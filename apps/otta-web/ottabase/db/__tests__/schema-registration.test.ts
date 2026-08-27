// ============================================================
// A table can be registered in three places and STILL be skipped by auto-init,
// with no error anywhere — the symptom is an empty result that sends people to
// debug the wrong layer.
//
// These assertions are cheap and they are the only thing standing between
// "I added the table to PACKAGE_REGISTRY" and "the table actually exists in D1".
// ============================================================

import { describe, expect, it } from 'vitest';
import { getEnabledPackageTables } from '../../config.migrations';
import { getAllSchemas, getSchemaSummary } from '../schemas-helper';
import * as drizzleSchema from '../schema';

/**
 * `collectTableSchemas` (the auto-init migrator) picks up entries whose KEY ends in
 * `Table`. A correctly-shaped table exported under a key that does not is invisible to it.
 */
const AI_TABLE_KEY = 'aiProviderCredentialsTable';

describe('ai_provider_credentials reaches auto-init', () => {
    it('appears in getAllSchemas() under a key the migrator will collect', () => {
        const schemas = getAllSchemas() as Record<string, unknown>;
        expect(Object.keys(schemas)).toContain(AI_TABLE_KEY);
        expect(AI_TABLE_KEY.endsWith('Table')).toBe(true);
    });

    it('appears in getSchemaSummary() too — auto-init silently skips a table missing from either', () => {
        expect(getSchemaSummary().packages).toContain(AI_TABLE_KEY);
    });

    it('is the real Drizzle table, with the columns the resolver and the write path depend on', () => {
        const table = (getAllSchemas() as unknown as Record<string, Record<string, unknown>>)[AI_TABLE_KEY]!;
        // The tenancy tuple the AAD binds and the resolver scores on…
        for (const column of ['id', 'organizationId', 'userId', 'appId', 'provider']) {
            expect(table[column], `missing column: ${column}`).toBeDefined();
        }
        // …the secret UNION with its stored discriminator (not two nullable columns)…
        for (const column of ['secretKind', 'secretCiphertext', 'secretAlias', 'keyHint']) {
            expect(table[column], `missing column: ${column}`).toBeDefined();
        }
        // …the keyring index that makes rotation batchable…
        for (const column of ['keyId', 'formatVersion']) {
            expect(table[column], `missing column: ${column}`).toBeDefined();
        }
        // …and the health columns, which ship in the INITIAL schema because every consuming
        // app otherwise hits the same support question and adds the identical columns.
        for (const column of ['lastUsedAt', 'lastSuccessAt', 'lastErrorAt', 'lastErrorCode', 'consecutiveFailures']) {
            expect(table[column], `missing column: ${column}`).toBeDefined();
        }
    });
});

describe('comments package schema adapters stay in lockstep', () => {
    const tableKeys = ['commentsTable', 'commentReactionsTable'] as const;

    it('exports every enabled comments table through the runtime and drizzle-kit adapters', () => {
        const packageTables = getEnabledPackageTables() as Record<string, unknown>;
        const runtimeTables = getAllSchemas() as Record<string, unknown>;
        const staticTables = drizzleSchema as Record<string, unknown>;

        for (const tableKey of tableKeys) {
            expect(packageTables[tableKey], `PACKAGE_REGISTRY.${tableKey}`).toBeDefined();
            expect(runtimeTables[tableKey], `getAllSchemas().${tableKey}`).toBe(packageTables[tableKey]);
            expect(staticTables[tableKey], `db/schema.${tableKey}`).toBe(packageTables[tableKey]);
        }
    });
});
