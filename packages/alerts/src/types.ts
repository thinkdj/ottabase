import type { EnvContribution, HealthProbe } from '@ottabase/kernel';
import type { Ctx } from '@ottabase/ottarouter';
import type { SEVERITIES } from './constants';
import type { Alerts } from './engine';

export type Awaitable<T> = T | Promise<T>;

/** How loud an alert is. Channels take a minimum; `critical` is never capped or batched. */
export type Severity = (typeof SEVERITIES)[number];
/** A condition starting (or still true), or the same key clearing. */
export type AlertStatus = 'firing' | 'resolved';
export type ChannelType = 'email' | 'slack' | 'discord' | 'telegram' | 'pagerduty' | 'webhook';
export type ChannelMode = 'immediate' | 'digest';
export type DeliveryStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'dead' | 'held' | 'digest' | 'digested';

export interface AlertField {
    label: string;
    value: string;
}

/**
 * What a package raises. Only `source`, `kind` and `title` are required; everything is
 * bounded before it is stored, and nothing in it is trusted as markup by any channel.
 */
export interface AlertInput {
    /** The raising package's key: `blackbox`, `tower`, `payport`. */
    source: string;
    /** What happened, dotted: `issue.new`, `app.down`, `license.activated`. */
    kind: string;
    /** Default `warning`. Send a resolve with the severity of what it resolves, so it reaches the same channels. */
    severity?: Severity;
    /** Default `firing`. */
    status?: AlertStatus;
    /** One line: the subject of a mail, the header of a Slack message. */
    title: string;
    /** Plain text, several lines allowed. */
    body?: string | null;
    /** Where to look. An app path (`/admin/...`) is made absolute against the app's base URL. */
    url?: string | null;
    /** Up to ten short facts, shown as a grid where the channel has one. */
    fields?: AlertField[];
    /**
     * What makes two alerts "the same" for the cooldown and for PagerDuty's de-duplication.
     * Default `source:kind:title`. Give a stable id when the title varies (`tower:<appId>`).
     */
    key?: string;
    /** The same key and state again within this many ms is counted, not sent. Default 30 min; 0 sends every one. */
    cooldownMs?: number;
    /** When it happened. Default now. */
    at?: number;
}

export interface RaiseOptions {
    /** Keeps the isolate alive for the sends; without it they are awaited before `raise()` resolves. */
    waitUntil?: (promise: Promise<unknown>) => void;
}

export interface RaiseResult {
    /** The stored alert, or null when the cooldown held it back. */
    id: string | null;
    /** True when the cooldown held it back. */
    suppressed: boolean;
    /** Channels it was routed to (sent now, held for the cap, or waiting for a digest). */
    routed: number;
}

/**
 * What a package needs to raise alerts, and nothing more. Packages take this type (often
 * as an optional `alerts` option) so they never import the engine; the app hands them its
 * one `createAlerts()` instance.
 */
export interface AlertSink<Env = unknown> {
    raise(env: Env, alert: AlertInput, options?: RaiseOptions): Promise<RaiseResult>;
}

/** A stored alert. */
export interface Alert {
    id: string;
    key: string;
    source: string;
    kind: string;
    severity: Severity;
    status: AlertStatus;
    title: string;
    body: string | null;
    /** Absolute, or null. */
    url: string | null;
    fields: AlertField[];
    /** Repeats held back by the cooldown before this one went out. */
    heldBefore: number;
    raisedAt: number;
}

/** Non-secret settings, per type. */
export interface ChannelConfig {
    /** `email`: the recipients. */
    to?: string[];
    /** `telegram`: the chat id or `@channelname`. */
    chatId?: string;
}

/** What grants posting rights, per type. Sealed at rest; never sent to the browser. */
export interface ChannelSecrets {
    /** `slack`, `discord`, `webhook`. */
    url?: string;
    /** `telegram`. */
    botToken?: string;
    /** `pagerduty`: the Events API v2 integration key. */
    routingKey?: string;
    /** `webhook`: the HMAC key receivers verify `X-Ottabase-Signature` with. */
    signingSecret?: string;
}

/** A channel as the console sees it. */
export interface ChannelView {
    id: string;
    name: string;
    type: ChannelType;
    /** A harmless, recognisable part of the target. */
    hint: string | null;
    config: ChannelConfig;
    minSeverity: Severity;
    /** `source` or `source:kind` entries; null takes everything. */
    sources: string[] | null;
    mode: ChannelMode;
    digestHour: number;
    maxPerHour: number;
    enabled: boolean;
    lastSentAt: number | null;
    lastError: string | null;
    lastErrorAt: number | null;
    failures: number;
    /** False when the sealed secret no longer opens (the encryption secret changed): enter the target again. */
    readable: boolean;
    /** The channel `emailTo` describes: shown, tested, never edited here. */
    fromEnv: boolean;
    createdAt: number;
}

/** A channel as a create or a change returns it: a webhook's generated signing secret, this once. */
export type SavedChannel = ChannelView & { signingSecret?: string };

/** What the console posts to create a channel or change one. Secrets left out of a change are kept. */
export interface ChannelInput {
    name?: string;
    type?: ChannelType;
    minSeverity?: Severity;
    sources?: string[] | null;
    mode?: ChannelMode;
    digestHour?: number;
    maxPerHour?: number;
    enabled?: boolean;
    /** `email`. */
    to?: string[] | string;
    /** `slack`, `discord`, `webhook`. */
    url?: string;
    /** `telegram`. */
    botToken?: string;
    chatId?: string;
    /** `pagerduty`. */
    routingKey?: string;
    /** `webhook`. Generated on create when left out; `rotate` issues a new one. */
    signingSecret?: string;
    rotateSigningSecret?: boolean;
}

export interface DeliveryView {
    id: string;
    channelId: string;
    channelName: string;
    channelType: ChannelType | null;
    status: DeliveryStatus;
    attempts: number;
    lastError: string | null;
    sentAt: number | null;
    nextAttemptAt: number | null;
}

/** One row of the feed: the alert and where it went. */
export interface AlertView extends Alert {
    deliveries: DeliveryView[];
}

export interface AlertsSummary {
    /** Alerts stored in the last 24 hours, by severity. */
    last24h: Record<Severity, number>;
    /** Deliveries waiting for a channel's cap or digest. */
    waiting: number;
    /** Deliveries that gave up in the last 24 hours. */
    dead24h: number;
    /** Sources seen in the retention window, for the channel form. */
    sources: string[];
}

/** The outcome of one send. */
export type SendOutcome = { ok: true } | { ok: false; error: string; permanent: boolean };

/** One mail, handed to the composition's mailer. */
export interface AlertMail {
    to: string[];
    subject: string;
    text: string;
    html: string;
}

/** The engine's settings. Every function reads per request: the env carries the secrets. */
export interface AlertsOptions<Env> {
    /** This deployment's app id; partitions the rows. */
    appId: (env: Env) => string;
    /** Named in messages: "Acme · blackbox". */
    appName?: (env: Env) => string | null | undefined;
    /** The app's origin (`AUTH_URL`): app paths in alerts become links against it. */
    baseUrl?: (env: Env) => string | null | undefined;
    /**
     * Key material channel secrets are sealed with (`ALERTS_SECRET`, else `AUTH_SECRET`).
     * Changing it leaves stored channels unreadable until their target is entered again.
     */
    secret: (env: Env) => string | null | undefined;
    /** Sends a mail through the app's mailer; a throw is a failed delivery. Without it, email channels fail. */
    email?: { send: (env: Env, mail: AlertMail) => Promise<void> };
    /** Recipients of the built-in email channel (`ALERTS_EMAIL_TO`, comma-separated). Unset: no such channel. */
    emailTo?: (env: Env) => string | string[] | null | undefined;
    /** Bearer token for `POST /api/alerts/ingest` (`ALERTS_INGEST_TOKEN`). Unset: the route refuses. */
    ingestToken?: (env: Env) => string | null | undefined;
    /** Default cooldown. Default 30 minutes. */
    cooldownMs?: number;
    /** Replace global fetch (tests, service bindings). */
    fetch?: typeof fetch;
    now?: () => number;
}

export interface AlertsCaller {
    userId: string;
    organizationId: string | null;
    appId: string;
    /** Platform (system-scoped) administrator: the only one who manages channels. */
    platformAdmin?: boolean;
}

export interface AlertsPackageOptions<Env> {
    /** The app's one engine, from `createAlerts()`. */
    alerts: Alerts<Env>;
    /** The host's session to caller. Null means anonymous. Never read from request headers. */
    resolveCaller: (request: Request, env: Env) => Awaitable<AlertsCaller | null>;
    /** Guard for the console routes. Defaults to `caller.platformAdmin === true`. */
    requireAdmin?: (c: Ctx<Env>, caller: AlertsCaller) => Awaitable<Response | null>;
    /**
     * Alert on unhandled errors (a 5xx, a failed scheduled task, a queue job that gave up),
     * one per error shape per hour. Turn it off where an error tracker already alerts:
     * otta-web answers `false` once `@ottabase/blackbox` is installed. Default true.
     */
    reportErrors?: boolean | ((env: Env) => Awaitable<boolean>);
    /**
     * Throttle for `/ingest`, by the caller's address, run before the token is compared: a
     * response ends the request. Unset, the token (24 characters at least) is the only gate.
     */
    rateLimit?: (request: Request, env: Env) => Awaitable<Response | null>;
    /** Default `/api/alerts`. */
    basePath?: string;
    /** Cron for retries, held-back summaries and digests. Default every five minutes. */
    sweepSchedule?: string;
    /** Cron for the prune. Default daily at 04:20. */
    pruneSchedule?: string;
    /** Days alerts are kept. Default 30. */
    retentionDays?: number;
    /** Env this deployment reads, for the health report. */
    env?: EnvContribution;
    /** Replace the built-in channel probe. */
    health?: HealthProbe<Env>;
}
