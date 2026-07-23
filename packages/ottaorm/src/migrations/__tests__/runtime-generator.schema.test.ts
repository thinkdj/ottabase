import { sql } from 'drizzle-orm';
import { index, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { describe, expect, test } from 'vitest';
import { autoMigrate } from '../runtime-generator';

/** Minimal driver that reports an empty database and records every executed statement. */
class RecordingDriver {
    executed: string[] = [];

    async executeRaw(sql: string, _params?: any[]) {
        this.executed.push(sql.trim());
        // Empty DB: no existing tables/columns → everything takes the CREATE path.
        return { results: [] };
    }
}

describe('runtime generator — schema constraints', () => {
    test('emits composite PRIMARY KEY for primaryKey({ columns })', async () => {
        const members = sqliteTable(
            'members',
            {
                userId: text('user_id').notNull(),
                orgId: text('org_id').notNull(),
                role: text('role'),
            },
            (t) => ({
                pk: primaryKey({ columns: [t.userId, t.orgId] }),
                roleIdx: index('members_role_idx').on(t.role),
            }),
        );

        const driver = new RecordingDriver();
        const result = await autoMigrate({ driver: driver as any, tables: { members }, customMigrations: [] } as any);
        const sql = driver.executed.join('\n');

        expect(/CREATE TABLE IF NOT EXISTS "members"/i.test(sql)).toBe(true);
        // Composite PK must be emitted as a table-level constraint (was previously dropped).
        expect(/PRIMARY KEY \("user_id", "org_id"\)/i.test(sql)).toBe(true);
        // Declared index is created idempotently and tracked.
        expect(/CREATE INDEX IF NOT EXISTS "members_role_idx" ON "members" \("role"\)/i.test(sql)).toBe(true);
        expect(result.indexesEnsured).toContain('members.members_role_idx');
        expect(result.errors).toEqual([]);
    });

    test('emits composite UNIQUE index for uniqueIndex().on(...)', async () => {
        const posts = sqliteTable(
            'posts2',
            {
                id: text('id').primaryKey(),
                orgId: text('org_id'),
                slug: text('slug'),
            },
            (t) => ({
                slugUx: uniqueIndex('posts2_org_slug_ux').on(t.orgId, t.slug),
            }),
        );

        const driver = new RecordingDriver();
        const result = await autoMigrate({ driver: driver as any, tables: { posts }, customMigrations: [] } as any);
        const sql = driver.executed.join('\n');

        expect(
            /CREATE UNIQUE INDEX IF NOT EXISTS "posts2_org_slug_ux" ON "posts2" \("org_id", "slug"\)/i.test(sql),
        ).toBe(true);
        expect(result.indexesEnsured).toContain('posts2.posts2_org_slug_ux');
    });

    test('emits the WHERE clause for a partial uniqueIndex().where(...) instead of dropping it', async () => {
        const posts3 = sqliteTable(
            'posts3',
            {
                id: text('id').primaryKey(),
                appId: text('app_id'),
                slug: text('slug'),
            },
            (t) => ({
                // Mirrors Post.schema.ts's posts_slug_unique_no_app_idx: unique on slug
                // ONLY among platform-owned rows (appId IS NULL) — a global unique index
                // would defeat per-org slug namespaces if the WHERE were ever dropped.
                slugNoAppUx: uniqueIndex('posts3_slug_unique_no_app_ux')
                    .on(t.slug)
                    .where(sql`${t.appId} IS NULL`),
            }),
        );

        const driver = new RecordingDriver();
        const result = await autoMigrate({ driver: driver as any, tables: { posts3 }, customMigrations: [] } as any);
        const emittedSql = driver.executed.join('\n');

        expect(
            /CREATE UNIQUE INDEX IF NOT EXISTS "posts3_slug_unique_no_app_ux" ON "posts3" \("slug"\) WHERE "posts3"\."app_id" IS NULL/i.test(
                emittedSql,
            ),
        ).toBe(true);
        expect(result.indexesEnsured).toContain('posts3.posts3_slug_unique_no_app_ux');
    });
});
