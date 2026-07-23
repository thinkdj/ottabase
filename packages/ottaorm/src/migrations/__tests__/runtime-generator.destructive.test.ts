import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { describe, expect, test, vi } from 'vitest';
import { autoMigrate } from '../runtime-generator';

class FakeDriver {
    tables: Record<string, string[]> = {};
    executed: string[] = [];
    recordedMigrations: Set<string>;

    constructor(initial: Record<string, string[]>, recordedMigrations: string[] = []) {
        this.tables = { ...initial };
        this.recordedMigrations = new Set(recordedMigrations);
    }

    async executeRaw(sql: string, params?: any[]) {
        this.executed.push(sql.trim());

        const up = sql.trim();

        // sqlite_master query
        if (/SELECT name FROM sqlite_master/i.test(up)) {
            const results = Object.keys(this.tables).map((name) => ({ name }));
            return { results };
        }

        // pragma table_info
        const pragmaMatch = up.match(/PRAGMA table_info\((?:"|')?(.*?)?(?:"|')?\)/i);
        if (pragmaMatch) {
            const t = pragmaMatch[1];
            const cols = (this.tables[t] || []).map((c) => ({ name: c }));
            return { results: cols };
        }

        // CREATE TABLE
        const createMatch = up.match(/CREATE TABLE IF NOT EXISTS\s+"?([\w_]+)"?\s*\(([\s\S]*)\)/i);
        if (createMatch) {
            const name = createMatch[1];
            const colsDef = createMatch[2];
            const cols = colsDef
                .split(',')
                .map((s) => s.trim().split(' ')[0].replace(/"/g, ''))
                .filter(Boolean);
            this.tables[name] = cols;
            return { results: [] };
        }

        // ALTER TABLE ADD COLUMN
        const addCol = up.match(/ALTER TABLE "?([\w_]+)"? ADD COLUMN "?([\w_]+)"?/i);
        if (addCol) {
            const [, table, col] = addCol;
            this.tables[table] = this.tables[table] || [];
            if (!this.tables[table].includes(col)) this.tables[table].push(col);
            return { results: [] };
        }

        // INSERT INTO new SELECT ... FROM old -> ignore
        if (/INSERT INTO/i.test(up) && /SELECT/i.test(up) && /FROM/i.test(up)) {
            return { results: [] };
        }

        // DROP TABLE
        const drop = up.match(/DROP TABLE "?([\w_]+)"?/i);
        if (drop) {
            const name = drop[1];
            delete this.tables[name];
            return { results: [] };
        }

        // ALTER TABLE ... RENAME TO ...
        const rename = up.match(/ALTER TABLE "?([\w_]+)"? RENAME TO "?([\w_]+)"?/i);
        if (rename) {
            const [, from, to] = rename;
            this.tables[to] = this.tables[from];
            delete this.tables[from];
            return { results: [] };
        }

        // migration table related queries (table name is quoted via quoteIdentifier)
        if (/CREATE TABLE IF NOT EXISTS "?_ottabase_migrations"?/i.test(up)) {
            return { results: [] };
        }
        if (/SELECT name FROM "?_ottabase_migrations"? WHERE name = \?/i.test(up)) {
            const name = params?.[0];
            return { results: this.recordedMigrations.has(name) ? [{ name }] : [] };
        }
        if (/INSERT INTO "?_ottabase_migrations"?/i.test(up)) {
            const name = params?.[0];
            if (name) this.recordedMigrations.add(name);
            return { results: [] };
        }

        return { results: [] };
    }
}

describe('autoMigrate destructive flow', () => {
    test('skips destructive changes when disabled', async () => {
        // Model defines users with id,name,new_col
        const usersTable = sqliteTable('users', {
            id: text('id').primaryKey(),
            name: text('name'),
            new_col: text('new_col'),
        });

        // DB has users with id,name,old_col
        const driver = new FakeDriver({ users: ['id', 'name', 'old_col'] });

        const result = await autoMigrate({
            driver: driver as any,
            tables: { usersTable },
            customMigrations: [],
            verbose: false,
        } as any);

        // Should report an error about removed columns and not perform DROP/RENAME
        expect(result.errors.some((e) => /Detected removed columns on users/i.test(e))).toBe(true);
        expect(driver.executed.some((s) => /DROP TABLE "?users"?/i.test(s))).toBe(false);
    });

    test('performs recreate flow when destructive allowed with renameMap', async () => {
        const usersTable = sqliteTable('users', {
            id: text('id').primaryKey(),
            name: text('name'),
            new_col: text('new_col'),
        });

        // DB has users with id,name,old_col
        const driver = new FakeDriver({ users: ['id', 'name', 'old_col'] });

        const result = await autoMigrate({
            driver: driver as any,
            tables: { usersTable },
            customMigrations: [],
            verbose: true,
            allowDestructive: true,
            renameMap: { users: { old_col: 'new_col' } },
        } as any);

        // Expect steps: CREATE users__new, INSERT ... FROM users, DROP TABLE users, RENAME TO users
        const executed = driver.executed.join('\n');
        expect(/CREATE TABLE IF NOT EXISTS "?users__new"?/i.test(executed)).toBe(true);
        expect(/INSERT INTO "?users__new"?/i.test(executed)).toBe(true);
        expect(/DROP TABLE "?users"?/i.test(executed)).toBe(true);
        expect(/ALTER TABLE "?users__new"? RENAME TO "?users"?/i.test(executed)).toBe(true);
        expect(result.errors.length).toBe(0);
    });

    test('re-runs an already-recorded migration whose affectedTables were just destructively rebuilt', async () => {
        const usersTable = sqliteTable('users', {
            id: text('id').primaryKey(),
            name: text('name'),
            new_col: text('new_col'),
        });

        const driver = new FakeDriver({ users: ['id', 'name', 'old_col'] }, ['users_index_migration_v1']);
        const up = vi.fn(async () => {});

        const result = await autoMigrate({
            driver: driver as any,
            tables: { usersTable },
            customMigrations: [{ name: 'users_index_migration_v1', up, affectedTables: ['users'] }],
            verbose: false,
            allowDestructive: true,
            renameMap: { users: { old_col: 'new_col' } },
        } as any);

        expect(up).toHaveBeenCalledTimes(1);
        expect(result.customMigrationsRun).toContain('users_index_migration_v1');
        expect(result.customMigrationsSkipped).not.toContain('users_index_migration_v1');
        // Already recorded — must not attempt a duplicate INSERT (name is UNIQUE).
        expect(driver.executed.filter((s) => /INSERT INTO "?_ottabase_migrations"?/i.test(s))).toHaveLength(0);
    });

    test('skips an already-recorded migration whose affectedTables were NOT rebuilt this run', async () => {
        const usersTable = sqliteTable('users', {
            id: text('id').primaryKey(),
            name: text('name'),
            new_col: text('new_col'),
        });

        const driver = new FakeDriver({ users: ['id', 'name', 'old_col'] }, ['unrelated_migration_v1']);
        const up = vi.fn(async () => {});

        const result = await autoMigrate({
            driver: driver as any,
            tables: { usersTable },
            customMigrations: [{ name: 'unrelated_migration_v1', up, affectedTables: ['some_other_table'] }],
            verbose: false,
            allowDestructive: true,
            renameMap: { users: { old_col: 'new_col' } },
        } as any);

        expect(up).not.toHaveBeenCalled();
        expect(result.customMigrationsSkipped).toContain('unrelated_migration_v1');
        expect(result.customMigrationsRun).not.toContain('unrelated_migration_v1');
    });
});
