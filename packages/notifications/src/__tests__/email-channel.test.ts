import { describe, expect, it, vi } from 'vitest';
import { EmailChannel } from '../channels/email';

async function renderAction(actionUrl: string) {
    const send = vi.fn(async () => ({ success: true, id: 'm1' }));
    const channel = new EmailChannel({ mailer: { send } as never, from: 'noreply@example.com' });
    await channel.send({
        recipient: { userId: 'u1', email: 'u1@example.com' },
        payload: { title: 'T', message: 'M', actionUrl, actionText: 'Open' },
    });
    return (send.mock.calls[0] as unknown as [{ html: string }])[0].html;
}

describe('EmailChannel action link', () => {
    it('keeps safe absolute and relative links', async () => {
        expect(await renderAction('https://example.com/a')).toContain('href="https://example.com/a"');
        expect(await renderAction('/dashboard')).toContain('href="/dashboard"');
    });

    it('drops javascript: and protocol-relative links', async () => {
        for (const url of ['javascript:alert(1)', '//evil.com', '/\\evil.com']) {
            expect(await renderAction(url)).not.toContain('href=');
        }
    });
});
