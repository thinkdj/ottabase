// @vitest-environment jsdom
// The lead form's bot check in a real DOM: the widget sits above the button, the site key comes
// from the layout's meta tag, and the submit carries the token. The rest of the package runs in node.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const turnstile = vi.hoisted(() => ({ useTurnstile: vi.fn(), headers: vi.fn() }));
vi.mock('@ottabase/ui/turnstile', () => ({
    turnstileSiteKey: () => document.querySelector<HTMLMetaElement>('meta[name="turnstile-site-key"]')?.content ?? null,
    useTurnstile: turnstile.useTurnstile,
}));
const api = vi.hoisted(() => vi.fn());
vi.mock('@ottabase/api', async (importOriginal) => ({ ...(await importOriginal<object>()), api }));

import { LeadForm } from '../react/lead-form';

const classes = { input: 'in', button: 'btn', label: 'lbl', note: 'note', error: 'err' };

function setup(wrap = (form: React.ReactElement) => form) {
    const meta = document.createElement('meta');
    meta.name = 'turnstile-site-key';
    meta.content = 'site-key';
    document.head.appendChild(meta);
    turnstile.headers.mockResolvedValue({ 'X-Turnstile-Token': 'tok' });
    turnstile.useTurnstile.mockImplementation((_action: string, { siteKey }: { siteKey: string | null }) => ({
        enabled: !!siteKey,
        widget: siteKey ? <div data-testid="bot-check" /> : null,
        headers: turnstile.headers,
        error: null,
    }));
    render(wrap(<LeadForm kind="signup" classes={classes} />));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'fan@example.com' } });
}

afterEach(() => {
    cleanup();
    document.head.innerHTML = '';
    vi.clearAllMocks();
});

describe('LeadForm bot check', () => {
    it('renders the widget above the button with the meta site key, and sends its token', async () => {
        api.mockResolvedValue({ ok: true });
        setup();
        const widget = await screen.findByTestId('bot-check');
        const button = screen.getByRole('button');
        expect(widget.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(turnstile.useTurnstile).toHaveBeenLastCalledWith('lead', { siteKey: 'site-key' });

        fireEvent.click(button);
        await screen.findByRole('status');
        expect(turnstile.headers).toHaveBeenCalledTimes(1);
        expect(api).toHaveBeenCalledWith(
            '/api/leads',
            expect.objectContaining({ headers: { 'X-Turnstile-Token': 'tok' } }),
        );
    });

    it('renders no widget inside an inert admin preview', async () => {
        setup((form) => <div inert>{form}</div>);
        await waitFor(() => expect(turnstile.useTurnstile).toHaveBeenCalled());
        expect(turnstile.useTurnstile).toHaveBeenLastCalledWith('lead', { siteKey: null });
        expect(screen.queryByTestId('bot-check')).toBeNull();
    });

    it("shows the server's refusal as the form's error", async () => {
        api.mockRejectedValue(new Error('Please complete the bot check and try again.'));
        setup();
        fireEvent.click(screen.getByRole('button'));
        await waitFor(() =>
            expect(screen.getByRole('alert').textContent).toBe('Please complete the bot check and try again.'),
        );
    });
});
