import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_EMAILS } from '@/email/catalog';

const mocks = vi.hoisted(() => ({ api: vi.fn(), success: vi.fn(), error: vi.fn() }));

vi.mock('@/lib/api', () => ({ api: mocks.api, isApiError: () => false }));
vi.mock('@/lib/auth', () => ({ useSession: () => ({ user: { email: 'ada@example.com' } }) }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock('@tanstack/react-router', () => ({
    Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));

import { AdminEmailPage } from '../EmailPage';

describe('AdminEmailPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.api.mockImplementation(async (url: string) =>
            url === '/api/email/providers'
                ? { devTrap: { available: true, required: [], optional: [] } }
                : { results: [{ email: 'ada@example.com', ok: true, provider: 'dev-trap' }] },
        );
        render(<AdminEmailPage />);
    });

    it('shows every app email with its subject and a rendered preview', async () => {
        expect(screen.getAllByTitle(/ preview$/)).toHaveLength(APP_EMAILS.length);
        expect(screen.getByText('Reset your password')).toBeInTheDocument();
        expect(screen.getByTitle('Password reset preview')).toHaveAttribute(
            'srcdoc',
            expect.stringContaining('Reset password'),
        );
        expect(await screen.findByRole('link', { name: 'Open Dev mail' })).toHaveAttribute(
            'href',
            '/admin/infrastructure/dev-mail',
        );
    });

    it('sends one email to the signed-in admin and says so', async () => {
        await waitFor(() => expect(screen.getByLabelText('Recipients')).toHaveValue('ada@example.com'));
        fireEvent.click(screen.getAllByRole('button', { name: 'Send test' })[1]);
        await waitFor(() =>
            expect(mocks.api).toHaveBeenCalledWith('/api/email/test', {
                method: 'POST',
                body: { recipients: ['ada@example.com'], email: 'password-reset', provider: 'auto' },
            }),
        );
        await waitFor(() =>
            expect(mocks.success).toHaveBeenCalledWith('Sent "Password reset" to ada@example.com via dev-trap'),
        );
    });

    it('asks for a recipient before sending', async () => {
        await waitFor(() => expect(screen.getByLabelText('Recipients')).toHaveValue('ada@example.com'));
        fireEvent.change(screen.getByLabelText('Recipients'), { target: { value: '' } });
        fireEvent.click(screen.getAllByRole('button', { name: 'Send test' })[0]);
        expect(mocks.error).toHaveBeenCalledWith('Add a recipient first.');
        expect(mocks.api).not.toHaveBeenCalledWith('/api/email/test', expect.anything());
    });
});
