// ============================================================
// @ottabase/fleet — the report: what one app says about itself
// ============================================================
// Every app that lists the package answers `GET /api/fleet/report` to a bearer token with
// one JSON document: its packages and their versions, each Premium Package's license state,
// the kernel health report, its scheduled tasks, and its newest backup. A cockpit is just a
// consumer of this document; so is `curl`.
// ============================================================

import { runHealth, type PackageRegistry } from '@ottabase/kernel';
import { ScheduledTask } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import { timingSafeEqual } from '@ottabase/utils/hmac-signature';
import type { FleetOptions, FleetReport, FleetReportTask, FleetStatus } from './types';

/** Null when the request carries this app's Fleet token. Never passes when no token is configured. */
export function authorizeFleet(request: Request, expected: string | null | undefined): Response | null {
    const want = expected?.trim();
    if (!want) {
        return errorResponse('FLEET_TOKEN is not set; this app cannot be watched until it is', 503, {
            code: 'NOT_CONFIGURED',
        });
    }
    const header = request.headers.get('authorization') ?? '';
    const got = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    return got && timingSafeEqual(got, want) ? null : errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
}

const ms = (value: unknown): number | null =>
    value === null || value === undefined ? null : value instanceof Date ? value.getTime() : Number(value);

async function defaultTasks(appId: string): Promise<FleetReportTask[]> {
    const rows = await ScheduledTask.where({ appId }, { limit: 200 });
    return rows.map((row) => ({
        name: String(row.get('name')),
        task: String(row.get('task')),
        isActive: Boolean(row.get('isActive')),
        lastStatus: (row.get('lastStatus') as string | null) ?? null,
        lastRunAt: ms(row.get('lastRunAt')),
        lastError: (row.get('lastError') as string | null) ?? null,
        failCount: Number(row.get('failCount') ?? 0),
    }));
}

/** Build this app's report. A source that throws is named in `errors`; the rest of the report stands. */
export function createReporter<Env>(
    packages: PackageRegistry<Env>,
    options: FleetOptions<Env>,
): (env: Env) => Promise<FleetReport> {
    const now = options.now ?? Date.now;
    return async (env) => {
        const appId = options.appId(env);
        const errors: string[] = [];
        const guard = async <T>(label: string, run: () => Promise<T> | T, fallback: T): Promise<T> => {
            try {
                return await run();
            } catch (error) {
                errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
                return fallback;
            }
        };
        const [health, statuses, tasks, backup] = await Promise.all([
            runHealth(packages, env),
            guard('licenses', () => options.licenses?.(env) ?? [], []),
            guard('tasks', () => (options.sources?.tasks ? options.sources.tasks(env) : defaultTasks(appId)), []),
            guard('backup', () => options.sources?.backup?.(env) ?? null, null),
        ]);
        const licenses = new Map(statuses.map((status) => [status.key, status]));
        return {
            app: appId,
            environment: options.environment?.(env) ?? 'unknown',
            takenAt: now(),
            packages: packages.packages.map((pkg) => {
                const status = licenses.get(pkg.key);
                return {
                    key: pkg.key,
                    name: pkg.name,
                    version: pkg.version,
                    ...(status
                        ? {
                              premium: {
                                  state: status.state,
                                  plan: status.plan ?? null,
                                  expiresAt: status.expiresAt ?? null,
                              },
                          }
                        : {}),
                };
            }),
            health,
            tasks,
            backup,
            canInit: Boolean(options.init),
            errors,
        };
    };
}

/** A board's verdict on a report: a failing check or a failing active task makes it `degraded`. */
export function summarize(report: FleetReport): { status: FleetStatus; detail: string | null } {
    const checks = report.health.checks.filter((check) => !check.ok).map((check) => `${check.package}/${check.name}`);
    const tasks = report.tasks
        .filter((task) => task.isActive && task.lastStatus === 'failed')
        .map((task) => `cron ${task.task}`);
    const problems = [...checks, ...tasks];
    return problems.length ? { status: 'degraded', detail: problems.join(', ') } : { status: 'ok', detail: null };
}
