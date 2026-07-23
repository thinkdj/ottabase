// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import React, { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession, signOut } = vi.hoisted(() => ({
    getSession: vi.fn(),
    signOut: vi.fn(),
}));

vi.mock('../client-api', () => ({ getSession, signOut }));

import { useSession, useSessionBootstrap } from '../react-hooks';

function SessionProbe() {
    const { user } = useSession();
    return <output>{user?.email ?? 'anonymous'}</output>;
}

function SessionBootstrapProbe() {
    useSessionBootstrap();
    return null;
}

describe('session synchronization', () => {
    beforeEach(() => {
        getSession.mockReset();
        signOut.mockReset();
        localStorage.clear();
    });

    it('keeps useSession side-effect free until the explicit bootstrap runs', async () => {
        render(<SessionProbe />);

        await Promise.resolve();

        expect(getSession).not.toHaveBeenCalled();
    });

    it('delivers the bootstrap result after React Strict Mode re-runs effects', async () => {
        let resolveSession: (session: { user: { id: string; email: string }; expires: number }) => void;
        getSession.mockReturnValue(
            new Promise<{ user: { id: string; email: string }; expires: number }>((resolve) => {
                resolveSession = resolve;
            }),
        );

        render(
            <StrictMode>
                <SessionBootstrapProbe />
                <SessionProbe />
            </StrictMode>,
        );

        await waitFor(() => expect(getSession).toHaveBeenCalledOnce());
        resolveSession!({ user: { id: 'user-1', email: 'owner@example.com' }, expires: Date.now() + 60_000 });

        await waitFor(() => expect(screen.getByRole('status').textContent).toBe('owner@example.com'));
    });
});
