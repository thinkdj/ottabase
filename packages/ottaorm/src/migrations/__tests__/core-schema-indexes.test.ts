import { describe, expect, test } from 'vitest';
import { accountsTable } from '../../models/Account.schema';
import { auditLogsTable } from '../../models/AuditLog.schema';
import { authenticatorsTable } from '../../models/Authenticator.schema';
import { mediaTable } from '../../models/Media.schema';
import { organizationsTable } from '../../models/Organization.schema';
import { rolesTable } from '../../models/Role.schema';
import { scheduledTasksTable } from '../../models/ScheduledTask.schema';
import { sessionsTable } from '../../models/Session.schema';
import { tagsTable } from '../../models/Tag.schema';
import { userRolesTable } from '../../models/UserRole.schema';
import { usersTable } from '../../models/User.schema';
import { verificationTokensTable } from '../../models/VerificationToken.schema';
import { autoMigrate } from '../runtime-generator';

/** Minimal driver that reports an empty database and records every executed statement. */
class RecordingDriver {
    executed: string[] = [];

    async executeRaw(sql: string, _params?: any[]) {
        this.executed.push(sql.trim());
        // Empty DB: no existing tables → everything takes the CREATE path.
        return { results: [] };
    }

    async executeBatch(sqls: string[]) {
        for (const sql of sqls) this.executed.push(sql.trim());
        return { results: [] };
    }
}

/**
 * Regression guard for the core hot-path indexes. SQLite only auto-indexes PRIMARY KEY and
 * UNIQUE columns, so RLS-scoped filter columns (organizationId / userId / appId / …) must be
 * explicitly indexed or every tenant-scoped query degrades into a full table scan as data grows.
 * Each entry pins the index name the migration generator is expected to emit for that table.
 */
describe('runtime generator — core-table secondary indexes', () => {
    const cases: Array<{ name: string; table: any; expectedIndexes: string[] }> = [
        {
            name: 'accounts',
            table: accountsTable,
            expectedIndexes: ['accounts_provider_account_idx', 'accounts_user_idx'],
        },
        { name: 'sessions', table: sessionsTable, expectedIndexes: ['sessions_user_idx'] },
        { name: 'organizations', table: organizationsTable, expectedIndexes: ['organizations_owner_idx'] },
        {
            name: 'audit_logs',
            table: auditLogsTable,
            expectedIndexes: ['audit_logs_org_created_idx', 'audit_logs_user_idx', 'audit_logs_resource_idx'],
        },
        {
            name: 'media',
            table: mediaTable,
            expectedIndexes: ['media_org_created_idx', 'media_user_idx', 'media_app_idx'],
        },
        {
            name: 'user_roles',
            table: userRolesTable,
            expectedIndexes: ['user_roles_user_org_idx', 'user_roles_role_idx'],
        },
        {
            name: 'verification_tokens',
            table: verificationTokensTable,
            expectedIndexes: ['verification_tokens_token_idx'],
        },
        { name: 'scheduled_tasks', table: scheduledTasksTable, expectedIndexes: ['scheduled_tasks_active_next_idx'] },
        { name: 'tags', table: tagsTable, expectedIndexes: ['tags_app_idx'] },
        { name: 'users', table: usersTable, expectedIndexes: ['users_referred_by_idx'] },
        { name: 'authenticators', table: authenticatorsTable, expectedIndexes: ['authenticators_user_idx'] },
        { name: 'roles', table: rolesTable, expectedIndexes: ['roles_org_idx'] },
    ];

    for (const { name, table, expectedIndexes } of cases) {
        test(`emits CREATE INDEX for ${name}`, async () => {
            const driver = new RecordingDriver();
            const result = await autoMigrate({
                driver: driver as any,
                tables: { [name]: table },
                customMigrations: [],
            } as any);

            const sql = driver.executed.join('\n');
            for (const idx of expectedIndexes) {
                expect(sql).toContain(`CREATE INDEX IF NOT EXISTS "${idx}"`);
                expect(result.indexesEnsured).toContain(`${name}.${idx}`);
            }
            expect(result.errors).toEqual([]);
        });
    }

    test('roles: per-org custom roles are keyed by a composite UNIQUE (organization_id, name)', async () => {
        const driver = new RecordingDriver();
        const result = await autoMigrate({
            driver: driver as any,
            tables: { roles: rolesTable },
            customMigrations: [],
        } as any);
        const sql = driver.executed.join('\n');

        // organization_id column exists and the old global name-unique is gone from CREATE TABLE.
        expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "roles"[\s\S]*"organization_id"/i);
        expect(sql).not.toMatch(/"name" text NOT NULL UNIQUE/i);
        // Uniqueness is now per (organization_id, name) so two orgs can share a role name.
        expect(sql).toContain(
            'CREATE UNIQUE INDEX IF NOT EXISTS "roles_org_name_unique" ON "roles" ("organization_id", "name")',
        );
        expect(result.indexesEnsured).toContain('roles.roles_org_name_unique');
        expect(result.errors).toEqual([]);
    });
});
