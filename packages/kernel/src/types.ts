// ============================================================
// @ottabase/kernel — the package contract
// ============================================================
// One manifest describes everything a package contributes to an app: tables,
// migrations, models, RLS policies, API routes, cron handlers, queue handlers,
// event subscriptions, admin navigation, required env, a health probe and
// lifecycle hooks. The app registers manifests in ONE list and the framework
// derives the rest. Free and paid packages share this contract; a paid one
// adds licensing on top (`@ottabase/premium`).
// ============================================================

import type { TaskHandler } from '@ottabase/cron';
import type { Subscription } from '@ottabase/events';
import type { Migration, ModelRLSConfig, registerModels } from '@ottabase/ottaorm';
import type { Awaitable, Gate, Middleware, Router } from '@ottabase/ottarouter';
import type { JobHandler } from '@ottabase/queue';

export type { Awaitable };

/** What `registerModels()` accepts: a model class, or one with package metadata. */
export type ModelEntry = Parameters<typeof registerModels>[0][number];

/**
 * What a package's routes receive at mount time. `packages` is the app's registry, so a
 * package can ask what else is installed. `premium` is set by `@ottabase/premium` when it
 * mounts paid packages; `premiumRegistryOf(host)` reads it with its proper type.
 */
export interface PackageHost<Env = unknown> {
    packages: PackageRegistry<Env>;
    premium?: unknown;
}

/** How a package contributes API routes. A package may contribute several mounts. */
export interface RouteContribution<Env = unknown> {
    /** Mount prefix in the host app, e.g. `/api/shortlinks`. Must start with `/`. `/` is allowed. */
    basePath: string;
    /**
     * Build the sub-router. Called ONCE at mount time, never per request; an ottarouter
     * Router freezes when mounted, so this must return a fresh instance.
     */
    build: (host: PackageHost<Env>) => Router<Env>;
    /** Request-time gate. `false` makes the whole subtree invisible and matching continues past it. */
    when?: Gate<Env>;
    /** Middleware run before the subtree on every request under `basePath` (auth, rate limits). */
    before?: Middleware<Env>;
}

/**
 * A cron handler. Handlers run from the app's one-minute scheduler against rows in
 * `scheduled_tasks`; `schedule` seeds that row on install so nothing has to be clicked in
 * the admin. Name handlers `<package>:<verb>` ("payport:expire-licenses").
 *
 * `TaskHandler<Env, never>` accepts a handler typed for any payload; the handler validates
 * the payload it is given, since the row's JSON is operator-edited.
 */
export interface CronContribution<Env = unknown> {
    description: string;
    handler: TaskHandler<Env, never>;
    /** Cron expression to seed as an active task on first install. Omit for on-demand handlers. */
    schedule?: string;
    /** Default payload for the seeded task. */
    payload?: Record<string, unknown> | null;
}

/** Admin navigation entry. `icon` is a lucide export NAME; the manifest stays headless. */
export interface NavContribution {
    title: string;
    description: string;
    href: string;
    icon?: string;
    /** Which admin capability the page needs. Mirrors the host's own nav scopes. Default `platform`. */
    scope?: 'platform' | 'org';
    /** Admin nav group id in the host (e.g. `growth`, `content`). Default: the host decides. */
    group?: string;
}

/**
 * An error the host could not handle, offered to every package that reports errors. The
 * host's own log line and 5xx response are already written when this is built; a reporter
 * only records.
 */
export interface ErrorIncident<Env = unknown> {
    error: unknown;
    env: Env;
    /** Where it happened: a request, a scheduled task, a queue job, or somewhere else. */
    source: 'request' | 'cron' | 'queue' | 'other';
    request?: Request;
    /** Task or job name for cron and queue incidents. */
    task?: string;
    /** Correlates with the host's own log line (the `cf-ray`, or whatever the host chose). */
    requestId?: string;
    /** Keeps the isolate alive for the report; the host passes `ctx.waitUntil` when it has one. */
    waitUntil?: (promise: Promise<unknown>) => void;
}

/** How a package observes unhandled errors (an error tracker, a pager). */
export interface ErrorContribution<Env = unknown> {
    /** Called for every incident. Must not throw; the registry logs and swallows if it does. */
    report: (incident: ErrorIncident<Env>) => Awaitable<void>;
}

/** Env keys (vars, secrets and bindings) this package reads. Checked by the health report. */
export interface EnvContribution {
    required?: string[];
    optional?: string[];
}

export interface HealthCheck {
    name: string;
    ok: boolean;
    detail?: string;
}

/** Answers "is this package able to do its job right now?" with concrete checks. Must not throw. */
export type HealthProbe<Env = unknown> = (env: Env) => Awaitable<HealthCheck | HealthCheck[]>;

export interface LifecycleContext<Env = unknown> {
    env: Env;
    key: string;
    /** Version recorded before this transition; null on first install. */
    previousVersion: string | null;
    /** Version the manifest declares now. */
    version: string;
}

/**
 * Lifecycle hooks. Every one is OPTIONAL and BEST-EFFORT: a hook that throws is logged and
 * swallowed, because a package's bookkeeping must never take the app down. Anything that
 * MUST succeed belongs in a migration.
 *
 * Declared as methods on purpose: method parameters are bivariant, so a package framework
 * that passes a richer context (premium passes license claims) still satisfies this type.
 */
export interface LifecycleHooks<Env = unknown> {
    /** First time this package key is seen by this deployment. Seed defaults here. */
    onInstall?(ctx: LifecycleContext<Env>): Awaitable<void>;
    /** Manifest version differs from the recorded one. Migrate package-owned KV/state here. */
    onUpgrade?(ctx: LifecycleContext<Env>): Awaitable<void>;
    /** Explicit offboarding for a controlled uninstall deployment. Never a runtime admin action. */
    onUninstall?(ctx: LifecycleContext<Env>): Awaitable<void>;
}

export interface OttaPackage<Env = unknown> {
    /** Stable identifier: config keys, env var names, API paths. `^[a-z][a-z0-9-]{1,48}$`. */
    key: string;
    /** Display name. */
    name: string;
    /** Package version. A change triggers `onUpgrade`. */
    version: string;
    description?: string;
    docsUrl?: string;

    /** Drizzle tables, keyed by their export name (`...Table`), contributed to auto-init. */
    tables?: Record<string, unknown>;
    /** Migrations appended after the tables. */
    migrations?: Migration[];
    /** Index names auto-init must not create (a uniqueness some mode relaxes). */
    suppressIndexes?: string[];
    /** OttaORM model classes to register at boot. */
    models?: ModelEntry[];
    /** RLS policies registered after the host's `initRLS()`. */
    policies?: ModelRLSConfig[];

    /** API routes. */
    routes?: RouteContribution<Env> | RouteContribution<Env>[];
    /** Cron handlers by name. Names are unique across the app; the registry throws on a clash. */
    cron?: Record<string, CronContribution<Env>>;
    /**
     * Queue job handlers by job type. Unique across the app. `JobHandler<never, Env>` accepts
     * a handler typed for any payload.
     */
    queue?: Record<string, JobHandler<never, Env>>;
    /** Event subscriptions, registered on the app's bus. */
    events?: Array<Subscription<Env, never>>;

    nav?: NavContribution[];
    env?: EnvContribution;
    health?: HealthProbe<Env>;
    lifecycle?: LifecycleHooks<Env>;
    /** Observe unhandled errors the host reports through `registry.report()`. */
    errors?: ErrorContribution<Env>;

    /**
     * Set by `@ottabase/premium`. The kernel collects EVERYTHING from a premium package
     * (tables, models, cron, events…) but leaves route mounting and lifecycle to the premium
     * registry, which gates both on the license.
     */
    premium?: boolean;
}

/**
 * What a package factory lets the host add on top of the package's own data half: routes whose
 * handlers live in the app, extra cron or queue handlers, subscriptions, nav, env and health.
 */
export type PackageExtras<Env = unknown> = Partial<
    Pick<OttaPackage<Env>, 'routes' | 'cron' | 'queue' | 'events' | 'nav' | 'env' | 'health' | 'lifecycle'>
>;

/** The app's registry: every installed package, and everything they contribute, collected. */
export interface PackageRegistry<Env = unknown> {
    readonly packages: ReadonlyArray<OttaPackage<Env>>;
    has(key: string): boolean;
    get(key: string): OttaPackage<Env> | null;
    keys(): string[];
    /** `{ [key]: true }` for every installed package. The client-side mirror derives the same map. */
    installed(): Record<string, boolean>;

    tables(): Record<string, unknown>;
    migrations(): Migration[];
    suppressIndexes(): string[];
    models(): ModelEntry[];
    policies(): ModelRLSConfig[];
    routes(): Array<RouteContribution<Env> & { packageKey: string }>;
    cron(): Record<string, CronContribution<Env> & { packageKey: string }>;
    queue(): Record<string, JobHandler<never, Env>>;
    events(): Array<Subscription<Env, never>>;
    nav(): Array<NavContribution & { packageKey: string }>;
    env(): { required: string[]; optional: string[] };
    /**
     * Hand an unhandled error to every package that reports errors. Never throws and never
     * waits: each reporter runs under `incident.waitUntil` when the host gave one.
     */
    report(incident: ErrorIncident<Env>): void;
}

export interface HealthReport {
    ok: boolean;
    checks: Array<HealthCheck & { package: string }>;
}
