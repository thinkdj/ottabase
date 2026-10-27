// ============================================================
// @ottabase/alerts: channel types: what each accepts and what each is sent
// ============================================================
// Pure functions, one switch per concern: validate a target typed into the console, render
// an alert (or a batch of them) into the request a service expects, and judge its answer.
// The engine does the I/O.
//
// EVERY ALERT IS UNTRUSTED TEXT. A browser error report, a support mail's subject, a CI
// job's name: none of it is markup. Each renderer escapes for its service (Slack mrkdwn,
// Discord markdown, Telegram HTML, mail HTML), turns off link previews where the service
// has them, and Discord never pings (`allowed_mentions: { parse: [] }`).
//
// Hosts are pinned where the service has one (hooks.slack.com, discord.com, Telegram,
// PagerDuty), so only a generic webhook needs the public-URL policy, and no request
// follows a redirect.
// ============================================================

import { buildSignatureHeader, generateSigningSecret } from '@ottabase/utils/hmac-signature';
import { OutboundUrlError, assertPublicHttpsUrl } from '@ottabase/utils/outbound-url';
import { MAX_ERROR, MAX_RECIPIENTS } from './constants';
import type { Alert, AlertMail, ChannelConfig, ChannelInput, ChannelSecrets, ChannelType, Severity } from './types';

/** A target the console cannot accept. The message is about the value typed, so it is safe to show. */
export class ChannelInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ChannelInputError';
    }
}

/** What each type can do. PagerDuty pages: it is never capped and never batched into a digest. */
export const CHANNEL_TYPES: Record<ChannelType, { label: string; batches: boolean }> = {
    email: { label: 'Email', batches: true },
    slack: { label: 'Slack', batches: true },
    discord: { label: 'Discord', batches: true },
    telegram: { label: 'Telegram', batches: true },
    pagerduty: { label: 'PagerDuty', batches: false },
    webhook: { label: 'Webhook', batches: true },
};

export const isChannelType = (value: unknown): value is ChannelType =>
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(CHANNEL_TYPES, value);

/** Header names a webhook receiver routes and verifies on: the same as `@ottabase/webhooks`. */
export const SIGNATURE_HEADER = 'X-Ottabase-Signature';
export const EVENT_HEADER = 'X-Ottabase-Event';
export const DELIVERY_HEADER = 'X-Ottabase-Delivery';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEGRAM_TOKEN_RE = /^\d{5,}:[A-Za-z0-9_-]{30,}$/;
const TELEGRAM_CHAT_RE = /^(-?\d{1,20}|@[A-Za-z][A-Za-z0-9_]{4,31})$/;
const PAGERDUTY_KEY_RE = /^[A-Za-z0-9]{20,64}$/;
const DISCORD_HOSTS = new Set(['discord.com', 'discordapp.com', 'ptb.discord.com', 'canary.discord.com']);

const tail = (value: string, length = 4) => value.slice(-length);

function parseUrl(raw: string, label: string): URL {
    try {
        const url = new URL(raw.trim());
        if (url.protocol !== 'https:') throw new ChannelInputError(`${label} URLs must use https`);
        if (url.username || url.password) throw new ChannelInputError(`${label} URLs must not contain credentials`);
        return url;
    } catch (error) {
        if (error instanceof ChannelInputError) throw error;
        throw new ChannelInputError(`Enter the full ${label} URL`);
    }
}

function recipientsOf(value: string[] | string | undefined): string[] | undefined {
    if (value === undefined) return undefined;
    const list = (Array.isArray(value) ? value : value.split(/[,;\s]+/))
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
    return [...new Set(list)];
}

/**
 * The config, secrets and hint for a target. On a change, `existing` supplies whatever the
 * input leaves out, so the console never has to send a secret back to keep it.
 */
export function parseChannelTarget(
    type: ChannelType,
    input: ChannelInput,
    existing?: { config: ChannelConfig; secrets: ChannelSecrets | null },
): { config: ChannelConfig; secrets: ChannelSecrets; hint: string } {
    const kept = existing?.secrets ?? {};
    switch (type) {
        case 'email': {
            const to = recipientsOf(input.to) ?? existing?.config.to ?? [];
            if (to.length === 0) throw new ChannelInputError('Add at least one recipient');
            if (to.length > MAX_RECIPIENTS) throw new ChannelInputError(`At most ${MAX_RECIPIENTS} recipients`);
            const bad = to.find((email) => !EMAIL_RE.test(email));
            if (bad) throw new ChannelInputError(`"${bad.slice(0, 80)}" is not an email address`);
            return { config: { to }, secrets: {}, hint: to.join(', ').slice(0, 120) };
        }
        case 'slack': {
            const raw = input.url ?? kept.url;
            if (!raw) throw new ChannelInputError('Paste the Slack incoming webhook URL');
            const url = parseUrl(raw, 'Slack');
            if (url.hostname !== 'hooks.slack.com' || !/^\/(services|triggers|workflows)\//.test(url.pathname)) {
                throw new ChannelInputError('Slack webhook URLs start with https://hooks.slack.com/services/');
            }
            return {
                config: {},
                secrets: { url: url.toString() },
                hint: `hooks.slack.com/…/${tail(url.pathname)}`,
            };
        }
        case 'discord': {
            const raw = input.url ?? kept.url;
            if (!raw) throw new ChannelInputError('Paste the Discord webhook URL');
            const url = parseUrl(raw, 'Discord');
            if (!DISCORD_HOSTS.has(url.hostname) || !url.pathname.startsWith('/api/webhooks/')) {
                throw new ChannelInputError('Discord webhook URLs start with https://discord.com/api/webhooks/');
            }
            return { config: {}, secrets: { url: url.toString() }, hint: `discord.com/…/${tail(url.pathname)}` };
        }
        case 'telegram': {
            const botToken = (input.botToken ?? kept.botToken ?? '').trim();
            const chatId = (input.chatId ?? existing?.config.chatId ?? '').trim();
            if (!TELEGRAM_TOKEN_RE.test(botToken)) {
                throw new ChannelInputError('Paste the bot token BotFather gave you (123456:ABC…)');
            }
            if (!TELEGRAM_CHAT_RE.test(chatId)) {
                throw new ChannelInputError('The chat id is a number (-100… for a group) or @channelname');
            }
            return { config: { chatId }, secrets: { botToken }, hint: `chat ${chatId}` };
        }
        case 'pagerduty': {
            const routingKey = (input.routingKey ?? kept.routingKey ?? '').trim();
            if (!PAGERDUTY_KEY_RE.test(routingKey)) {
                throw new ChannelInputError('Paste the Events API v2 integration key of a PagerDuty service');
            }
            return { config: {}, secrets: { routingKey }, hint: `integration key …${tail(routingKey)}` };
        }
        case 'webhook': {
            const raw = input.url ?? kept.url;
            if (!raw) throw new ChannelInputError('Enter the URL to post alerts to');
            let url: string;
            try {
                url = assertPublicHttpsUrl(raw, 'Webhook URLs');
            } catch (error) {
                if (error instanceof OutboundUrlError) throw new ChannelInputError(error.message);
                throw error;
            }
            const given = input.signingSecret?.trim();
            if (given !== undefined && given.length < 16) {
                throw new ChannelInputError('A signing secret needs at least 16 characters');
            }
            const signingSecret =
                given || (input.rotateSigningSecret ? null : kept.signingSecret) || generateSigningSecret('alsec_');
            const parsed = new URL(url);
            return { config: {}, secrets: { url, signingSecret }, hint: `${parsed.host}/…` };
        }
    }
}

// ── Rendering ────────────────────────────────────────────────

/** One alert, or several sent as one message: a daily digest, or what an hourly cap held back. */
export type Outbound =
    | { kind: 'alert'; alert: Alert }
    | { kind: 'batch'; reason: 'digest' | 'held'; alerts: Alert[]; total: number; since: number };

export interface RenderContext {
    appName: string | null;
    /** Absolute link to the console, for batches. */
    consoleUrl: string | null;
    deliveryId: string;
    now: number;
}

const SEVERITY_WORD: Record<Severity, string> = { info: 'Info', warning: 'Warning', critical: 'Critical' };
const SEVERITY_MARK: Record<Severity, string> = { info: '🔵', warning: '🟠', critical: '🔴' };
const DISCORD_COLOR: Record<Severity | 'resolved', number> = {
    info: 0x3b82f6,
    warning: 0xf5a524,
    critical: 0xe5484d,
    resolved: 0x30a46c,
};

const clip = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);
const iso = (at: number) => new Date(at).toISOString();
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export const mark = (alert: Alert) => (alert.status === 'resolved' ? '✅' : SEVERITY_MARK[alert.severity]);
export const headline = (alert: Alert) => `${alert.status === 'resolved' ? 'Resolved: ' : ''}${alert.title}`;
const tagline = (alert: Alert, ctx: RenderContext) =>
    [ctx.appName, `${alert.source} · ${alert.kind}`].filter(Boolean).join(' · ');
const heldLine = (alert: Alert) =>
    alert.heldBefore > 0 ? `${plural(alert.heldBefore, 'more alert')} like this held back by the cooldown.` : null;

/** "Digest: 14 alerts since 26 Oct, 08:00 UTC" and the like. */
export function batchTitle(out: Extract<Outbound, { kind: 'batch' }>): string {
    const since = new Date(out.since).toUTCString().slice(5, 22);
    return out.reason === 'digest'
        ? `Digest: ${plural(out.total, 'alert')} since ${since} UTC`
        : `${plural(out.total, 'alert')} held back: over this channel's hourly limit`;
}

/** "3 critical, 9 warning" for a batch. */
export function batchCounts(alerts: Alert[]): string {
    const counts: Record<Severity, number> = { critical: 0, warning: 0, info: 0 };
    for (const alert of alerts) counts[alert.severity] += 1;
    return (['critical', 'warning', 'info'] as const)
        .filter((severity) => counts[severity] > 0)
        .map((severity) => `${counts[severity]} ${severity}`)
        .join(', ');
}

const moreLine = (out: Extract<Outbound, { kind: 'batch' }>) =>
    out.total > out.alerts.length ? `…and ${out.total - out.alerts.length} more.` : null;

/** The plain-text form every channel starts from. */
export function alertText(alert: Alert, ctx: RenderContext): string {
    return [
        headline(alert),
        `${SEVERITY_WORD[alert.severity]} · ${tagline(alert, ctx)} · ${iso(alert.raisedAt)}`,
        alert.body ? `\n${alert.body}` : null,
        alert.fields.length ? `\n${alert.fields.map((field) => `${field.label}: ${field.value}`).join('\n')}` : null,
        heldLine(alert) ? `\n${heldLine(alert)}` : null,
        alert.url ? `\nOpen: ${alert.url}` : null,
    ]
        .filter((line) => line !== null)
        .join('\n');
}

export function batchText(out: Extract<Outbound, { kind: 'batch' }>, ctx: RenderContext): string {
    return [
        batchTitle(out),
        batchCounts(out.alerts),
        '',
        ...out.alerts.map(
            (alert) =>
                `- [${alert.status === 'resolved' ? 'resolved' : alert.severity}] ${alert.source}: ${alert.title}${alert.url ? `\n  ${alert.url}` : ''}`,
        ),
        moreLine(out),
        ctx.consoleUrl ? `\nAll alerts: ${ctx.consoleUrl}` : null,
    ]
        .filter((line) => line !== null)
        .join('\n');
}

const escapeHtml = (value: string) =>
    value.replace(
        /[&<>"']/g,
        (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
    );
/** Slack mrkdwn: these three are the whole escaping contract (and what stops `<!channel>`). */
const escapeSlack = (value: string) =>
    value.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]!);
/** A link target inside `<url|text>`: escaped, and a literal `|` would end the URL early. */
const slackUrl = (url: string) => escapeSlack(url).replace(/\|/g, '%7C');
/** Discord markdown, so `[click](https://evil)` stays text. Mentions are off separately. */
const escapeDiscord = (value: string) => value.replace(/([\\*_~`|>[\]()#])/g, '\\$1');

/** The mail for an alert or a batch. */
export function renderMail(to: string[], out: Outbound, ctx: RenderContext): AlertMail {
    const app = ctx.appName ? `[${ctx.appName}] ` : '';
    if (out.kind === 'batch') {
        const text = batchText(out, ctx);
        return {
            to,
            subject: clip(`${app}${batchTitle(out)}`, 200),
            text,
            html: `<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
        };
    }
    const { alert } = out;
    const word = alert.status === 'resolved' ? 'Resolved' : SEVERITY_WORD[alert.severity];
    const text = alertText(alert, ctx);
    return {
        to,
        subject: clip(`${app}${word}: ${alert.title}`, 200),
        text,
        html: `<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap">${escapeHtml(text)}</pre>${
            alert.url ? `<p><a href="${escapeHtml(alert.url)}">Open it</a></p>` : ''
        }`,
    };
}

function slackBody(out: Outbound, ctx: RenderContext): unknown {
    if (out.kind === 'batch') {
        const lines = out.alerts.map(
            (alert) =>
                `${mark(alert)} *${escapeSlack(alert.source)}* ${
                    alert.url
                        ? `<${slackUrl(alert.url)}|${escapeSlack(clip(alert.title, 150))}>`
                        : escapeSlack(clip(alert.title, 150))
                }`,
        );
        const more = moreLine(out);
        return {
            text: batchTitle(out),
            unfurl_links: false,
            unfurl_media: false,
            blocks: [
                { type: 'header', text: { type: 'plain_text', text: clip(batchTitle(out), 150) } },
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: clip([...lines, more].filter(Boolean).join('\n'), 2900) },
                },
                {
                    type: 'context',
                    elements: [
                        {
                            type: 'mrkdwn',
                            text: escapeSlack([ctx.appName, batchCounts(out.alerts)].filter(Boolean).join(' · ')),
                        },
                    ],
                },
                ...(ctx.consoleUrl
                    ? [
                          {
                              type: 'actions',
                              elements: [
                                  {
                                      type: 'button',
                                      text: { type: 'plain_text', text: 'All alerts' },
                                      url: ctx.consoleUrl,
                                  },
                              ],
                          },
                      ]
                    : []),
            ],
        };
    }
    const { alert } = out;
    const held = heldLine(alert);
    return {
        // The notification text is mrkdwn too: an unescaped `<!channel>` here would page the room.
        text: `${mark(alert)} ${escapeSlack(headline(alert))}`,
        unfurl_links: false,
        unfurl_media: false,
        blocks: [
            { type: 'header', text: { type: 'plain_text', text: clip(`${mark(alert)} ${headline(alert)}`, 150) } },
            ...(alert.body
                ? [{ type: 'section', text: { type: 'mrkdwn', text: clip(escapeSlack(alert.body), 2900) } }]
                : []),
            ...(alert.fields.length
                ? [
                      {
                          type: 'section',
                          fields: alert.fields.slice(0, 10).map((field) => ({
                              type: 'mrkdwn',
                              text: clip(`*${escapeSlack(field.label)}*\n${escapeSlack(field.value)}`, 1900),
                          })),
                      },
                  ]
                : []),
            {
                type: 'context',
                elements: [
                    {
                        type: 'mrkdwn',
                        text: escapeSlack(
                            [`${SEVERITY_WORD[alert.severity]}`, tagline(alert, ctx), held].filter(Boolean).join(' · '),
                        ),
                    },
                ],
            },
            ...(alert.url
                ? [
                      {
                          type: 'actions',
                          elements: [{ type: 'button', text: { type: 'plain_text', text: 'Open' }, url: alert.url }],
                      },
                  ]
                : []),
        ],
    };
}

function discordBody(out: Outbound, ctx: RenderContext): unknown {
    const base = {
        username: clip(ctx.appName ? `${ctx.appName} alerts` : 'Ottabase alerts', 80),
        allowed_mentions: { parse: [] },
    };
    if (out.kind === 'batch') {
        const lines = out.alerts.map(
            (alert) => `${mark(alert)} **${escapeDiscord(alert.source)}** ${escapeDiscord(clip(alert.title, 180))}`,
        );
        return {
            ...base,
            embeds: [
                {
                    title: clip(batchTitle(out), 256),
                    ...(ctx.consoleUrl ? { url: ctx.consoleUrl } : {}),
                    description: clip([...lines, moreLine(out)].filter(Boolean).join('\n'), 4000),
                    color: DISCORD_COLOR.info,
                    footer: { text: clip(batchCounts(out.alerts), 2000) },
                    timestamp: iso(ctx.now),
                },
            ],
        };
    }
    const { alert } = out;
    const description = [alert.body ? escapeDiscord(alert.body) : null, heldLine(alert)].filter(Boolean).join('\n\n');
    return {
        ...base,
        embeds: [
            {
                title: clip(`${mark(alert)} ${headline(alert)}`, 256),
                ...(alert.url ? { url: alert.url } : {}),
                ...(description ? { description: clip(description, 4000) } : {}),
                color: DISCORD_COLOR[alert.status === 'resolved' ? 'resolved' : alert.severity],
                fields: alert.fields.slice(0, 10).map((field) => ({
                    name: clip(field.label, 256),
                    value: clip(escapeDiscord(field.value) || '-', 1024),
                    inline: field.value.length <= 40,
                })),
                footer: { text: clip(`${SEVERITY_WORD[alert.severity]} · ${tagline(alert, ctx)}`, 2000) },
                timestamp: iso(alert.raisedAt),
            },
        ],
    };
}

function telegramText(out: Outbound, ctx: RenderContext): string {
    if (out.kind === 'batch') {
        const lines = out.alerts.map(
            (alert) =>
                `${mark(alert)} <b>${escapeHtml(alert.source)}</b> ${
                    alert.url
                        ? `<a href="${escapeHtml(alert.url)}">${escapeHtml(clip(alert.title, 150))}</a>`
                        : escapeHtml(clip(alert.title, 150))
                }`,
        );
        return clip(
            [
                `<b>${escapeHtml(batchTitle(out))}</b>`,
                escapeHtml(batchCounts(out.alerts)),
                '',
                ...lines,
                moreLine(out),
                ctx.consoleUrl ? `\n<a href="${escapeHtml(ctx.consoleUrl)}">All alerts</a>` : null,
            ]
                .filter((line) => line !== null)
                .join('\n'),
            4000,
        );
    }
    const { alert } = out;
    return [
        `${mark(alert)} <b>${escapeHtml(clip(headline(alert), 300))}</b>`,
        `<i>${escapeHtml(`${SEVERITY_WORD[alert.severity]} · ${tagline(alert, ctx)}`)}</i>`,
        // Cut before escaping: an entity split in half is a Telegram parse error.
        alert.body ? `\n${escapeHtml(clip(alert.body, 3000))}` : null,
        alert.fields.length
            ? `\n${alert.fields.map((field) => `<b>${escapeHtml(field.label)}:</b> ${escapeHtml(clip(field.value, 200))}`).join('\n')}`
            : null,
        heldLine(alert) ? `\n${escapeHtml(heldLine(alert)!)}` : null,
        alert.url ? `\n<a href="${escapeHtml(alert.url)}">Open</a>` : null,
    ]
        .filter((line) => line !== null)
        .join('\n');
}

function pagerdutyBody(routingKey: string, alert: Alert, ctx: RenderContext): unknown {
    const resolve = alert.status === 'resolved';
    return {
        routing_key: routingKey,
        event_action: resolve ? 'resolve' : 'trigger',
        // PagerDuty's de-duplication: a resolve closes the incident its trigger opened.
        dedup_key: clip(alert.key, 255),
        ...(resolve
            ? {}
            : {
                  payload: {
                      summary: clip(alert.title, 1024),
                      source: ctx.appName ?? 'ottabase',
                      severity: alert.severity,
                      component: alert.source,
                      class: alert.kind,
                      timestamp: iso(alert.raisedAt),
                      custom_details: {
                          ...(alert.body ? { body: alert.body } : {}),
                          ...Object.fromEntries(alert.fields.map((field) => [field.label, field.value])),
                          ...(alert.heldBefore ? { held_before: alert.heldBefore } : {}),
                      },
                  },
                  ...(alert.url ? { links: [{ href: alert.url, text: 'Open' }] } : {}),
              }),
    };
}

/** The JSON a webhook receiver gets. Plain data, stable names. */
export function publicAlert(alert: Alert) {
    return {
        id: alert.id,
        key: alert.key,
        source: alert.source,
        kind: alert.kind,
        severity: alert.severity,
        status: alert.status,
        title: alert.title,
        body: alert.body,
        url: alert.url,
        fields: alert.fields,
        heldBefore: alert.heldBefore,
        raisedAt: iso(alert.raisedAt),
    };
}

/** The HTTP request for a non-email channel. */
export async function buildRequest(
    type: Exclude<ChannelType, 'email'>,
    secrets: ChannelSecrets,
    config: ChannelConfig,
    out: Outbound,
    ctx: RenderContext,
): Promise<{ url: string; init: RequestInit }> {
    const json = (url: string, body: unknown, headers: Record<string, string> = {}) => ({
        url,
        init: {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...headers },
            body: JSON.stringify(body),
            // An outbound target must never bounce the request somewhere else.
            redirect: 'manual' as const,
        },
    });
    switch (type) {
        case 'slack':
            return json(secrets.url!, slackBody(out, ctx));
        case 'discord':
            return json(secrets.url!, discordBody(out, ctx));
        case 'telegram':
            return json(`https://api.telegram.org/bot${secrets.botToken}/sendMessage`, {
                chat_id: config.chatId,
                text: telegramText(out, ctx),
                parse_mode: 'HTML',
                link_preview_options: { is_disabled: true },
            });
        case 'pagerduty':
            if (out.kind !== 'alert') throw new Error('PagerDuty takes one alert at a time');
            return json('https://events.pagerduty.com/v2/enqueue', pagerdutyBody(secrets.routingKey!, out.alert, ctx));
        case 'webhook': {
            const event = out.kind === 'alert' ? `alert.${out.alert.status}` : `alerts.${out.reason}`;
            const body = JSON.stringify(
                out.kind === 'alert'
                    ? { type: event, app: ctx.appName, deliveryId: ctx.deliveryId, alert: publicAlert(out.alert) }
                    : {
                          type: event,
                          app: ctx.appName,
                          deliveryId: ctx.deliveryId,
                          total: out.total,
                          since: iso(out.since),
                          alerts: out.alerts.map(publicAlert),
                      },
            );
            const signature = await buildSignatureHeader(secrets.signingSecret!, body, Math.floor(ctx.now / 1000));
            return {
                url: secrets.url!,
                init: {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        [SIGNATURE_HEADER]: signature,
                        [EVENT_HEADER]: event,
                        [DELIVERY_HEADER]: ctx.deliveryId,
                    },
                    body,
                    redirect: 'manual',
                },
            };
        }
    }
}

/** The service's answer as an outcome. Fixing a 404 takes a person; a 429 or a 503 takes a minute. */
export async function judgeResponse(
    response: Response,
): Promise<{ ok: true } | { ok: false; error: string; permanent: boolean }> {
    if (response.status >= 200 && response.status < 300) return { ok: true };
    // One chunk is all a detail needs: a target answering with a huge body must not fill the isolate.
    let detail = '';
    try {
        const reader = response.body?.getReader();
        if (reader) {
            const { value } = await reader.read();
            await reader.cancel().catch(() => undefined);
            detail = new TextDecoder()
                .decode(value ?? new Uint8Array())
                .slice(0, MAX_ERROR)
                .replace(/\s+/g, ' ')
                .trim();
        }
    } catch {
        detail = '';
    }
    const error = clip(`HTTP ${response.status}${detail ? `: ${detail}` : ''}`, MAX_ERROR);
    if (response.status >= 300 && response.status < 400) {
        return { ok: false, error: `${error} (redirects are not followed)`.slice(0, MAX_ERROR), permanent: true };
    }
    const permanent = [400, 401, 403, 404, 410, 413, 422].includes(response.status);
    return { ok: false, error, permanent };
}
