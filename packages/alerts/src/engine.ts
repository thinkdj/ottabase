// ============================================================
// @ottabase/alerts: the engine
// ============================================================
// `createAlerts()` is the app's one alert pipeline. A package calls `raise()`; the engine:
//
//   1. bounds the input and makes its link absolute,
//   2. asks the alert's key whether the cooldown holds it back (one upsert, see AlertKey),
//   3. stores it and routes it to every channel whose severity floor and source filter
//      take it,
//   4. per channel decides: send now, hold for the channel's hourly cap, or wait for its
//      daily digest (`critical` and PagerDuty are never held or batched),
//   5. sends what is due now, under `waitUntil` when the caller has one.
//
// A send that fails is retried by the sweep (every five minutes) after 1, 5, 15 and 60
// minutes, then given up; a 404 or a revoked token is given up at once. The sweep also
// sends each channel's held-back alerts as one summary once its cap allows, and each digest
// channel's digest once a day.
//
// `raise()` never throws: an alert pipeline that can take down the code reporting a
// problem is worse than none. A failure is logged as one structured line.
// ============================================================

import type { HealthCheck } from '@ottabase/kernel';
import { redactErrorForLog } from '@ottabase/utils/http-errors';
import {
    CHANNEL_TYPES,
    ChannelInputError,
    buildRequest,
    isChannelType,
    judgeResponse,
    parseChannelTarget,
    renderMail,
    type Outbound,
    type RenderContext,
} from './channels';
import {
    ALERTS_ADMIN_PATH,
    DAY_MS,
    DEFAULT_COOLDOWN_MS,
    DEFAULT_DIGEST_HOUR,
    DEFAULT_MAX_PER_HOUR,
    DEFAULT_RETENTION_DAYS,
    DIGEST_LIST_LIMIT,
    ENV_EMAIL_CHANNEL_ID,
    EVENTS_PAGE_CEILING,
    FAILING_AFTER,
    HOUR_MS,
    MAX_ATTEMPTS,
    MAX_BODY,
    MAX_CHANNELS,
    MAX_ERROR,
    MAX_FIELD_LABEL,
    MAX_FIELD_VALUE,
    MAX_FIELDS,
    MAX_KEY,
    MAX_KIND,
    MAX_NAME,
    MAX_SOURCE,
    MAX_TITLE,
    MAX_URL,
    RETRY_DELAYS_MS,
    SEND_TIMEOUT_MS,
    SEVERITIES,
    SWEEP_BATCH,
} from './constants';
import { AlertChannel, type NewChannel } from './ottaorm-models/AlertChannel';
import { AlertDelivery, type NewDelivery } from './ottaorm-models/AlertDelivery';
import { AlertEvent, type EventFilter } from './ottaorm-models/AlertEvent';
import { AlertKey } from './ottaorm-models/AlertKey';
import type { AlertChannelRecord, AlertDeliveryRecord, AlertEventRecord } from './schema';
import { open, seal } from './secret';
import type {
    Alert,
    AlertField,
    AlertInput,
    AlertSink,
    AlertView,
    AlertsOptions,
    AlertsSummary,
    ChannelConfig,
    ChannelInput,
    ChannelMode,
    ChannelSecrets,
    ChannelType,
    ChannelView,
    DeliveryStatus,
    DeliveryView,
    RaiseOptions,
    RaiseResult,
    SavedChannel,
    SendOutcome,
    Severity,
} from './types';

// ── Pure helpers ─────────────────────────────────────────────

const rank = (severity: Severity) => SEVERITIES.indexOf(severity);
export const isSeverity = (value: unknown): value is Severity =>
    typeof value === 'string' && (SEVERITIES as readonly string[]).includes(value);

const oneLine = (value: string) => value.replace(/\s+/g, ' ').trim();
const cut = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);
const errorText = (error: unknown) => cut(error instanceof Error ? error.message : String(error), MAX_ERROR);

/** A link the alert may carry: http(s) only, absolute against `base` when it is an app path. */
export function absoluteUrl(url: string | null | undefined, base: string | null | undefined): string | null {
    if (!url?.trim()) return null;
    try {
        const parsed = base ? new URL(url.trim(), base) : new URL(url.trim());
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
        const href = parsed.toString();
        return href.length > MAX_URL ? null : href;
    } catch {
        return null;
    }
}

/** What `raise()` stores: every field bounded, the title on one line, the key settled. */
export function normalizeAlert(
    input: AlertInput,
    base: string | null | undefined,
): Omit<Alert, 'id' | 'heldBefore' | 'raisedAt'> {
    const source =
        String(input.source ?? '')
            .toLowerCase()
            .replace(/[^a-z0-9:_.-]/g, '')
            .slice(0, MAX_SOURCE) || 'app';
    const kind = oneLine(String(input.kind ?? '')).slice(0, MAX_KIND) || 'alert';
    const title = cut(oneLine(String(input.title ?? '')), MAX_TITLE) || `${source} ${kind}`;
    const body = typeof input.body === 'string' && input.body.trim() ? cut(input.body.trim(), MAX_BODY) : null;
    const fields: AlertField[] = (Array.isArray(input.fields) ? input.fields : [])
        .filter(
            (field) => field && typeof field.label === 'string' && field.value !== undefined && field.value !== null,
        )
        .map((field) => ({
            label: cut(oneLine(field.label), MAX_FIELD_LABEL),
            value: cut(String(field.value).trim(), MAX_FIELD_VALUE),
        }))
        .filter((field) => field.label && field.value)
        .slice(0, MAX_FIELDS);
    const key = cut(oneLine(input.key ?? '') || `${source}:${kind}:${title}`, MAX_KEY);
    return {
        key,
        source,
        kind,
        severity: isSeverity(input.severity) ? input.severity : 'warning',
        status: input.status === 'resolved' ? 'resolved' : 'firing',
        title,
        body,
        url: absoluteUrl(input.url, base),
        fields,
    };
}

/** Whether a channel takes an alert: on, loud enough, and from a source it listens to. */
export function channelTakes(
    channel: ChannelView,
    alert: { source: string; kind: string; severity: Severity },
): boolean {
    if (!channel.enabled) return false;
    if (rank(alert.severity) < rank(channel.minSeverity)) return false;
    if (!channel.sources?.length) return true;
    return channel.sources.includes(alert.source) || channel.sources.includes(`${alert.source}:${alert.kind}`);
}

/** The first moment of today's digest slot, at `hour` UTC. */
export function digestSlot(at: number, hour: number): number {
    const day = new Date(at);
    return Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour);
}

/** Whether a digest channel owes its digest now. */
export function digestDue(at: number, hour: number, lastDigestAt: number | null): boolean {
    const slot = digestSlot(at, hour);
    return at >= slot && (lastDigestAt ?? 0) < slot;
}

const parseJson = <T>(value: unknown, fallback: T): T => {
    if (typeof value !== 'string' || !value) return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
};

function toAlert(row: AlertEventRecord): Alert {
    return {
        id: row.id,
        key: row.key,
        source: row.source,
        kind: row.kind,
        severity: isSeverity(row.severity) ? row.severity : 'warning',
        status: row.status === 'resolved' ? 'resolved' : 'firing',
        title: row.title,
        body: row.body ?? null,
        url: row.url ?? null,
        fields: parseJson<AlertField[]>(row.fields, []),
        heldBefore: Number(row.heldBefore ?? 0),
        raisedAt: Number(row.raisedAt),
    };
}

/** Sources typed into the form: `blackbox`, `tower:app.down`. Empty means every source. */
function parseSources(value: unknown): string[] | null {
    const list = (Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,\s]+/) : [])
        .map((entry) =>
            String(entry)
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9:_.-]/g, ''),
        )
        .filter(Boolean)
        .slice(0, 20);
    return list.length ? [...new Set(list)] : null;
}

// ── Channels as the engine sees them ─────────────────────────

/** A channel ready to send to: its view, and how to open its secrets when a send needs them. */
interface Resolved {
    view: ChannelView;
    secrets: () => Promise<ChannelSecrets | null>;
}

export interface SweepResult {
    retried: number;
    summaries: number;
    digests: number;
}

export interface PruneResult {
    alerts: number;
    keys: number;
}

export interface TestResult {
    ok: boolean;
    error: string | null;
    delivery: DeliveryView | null;
}

export interface FeedFilter {
    source?: string;
    severity?: Severity;
    before?: number;
    limit?: number;
}

/** The engine: the sink packages raise into, plus what the console and the cron jobs need. */
export interface Alerts<Env> extends AlertSink<Env> {
    readonly options: AlertsOptions<Env>;
    /** Every channel of this app, the env email channel first when configured. */
    listChannels(env: Env): Promise<ChannelView[]>;
    /** The new channel; a webhook's generated signing secret comes back this once. */
    createChannel(env: Env, input: ChannelInput): Promise<SavedChannel>;
    updateChannel(env: Env, id: string, input: ChannelInput): Promise<SavedChannel | null>;
    removeChannel(env: Env, id: string): Promise<boolean>;
    /** Sends a test alert to one channel now, past its filters, cap and digest. */
    testChannel(env: Env, id: string): Promise<TestResult | null>;
    feed(env: Env, filter?: FeedFilter): Promise<AlertView[]>;
    summary(env: Env): Promise<AlertsSummary>;
    /** A failed or given-up delivery, sent again now. */
    retry(env: Env, deliveryId: string): Promise<DeliveryView | null>;
    sweep(env: Env): Promise<SweepResult>;
    prune(env: Env, retentionDays?: number): Promise<PruneResult>;
    /** The health check: failing channels fail it. */
    probe(env: Env): Promise<HealthCheck>;
}

export function createAlerts<Env>(options: AlertsOptions<Env>): Alerts<Env> {
    const now = options.now ?? Date.now;
    const fetcher: typeof fetch = options.fetch ?? ((input, init) => fetch(input, init));
    const appIdOf = (env: Env) => options.appId(env);
    const baseOf = (env: Env) => options.baseUrl?.(env) || null;

    function envRecipients(env: Env): string[] {
        const raw = options.emailTo?.(env);
        const list = (Array.isArray(raw) ? raw : (raw ?? '').split(/[,;\s]+/))
            .map((email) => email.trim().toLowerCase())
            .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
        return [...new Set(list)].slice(0, 10);
    }

    /** The channel `emailTo` describes, or null. Every source, every severity, sent at once. */
    function envChannel(env: Env): Resolved | null {
        const to = envRecipients(env);
        if (to.length === 0) return null;
        return {
            view: {
                id: ENV_EMAIL_CHANNEL_ID,
                name: 'Email (ALERTS_EMAIL_TO)',
                type: 'email',
                hint: to.join(', '),
                config: { to },
                minSeverity: 'info',
                sources: null,
                mode: 'immediate',
                digestHour: DEFAULT_DIGEST_HOUR,
                maxPerHour: DEFAULT_MAX_PER_HOUR,
                enabled: true,
                lastSentAt: null,
                lastError: options.email ? null : 'no mailer is configured for alerts',
                lastErrorAt: null,
                failures: 0,
                readable: true,
                fromEnv: true,
                createdAt: 0,
            },
            secrets: async () => ({}),
        };
    }

    async function resolveRecord(env: Env, record: AlertChannelRecord): Promise<Resolved> {
        const type = (isChannelType(record.type) ? record.type : 'webhook') as ChannelType;
        const secretOf = async () => {
            if (!record.secret) return {};
            const opened = await open(options.secret(env), record.secret);
            return opened === null ? null : parseJson<ChannelSecrets>(opened, {});
        };
        const readable = !record.secret || (await secretOf()) !== null;
        return {
            view: {
                id: record.id,
                name: record.name,
                type,
                hint: record.hint ?? null,
                config: parseJson<ChannelConfig>(record.config, {}),
                minSeverity: isSeverity(record.minSeverity) ? record.minSeverity : 'info',
                sources: parseJson<string[] | null>(record.sources, null),
                mode: record.mode === 'digest' ? 'digest' : 'immediate',
                digestHour: Number(record.digestHour ?? DEFAULT_DIGEST_HOUR),
                maxPerHour: Number(record.maxPerHour ?? DEFAULT_MAX_PER_HOUR),
                enabled: Boolean(record.enabled),
                lastSentAt: record.lastSentAt === null ? null : Number(record.lastSentAt),
                lastError: record.lastError ?? null,
                lastErrorAt: record.lastErrorAt === null ? null : Number(record.lastErrorAt),
                failures: Number(record.failures ?? 0),
                readable,
                fromEnv: false,
                createdAt: Number(record.createdAt),
            },
            secrets: secretOf,
        };
    }

    async function resolveAll(env: Env): Promise<Resolved[]> {
        const records = await AlertChannel.listFor(appIdOf(env));
        const fromEnv = envChannel(env);
        return [
            ...(fromEnv ? [fromEnv] : []),
            ...(await Promise.all(records.map((record) => resolveRecord(env, record)))),
        ];
    }

    async function resolveOne(env: Env, id: string): Promise<Resolved | null> {
        if (id === ENV_EMAIL_CHANNEL_ID) return envChannel(env);
        const record = await AlertChannel.findFor(appIdOf(env), id);
        return record ? resolveRecord(env, record) : null;
    }

    const contextOf = (env: Env, deliveryId: string): RenderContext => ({
        appName: options.appName?.(env) || null,
        consoleUrl: absoluteUrl(ALERTS_ADMIN_PATH, baseOf(env)),
        deliveryId,
        now: now(),
    });

    /** One message to one channel. Never throws; never puts a credential in the error it returns. */
    async function send(env: Env, channel: Resolved, out: Outbound, deliveryId: string): Promise<SendOutcome> {
        const ctx = contextOf(env, deliveryId);
        const { type, config } = channel.view;
        let secrets: ChannelSecrets | null = null;
        try {
            if (type === 'email') {
                if (!options.email) return { ok: false, error: 'no mailer is configured for alerts', permanent: true };
                if (!config.to?.length) return { ok: false, error: 'the channel has no recipients', permanent: true };
                await options.email.send(env, renderMail(config.to, out, ctx));
                return { ok: true };
            }
            secrets = await channel.secrets();
            if (!secrets) {
                return {
                    ok: false,
                    error: 'the channel target cannot be read (the encryption secret changed): enter it again',
                    permanent: true,
                };
            }
            const { url, init } = await buildRequest(type, secrets, config, out, ctx);
            const response = await fetcher(url, { ...init, signal: AbortSignal.timeout(SEND_TIMEOUT_MS) });
            return await judgeResponse(response);
        } catch (error) {
            let message = errorText(error);
            // A runtime error can echo the request URL, and for Telegram that URL holds the token.
            for (const value of Object.values(secrets ?? {})) {
                if (value) message = message.split(value).join('…');
            }
            return { ok: false, error: message, permanent: false };
        }
    }

    /** Claims one delivery, sends it, records how it went. Returns the row after, or null when it was not ours. */
    async function deliver(env: Env, deliveryId: string): Promise<AlertDeliveryRecord | null> {
        const appId = appIdOf(env);
        const at = now();
        const claimed = await AlertDelivery.claim(deliveryId, at);
        if (!claimed) return null;
        const [event, channel] = await Promise.all([
            AlertEvent.findFor(appId, claimed.eventId),
            resolveOne(env, claimed.channelId),
        ]);
        if (!event || !channel) {
            await AlertDelivery.markFailed(claimed.id, at, event ? 'channel removed' : 'alert pruned', null);
            return AlertDelivery.findFor(appId, claimed.id);
        }
        const outcome = await send(env, channel, { kind: 'alert', alert: toAlert(event) }, claimed.id);
        const done = now();
        if (outcome.ok) {
            await AlertDelivery.markSent(claimed.id, done);
            if (!channel.view.fromEnv) await AlertChannel.recordSent(channel.view.id, done);
        } else {
            const attempts = Number(claimed.attempts);
            const retryAt =
                outcome.permanent || attempts >= MAX_ATTEMPTS ? null : done + RETRY_DELAYS_MS[attempts - 1]!;
            await AlertDelivery.markFailed(claimed.id, done, outcome.error, retryAt);
            if (!channel.view.fromEnv) await AlertChannel.recordFailure(channel.view.id, done, outcome.error);
            console.warn(
                JSON.stringify({
                    event: 'alert_delivery_failed',
                    channel: channel.view.id,
                    type: channel.view.type,
                    attempt: attempts,
                    retry: retryAt !== null,
                    error: outcome.error,
                }),
            );
        }
        return AlertDelivery.findFor(appId, claimed.id);
    }

    /** Sends everything a channel has waiting in `reason` as one message. Returns whether it went out. */
    async function flush(env: Env, channel: Resolved, reason: 'held' | 'digest', at: number): Promise<boolean> {
        const waiting = await AlertDelivery.waiting(channel.view.id, reason, at, DIGEST_LIST_LIMIT);
        if (waiting.total === 0) return false;
        const outcome = await send(
            env,
            channel,
            {
                kind: 'batch',
                reason,
                alerts: waiting.events.map(toAlert),
                total: waiting.total,
                since: waiting.since ?? at,
            },
            `${reason}:${channel.view.id}:${at}`,
        );
        const done = now();
        if (outcome.ok) {
            // Only the rows this message covered: a raise that lands meanwhile waits for the next sweep.
            await AlertDelivery.markBatched(waiting.ids, done);
            if (!channel.view.fromEnv) await AlertChannel.recordSent(channel.view.id, done);
            return true;
        }
        // The rows stay waiting; the next sweep tries again, and the prune ends it at retention.
        if (!channel.view.fromEnv) await AlertChannel.recordFailure(channel.view.id, done, outcome.error);
        console.warn(
            JSON.stringify({ event: 'alert_batch_failed', channel: channel.view.id, reason, error: outcome.error }),
        );
        return false;
    }

    function deliveryView(row: AlertDeliveryRecord, channels: Map<string, ChannelView>): DeliveryView {
        const channel = channels.get(row.channelId);
        return {
            id: row.id,
            channelId: row.channelId,
            channelName:
                channel?.name ??
                (row.channelId === ENV_EMAIL_CHANNEL_ID ? 'Email (ALERTS_EMAIL_TO)' : 'Removed channel'),
            channelType: channel?.type ?? null,
            status: row.status as DeliveryStatus,
            attempts: Number(row.attempts),
            lastError: row.lastError ?? null,
            sentAt: row.sentAt === null ? null : Number(row.sentAt),
            nextAttemptAt: row.nextAttemptAt === null ? null : Number(row.nextAttemptAt),
        };
    }

    /** The channel fields a create or a change may set, validated. Throws ChannelInputError. */
    async function channelFields(
        env: Env,
        input: ChannelInput,
        existing: { record: AlertChannelRecord; resolved: Resolved } | null,
    ): Promise<{ fields: Partial<NewChannel>; revealed: string | null }> {
        const type: ChannelType | undefined = existing
            ? (existing.resolved.view.type as ChannelType)
            : isChannelType(input.type)
              ? input.type
              : undefined;
        if (!type) throw new ChannelInputError('Choose a channel type');
        if (existing && input.type !== undefined && input.type !== type) {
            throw new ChannelInputError('A channel cannot change type; add a new one');
        }
        const fields: Partial<NewChannel> = {};
        let revealed: string | null = null;

        if (input.name !== undefined || !existing) {
            const name = oneLine(String(input.name ?? '')).slice(0, MAX_NAME);
            if (!name) throw new ChannelInputError('Give the channel a name');
            fields.name = name;
        }
        if (input.minSeverity !== undefined) {
            if (!isSeverity(input.minSeverity)) throw new ChannelInputError('Severity is info, warning or critical');
            fields.minSeverity = input.minSeverity;
        }
        if (input.sources !== undefined) {
            const sources = parseSources(input.sources);
            fields.sources = sources ? JSON.stringify(sources) : null;
        }
        if (input.mode !== undefined) {
            const mode: ChannelMode | null =
                input.mode === 'digest' ? 'digest' : input.mode === 'immediate' ? 'immediate' : null;
            if (!mode) throw new ChannelInputError('Mode is immediate or digest');
            if (mode === 'digest' && !CHANNEL_TYPES[type].batches) {
                throw new ChannelInputError(`${CHANNEL_TYPES[type].label} pages at once; it cannot be a digest`);
            }
            fields.mode = mode;
        }
        if (input.digestHour !== undefined) {
            const hour = Number(input.digestHour);
            if (!Number.isInteger(hour) || hour < 0 || hour > 23)
                throw new ChannelInputError('The digest hour is 0 to 23 (UTC)');
            fields.digestHour = hour;
        }
        if (input.maxPerHour !== undefined) {
            const cap = Number(input.maxPerHour);
            if (!Number.isInteger(cap) || cap < 1 || cap > 1000)
                throw new ChannelInputError('The hourly limit is 1 to 1000');
            fields.maxPerHour = cap;
        }
        if (input.enabled !== undefined) fields.enabled = Boolean(input.enabled);

        const targetGiven =
            !existing ||
            ['to', 'url', 'botToken', 'chatId', 'routingKey', 'signingSecret', 'rotateSigningSecret'].some(
                (field) => input[field as keyof ChannelInput] !== undefined,
            );
        if (targetGiven) {
            const kept = existing
                ? { config: existing.resolved.view.config, secrets: await existing.resolved.secrets() }
                : undefined;
            const target = parseChannelTarget(type, input, kept);
            fields.config = JSON.stringify(target.config);
            fields.hint = target.hint;
            fields.secret = Object.keys(target.secrets).length
                ? await seal(options.secret(env), JSON.stringify(target.secrets))
                : null;
            // A signing secret the server made up is shown once, in this response, or no
            // receiver could ever verify a request. One the operator typed is never echoed.
            if (type === 'webhook' && !input.signingSecret?.trim() && (!existing || input.rotateSigningSecret)) {
                revealed = target.secrets.signingSecret ?? null;
            }
        }
        if (!existing) fields.type = type;
        return { fields, revealed };
    }

    const engine: Alerts<Env> = {
        options,

        async raise(env: Env, input: AlertInput, raiseOptions: RaiseOptions = {}): Promise<RaiseResult> {
            try {
                const appId = appIdOf(env);
                const at = typeof input.at === 'number' && Number.isFinite(input.at) ? input.at : now();
                const alert = normalizeAlert(input, baseOf(env));
                const cooldown = Math.max(0, input.cooldownMs ?? options.cooldownMs ?? DEFAULT_COOLDOWN_MS);
                const { send: goes, carried } = await AlertKey.touch(appId, alert.key, alert.status, at, cooldown);
                if (!goes) return { id: null, suppressed: true, routed: 0 };

                const event = await AlertEvent.insert({
                    appId,
                    key: alert.key,
                    source: alert.source,
                    kind: alert.kind,
                    severity: alert.severity,
                    status: alert.status,
                    title: alert.title,
                    body: alert.body,
                    url: alert.url,
                    fields: alert.fields.length ? JSON.stringify(alert.fields) : null,
                    heldBefore: carried,
                    raisedAt: at,
                });

                const channels = (await resolveAll(env)).filter((channel) => channelTakes(channel.view, alert));
                if (channels.length === 0) {
                    // Nowhere to go is still somewhere: the log, so nothing is ever silent.
                    console.warn(
                        JSON.stringify({
                            event: 'alert_unrouted',
                            source: alert.source,
                            kind: alert.kind,
                            severity: alert.severity,
                            status: alert.status,
                            title: alert.title,
                        }),
                    );
                    return { id: event.id, suppressed: false, routed: 0 };
                }

                const rows: NewDelivery[] = [];
                for (const channel of channels) {
                    let status: DeliveryStatus = 'pending';
                    const batches = CHANNEL_TYPES[channel.view.type].batches;
                    if (alert.severity !== 'critical' && batches) {
                        if (channel.view.mode === 'digest') status = 'digest';
                        else if (
                            (await AlertDelivery.sentSince(channel.view.id, at - HOUR_MS)) >= channel.view.maxPerHour
                        ) {
                            status = 'held';
                        }
                    }
                    // Stamped by the engine's clock, which the sweep compares against; never the column default.
                    rows.push({
                        appId,
                        eventId: event.id,
                        channelId: channel.view.id,
                        status,
                        attempts: 0,
                        createdAt: at,
                        updatedAt: at,
                    });
                }
                const deliveries = await AlertDelivery.insertMany(rows);
                const due = deliveries.filter((row) => row.status === 'pending').map((row) => row.id);
                if (due.length) {
                    const work = Promise.all(due.map((id) => deliver(env, id))).catch((error) =>
                        console.error(JSON.stringify({ event: 'alert_send_failed', error: redactErrorForLog(error) })),
                    );
                    if (raiseOptions.waitUntil) raiseOptions.waitUntil(work);
                    else await work;
                }
                return { id: event.id, suppressed: false, routed: deliveries.length };
            } catch (error) {
                console.error(
                    JSON.stringify({
                        event: 'alert_raise_failed',
                        source: input?.source ?? null,
                        kind: input?.kind ?? null,
                        error: redactErrorForLog(error),
                    }),
                );
                return { id: null, suppressed: false, routed: 0 };
            }
        },

        async listChannels(env) {
            return (await resolveAll(env)).map((channel) => channel.view);
        },

        async createChannel(env, input) {
            const appId = appIdOf(env);
            if ((await AlertChannel.countFor(appId)) >= MAX_CHANNELS) {
                throw new ChannelInputError(`An app may have at most ${MAX_CHANNELS} channels`);
            }
            const { fields, revealed } = await channelFields(env, input, null);
            const record = await AlertChannel.insert({
                appId,
                name: fields.name!,
                type: fields.type!,
                config: fields.config ?? '{}',
                secret: fields.secret ?? null,
                hint: fields.hint ?? null,
                minSeverity: fields.minSeverity ?? 'info',
                sources: fields.sources ?? null,
                mode: fields.mode ?? 'immediate',
                digestHour: fields.digestHour ?? DEFAULT_DIGEST_HOUR,
                maxPerHour: fields.maxPerHour ?? DEFAULT_MAX_PER_HOUR,
                enabled: fields.enabled ?? true,
            });
            const view = (await resolveRecord(env, record)).view;
            return revealed ? { ...view, signingSecret: revealed } : view;
        },

        async updateChannel(env, id, input) {
            const appId = appIdOf(env);
            if (id === ENV_EMAIL_CHANNEL_ID) {
                throw new ChannelInputError('This channel comes from ALERTS_EMAIL_TO; change it there');
            }
            const record = await AlertChannel.findFor(appId, id);
            if (!record) return null;
            const { fields, revealed } = await channelFields(env, input, {
                record,
                resolved: await resolveRecord(env, record),
            });
            const updated = await AlertChannel.patch(appId, id, fields);
            if (!updated) return null;
            const view = (await resolveRecord(env, updated)).view;
            return revealed ? { ...view, signingSecret: revealed } : view;
        },

        async removeChannel(env, id) {
            const appId = appIdOf(env);
            if (id === ENV_EMAIL_CHANNEL_ID) {
                throw new ChannelInputError('This channel comes from ALERTS_EMAIL_TO; unset it there');
            }
            const removed = await AlertChannel.remove(appId, id);
            if (removed) await AlertDelivery.abandonChannel(appId, id, now());
            return removed;
        },

        async testChannel(env, id) {
            const appId = appIdOf(env);
            const channel = await resolveOne(env, id);
            if (!channel) return null;
            const at = now();
            const appName = options.appName?.(env) || 'Ottabase';
            const event = await AlertEvent.insert({
                appId,
                key: `alerts:test:${id}:${at}`,
                source: 'alerts',
                kind: 'test',
                severity: 'info',
                status: 'firing',
                title: `Test alert from ${appName}`,
                body: `If you can read this, "${channel.view.name}" works. Sent from the alerts console.`,
                url: absoluteUrl(ALERTS_ADMIN_PATH, baseOf(env)),
                fields: null,
                heldBefore: 0,
                raisedAt: at,
            });
            const [row] = await AlertDelivery.insertMany([
                {
                    appId,
                    eventId: event.id,
                    channelId: id,
                    status: 'pending',
                    attempts: 0,
                    createdAt: at,
                    updatedAt: at,
                },
            ]);
            const after = await deliver(env, row!.id);
            const views = new Map([[channel.view.id, channel.view]]);
            const delivery = after ? deliveryView(after, views) : null;
            return {
                ok: delivery?.status === 'sent',
                error: delivery?.status === 'sent' ? null : (delivery?.lastError ?? 'not sent'),
                delivery,
            };
        },

        async feed(env, filter = {}) {
            const appId = appIdOf(env);
            const query: EventFilter = {
                source: filter.source,
                severity: filter.severity,
                before: filter.before,
                limit: Math.min(Math.max(filter.limit ?? 50, 1), EVENTS_PAGE_CEILING),
            };
            const events = await AlertEvent.recent(appId, query);
            const [deliveries, channels] = await Promise.all([
                AlertDelivery.forEvents(events.map((event) => event.id)),
                engine.listChannels(env),
            ]);
            const views = new Map(channels.map((channel) => [channel.id, channel]));
            const byEvent = new Map<string, DeliveryView[]>();
            for (const row of deliveries) {
                const list = byEvent.get(row.eventId) ?? [];
                list.push(deliveryView(row, views));
                byEvent.set(row.eventId, list);
            }
            return events.map((event) => ({ ...toAlert(event), deliveries: byEvent.get(event.id) ?? [] }));
        },

        async summary(env) {
            const appId = appIdOf(env);
            const at = now();
            const [counts, waiting, dead24h, sources] = await Promise.all([
                AlertEvent.countsSince(appId, at - DAY_MS),
                AlertDelivery.countWaiting(appId),
                AlertDelivery.countDeadSince(appId, at - DAY_MS),
                AlertEvent.sourcesSince(appId, at - DEFAULT_RETENTION_DAYS * DAY_MS),
            ]);
            return {
                last24h: { info: counts.info ?? 0, warning: counts.warning ?? 0, critical: counts.critical ?? 0 },
                waiting,
                dead24h,
                sources: sources.filter((source) => source !== 'alerts'),
            };
        },

        async retry(env, deliveryId) {
            const appId = appIdOf(env);
            const queued = await AlertDelivery.requeue(appId, deliveryId, now());
            if (!queued) return null;
            const after = (await deliver(env, queued.id)) ?? queued;
            const views = new Map((await engine.listChannels(env)).map((channel) => [channel.id, channel]));
            return deliveryView(after, views);
        },

        async sweep(env) {
            const appId = appIdOf(env);
            const at = now();
            const result: SweepResult = { retried: 0, summaries: 0, digests: 0 };

            // 1. Retries that are due, sends that died mid-way, and pending rows nobody sent.
            const due = await AlertDelivery.due(appId, at, at - 2 * 60_000, SWEEP_BATCH);
            for (let i = 0; i < due.length; i += 5) {
                const batch = await Promise.all(due.slice(i, i + 5).map((id) => deliver(env, id)));
                result.retried += batch.filter(Boolean).length;
            }

            // 2. Held-back alerts, as one summary per channel, once its hourly cap has room.
            for (const channelId of await AlertDelivery.channelsWaiting(appId, 'held')) {
                const channel = await resolveOne(env, channelId);
                if (!channel) {
                    await AlertDelivery.abandonChannel(appId, channelId, at);
                    continue;
                }
                if (!channel.view.enabled) continue;
                // A channel that keeps failing is tried once an hour here, not on every sweep.
                const { failures, lastErrorAt } = channel.view;
                if (failures >= FAILING_AFTER && lastErrorAt !== null && at - lastErrorAt < HOUR_MS) continue;
                if ((await AlertDelivery.sentSince(channelId, at - HOUR_MS)) >= channel.view.maxPerHour) continue;
                if (await flush(env, channel, 'held', at)) result.summaries += 1;
            }

            // 3. Digests, once a day per channel at its hour (UTC). No alerts, no mail.
            for (const record of await AlertChannel.listFor(appId)) {
                if (!record.enabled || record.mode !== 'digest') continue;
                const hour = Number(record.digestHour ?? DEFAULT_DIGEST_HOUR);
                const last = record.lastDigestAt === null ? null : Number(record.lastDigestAt);
                if (!digestDue(at, hour, last)) continue;
                const channel = await resolveRecord(env, record);
                const sent = await flush(env, channel, 'digest', at);
                if (sent) result.digests += 1;
                // One attempt per day, sent or not: a failed digest's alerts stay waiting and
                // join tomorrow's, rather than a broken channel being retried every five minutes.
                await AlertChannel.recordDigest(record.id, at);
            }
            return result;
        },

        async prune(env, retentionDays = DEFAULT_RETENTION_DAYS) {
            const appId = appIdOf(env);
            const before = now() - retentionDays * DAY_MS;
            const [alerts, keys] = [
                await AlertEvent.pruneBefore(appId, before),
                await AlertKey.pruneBefore(appId, before),
            ];
            return { alerts, keys };
        },

        async probe(env) {
            const name = 'alerts:channels';
            try {
                const enabled = (await engine.listChannels(env)).filter((channel) => channel.enabled);
                if (enabled.length === 0) return { name, ok: true, detail: 'no channels: alerts are only logged' };
                const failing = enabled.filter(
                    (channel) =>
                        !channel.readable ||
                        channel.failures >= FAILING_AFTER ||
                        (channel.fromEnv && channel.lastError !== null),
                );
                if (failing.length === 0) {
                    return {
                        name,
                        ok: true,
                        detail: `${enabled.length} channel${enabled.length === 1 ? '' : 's'} delivering`,
                    };
                }
                const worst = failing
                    .slice(0, 3)
                    .map(
                        (channel) =>
                            `${channel.name} (${channel.readable ? (channel.lastError ?? 'failing') : 'unreadable target'})`,
                    )
                    .join('; ');
                return {
                    name,
                    ok: false,
                    detail: cut(`${failing.length} of ${enabled.length} failing: ${worst}`, 400),
                };
            } catch (error) {
                const message = errorText(error);
                // Before init the tables do not exist: a fresh install, not a broken channel.
                if (/no such table/i.test(message)) return { name, ok: true, detail: 'not initialized yet' };
                return { name, ok: false, detail: message };
            }
        },
    };

    return engine;
}
