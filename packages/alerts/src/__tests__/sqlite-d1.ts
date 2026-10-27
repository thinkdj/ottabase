// A real SQLite database (node:sqlite, in memory) behind the slice of the D1 binding API that
// Drizzle's D1 driver uses, so the model stores run real SQL: upserts, RETURNING, unique
// indexes and counters behave as they do on D1. Same shape as ottalanding's and Blackbox's.

import type { createD1Driver } from '@ottabase/db/drizzle-d1';
import { DatabaseSync } from 'node:sqlite';

type D1Database = Parameters<typeof createD1Driver>[0];
type Param = string | number | bigint | null | Uint8Array;
type Rows = Record<string, unknown>[];

export function createSqliteD1(): D1Database & { sqlite: DatabaseSync } {
    const db = new DatabaseSync(':memory:');
    const norm = (params: unknown[]): Param[] =>
        params.map((v) => (typeof v === 'boolean' ? Number(v) : v === undefined ? null : (v as Param)));

    const prepare = (sql: string) => {
        let params: Param[] = [];
        const stmt = {
            bind(...p: unknown[]) {
                // D1 refuses a statement with more than 100 bound values; so does this.
                if (p.length > 100) throw new Error(`D1_ERROR: too many SQL variables (${p.length})`);
                params = norm(p);
                return stmt;
            },
            async all() {
                return { results: db.prepare(sql).all(...params) as Rows, success: true, meta: {} };
            },
            async raw() {
                return (db.prepare(sql).all(...params) as Rows).map((row) => Object.values(row));
            },
            async first(column?: string) {
                const row = db.prepare(sql).get(...params) as Record<string, unknown> | undefined;
                return row ? (column ? row[column] : row) : null;
            },
            async run() {
                const r = db.prepare(sql).run(...params);
                return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
            },
        };
        return stmt;
    };

    return {
        sqlite: db,
        prepare,
        batch: async (stmts: Array<{ all(): Promise<unknown> }>) => Promise.all(stmts.map((s) => s.all())),
        exec: async (sql: string) => {
            db.exec(sql);
            return { count: 0, duration: 0 };
        },
    } as unknown as D1Database & { sqlite: DatabaseSync };
}
