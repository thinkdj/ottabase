// ============================================================
// Channel types: what the console accepts, and what each service is sent.
// Every alert is untrusted text; these pin that no renderer lets it become markup, a
// mention or a redirect.
// ============================================================

import { verifySignatureHeader } from '@ottabase/utils/hmac-signature';
import { describe, expect, it } from 'vitest';
import {
    ChannelInputError,
    batchTitle,
    buildRequest,
    judgeResponse,
    parseChannelTarget,
    renderMail,
    type Outbound,
    type RenderContext,
} from '../channels';
import type { Alert } from '../types';
import { DISCORD_URL, PAGERDUTY_KEY, SLACK_URL, TELEGRAM_TOKEN } from './harness';

const NOW = Date.UTC(2026, 9, 27, 9, 30);
const ctx: RenderContext = {
    appName: 'Acme',
    consoleUrl: 'https://acme.test/admin/infrastructure/alerts',
    deliveryId: 'd1',
    now: NOW,
};

const alert = (over: Partial<Alert> = {}): Alert => ({
    id: 'a1',
    key: 'blackbox:i1',
    source: 'blackbox',
    kind: 'issue.new',
    severity: 'warning',
    status: 'firing',
    title: 'TypeError: x is undefined',
    body: 'at handler (worker.js:10:5)',
    url: 'https://acme.test/admin/infrastructure/blackbox?issue=i1',
    fields: [{ label: 'Release', value: 'v1.2.3' }],
    heldBefore: 0,
    raisedAt: NOW,
    ...over,
});
const one = (over: Partial<Alert> = {}): Outbound => ({ kind: 'alert', alert: alert(over) });
const json = (init: RequestInit) => JSON.parse(String(init.body));

describe('parseChannelTarget', () => {
    it('takes email recipients as a list or a string, deduplicated and lowercased', () => {
        const parsed = parseChannelTarget('email', { to: 'Ops@Acme.test, ops@acme.test; cto@acme.test' });
        expect(parsed.config.to).toEqual(['ops@acme.test', 'cto@acme.test']);
        expect(parsed.secrets).toEqual({});
        expect(() => parseChannelTarget('email', { to: 'nope' })).toThrow(ChannelInputError);
        expect(() => parseChannelTarget('email', { to: [] })).toThrow('Add at least one recipient');
    });

    it('pins Slack and Discord to their hosts', () => {
        expect(parseChannelTarget('slack', { url: SLACK_URL }).hint).toBe('hooks.slack.com/…/ijkl');
        expect(() => parseChannelTarget('slack', { url: 'https://evil.test/services/x' })).toThrow(/hooks.slack.com/);
        expect(() => parseChannelTarget('slack', { url: 'http://hooks.slack.com/services/x' })).toThrow(/https/);
        expect(parseChannelTarget('discord', { url: DISCORD_URL }).secrets.url).toBe(DISCORD_URL);
        expect(() => parseChannelTarget('discord', { url: 'https://discord.com/channels/1' })).toThrow(/api\/webhooks/);
    });

    it('checks a Telegram token and chat id', () => {
        const parsed = parseChannelTarget('telegram', { botToken: TELEGRAM_TOKEN, chatId: '-1001234' });
        expect(parsed).toMatchObject({ config: { chatId: '-1001234' }, secrets: { botToken: TELEGRAM_TOKEN } });
        expect(() => parseChannelTarget('telegram', { botToken: 'x', chatId: '1' })).toThrow(/BotFather/);
        expect(() => parseChannelTarget('telegram', { botToken: TELEGRAM_TOKEN, chatId: 'ops' })).toThrow(/chat id/);
    });

    it('checks a PagerDuty key and never shows it whole', () => {
        const parsed = parseChannelTarget('pagerduty', { routingKey: PAGERDUTY_KEY });
        expect(parsed.hint).toBe('integration key …1234');
        expect(parsed.hint).not.toContain(PAGERDUTY_KEY);
        expect(() => parseChannelTarget('pagerduty', { routingKey: 'short' })).toThrow(ChannelInputError);
    });

    it('holds a generic webhook to the public-URL policy and issues a signing secret', () => {
        const parsed = parseChannelTarget('webhook', { url: 'https://hooks.acme.test/alerts?token=abc' });
        expect(parsed.secrets.signingSecret).toMatch(/^alsec_[0-9a-f]{64}$/);
        expect(parsed.hint).toBe('hooks.acme.test/…');
        expect(() => parseChannelTarget('webhook', { url: 'https://169.254.169.254/x' })).toThrow(
            'Webhook URLs must point at a public host',
        );
        expect(() => parseChannelTarget('webhook', { url: 'https://acme.test', signingSecret: 'short' })).toThrow(
            /16 characters/,
        );
    });

    it('keeps what a change leaves out, and rotates the signing secret when asked', () => {
        const first = parseChannelTarget('webhook', { url: 'https://hooks.acme.test/a' });
        const existing = { config: first.config, secrets: first.secrets };
        const same = parseChannelTarget('webhook', {}, existing);
        expect(same.secrets).toEqual(first.secrets);
        const rotated = parseChannelTarget('webhook', { rotateSigningSecret: true }, existing);
        expect(rotated.secrets.url).toBe(first.secrets.url);
        expect(rotated.secrets.signingSecret).not.toBe(first.secrets.signingSecret);
        const kept = parseChannelTarget(
            'telegram',
            { chatId: '42' },
            { config: { chatId: '1' }, secrets: { botToken: TELEGRAM_TOKEN } },
        );
        expect(kept).toMatchObject({ config: { chatId: '42' }, secrets: { botToken: TELEGRAM_TOKEN } });
    });
});

describe('rendering', () => {
    it('Slack: escaped mrkdwn, no unfurling, a button to the link', async () => {
        const { url, init } = await buildRequest(
            'slack',
            { url: SLACK_URL },
            {},
            one({ body: '<!channel> look <https://evil.test|here> & now' }),
            ctx,
        );
        expect(url).toBe(SLACK_URL);
        expect(init.redirect).toBe('manual');
        const body = json(init);
        expect(body.unfurl_links).toBe(false);
        const text = JSON.stringify(body.blocks);
        expect(text).not.toContain('<!channel>');
        expect(text).toContain('&lt;!channel&gt;');
        expect(text).toContain('&amp; now');
        expect(body.blocks[0].text.text).toBe('🟠 TypeError: x is undefined');
        expect(body.blocks.at(-1).elements[0].url).toBe(alert().url);
    });

    it('Slack: the notification text is escaped too, so a title cannot page the room', async () => {
        const { init } = await buildRequest('slack', { url: SLACK_URL }, {}, one({ title: '<!channel> down' }), ctx);
        expect(json(init).text).toBe('🟠 &lt;!channel&gt; down');
    });

    it('Slack: a resolve reads as resolved', async () => {
        const { init } = await buildRequest('slack', { url: SLACK_URL }, {}, one({ status: 'resolved' }), ctx);
        expect(json(init).blocks[0].text.text).toBe('✅ Resolved: TypeError: x is undefined');
    });

    it('Discord: never pings, and markdown links stay text', async () => {
        const { init } = await buildRequest(
            'discord',
            { url: DISCORD_URL },
            {},
            one({ body: '@everyone [click](https://evil.test)', severity: 'critical' }),
            ctx,
        );
        const body = json(init);
        expect(body.allowed_mentions).toEqual({ parse: [] });
        expect(body.embeds[0].description).toBe('@everyone \\[click\\]\\(https://evil.test\\)');
        expect(body.embeds[0].color).toBe(0xe5484d);
        expect(body.username).toBe('Acme alerts');
    });

    it('Telegram: HTML-escaped, previews off', async () => {
        const { url, init } = await buildRequest(
            'telegram',
            { botToken: TELEGRAM_TOKEN },
            { chatId: '-100' },
            one({ title: '<b>bold</b> & "quoted"' }),
            ctx,
        );
        expect(url).toBe(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`);
        const body = json(init);
        expect(body).toMatchObject({
            chat_id: '-100',
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
        });
        expect(body.text).toContain('&lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot;');
    });

    it('PagerDuty: trigger and resolve share the dedup key', async () => {
        const trigger = json(
            (await buildRequest('pagerduty', { routingKey: PAGERDUTY_KEY }, {}, one({ severity: 'critical' }), ctx))
                .init,
        );
        expect(trigger).toMatchObject({
            routing_key: PAGERDUTY_KEY,
            event_action: 'trigger',
            dedup_key: 'blackbox:i1',
            payload: { severity: 'critical', source: 'Acme', component: 'blackbox', class: 'issue.new' },
        });
        const resolve = json(
            (await buildRequest('pagerduty', { routingKey: PAGERDUTY_KEY }, {}, one({ status: 'resolved' }), ctx)).init,
        );
        expect(resolve).toEqual({ routing_key: PAGERDUTY_KEY, event_action: 'resolve', dedup_key: 'blackbox:i1' });
        await expect(
            buildRequest(
                'pagerduty',
                { routingKey: PAGERDUTY_KEY },
                {},
                { kind: 'batch', reason: 'held', alerts: [], total: 0, since: NOW },
                ctx,
            ),
        ).rejects.toThrow(/one alert at a time/);
    });

    it('Webhook: a body the receiver verifies with the shared verifier', async () => {
        const { init } = await buildRequest(
            'webhook',
            { url: 'https://hooks.acme.test/a', signingSecret: 'alsec_0123456789abcdef' },
            {},
            one(),
            ctx,
        );
        const headers = init.headers as Record<string, string>;
        expect(headers['X-Ottabase-Event']).toBe('alert.firing');
        expect(headers['X-Ottabase-Delivery']).toBe('d1');
        const ok = await verifySignatureHeader(
            'alsec_0123456789abcdef',
            String(init.body),
            headers['X-Ottabase-Signature']!,
            {
                now: Math.floor(NOW / 1000),
            },
        );
        expect(ok).toBe(true);
        expect(json(init).alert).toMatchObject({ key: 'blackbox:i1', raisedAt: new Date(NOW).toISOString() });
    });

    it('Mail: subject names the app and severity; HTML is escaped', () => {
        const mail = renderMail(['ops@acme.test'], one({ title: '<script>x</script>' }), ctx);
        expect(mail.subject).toBe('[Acme] Warning: <script>x</script>');
        expect(mail.html).not.toContain('<script>');
        expect(mail.text).toContain('Open: https://acme.test/admin/infrastructure/blackbox?issue=i1');
    });

    it('a batch lists the loudest first and counts the rest', async () => {
        const batch: Outbound = {
            kind: 'batch',
            reason: 'digest',
            alerts: [alert({ severity: 'critical', title: 'Down' }), alert({ title: 'Slow' })],
            total: 7,
            since: Date.UTC(2026, 9, 26, 8, 0),
        };
        expect(batchTitle(batch as Extract<Outbound, { kind: 'batch' }>)).toBe(
            'Digest: 7 alerts since 26 Oct 2026 08:00 UTC',
        );
        const mail = renderMail(['ops@acme.test'], batch, ctx);
        expect(mail.text).toContain('1 critical, 1 warning');
        expect(mail.text).toContain('…and 5 more.');
        expect(mail.text).toContain('All alerts: https://acme.test/admin/infrastructure/alerts');
        const slack = json((await buildRequest('slack', { url: SLACK_URL }, {}, batch, ctx)).init);
        expect(slack.blocks[1].text.text).toContain(
            '🔴 *blackbox* <https://acme.test/admin/infrastructure/blackbox?issue=i1|Down>',
        );
    });
});

describe('judgeResponse', () => {
    it('2xx is sent', async () => {
        await expect(judgeResponse(new Response(null, { status: 202 }))).resolves.toEqual({ ok: true });
    });

    it('a dead target is permanent, a busy one is not', async () => {
        await expect(judgeResponse(new Response('no_service', { status: 404 }))).resolves.toEqual({
            ok: false,
            error: 'HTTP 404: no_service',
            permanent: true,
        });
        await expect(judgeResponse(new Response('slow down', { status: 429 }))).resolves.toMatchObject({
            permanent: false,
        });
        await expect(judgeResponse(new Response('', { status: 503 }))).resolves.toMatchObject({ permanent: false });
    });

    it('a redirect is refused, not followed', async () => {
        const result = await judgeResponse(new Response(null, { status: 302, headers: { location: 'https://x' } }));
        expect(result).toMatchObject({ ok: false, permanent: true });
        expect(result.ok ? '' : result.error).toContain('redirects are not followed');
    });
});
