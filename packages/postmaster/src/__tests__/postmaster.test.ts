import type { Mailer } from '@ottabase/email';
import { createPackageRegistry, mountPackages } from '@ottabase/kernel';
import { Router } from '@ottabase/ottarouter';
import { describe, expect, it, vi } from 'vitest';
import {
    createInboundEmailHandler,
    createMemorySuppressionStore,
    createPostmasterPackage,
    createSuppressions,
    createUnsubscribe,
    parseRawEmail,
    parseResendEvent,
    parseSesNotification,
    plusTag,
    verifyResendSignature,
    type InboundMessageLike,
} from '../index';

const RAW = [
    'From: Ada Lovelace <ada@example.org>',
    'To: support+t0k3n@acme.test',
    'Cc: ops@acme.test',
    'Subject: Login broken',
    'Message-ID: <abc@example.org>',
    'In-Reply-To: <prev@acme.test>',
    'Date: Mon, 01 Jan 2024 10:00:00 +0000',
    'Content-Type: multipart/mixed; boundary="b1"',
    '',
    '--b1',
    'Content-Type: text/plain; charset=utf-8',
    '',
    'It says 500 after I click sign in.',
    '--b1',
    'Content-Type: text/plain; name="log.txt"',
    'Content-Disposition: attachment; filename="log.txt"',
    'Content-Transfer-Encoding: base64',
    '',
    btoa('line one'),
    '--b1--',
    '',
].join('\r\n');

function message(raw: string, to = 'support+t0k3n@acme.test'): InboundMessageLike & { rejected: string | null } {
    const bytes = new TextEncoder().encode(raw);
    const self = {
        from: 'ada@example.org',
        to,
        rawSize: bytes.byteLength,
        headers: new Headers(),
        raw: new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(bytes);
                controller.close();
            },
        }),
        rejected: null as string | null,
        setReject(reason: string) {
            self.rejected = reason;
        },
    };
    return self;
}

describe('inbound', () => {
    it('parses envelope, headers, parts, attachments and the plus tag into plain data', async () => {
        const mail = await parseRawEmail(RAW, { from: 'ada@example.org', to: 'support+t0k3n@acme.test' });
        expect(mail.from).toEqual({ address: 'ada@example.org', name: 'Ada Lovelace' });
        expect(mail.to.map((a) => a.address)).toEqual(['support+t0k3n@acme.test']);
        expect(mail.cc.map((a) => a.address)).toEqual(['ops@acme.test']);
        expect(mail.subject).toBe('Login broken');
        expect(mail.text?.trim()).toBe('It says 500 after I click sign in.');
        expect(mail.messageId).toBe('<abc@example.org>');
        expect(mail.inReplyTo).toBe('<prev@acme.test>');
        expect(mail.headers['message-id']).toBe('<abc@example.org>');
        expect(mail.attachments).toHaveLength(1);
        expect(mail.attachments[0].filename).toBe('log.txt');
        expect(new TextDecoder().decode(mail.attachments[0].content)).toBe('line one');
        expect(mail.tag).toBe('t0k3n');
        expect(plusTag('plain@acme.test')).toBeNull();
    });

    it('the Worker handler accepts listed mailboxes, hands the parsed mail over, and rejects the rest', async () => {
        const onMessage = vi.fn();
        const handler = createInboundEmailHandler<{ tag: string }>({ onMessage, accept: ['support@acme.test'] });
        const ctx = { waitUntil() {} };

        const ok = message(RAW, 'Support@acme.test');
        await handler(ok, { tag: 'env' }, ctx);
        expect(onMessage).toHaveBeenCalledTimes(1);
        expect(onMessage.mock.calls[0][0].subject).toBe('Login broken');
        expect(ok.rejected).toBeNull();

        const stranger = message(RAW, 'nobody@acme.test');
        await handler(stranger, { tag: 'env' }, ctx);
        expect(stranger.rejected).toBe('No such mailbox');
        expect(onMessage).toHaveBeenCalledTimes(1);
    });

    it('rejects oversize messages and failures in the handler, reporting the error', async () => {
        const onError = vi.fn();
        const handler = createInboundEmailHandler<Record<string, never>>({
            onMessage: () => {},
            onError,
            maxBytes: 10,
        });
        const big = message(RAW);
        await handler(big, {}, { waitUntil() {} });
        expect(big.rejected).toBe('Message could not be processed');
        expect(onError).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('exceeds') }),
            big,
        );

        const failing = createInboundEmailHandler<Record<string, never>>({
            onMessage: () => {
                throw new Error('db down');
            },
            onError,
        });
        const again = message(RAW);
        await failing(again, {}, { waitUntil() {} });
        expect(again.rejected).toBe('Message could not be processed');
    });
});

describe('suppressions', () => {
    it('records, checks per list (with * always applying), and guards a mailer', async () => {
        const store = createMemorySuppressionStore();
        const suppressions = createSuppressions(store);
        await suppressions.suppress('app', 'Bounced@Example.org', 'bounce', { source: 'resend' });
        await suppressions.suppress('app', 'tired@example.org', 'unsubscribe', { list: 'newsletter', source: 'link' });

        expect(await suppressions.isSuppressed('app', 'bounced@example.org')).toBe(true);
        expect(await suppressions.isSuppressed('app', 'tired@example.org')).toBe(false);
        expect(await suppressions.isSuppressed('app', 'tired@example.org', 'newsletter')).toBe(true);
        expect(await suppressions.isSuppressed('other-app', 'bounced@example.org')).toBe(false);

        const sent: unknown[] = [];
        const mailer: Mailer = {
            provider: 'fake',
            send: async (input) => (sent.push(input), { provider: 'fake', success: true }),
        };
        const guarded = suppressions.guard(mailer, 'app', 'newsletter');
        const base = { from: 'news@acme.test', subject: 'Hi', html: '<p>hi</p>' };

        expect(await guarded.send({ ...base, to: ['tired@example.org', 'Bounced@example.org'] })).toMatchObject({
            success: false,
            error: 'SUPPRESSED',
        });
        expect(sent).toHaveLength(0);
        await guarded.send({ ...base, to: ['tired@example.org', 'fresh@example.org'] });
        expect(sent[0]).toMatchObject({ to: 'fresh@example.org' });

        expect(await suppressions.unsuppress('app', 'tired@example.org', 'newsletter')).toBe(true);
        expect(await suppressions.isSuppressed('app', 'tired@example.org', 'newsletter')).toBe(false);
        expect(await suppressions.list('app')).toHaveLength(1);
    });
});

describe('unsubscribe', () => {
    const unsubscribe = createUnsubscribe({
        secret: 'a-very-long-secret-value',
        url: 'https://app.test/api/email/hooks/unsubscribe',
        mailto: 'unsub@acme.test',
    });
    const claims = { appId: 'app', address: 'Someone@Example.org', list: 'newsletter' };

    it('mints a signed link that verifies back to its claims and refuses tampering', async () => {
        const link = await unsubscribe.link(claims);
        const token = new URL(link).searchParams.get('token')!;
        expect(await unsubscribe.verify(token)).toEqual({
            appId: 'app',
            address: 'someone@example.org',
            list: 'newsletter',
        });
        expect(await unsubscribe.verify(token.slice(0, -2) + 'xx')).toBeNull();
        expect(await unsubscribe.verify(`${token.split('.')[0]}x.${token.split('.')[1]}`)).toBeNull();
        expect(await unsubscribe.verify(null)).toBeNull();
        expect(() => createUnsubscribe({ secret: 'short', url: 'https://x' })).toThrow(/at least 16/);
    });

    it('adds RFC 8058 one-click headers to a message', async () => {
        const mail = await unsubscribe.withHeaders({ headers: { 'X-Thing': '1' } }, claims);
        expect(mail.headers['X-Thing']).toBe('1');
        expect(mail.headers['List-Unsubscribe']).toMatch(
            /^<mailto:unsub@acme.test\?subject=unsubscribe>, <https:\/\/app.test\/api\/email\/hooks\/unsubscribe\?token=/,
        );
        expect(mail.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    });
});

describe('provider events', () => {
    it('normalises Resend bounces, complaints and the rest', () => {
        expect(
            parseResendEvent({
                type: 'email.bounced',
                data: { email_id: 'e1', to: ['A@x.test'], bounce: { type: 'Permanent' } },
            }),
        ).toEqual({
            provider: 'resend',
            type: 'bounce',
            raw: 'email.bounced',
            addresses: ['a@x.test'],
            bounce: 'hard',
            messageId: 'e1',
        });
        expect(
            parseResendEvent({ type: 'email.bounced', data: { to: 'a@x.test', bounce: { type: 'Transient' } } })
                ?.bounce,
        ).toBe('soft');
        expect(parseResendEvent({ type: 'email.complained', data: { to: ['a@x.test'] } })?.type).toBe('complaint');
        expect(parseResendEvent({ type: 'email.opened', data: { to: ['a@x.test'] } })?.type).toBe('other');
        expect(parseResendEvent({ nope: true })).toBeNull();
    });

    it('verifies Svix signatures with the whsec secret, within the time window', async () => {
        const secret = `whsec_${btoa('0123456789abcdef0123456789abcdef')}`;
        const body = JSON.stringify({ type: 'email.delivered', data: { to: ['a@x.test'] } });
        const id = 'msg_1';
        const now = 1_700_000_000_000;
        const timestamp = String(Math.floor(now / 1000));
        const key = await crypto.subtle.importKey(
            'raw',
            Uint8Array.from(atob(secret.slice(6)), (c) => c.charCodeAt(0)),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign'],
        );
        const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
        const signature = `v1,${btoa(String.fromCharCode(...new Uint8Array(digest)))}`;
        const headers = new Headers({
            'svix-id': id,
            'svix-timestamp': timestamp,
            'svix-signature': `v1,bogus ${signature}`,
        });

        expect(await verifyResendSignature({ headers }, body, secret, now)).toBe(true);
        expect(await verifyResendSignature({ headers }, body + ' ', secret, now)).toBe(false);
        expect(await verifyResendSignature({ headers }, body, secret, now + 10 * 60_000)).toBe(false);
        expect(await verifyResendSignature({ headers: new Headers() }, body, secret, now)).toBe(false);
    });

    it('unwraps SNS envelopes for SES: subscription, bounce, complaint, delivery', () => {
        expect(
            parseSesNotification({
                Type: 'SubscriptionConfirmation',
                SubscribeURL: 'https://sns/confirm',
                TopicArn: 'arn:1',
            }),
        ).toEqual({ kind: 'subscribe', subscribeUrl: 'https://sns/confirm', topicArn: 'arn:1' });
        const bounce = parseSesNotification({
            Type: 'Notification',
            Message: JSON.stringify({
                notificationType: 'Bounce',
                bounce: { bounceType: 'Permanent', bouncedRecipients: [{ emailAddress: 'Gone@x.test' }] },
                mail: { messageId: 'm1' },
            }),
        });
        expect(bounce).toEqual({
            kind: 'event',
            event: {
                provider: 'ses',
                type: 'bounce',
                raw: 'Bounce',
                addresses: ['gone@x.test'],
                bounce: 'hard',
                messageId: 'm1',
            },
        });
        expect(
            parseSesNotification({
                Type: 'Notification',
                Message: JSON.stringify({
                    notificationType: 'Complaint',
                    complaint: { complainedRecipients: [{ emailAddress: 'angry@x.test' }] },
                }),
            }),
        ).toMatchObject({ kind: 'event', event: { type: 'complaint', addresses: ['angry@x.test'] } });
        expect(parseSesNotification({ Type: 'Notification', Message: 'not json' })).toEqual({
            kind: 'ignore',
            reason: 'Message is not JSON',
        });
        expect(parseSesNotification(null).kind).toBe('ignore');
    });
});

describe('routes and package', () => {
    type Env = { RESEND_WEBHOOK_SECRET?: string; UNSUB?: boolean };
    const secret = `whsec_${btoa('0123456789abcdef0123456789abcdef')}`;

    async function signed(body: string, now: number) {
        const key = await crypto.subtle.importKey(
            'raw',
            Uint8Array.from(atob(secret.slice(6)), (c) => c.charCodeAt(0)),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign'],
        );
        const timestamp = String(Math.floor(now / 1000));
        const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`id.${timestamp}.${body}`));
        return new Headers({
            'svix-id': 'id',
            'svix-timestamp': timestamp,
            'svix-signature': `v1,${btoa(String.fromCharCode(...new Uint8Array(digest)))}`,
            'content-type': 'application/json',
        });
    }

    function build() {
        const store = createMemorySuppressionStore();
        const suppressions = createSuppressions(store);
        const unsubscribe = createUnsubscribe({
            secret: 'a-very-long-secret-value',
            url: 'https://app.test/api/email/hooks/unsubscribe',
        });
        const onProviderEvent = vi.fn();
        const onUnsubscribe = vi.fn();
        const fetchImpl = vi.fn(async () => new Response('ok')) as unknown as typeof fetch;
        const pkg = createPostmasterPackage<Env>({
            appId: () => 'app',
            suppressions,
            unsubscribe: (env) => (env.UNSUB === false ? null : unsubscribe),
            resend: { webhookSecret: (env) => env.RESEND_WEBHOOK_SECRET },
            ses: { pathSecret: () => 'sesSecret' },
            onProviderEvent,
            onUnsubscribe,
            fetchImpl,
        });
        const router = new Router<Env>();
        mountPackages(router, { packages: createPackageRegistry({ packages: [pkg] }) });
        return { router, store, suppressions, unsubscribe, onProviderEvent, onUnsubscribe, fetchImpl, pkg };
    }

    it('records a signed Resend hard bounce as a suppression and refuses bad signatures', async () => {
        const { router, suppressions, onProviderEvent } = build();
        const body = JSON.stringify({
            type: 'email.bounced',
            data: { to: ['gone@x.test'], bounce: { type: 'Permanent' } },
        });
        const env = { RESEND_WEBHOOK_SECRET: secret };
        const good = await router.handle(
            new Request('https://app.test/api/email/hooks/resend', {
                method: 'POST',
                body,
                headers: await signed(body, Date.now()),
            }),
            env,
        );
        expect(good?.status).toBe(200);
        expect(await suppressions.isSuppressed('app', 'gone@x.test')).toBe(true);
        expect(onProviderEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'bounce' }), env);

        const bad = await router.handle(
            new Request('https://app.test/api/email/hooks/resend', {
                method: 'POST',
                body,
                headers: new Headers({ 'svix-id': 'x', 'svix-timestamp': '1', 'svix-signature': 'v1,nope' }),
            }),
            env,
        );
        expect(bad?.status).toBe(401);
        expect(
            (await router.handle(new Request('https://app.test/api/email/hooks/resend', { method: 'POST', body }), {}))
                ?.status,
        ).toBe(503);
    });

    it('confirms an SNS subscription, records SES complaints, and hides the route behind the path secret', async () => {
        const { router, suppressions, fetchImpl } = build();
        const post = (path: string, body: unknown) =>
            new Request(`https://app.test/api/email/hooks${path}`, {
                method: 'POST',
                body: JSON.stringify(body),
                headers: { 'content-type': 'application/json' },
            });
        expect((await router.handle(post('/ses/wrong', { Type: 'Notification' }), {}))?.status).toBe(404);
        expect(
            (
                await router.handle(
                    post('/ses/sesSecret', { Type: 'SubscriptionConfirmation', SubscribeURL: 'https://sns/confirm' }),
                    {},
                )
            )?.status,
        ).toBe(200);
        expect(fetchImpl).toHaveBeenCalledWith('https://sns/confirm');
        await router.handle(
            post('/ses/sesSecret', {
                Type: 'Notification',
                Message: JSON.stringify({
                    notificationType: 'Complaint',
                    complaint: { complainedRecipients: [{ emailAddress: 'angry@x.test' }] },
                }),
            }),
            {},
        );
        expect(await suppressions.isSuppressed('app', 'angry@x.test')).toBe(true);
    });

    it('an unsubscribe link records the list suppression for the token, GET or one-click POST', async () => {
        const { router, suppressions, unsubscribe, onUnsubscribe } = build();
        const link = await unsubscribe.link({ appId: 'app', address: 'tired@x.test', list: 'newsletter' });
        const response = await router.handle(new Request(link, { method: 'POST' }), {});
        expect(response?.status).toBe(200);
        expect(await response?.text()).toContain('unsubscribed from newsletter');
        expect(await suppressions.isSuppressed('app', 'tired@x.test', 'newsletter')).toBe(true);
        expect(await suppressions.isSuppressed('app', 'tired@x.test', 'other-list')).toBe(false);
        expect(onUnsubscribe).toHaveBeenCalledTimes(1);

        const foreign = await createUnsubscribe({
            secret: 'a-very-long-secret-value',
            url: 'https://app.test/api/email/hooks/unsubscribe',
        }).link({ appId: 'other', address: 'x@x.test', list: '*' });
        expect((await router.handle(new Request(foreign), {}))?.status).toBe(400);
        expect(
            (await router.handle(new Request('https://app.test/api/email/hooks/unsubscribe?token=garbage'), {}))
                ?.status,
        ).toBe(400);
        expect((await router.handle(new Request(link), { UNSUB: false }))?.status).toBe(503);
    });

    it('is a kernel package with its table, model and policy', () => {
        const { pkg } = build();
        expect(Object.keys(pkg.tables!)).toEqual(['emailSuppressionsTable']);
        expect(pkg.policies?.[0].model).toBe('email_suppressions');
        expect(pkg.env?.optional?.map((k) => (typeof k === 'string' ? k : k.key))).toContain(
            'EMAIL_RESEND_WEBHOOK_SECRET',
        );
    });
});
