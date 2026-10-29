// ============================================================
// The engine on real SQLite: routing, the cooldown, caps, digests, retries, the env channel,
// unreadable targets, the feed, the prune and the probe. The clock is the test's.
// ============================================================

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY_MS, HOUR_MS, MAX_ATTEMPTS } from '../constants';
import { channelTakes, digestDue, normalizeAlert } from '../engine';
import { AlertDelivery } from '../ottaorm-models/AlertDelivery';
import type { ChannelView } from '../types';
import {
    DISCORD_URL,
    ENV,
    PAGERDUTY_KEY,
    SLACK_URL,
    T0,
    closeDatabase,
    makeEngine,
    openDatabase,
    type TestEnv,
} from './harness';

beforeEach(openDatabase);
afterAll(closeDatabase);

const statuses = async (eventId: string | null) =>
    (await AlertDelivery.forEvents(eventId ? [eventId] : [])).map((row) => row.status).sort();

describe('normalizeAlert', () => {
    it('bounds everything, keeps the title on one line and makes app paths absolute', () => {
        const alert = normalizeAlert(
            {
                source: 'Black Box!',
                kind: 'issue.new',
                title: `line one\nline two ${'x'.repeat(400)}`,
                url: '/admin/x?y=1',
                fields: [
                    { label: 'A', value: '1' },
                    { label: '', value: 'dropped' },
                ],
            },
            'https://acme.test',
        );
        expect(alert.source).toBe('blackbox');
        expect(alert.title.startsWith('line one line two')).toBe(true);
        expect(alert.title.length).toBe(200);
        expect(alert.url).toBe('https://acme.test/admin/x?y=1');
        expect(alert.fields).toEqual([{ label: 'A', value: '1' }]);
        expect(alert.severity).toBe('warning');
        // Default key: source:kind:title, itself bounded.
        expect(alert.key.startsWith('blackbox:issue.new:line one line two')).toBe(true);
        expect(alert.key.length).toBe(200);
        expect(normalizeAlert({ source: 's', kind: 'k', title: 'Short' }, null).key).toBe('s:k:Short');
    });

    it('drops a link that is not http(s)', () => {
        expect(normalizeAlert({ source: 's', kind: 'k', title: 't', url: 'javascript:alert(1)' }, null).url).toBeNull();
        expect(normalizeAlert({ source: 's', kind: 'k', title: 't', url: '/relative' }, null).url).toBeNull();
    });
});

describe('channelTakes', () => {
    const channel = (over: Partial<ChannelView>) =>
        ({ enabled: true, minSeverity: 'info', sources: null, ...over }) as ChannelView;
    it('honours the severity floor and the source filter, by source or source:kind', () => {
        const alert = { source: 'tower', kind: 'app.down', severity: 'critical' as const };
        expect(channelTakes(channel({}), alert)).toBe(true);
        expect(channelTakes(channel({ enabled: false }), alert)).toBe(false);
        expect(channelTakes(channel({ minSeverity: 'critical' }), { ...alert, severity: 'warning' })).toBe(false);
        expect(channelTakes(channel({ sources: ['blackbox'] }), alert)).toBe(false);
        expect(channelTakes(channel({ sources: ['tower:app.down'] }), alert)).toBe(true);
        expect(channelTakes(channel({ sources: ['tower:app.up'] }), alert)).toBe(false);
    });
});

describe('digestDue', () => {
    it('is due once per day, from the slot on', () => {
        const slot = Date.UTC(2026, 9, 27, 8);
        expect(digestDue(slot - 1, 8, null)).toBe(false);
        expect(digestDue(slot, 8, null)).toBe(true);
        expect(digestDue(slot + HOUR_MS, 8, slot + 60_000)).toBe(false);
        expect(digestDue(slot + DAY_MS, 8, slot + 60_000)).toBe(true);
    });
});

describe('raise', () => {
    it('sends to every channel that takes it, and only those', async () => {
        const { alerts, net, mail } = makeEngine();
        await alerts.createChannel(ENV, { name: 'Ops', type: 'slack', url: SLACK_URL });
        await alerts.createChannel(ENV, {
            name: 'Pager',
            type: 'pagerduty',
            routingKey: PAGERDUTY_KEY,
            minSeverity: 'critical',
        });
        await alerts.createChannel(ENV, { name: 'Sales', type: 'discord', url: DISCORD_URL, sources: ['payport'] });

        const result = await alerts.raise(ENV, { source: 'blackbox', kind: 'issue.new', title: 'Boom' });
        expect(result).toMatchObject({ suppressed: false, routed: 1 });
        expect(net.sent.map((request) => request.url)).toEqual([SLACK_URL]);
        expect(await statuses(result.id)).toEqual(['sent']);
        expect(mail).toEqual([]);

        net.sent.length = 0;
        await alerts.raise(ENV, { source: 'tower', kind: 'app.down', title: 'Down', severity: 'critical' });
        expect(net.sent.map((request) => request.url).sort()).toEqual(
            ['https://events.pagerduty.com/v2/enqueue', SLACK_URL].sort(),
        );
    });

    it('holds the same key and state inside the cooldown, and says so on the next one', async () => {
        const { alerts, clock, net } = makeEngine();
        await alerts.createChannel(ENV, { name: 'Ops', type: 'slack', url: SLACK_URL });
        const input = { source: 'blackbox', kind: 'issue.new', title: 'Boom', key: 'bb:1' };

        expect((await alerts.raise(ENV, input)).suppressed).toBe(false);
        clock.now += 60_000;
        expect(await alerts.raise(ENV, input)).toEqual({ id: null, suppressed: true, routed: 0 });
        clock.now += 60_000;
        expect((await alerts.raise(ENV, input)).suppressed).toBe(true);
        expect(net.sent).toHaveLength(1);

        clock.now += 31 * 60_000;
        const third = await alerts.raise(ENV, input);
        expect(third.suppressed).toBe(false);
        const [latest] = await alerts.feed(ENV, { limit: 1 });
        expect(latest!.heldBefore).toBe(2);
        expect(JSON.stringify(JSON.parse(net.sent[1]!.body).blocks)).toContain('2 more alerts like this held back');
    });

    it('holds a repeat raised in the same millisecond', async () => {
        const { alerts, net } = makeEngine();
        await alerts.createChannel(ENV, { name: 'Ops', type: 'slack', url: SLACK_URL });
        const input = { source: 'errors', kind: 'request', title: 'Boom', key: 'same-ms' };
        const [first, second] = [await alerts.raise(ENV, input), await alerts.raise(ENV, input)];
        expect(first.suppressed).toBe(false);
        expect(second.suppressed).toBe(true);
        expect(net.sent).toHaveLength(1);
    });

    it('lets a resolve through at once, and sends every one with a zero cooldown', async () => {
        const { alerts, net } = makeEngine();
        await alerts.createChannel(ENV, { name: 'Ops', type: 'slack', url: SLACK_URL });
        await alerts.raise(ENV, { source: 'tower', kind: 'app.down', title: 'Down', key: 'tower:a' });
        await alerts.raise(ENV, { source: 'tower', kind: 'app.up', title: 'Up', key: 'tower:a', status: 'resolved' });
        await alerts.raise(ENV, { source: 'tower', kind: 'app.down', title: 'Down', key: 'tower:a', cooldownMs: 0 });
        expect(net.sent).toHaveLength(3);
    });

    it('logs an alert no channel takes, and still stores it', async () => {
        const { alerts } = makeEngine();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const result = await alerts.raise(ENV, { source: 's', kind: 'k', title: 'Lonely' });
        expect(result.routed).toBe(0);
        expect(result.id).not.toBeNull();
        expect(warn.mock.calls.flat().join(' ')).toContain('alert_unrouted');
        warn.mockRestore();
    });

    it('never throws, even with no tables', async () => {
        const { alerts } = makeEngine({ appId: () => 'app' });
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const { AlertKey } = await import('../ottaorm-models/AlertKey');
        const touch = vi
            .spyOn(AlertKey, 'touch')
            .mockRejectedValueOnce(new Error('D1_ERROR: no such table: alert_keys'));
        await expect(alerts.raise(ENV, { source: 's', kind: 'k', title: 't' })).resolves.toEqual({
            id: null,
            suppressed: false,
            routed: 0,
        });
        expect(error.mock.calls.flat().join(' ')).toContain('alert_raise_failed');
        touch.mockRestore();
        error.mockRestore();
    });

    it('sends under waitUntil when the caller has one', async () => {
        const { alerts, net } = makeEngine();
        await alerts.createChannel(ENV, { name: 'Ops', type: 'slack', url: SLACK_URL });
        const kept: Promise<unknown>[] = [];
        await alerts.raise(ENV, { source: 's', kind: 'k', title: 't' }, { waitUntil: (promise) => kept.push(promise) });
        expect(kept).toHaveLength(1);
        await Promise.all(kept);
        expect(net.sent).toHaveLength(1);
    });
});

describe('the hourly cap and held-back summaries', () => {
    it('holds what is over the cap, never a critical, and sends the rest as one summary once there is room', async () => {
        const { alerts, clock, net } = makeEngine();
        await alerts.createChannel(ENV, { name: 'Ops', type: 'slack', url: SLACK_URL, maxPerHour: 2 });
        for (let i = 0; i < 4; i++) {
            await alerts.raise(ENV, { source: 'blackbox', kind: 'issue.new', title: `Boom ${i}` });
            clock.now += 1000;
        }
        const critical = await alerts.raise(ENV, {
            source: 'tower',
            kind: 'app.down',
            title: 'Down',
            severity: 'critical',
        });
        expect(await statuses(critical.id)).toEqual(['sent']);
        expect(net.sent).toHaveLength(3);
        expect((await alerts.summary(ENV)).waiting).toBe(2);

        // Still inside the hour: nothing more goes out.
        expect((await alerts.sweep(ENV)).summaries).toBe(0);
        clock.now += HOUR_MS;
        expect((await alerts.sweep(ENV)).summaries).toBe(1);
        expect(net.sent).toHaveLength(4);
        const summary = JSON.parse(net.sent[3]!.body);
        expect(summary.text).toBe("2 alerts held back: over this channel's hourly limit");
        expect((await alerts.summary(ENV)).waiting).toBe(0);
    });
});

describe('digests', () => {
    it('waits for the hour, sends once, and sends nothing on an empty day', async () => {
        const { alerts, clock, net } = makeEngine();
        clock.now = Date.UTC(2026, 9, 27, 6, 0);
        await alerts.createChannel(ENV, {
            name: 'Daily',
            type: 'slack',
            url: SLACK_URL,
            mode: 'digest',
            digestHour: 8,
        });
        await alerts.raise(ENV, { source: 'payport', kind: 'license.activated', title: 'New sale', severity: 'info' });
        await alerts.raise(ENV, { source: 'helpdesk', kind: 'ticket.new', title: 'Ticket', severity: 'info' });
        const page = await alerts.raise(ENV, {
            source: 'tower',
            kind: 'app.down',
            title: 'Down',
            severity: 'critical',
        });
        // A critical never waits for a digest.
        expect(await statuses(page.id)).toEqual(['sent']);
        expect(net.sent).toHaveLength(1);

        expect((await alerts.sweep(ENV)).digests).toBe(0);
        clock.now = Date.UTC(2026, 9, 27, 8, 2);
        expect((await alerts.sweep(ENV)).digests).toBe(1);
        expect(JSON.parse(net.sent[1]!.body).text).toMatch(/^Digest: 2 alerts since/);
        clock.now += 5 * 60_000;
        expect((await alerts.sweep(ENV)).digests).toBe(0);
        clock.now = Date.UTC(2026, 9, 28, 8, 1);
        expect((await alerts.sweep(ENV)).digests).toBe(0);
        expect(net.sent).toHaveLength(2);
    });

    it('refuses digest mode for PagerDuty', async () => {
        const { alerts } = makeEngine();
        await expect(
            alerts.createChannel(ENV, { name: 'P', type: 'pagerduty', routingKey: PAGERDUTY_KEY, mode: 'digest' }),
        ).rejects.toThrow(/cannot be a digest/);
    });
});

describe('failures and retries', () => {
    it('retries a busy target on the backoff schedule, then gives up', async () => {
        const failing = makeEngine({
            fetch: (async () => new Response('busy', { status: 503 })) as typeof fetch,
        });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        await failing.alerts.createChannel(ENV, { name: 'Ops', type: 'slack', url: SLACK_URL });
        const { id } = await failing.alerts.raise(ENV, { source: 's', kind: 'k', title: 't' });
        const [first] = await AlertDelivery.forEvents([id!]);
        expect(first).toMatchObject({ status: 'failed', attempts: 1, nextAttemptAt: T0 + 60_000 });

        // Not due yet.
        expect((await failing.alerts.sweep(ENV)).retried).toBe(0);
        for (let attempt = 2; attempt <= MAX_ATTEMPTS; attempt++) {
            failing.clock.now += 2 * HOUR_MS;
            expect((await failing.alerts.sweep(ENV)).retried).toBe(1);
        }
        const [last] = await AlertDelivery.forEvents([id!]);
        expect(last).toMatchObject({ status: 'dead', attempts: MAX_ATTEMPTS, lastError: 'HTTP 503: busy' });
        const [channel] = await failing.alerts.listChannels(ENV);
        expect(channel!.failures).toBe(MAX_ATTEMPTS);
        expect((await failing.alerts.probe(ENV)).ok).toBe(false);
        warn.mockRestore();
    });

    it('gives up on a dead target at once, and a retry from the console sends again', async () => {
        let status = 404;
        const engine = makeEngine({ fetch: (async () => new Response('no_service', { status })) as typeof fetch });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        await engine.alerts.createChannel(ENV, { name: 'Ops', type: 'slack', url: SLACK_URL });
        const { id } = await engine.alerts.raise(ENV, { source: 's', kind: 'k', title: 't' });
        const [row] = await AlertDelivery.forEvents([id!]);
        expect(row).toMatchObject({ status: 'dead', attempts: 1, lastError: 'HTTP 404: no_service' });

        status = 200;
        const retried = await engine.alerts.retry(ENV, row!.id);
        expect(retried).toMatchObject({ status: 'sent', attempts: 2, channelName: 'Ops' });
        expect(await engine.alerts.retry(ENV, row!.id)).toBeNull();
        const [channel] = await engine.alerts.listChannels(ENV);
        expect(channel!.failures).toBe(0);
        warn.mockRestore();
    });

    it('treats a network error as passing, and keeps a credential out of the error text', async () => {
        const engine = makeEngine({
            fetch: (async (url: string) => {
                throw new Error(`connect failed for ${url}`);
            }) as unknown as typeof fetch,
        });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { TELEGRAM_TOKEN } = await import('./harness');
        await engine.alerts.createChannel(ENV, {
            name: 'TG',
            type: 'telegram',
            botToken: TELEGRAM_TOKEN,
            chatId: '-100',
        });
        const { id } = await engine.alerts.raise(ENV, { source: 's', kind: 'k', title: 't' });
        const [row] = await AlertDelivery.forEvents([id!]);
        expect(row!.status).toBe('failed');
        expect(row!.lastError).not.toContain(TELEGRAM_TOKEN);
        expect(row!.lastError).toContain('api.telegram.org/bot…/sendMessage');
        warn.mockRestore();
    });
});

describe('the env email channel', () => {
    const withMail: TestEnv = { ...ENV, emailTo: 'ops@acme.test, cto@acme.test' };

    it('takes everything, is shown read-only and cannot be edited here', async () => {
        const { alerts, mail } = makeEngine();
        const [channel] = await alerts.listChannels(withMail);
        expect(channel).toMatchObject({ id: 'env:email', fromEnv: true, hint: 'ops@acme.test, cto@acme.test' });
        await alerts.raise(withMail, {
            source: 'privacy',
            kind: 'request.received',
            title: 'New request',
            severity: 'info',
        });
        expect(mail).toHaveLength(1);
        expect(mail[0]).toMatchObject({ to: ['ops@acme.test', 'cto@acme.test'], subject: '[Acme] Info: New request' });
        await expect(alerts.updateChannel(withMail, 'env:email', { name: 'x' })).rejects.toThrow(/ALERTS_EMAIL_TO/);
        await expect(alerts.removeChannel(withMail, 'env:email')).rejects.toThrow(/ALERTS_EMAIL_TO/);
    });

    it('fails the probe when there is no mailer', async () => {
        const { alerts } = makeEngine({ email: undefined });
        expect(await alerts.probe(withMail)).toMatchObject({ ok: false });
        expect(await alerts.probe(ENV)).toEqual({
            name: 'alerts:channels',
            ok: true,
            detail: 'no channels: alerts are only logged',
        });
    });
});

describe('channels in the console', () => {
    it('never shows a secret, keeps it across a change, and marks it unreadable under another key', async () => {
        const { alerts } = makeEngine();
        const created = await alerts.createChannel(ENV, { name: 'Ops', type: 'slack', url: SLACK_URL });
        expect(JSON.stringify(created)).not.toContain('abcdefghijkl');
        expect(created).toMatchObject({
            readable: true,
            hint: 'hooks.slack.com/…/ijkl',
            minSeverity: 'info',
            mode: 'immediate',
        });

        const renamed = await alerts.updateChannel(ENV, created.id, { name: 'Ops room', minSeverity: 'warning' });
        expect(renamed).toMatchObject({
            name: 'Ops room',
            minSeverity: 'warning',
            hint: 'hooks.slack.com/…/ijkl',
            readable: true,
        });
        await expect(alerts.updateChannel(ENV, created.id, { type: 'discord' })).rejects.toThrow(/cannot change type/);

        const otherKey = { ...ENV, secret: 'a-completely-different-secret' };
        const [view] = await alerts.listChannels(otherKey);
        expect(view!.readable).toBe(false);
        expect(await alerts.probe(otherKey)).toMatchObject({ ok: false });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { id } = await alerts.raise(otherKey, { source: 's', kind: 'k', title: 't' });
        expect((await AlertDelivery.forEvents([id!]))[0]).toMatchObject({ status: 'dead' });
        warn.mockRestore();
        // Entering the target again under the new key fixes it.
        expect(await alerts.updateChannel(otherKey, created.id, { url: SLACK_URL })).toMatchObject({ readable: true });
    });

    it('shows a generated webhook signing secret once, on create and on rotate, never one typed in', async () => {
        const { alerts } = makeEngine();
        const created = await alerts.createChannel(ENV, {
            name: 'Hook',
            type: 'webhook',
            url: 'https://hooks.acme.test/a',
        });
        expect(created.signingSecret).toMatch(/^alsec_/);
        expect(JSON.stringify(await alerts.listChannels(ENV))).not.toContain(created.signingSecret!);
        expect((await alerts.updateChannel(ENV, created.id, { name: 'Hook 2' }))!.signingSecret).toBeUndefined();
        const rotated = await alerts.updateChannel(ENV, created.id, { rotateSigningSecret: true });
        expect(rotated!.signingSecret).toMatch(/^alsec_/);
        expect(rotated!.signingSecret).not.toBe(created.signingSecret);
        const typed = await alerts.updateChannel(ENV, created.id, { signingSecret: 'my-own-secret-value-123' });
        expect(typed!.signingSecret).toBeUndefined();
    });

    it('validates what it is given', async () => {
        const { alerts } = makeEngine();
        await expect(alerts.createChannel(ENV, { type: 'slack', url: SLACK_URL })).rejects.toThrow(
            'Give the channel a name',
        );
        await expect(alerts.createChannel(ENV, { name: 'x' })).rejects.toThrow('Choose a channel type');
        await expect(
            alerts.createChannel(ENV, { name: 'x', type: 'slack', url: SLACK_URL, digestHour: 25 }),
        ).rejects.toThrow(/0 to 23/);
        await expect(
            alerts.createChannel(ENV, { name: 'x', type: 'slack', url: SLACK_URL, maxPerHour: 0 }),
        ).rejects.toThrow(/1 to 1000/);
        await expect(
            alerts.createChannel(ENV, { name: 'x', type: 'slack', url: SLACK_URL, minSeverity: 'loud' as never }),
        ).rejects.toThrow(/info, warning or critical/);
        const created = await alerts.createChannel(ENV, {
            name: 'x',
            type: 'slack',
            url: SLACK_URL,
            sources: 'Blackbox, tower:app.down, ,' as never,
        });
        expect(created.sources).toEqual(['blackbox', 'tower:app.down']);
    });

    it('removing a channel gives up what it still owed', async () => {
        const { alerts } = makeEngine();
        const channel = await alerts.createChannel(ENV, {
            name: 'Daily',
            type: 'slack',
            url: SLACK_URL,
            mode: 'digest',
        });
        const { id } = await alerts.raise(ENV, { source: 's', kind: 'k', title: 't' });
        expect(await statuses(id)).toEqual(['digest']);
        expect(await alerts.removeChannel(ENV, channel.id)).toBe(true);
        expect((await AlertDelivery.forEvents([id!]))[0]).toMatchObject({
            status: 'dead',
            lastError: 'channel removed',
        });
        expect(await alerts.removeChannel(ENV, channel.id)).toBe(false);
    });

    it('tests one channel past its filters and reports how it went', async () => {
        const { alerts, net } = makeEngine();
        const channel = await alerts.createChannel(ENV, {
            name: 'Pager',
            type: 'pagerduty',
            routingKey: PAGERDUTY_KEY,
            minSeverity: 'critical',
        });
        const result = await alerts.testChannel(ENV, channel.id);
        expect(result).toMatchObject({ ok: true, error: null, delivery: { status: 'sent', channelName: 'Pager' } });
        expect(JSON.parse(net.sent[0]!.body).payload.summary).toBe('Test alert from Acme');
        expect(await alerts.testChannel(ENV, 'missing')).toBeNull();
    });
});

describe('feed, summary and prune', () => {
    it('lists alerts with where they went, filters, and counts', async () => {
        const { alerts, clock } = makeEngine();
        await alerts.createChannel(ENV, { name: 'Ops', type: 'slack', url: SLACK_URL });
        await alerts.raise(ENV, { source: 'blackbox', kind: 'issue.new', title: 'One' });
        clock.now += 1000;
        await alerts.raise(ENV, { source: 'tower', kind: 'app.down', title: 'Two', severity: 'critical' });

        const feed = await alerts.feed(ENV);
        expect(feed.map((alert) => alert.title)).toEqual(['Two', 'One']);
        expect(feed[0]!.deliveries).toMatchObject([{ channelName: 'Ops', status: 'sent', channelType: 'slack' }]);
        expect((await alerts.feed(ENV, { source: 'blackbox' })).map((alert) => alert.title)).toEqual(['One']);
        expect((await alerts.feed(ENV, { severity: 'critical' })).map((alert) => alert.title)).toEqual(['Two']);
        expect((await alerts.feed(ENV, { before: clock.now })).map((alert) => alert.title)).toEqual(['One']);

        const summary = await alerts.summary(ENV);
        expect(summary).toMatchObject({ last24h: { info: 0, warning: 1, critical: 1 }, waiting: 0, dead24h: 0 });
        expect(summary.sources).toEqual(['blackbox', 'tower']);
    });

    it('drops alerts and keys past retention, deliveries with them', async () => {
        const { alerts, clock } = makeEngine();
        await alerts.createChannel(ENV, { name: 'Ops', type: 'slack', url: SLACK_URL });
        const { id } = await alerts.raise(ENV, { source: 's', kind: 'k', title: 'old' });
        clock.now += 31 * DAY_MS;
        await alerts.raise(ENV, { source: 's', kind: 'k', title: 'new' });
        expect(await alerts.prune(ENV, 30)).toEqual({ alerts: 1, keys: 1 });
        expect(await AlertDelivery.forEvents([id!])).toEqual([]);
        expect((await alerts.feed(ENV)).map((alert) => alert.title)).toEqual(['new']);
    });
});

describe("D1's 100 bound values", () => {
    it('routes one alert to many channels, and lists more alerts than one IN (…) can hold', async () => {
        // One alert goes to 20 channels; then 19 are switched off, and 120 more alerts to the one left push the
        // feed's alert ids past one IN (…). All 121 to all 20 would prove nothing more for 2,420 signed sends.
        const { alerts, clock, net } = makeEngine();
        const channels: { id: string }[] = [];
        for (let i = 0; i < 20; i++)
            channels.push(await alerts.createChannel(ENV, { name: `Ops ${i}`, type: 'slack', url: SLACK_URL }));
        const many = await alerts.raise(ENV, { source: 's', kind: 'k', title: 'Everyone' });
        expect(many.routed).toBe(20);
        expect(net.sent).toHaveLength(20);

        for (const channel of channels.slice(1)) await alerts.updateChannel(ENV, channel.id, { enabled: false });
        for (let i = 0; i < 120; i++) {
            clock.now += 1000;
            await alerts.raise(ENV, { source: 'bulk', kind: 'k', title: `Alert ${i}`, severity: 'info' });
        }
        const feed = await alerts.feed(ENV, { limit: 200 });
        expect(feed).toHaveLength(121);
        const everyone = feed.find((alert) => alert.title === 'Everyone');
        expect(everyone?.deliveries).toHaveLength(20);
        expect(feed.filter((alert) => alert !== everyone).every((alert) => alert.deliveries.length === 1)).toBe(true);
        // 121 raises on real SQLite: over the 5 s default when the whole monorepo tests in parallel.
    }, 20_000);
});
