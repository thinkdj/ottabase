import { describe, expect, it, vi } from 'vitest';
import type { Mailer, SendEmailInput } from '@ottabase/email';

vi.mock('@ottabase/ottaorm', () => ({ registerConnection: vi.fn() }));
vi.mock('@ottabase/db/drizzle-d1', () => ({ createD1Driver: vi.fn() }));
vi.mock('@ottabase/ottaorm/models', () => ({ User: { findByEmail: vi.fn() } }));

import { holdMailToStrangers, resolveAppMailer } from '../email-provider';

const message = (to: SendEmailInput['to'], extra: Partial<SendEmailInput> = {}): SendEmailInput => ({
    from: 'noreply@example.com',
    to,
    subject: 'Hi',
    html: '<p>Hi</p>',
    ...extra,
});

function setup(accounts: string[]) {
    const real: Mailer = { provider: 'resend', send: vi.fn(async () => ({ provider: 'resend', success: true })) };
    const store = { storeMessage: vi.fn(async () => undefined) };
    const isAccount = vi.fn(async (email: string) => accounts.includes(email));
    return { real, store, isAccount, guarded: holdMailToStrangers(real, store, isAccount) };
}

describe('holdMailToStrangers (DEMO_MODE mail policy)', () => {
    it('delivers when every recipient holds an account, matching addresses case-insensitively', async () => {
        const { real, store, guarded } = setup(['ada@example.com', 'bob@example.com']);

        const result = await guarded.send(
            message({ email: 'Ada@Example.com', name: 'Ada' }, { cc: 'bob@example.com' }),
        );

        expect(result.success).toBe(true);
        expect(real.send).toHaveBeenCalledOnce();
        expect(store.storeMessage).not.toHaveBeenCalled();
    });

    it('holds the whole message when any recipient (to, cc or bcc) is a stranger', async () => {
        const { real, store, guarded } = setup(['ada@example.com']);

        const result = await guarded.send(message('ada@example.com', { bcc: ['stranger@example.org'] }));

        expect(real.send).not.toHaveBeenCalled();
        expect(store.storeMessage).toHaveBeenCalledOnce();
        // Reported as sent, so queued senders do not retry a held message forever.
        expect(result.success).toBe(true);
    });

    it('holds the mail when the account lookup fails', async () => {
        const real: Mailer = { provider: 'resend', send: vi.fn() };
        const guarded = holdMailToStrangers(real, null, async () => {
            throw new Error('D1 down');
        });

        const result = await guarded.send(message('ada@example.com'));

        expect(real.send).not.toHaveBeenCalled();
        expect(result).toEqual({ provider: 'demo-held', success: true });
    });
});

describe('resolveAppMailer', () => {
    const resendEnv = { EMAIL_RESEND_API_KEY: 're_test', EMAIL_FROM: 'noreply@example.com' } as any;

    it('returns the bare transport on a normal deploy', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(new Response(JSON.stringify({ id: 'msg-1' }), { status: 200 }));
        const { mailer, provider } = await resolveAppMailer(resendEnv);

        await mailer!.send(message('stranger@example.org'));

        expect(provider).toBe('resend');
        expect(fetchSpy).toHaveBeenCalledOnce();
        fetchSpy.mockRestore();
    });

    it('wraps the transport on a public demo, so a stranger is never mailed', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const { mailer } = await resolveAppMailer({ ...resendEnv, DEMO_MODE: 'true' });

        // No D1 binding means no account can be confirmed: the message is held, nothing is fetched.
        const result = await mailer!.send(message('stranger@example.org'));

        expect(result).toEqual({ provider: 'demo-held', success: true });
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });
});
