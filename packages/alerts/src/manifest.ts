// ============================================================
// @ottabase/alerts: the manifest
// ============================================================
// Five contributions carry it: the tables and models, the console's routes, two cron jobs
// (the five-minute sweep: retries, held-back summaries, digests; and the daily prune), the
// health probe (a failing channel fails it, so Tower sees it through Fleet), and an error
// reporter that turns unhandled errors into alerts when nothing better is installed.
//
// Free and MIT: alerting is a primitive every package leans on. Paid packages raise into it.
// ============================================================

import { definePackage, type ErrorIncident, type OttaPackage } from '@ottabase/kernel';
import { redactErrorForLog } from '@ottabase/utils/http-errors';
import {
    ALERTS_ADMIN_PATH,
    ALERTS_BASE_PATH,
    ALERTS_PACKAGE_KEY,
    ALERTS_PRUNE_HANDLER,
    ALERTS_SWEEP_HANDLER,
    DEFAULT_ERROR_COOLDOWN_MS,
    DEFAULT_PRUNE_SCHEDULE,
    DEFAULT_RETENTION_DAYS,
    DEFAULT_SWEEP_SCHEDULE,
} from './constants';
import { AlertChannel } from './ottaorm-models/AlertChannel';
import { AlertDelivery } from './ottaorm-models/AlertDelivery';
import { AlertEvent } from './ottaorm-models/AlertEvent';
import { AlertKey } from './ottaorm-models/AlertKey';
import { createAlertsRouter } from './routes';
import { alertChannelsTable, alertDeliveriesTable, alertEventsTable, alertKeysTable } from './schema';
import type { AlertInput, AlertsPackageOptions } from './types';

const LEAD: Record<ErrorIncident['source'], string> = {
    request: 'Server error',
    cron: 'Scheduled task failed',
    queue: 'Queue job failed',
    other: 'Unhandled error',
};

/** Ids, hashes and counts out of a message, so one failure with a thousand ids is one alert. */
export function errorShape(message: string): string {
    return message
        .split('\n')[0]!
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '#')
        .replace(/\b[0-9a-f]{12,}\b/gi, '#')
        .replace(/\d+/g, '#')
        .slice(0, 120);
}

/** An unhandled error as an alert: redacted, keyed by where it broke and the shape of its message. */
export function alertFromIncident<Env>(incident: ErrorIncident<Env>): AlertInput {
    const { name, message, stack } = redactErrorForLog(incident.error, 600);
    let where: string | null = incident.task ?? null;
    if (incident.request) {
        try {
            where = `${incident.request.method} ${new URL(incident.request.url).pathname}`;
        } catch {
            where = incident.request.method;
        }
    }
    const firstLine = message.split('\n')[0]!.slice(0, 160);
    // The stack's top frames: enough to know where, short enough for a chat message.
    const frames = stack
        ?.split('\n')
        .slice(1, 9)
        .map((line) => line.trim())
        .join('\n');
    return {
        source: 'errors',
        kind: incident.source,
        severity: 'warning',
        title: `${LEAD[incident.source]}${where ? ` (${where})` : ''}: ${name}: ${firstLine}`,
        body: frames || null,
        fields: [
            ...(where ? [{ label: 'Where', value: where }] : []),
            ...(incident.requestId ? [{ label: 'Request id', value: incident.requestId }] : []),
        ],
        // Not the path: a caller chooses it, and a key per path would be an alert per request.
        key: `errors:${incident.source}:${name}:${errorShape(message)}`,
        cooldownMs: DEFAULT_ERROR_COOLDOWN_MS,
    };
}

/** The package as the app registers it. */
export function createAlertsPackage<Env = unknown>(options: AlertsPackageOptions<Env>): OttaPackage<Env> {
    const {
        alerts,
        basePath = ALERTS_BASE_PATH,
        sweepSchedule = DEFAULT_SWEEP_SCHEDULE,
        pruneSchedule = DEFAULT_PRUNE_SCHEDULE,
        retentionDays = DEFAULT_RETENTION_DAYS,
        reportErrors = true,
    } = options;

    const reporting = async (env: Env) =>
        typeof reportErrors === 'function' ? await reportErrors(env) : reportErrors !== false;

    // An error storm is thousands of the same error a minute. The cooldown would hold all but one,
    // but only after a D1 upsert each; this isolate remembers what it raised lately and skips those
    // before touching D1. ponytail: per isolate, so the "held" count on the next alert misses the
    // repeats skipped here; a shared counter (KV, a Durable Object) if that count ever matters.
    const now = alerts.options.now ?? Date.now;
    const recent = new Map<string, number>();
    const firstLately = (key: string, at: number): boolean => {
        const last = recent.get(key);
        if (last !== undefined && at - last < DEFAULT_ERROR_COOLDOWN_MS) return false;
        recent.delete(key);
        recent.set(key, at);
        // Oldest first out, so a spray of distinct errors cannot grow the map without bound.
        if (recent.size > 500) recent.delete(recent.keys().next().value!);
        return true;
    };

    return definePackage<Env>({
        key: ALERTS_PACKAGE_KEY,
        name: 'Alerts',
        version: '0.1.0',
        description:
            'Operator alerts from every package to email, Slack, Discord, Telegram, PagerDuty or a signed webhook: de-duplicated, capped per channel, batched into digests, retried.',
        docsUrl: 'https://github.com/thinkdj/ottabase/tree/main/packages/alerts#readme',

        tables: { alertChannelsTable, alertEventsTable, alertDeliveriesTable, alertKeysTable },
        models: [AlertChannel, AlertEvent, AlertDelivery, AlertKey],
        // No RLS policies: the operator's rows, partitioned by app id, reached only through the routes.

        routes: {
            basePath,
            build: () =>
                createAlertsRouter<Env>({
                    alerts,
                    resolveCaller: options.resolveCaller,
                    requireAdmin: options.requireAdmin,
                    rateLimit: options.rateLimit,
                }),
        },

        cron: {
            [ALERTS_SWEEP_HANDLER]: {
                description: 'Alerts: retry failed sends, send held-back summaries and daily digests.',
                handler: async ({ env }) => {
                    const result = await alerts.sweep(env);
                    if (result.retried || result.summaries || result.digests) {
                        console.info(JSON.stringify({ event: 'alerts_sweep', ...result }));
                    }
                },
                schedule: sweepSchedule,
                payload: null,
            },
            [ALERTS_PRUNE_HANDLER]: {
                description: `Alerts: drop alerts older than ${retentionDays} days, with their deliveries.`,
                handler: async ({ env }) => {
                    console.info(
                        JSON.stringify({ event: 'alerts_prune', ...(await alerts.prune(env, retentionDays)) }),
                    );
                },
                schedule: pruneSchedule,
                payload: null,
            },
        },

        errors: {
            // Returns the raise so the registry's waitUntil keeps the isolate alive for the sends.
            report: async (incident) => {
                if (!(await reporting(incident.env))) return;
                const alert = alertFromIncident(incident);
                if (!firstLately(alert.key!, now())) return;
                await alerts.raise(incident.env, alert, { waitUntil: incident.waitUntil });
            },
        },

        nav: [
            {
                title: 'Alerts',
                description: 'Where operator alerts go, and every alert with where it went.',
                href: ALERTS_ADMIN_PATH,
                icon: 'BellRing',
                scope: 'platform',
                group: 'infrastructure',
            },
        ],

        ...(options.env ? { env: options.env } : {}),
        health: options.health ?? ((env) => alerts.probe(env)),
    });
}
