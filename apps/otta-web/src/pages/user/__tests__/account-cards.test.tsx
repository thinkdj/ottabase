import { OttaQueryProvider } from '@ottabase/ottaorm/client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActiveSessions } from '../ActiveSessions';
import { SignInMethods } from '../SignInMethods';

const { apiClient, toastSuccess, toastError } = vi.hoisted(() => ({
    apiClient: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
}));
vi.mock('@ottabase/ui-shadcn', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@ottabase/ui-shadcn')>()),
    toast: { success: toastSuccess, error: toastError },
}));

const scope = { appId: 'app', organizationId: null, principalId: 'u1' };
const wrap = (ui: React.ReactElement) =>
    render(
        <OttaQueryProvider apiClient={apiClient} visibilityScope={scope}>
            {ui}
        </OttaQueryProvider>,
    );

describe('ActiveSessions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.mockImplementation(async (url: string, options?: { method?: string }) => {
            if (url === '/api/users/me/sessions' && (!options?.method || options.method === 'GET')) {
                return {
                    data: [
                        {
                            id: 'here',
                            createdAt: 1_700_000_000_000,
                            userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/124.0 Safari/537.36',
                            current: true,
                        },
                        {
                            id: 'phone',
                            createdAt: 1_690_000_000_000,
                            userAgent: 'Mozilla/5.0 (iPhone) Safari/604.1',
                            current: false,
                        },
                    ],
                };
            }
            return { success: true };
        });
    });

    it('names each device, marks this one and signs the other out', async () => {
        wrap(<ActiveSessions />);
        expect(await screen.findByText('Chrome on Windows')).toBeInTheDocument();
        expect(screen.getByText('This device')).toBeInTheDocument();
        expect(screen.getByText('Safari on iPhone')).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Sign out' })).toHaveLength(1);

        fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
        await waitFor(() =>
            expect(apiClient).toHaveBeenCalledWith(
                '/api/users/me/sessions/phone',
                expect.objectContaining({ method: 'DELETE' }),
            ),
        );
        expect(toastSuccess).toHaveBeenCalledWith('Signed out');

        fireEvent.click(screen.getByRole('button', { name: 'Sign out other devices' }));
        await waitFor(() =>
            expect(apiClient).toHaveBeenCalledWith(
                '/api/users/me/sessions',
                expect.objectContaining({ method: 'DELETE' }),
            ),
        );
    });
});

describe('SignInMethods', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.mockImplementation(async (url: string, options?: { method?: string }) => {
            if (url === '/api/auth/config')
                return {
                    socialProviders: [
                        { id: 'github', name: 'GitHub' },
                        { id: 'google', name: 'Google' },
                    ],
                };
            if (options?.method === 'DELETE') return { success: true, linkedAccounts: [] };
            return {};
        });
    });

    it('offers the providers not yet connected and disconnects a connected one', async () => {
        const onChanged = vi.fn();
        wrap(
            <SignInMethods
                linkedAccounts={[{ provider: 'github', type: 'oauth', createdAt: 1_700_000_000_000 }]}
                hasPassword
                loading={false}
                onChanged={onChanged}
            />,
        );
        expect(screen.getByText('Email and password')).toBeInTheDocument();
        expect(await screen.findByRole('button', { name: 'Connect Google' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Connect GitHub' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
        await waitFor(() => expect(onChanged).toHaveBeenCalledWith([]));
        expect(apiClient).toHaveBeenCalledWith(
            '/api/users/me/accounts/github',
            expect.objectContaining({ method: 'DELETE' }),
        );
    });

    it('keeps the only way in connected', () => {
        wrap(
            <SignInMethods
                linkedAccounts={[{ provider: 'github', type: 'oauth', createdAt: null }]}
                hasPassword={false}
                loading={false}
                onChanged={vi.fn()}
            />,
        );
        expect(screen.getByRole('button', { name: 'Disconnect' })).toBeDisabled();
    });
});
