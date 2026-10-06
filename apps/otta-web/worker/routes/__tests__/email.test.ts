/**
 * The test endpoint sends one catalogue email, rendered from its sample, to each recipient.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Sent = { to: string; subject: string; html: string };
const mocks = vi.hoisted(() => ({
    send: vi.fn(async (_message: Sent) => ({
        success: true,
        provider: 'dev-trap',
    })),
}));

vi.mock('../../lib/admin-guard', () => ({ requireAdminAccess: vi.fn(async () => ({ user: { id: 'u1' } })) }));
vi.mock('../../lib/email-provider', () => ({
    isDevTrapAvailable: () => true,
    resolveAppMailer: vi.fn(async () => ({
        mailer: { provider: 'dev-trap', send: mocks.send },
        from: 'Ottabase <no-reply@example.com>',
        provider: 'dev-trap',
    })),
}));

import { handleEmailTest } from '../email';

const context = (body: unknown) =>
    ({
        request: new Request('http://x/api/email/test', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'content-type': 'application/json' },
        }),
        env: {},
        url: new URL('http://x/api/email/test'),
    }) as never;

describe('handleEmailTest', () => {
    beforeEach(() => mocks.send.mockClear());

    it('sends the chosen email, rendered from its sample, to every recipient', async () => {
        const res = await handleEmailTest(
            context({ recipients: ['a@example.com', 'b@example.com'], email: 'password-reset' }),
        );
        expect(res.status).toBe(200);
        const json = (await res.json()) as { email: string; results: { email: string; ok: boolean }[] };
        expect(json.email).toBe('password-reset');
        expect(json.results.map((r) => r.email)).toEqual(['a@example.com', 'b@example.com']);
        expect(mocks.send).toHaveBeenCalledTimes(2);
        const sent: Sent = mocks.send.mock.calls[0][0];
        expect(sent.to).toBe('a@example.com');
        expect(sent.subject).toBe('Reset your password');
        expect(sent.html).toContain('reset-password?token=sample');
        expect(sent.html).not.toContain('{{');
    });

    it('refuses an unknown email and an empty recipient list', async () => {
        expect((await handleEmailTest(context({ recipients: ['a@example.com'], email: 'nope' }))).status).toBe(400);
        expect((await handleEmailTest(context({ recipients: [] }))).status).toBe(400);
        expect(mocks.send).not.toHaveBeenCalled();
    });
});
