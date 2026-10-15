import { createD1Driver } from '@ottabase/db/drizzle-d1';
import {
    autoInit,
    clearConnection,
    configureOttaORM,
    hasConnection,
    initRLS,
    registerConnection,
    registerModels,
    registerPolicy,
} from '@ottabase/ottaorm';
import { ScheduledTask } from '@ottabase/ottaorm/models';
import * as schema from '../../ottabase/db/schema';
import { packages } from '../../ottabase/registry';

let readyFor: D1Database | null = null;

/**
 * Connect the ORM to this request's D1 and teach it every model and policy the packages
 * contribute. Bindings are stable object references within an isolate, so this runs once
 * per isolate (again if the binding ever changes).
 */
export function ensureDbConnection(env: CloudflareEnv): void {
    if (!env.OBCF_D1 || readyFor === env.OBCF_D1) return;
    configureOttaORM({ maxAllRows: env.OTTAORM_MAX_ALL_ROWS });
    if (hasConnection('default')) clearConnection('default');
    try {
        registerConnection('default', createD1Driver(env.OBCF_D1));
        registerModels([ScheduledTask, ...packages.models()]);
        initRLS();
        // After initRLS(): the RLS registry is last-write-wins and a built-in would replace these.
        for (const policy of packages.policies()) registerPolicy(policy);
        readyFor = env.OBCF_D1;
    } catch (error) {
        readyFor = null;
        if (hasConnection('default')) clearConnection('default');
        throw error;
    }
}

type Schema = Parameters<typeof autoInit>[0]['schema'];

/** Core tables (every `*Table` export of schema.ts) plus whatever the installed packages contribute. */
export function getAllSchemas(): Schema {
    const core = Object.fromEntries(Object.entries(schema).filter(([key]) => key.endsWith('Table'))) as Schema;
    return { ...core, ...(packages.tables() as Schema) };
}

/** Create or update every table, then run the packages' own migrations. Idempotent. */
export async function initDatabase(env: CloudflareEnv) {
    ensureDbConnection(env);
    const destructive = env.MIGRATION_ALLOW_DESTRUCTIVE?.trim().toLowerCase();
    return autoInit({
        driver: createD1Driver(env.OBCF_D1),
        schema: getAllSchemas(),
        customMigrations: packages.migrations(),
        suppressIndexes: packages.suppressIndexes(),
        allowDestructive: destructive === '1' || destructive === 'true',
        verbose: false,
    });
}

export function resetDbConnectionForTests(): void {
    readyFor = null;
    if (hasConnection('default')) clearConnection('default');
}
