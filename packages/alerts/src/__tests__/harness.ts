// Shared setup for the suites that run the engine: real SQLite behind the D1 driver, a clock
// the test moves, a fetch that records what was sent and answers what the test says, and a
// mailer that records mail.

import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { autoInit, clearConnection, registerConnection, registerModels } from '@ottabase/ottaorm';
import { expect } from 'vitest';
import { createAlerts, type Alerts } from '../engine';
import { AlertChannel } from '../ottaorm-models/AlertChannel';
import { AlertDelivery } from '../ottaorm-models/AlertDelivery';
import { AlertEvent } from '../ottaorm-models/AlertEvent';
import { AlertKey } from '../ottaorm-models/AlertKey';
import { alertChannelsTable, alertDeliveriesTable, alertEventsTable, alertKeysTable } from '../schema';
import type { AlertMail, AlertsOptions } from '../types';
import { createSqliteD1 } from './sqlite-d1';

export interface TestEnv {
    secret: string;
    emailTo?: string;
    token?: string;
}

export const ENV: TestEnv = { secret: 'test-secret-that-is-long-enough' };
/** 2026-10-27 09:30 UTC: past an 08:00 digest slot. */
export const T0 = Date.UTC(2026, 9, 27, 9, 30);

export async function openDatabase(): Promise<void> {
    const sqlite = createSqliteD1();
    const driver = createD1Driver(sqlite);
    const schema = { alertChannelsTable, alertEventsTable, alertDeliveriesTable, alertKeysTable };
    const result = await autoInit({ driver, schema, verbose: false });
    expect(result.details.errors).toEqual([]);
    registerConnection('default', driver);
    registerModels([AlertChannel, AlertEvent, AlertDelivery, AlertKey]);
    // A fresh database per suite: the rows of one test never decide another's.
    for (const table of ['alert_channels', 'alert_events', 'alert_deliveries', 'alert_keys']) {
        sqlite.sqlite.exec(`DELETE FROM ${table}`);
    }
}

export const closeDatabase = () => clearConnection('default');

export interface Sent {
    url: string;
    body: string;
    headers: Record<string, string>;
}

/** A recording fetch. `answer` decides the response per URL; default 200 OK. */
export function fakeFetch(answer: (url: string) => Response | Error = () => new Response('ok')) {
    const sent: Sent[] = [];
    const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        sent.push({
            url,
            body: String(init?.body ?? ''),
            headers: Object.fromEntries(new Headers(init?.headers).entries()),
        });
        const reply = answer(url);
        if (reply instanceof Error) throw reply;
        return reply;
    }) as typeof fetch;
    return { fn, sent };
}

export function makeEngine(overrides: Partial<AlertsOptions<TestEnv>> = {}) {
    const clock = { now: T0 };
    const mail: AlertMail[] = [];
    const net = fakeFetch();
    const alerts: Alerts<TestEnv> = createAlerts<TestEnv>({
        appId: () => 'app',
        appName: () => 'Acme',
        baseUrl: () => 'https://acme.test',
        secret: (env) => env.secret,
        emailTo: (env) => env.emailTo,
        ingestToken: (env) => env.token,
        email: {
            send: async (_env, message) => {
                mail.push(message);
            },
        },
        fetch: net.fn,
        now: () => clock.now,
        ...overrides,
    });
    return { alerts, clock, mail, net };
}

export const SLACK_URL = 'https://hooks.slack.com/services/T000/B000/abcdefghijkl';
export const DISCORD_URL = 'https://discord.com/api/webhooks/123/abcdef';
export const TELEGRAM_TOKEN = '123456789:AAEhBP0av28vn5U7_abcdefghijklmnopqrstuv';
export const PAGERDUTY_KEY = 'R0abcdefghijklmnopqrstuvwxyz1234';
