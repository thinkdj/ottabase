import type { EnvContribution, HealthReport } from '@ottabase/kernel';

export type Awaitable<T> = T | Promise<T>;

/** A Premium Package's license state as the host's premium registry reports it. */
export interface FleetLicenseState {
    key: string;
    state: string;
    plan?: string | null;
    expiresAt?: number | null;
}

/** What Fleet says about one installed package. `premium` is present for Premium Packages only. */
export interface FleetReportPackage {
    key: string;
    name: string;
    version: string;
    premium?: { state: string; plan: string | null; expiresAt: number | null };
}

/** One scheduled task as Fleet reports it: only what a board needs to say "cron is failing". */
export interface FleetReportTask {
    name: string;
    task: string;
    isActive: boolean;
    lastStatus: string | null;
    lastRunAt: number | null;
    lastError: string | null;
    failCount: number;
}

/** What `GET /api/fleet/report` returns. Serialisable: a cockpit stores it as is. */
export interface FleetReport {
    app: string;
    environment: string;
    takenAt: number;
    packages: FleetReportPackage[];
    health: HealthReport;
    tasks: FleetReportTask[];
    /** The newest backup, when the host wired `sources.backup`. */
    backup: { id: string; createdAt: string } | null;
    /** Whether `POST /api/fleet/init` does anything here. */
    canInit: boolean;
    /** Sources that threw while the report was assembled. The report still stands. */
    errors: string[];
}

/** A board's verdict on a report. */
export type FleetStatus = 'ok' | 'degraded' | 'unreachable';

/** What Fleet reads from the host. Everything optional degrades to "not reported". */
export interface FleetSources<Env> {
    /** The newest backup, e.g. `async (env) => (await vault.list(env, 1))[0] ?? null`. */
    backup?: (env: Env) => Awaitable<{ id: string; createdAt: string } | null>;
    /** Replace the default scheduled-task read (`ScheduledTask.where({ appId })`). */
    tasks?: (env: Env) => Awaitable<FleetReportTask[]>;
}

export interface FleetOptions<Env> {
    /** This deployment's app id; names the report and scopes the task read. */
    appId: (env: Env) => string;
    /** Environment name for the report (`production`, `development`). */
    environment?: (env: Env) => string;
    /** The Fleet token this app expects. Default `env.FLEET_TOKEN`. Unset means the report refuses. */
    token?: (env: Env) => string | null | undefined;
    sources?: FleetSources<Env>;
    /**
     * License states of the host's Premium Packages, e.g. `(env) => premium.statuses(env)`.
     * A free package is mounted without the premium registry on its host, so the host hands it over.
     */
    licenses?: (env: Env) => Awaitable<FleetLicenseState[]>;
    /** What `POST /api/fleet/init` runs on THIS app (the Worker template passes its database init). */
    init?: (env: Env) => Awaitable<unknown>;
    /** Default `/api/fleet`. */
    basePath?: string;
    /** Env this deployment reads, for the health report. Default `{ optional: ['FLEET_TOKEN'] }`. */
    env?: EnvContribution;
    now?: () => number;
}
