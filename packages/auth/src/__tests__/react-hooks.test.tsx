// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import React, { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession, signOut } = vi.hoisted(() => ({
    getSession: vi.fn(),
    signOut: vi.fn(),
}));

vi.mock('../client-api', () => ({ getSession, signOut }));

import type { SessionFetchResult } from '../client-api';
import { AUTH_STORAGE_KEY, invalidateAuthSession, useSession, useSessionBootstrap } from '../react-hooks';

function SessionProbe() {
    const { user } = useSession();
    return <output>{user?.email ?? 'anonymous'}</output>;
}

function SessionBootstrapProbe() {
    useSessionBootstrap();
    return null;
}

function SessionControls() {
    const { refreshSession, sessionError, user } = useSession();
    return (
        <>
            <output>{user?.email ?? 'anonymous'}</output>
            <span>{sessionError?.state ?? 'available'}</span>
            <button onClick={() => void refreshSession()}>refresh</button>
        </>
    );
}

function RefreshThenPatchProbe() {
    const { refreshSession, updateUser, user } = useSession();
    const timezone = typeof user?.timezone === 'string' ? user.timezone : 'unset';

    const refreshThenPatch = async () => {
        await refreshSession();
        updateUser({ timezone: 'Asia/Kolkata' });
    };

    return (
        <>
            <output>{`${user?.email ?? 'anonymous'}|${timezone}`}</output>
            <button onClick={() => void refreshThenPatch()}>refresh then patch</button>
        </>
    );
}

function renderWithStore(children: React.ReactNode) {
    return render(<Provider store={createStore()}>{children}</Provider>);
}

describe('session synchronization', () => {
    beforeEach(() => {
        getSession.mockReset();
        signOut.mockReset();
        localStorage.clear();
    });

    it('keeps useSession side-effect free until the explicit bootstrap runs', async () => {
        renderWithStore(<SessionProbe />);

        await Promise.resolve();

        expect(getSession).not.toHaveBeenCalled();
    });

    it('delivers the bootstrap result after React Strict Mode re-runs effects', async () => {
        let resolveSession: (result: {
            state: 'authenticated';
            session: { user: { id: string; email: string }; expires: number };
        }) => void;
        getSession.mockReturnValue(
            new Promise<{ state: 'authenticated'; session: { user: { id: string; email: string }; expires: number } }>(
                (resolve) => {
                    resolveSession = resolve;
                },
            ),
        );

        renderWithStore(
            <StrictMode>
                <SessionBootstrapProbe />
                <SessionProbe />
            </StrictMode>,
        );

        await waitFor(() => expect(getSession).toHaveBeenCalledOnce());
        resolveSession!({
            state: 'authenticated',
            session: { user: { id: 'user-1', email: 'owner@example.com' }, expires: Date.now() + 60_000 },
        });

        await waitFor(() => expect(screen.getByRole('status').textContent).toBe('owner@example.com'));
    });

    it('lets only the causally newest refresh commit', async () => {
        getSession.mockResolvedValueOnce({
            state: 'authenticated',
            session: { user: { id: 'user-1', email: 'initial@example.com' }, expires: Date.now() + 60_000 },
        });

        let resolveOlder!: (result: SessionFetchResult) => void;
        let resolveNewer!: (result: SessionFetchResult) => void;
        const older = new Promise<SessionFetchResult>((resolve) => {
            resolveOlder = resolve;
        });
        const newer = new Promise<SessionFetchResult>((resolve) => {
            resolveNewer = resolve;
        });
        getSession.mockReturnValueOnce(older).mockReturnValueOnce(newer);

        renderWithStore(
            <>
                <SessionBootstrapProbe />
                <SessionControls />
            </>,
        );
        await waitFor(() => expect(screen.getByRole('status').textContent).toBe('initial@example.com'));

        fireEvent.click(screen.getByRole('button', { name: 'refresh' }));
        fireEvent.click(screen.getByRole('button', { name: 'refresh' }));
        resolveNewer({
            state: 'authenticated',
            session: { user: { id: 'user-1', email: 'new@example.com' }, expires: Date.now() + 60_000 },
        });
        await waitFor(() => expect(screen.getByRole('status').textContent).toBe('new@example.com'));

        resolveOlder({
            state: 'authenticated',
            session: { user: { id: 'user-1', email: 'stale@example.com' }, expires: Date.now() + 60_000 },
        });
        await Promise.resolve();
        expect(screen.getByRole('status').textContent).toBe('new@example.com');
    });

    it('merges an update made after refresh into the newly confirmed session', async () => {
        getSession
            .mockResolvedValueOnce({
                state: 'authenticated',
                session: { user: { id: 'user-1', email: 'initial@example.com' }, expires: Date.now() + 60_000 },
            })
            .mockResolvedValueOnce({
                state: 'authenticated',
                session: { user: { id: 'user-1', email: 'refreshed@example.com' }, expires: Date.now() + 60_000 },
            });

        renderWithStore(
            <>
                <SessionBootstrapProbe />
                <RefreshThenPatchProbe />
            </>,
        );
        await waitFor(() => expect(screen.getByRole('status').textContent).toBe('initial@example.com|unset'));

        fireEvent.click(screen.getByRole('button', { name: 'refresh then patch' }));

        await waitFor(() => expect(screen.getByRole('status').textContent).toBe('refreshed@example.com|Asia/Kolkata'));
    });

    it('retains the last confirmed session when revalidation is unavailable', async () => {
        getSession
            .mockResolvedValueOnce({
                state: 'authenticated',
                session: { user: { id: 'user-1', email: 'known@example.com' }, expires: Date.now() + 60_000 },
            })
            .mockResolvedValueOnce({
                state: 'unavailable',
                reason: 'network',
                message: 'Network down',
            });

        renderWithStore(
            <>
                <SessionBootstrapProbe />
                <SessionControls />
            </>,
        );
        await waitFor(() => expect(screen.getByRole('status').textContent).toBe('known@example.com'));

        fireEvent.click(screen.getByRole('button', { name: 'refresh' }));

        await waitFor(() => expect(screen.getByText('unavailable')).toBeTruthy());
        expect(screen.getByRole('status').textContent).toBe('known@example.com');
    });

    it('clears mounted session state when an external 401 invalidates auth', async () => {
        getSession.mockResolvedValueOnce({
            state: 'authenticated',
            session: { user: { id: 'user-1', email: 'known@example.com' }, expires: Date.now() + 60_000 },
        });

        renderWithStore(
            <>
                <SessionBootstrapProbe />
                <SessionProbe />
            </>,
        );
        await waitFor(() => expect(screen.getByRole('status').textContent).toBe('known@example.com'));
        expect(localStorage.getItem(AUTH_STORAGE_KEY)).not.toBeNull();

        act(() => invalidateAuthSession());

        await waitFor(() => expect(screen.getByRole('status').textContent).toBe('anonymous'));
        expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    });
});
