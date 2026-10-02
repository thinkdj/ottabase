import { describe, expect, it, vi } from 'vitest';
import { rollbackMigrations, runMigrations, type Migration } from '../index';

// Both runners must hand `up()`/`down()` the DbDriver itself, the same object autoInit passes,
// so one migration body (`db.executeRaw(sql)`) works under either entry point.
function createDriver(executed: string[] = []) {
    return {
        executeRaw: vi.fn(async (sql: string) => {
            if (sql.includes('SELECT name FROM _ottabase_migrations')) {
                return { results: executed.map((name) => ({ name })) };
            }
            return { results: [] };
        }),
    };
}

describe('runMigrations / rollbackMigrations', () => {
    it('pass the DbDriver (executeRaw) to up() and down()', async () => {
        const driver = createDriver(['m1']);
        const migration: Migration = {
            name: 'm1',
            up: async (db) => {
                await db.executeRaw('CREATE INDEX IF NOT EXISTS i ON t(c)');
            },
            down: async (db) => {
                await db.executeRaw('DROP INDEX IF EXISTS i');
            },
        };
        vi.spyOn(console, 'log').mockImplementation(() => undefined);

        await expect(runMigrations(driver as never, [migration])).resolves.toEqual({ executed: ['m1'], skipped: [] });
        await expect(rollbackMigrations(driver as never, [migration])).resolves.toEqual({ rolledBack: ['m1'] });

        const statements = driver.executeRaw.mock.calls.map(([sql]) => sql);
        expect(statements).toContain('CREATE INDEX IF NOT EXISTS i ON t(c)');
        expect(statements).toContain('DROP INDEX IF EXISTS i');
    });
});
