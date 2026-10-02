import { sql } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { createD1Driver } from '../drizzle/drizzle-d1';

// Minimal D1 binding fake: records the prepared SQL and returns fixed rows.
function fakeD1(rows: Record<string, unknown>[]) {
    const stmt = {
        bind: vi.fn(() => stmt),
        all: vi.fn(async () => ({ results: rows, success: true, meta: {} })),
        raw: vi.fn(async () => rows.map((r) => Object.values(r))),
        first: vi.fn(async () => rows[0]),
        run: vi.fn(async () => ({ success: true, meta: {} })),
    };
    return { prepare: vi.fn(() => stmt), batch: vi.fn(), exec: vi.fn(), dump: vi.fn() };
}

describe('D1Driver.execute', () => {
    it('runs a Drizzle SQL query and returns its rows', async () => {
        const d1 = fakeD1([{ id: 1, name: 'a' }]);
        const driver = createD1Driver(d1 as never);

        const rows = await driver.execute<{ id: number; name: string }>(
            sql`SELECT id, name FROM users WHERE id = ${1}`,
        );

        expect(d1.prepare).toHaveBeenCalledWith('SELECT id, name FROM users WHERE id = ?');
        expect(rows).toEqual([{ id: 1, name: 'a' }]);
    });
});
