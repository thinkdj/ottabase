import { and, eq } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { describe, expect, it, vi } from 'vitest';
import { BaseModel, ConcurrentMutationError } from '../BaseModel';

const guardedRows = sqliteTable('guarded_rows', {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    title: text('title'),
    secret: text('secret'),
    updatedAt: integer('updated_at'),
});

class GuardedRow extends BaseModel {
    static entity = 'guarded_rows';
    static table = guardedRows;
    static primaryKey = 'id';
    protected static casts = { updatedAt: 'datetime' as const };
    protected static hidden = ['secret'];
}

function conditionSql(condition: any): string {
    const chunks = condition.getSQL().queryChunks;
    return chunks.map((chunk: any) => (typeof chunk === 'string' ? chunk : (chunk?.value ?? String(chunk)))).join('');
}

function mutationDriver(returned: Array<Record<string, unknown>>) {
    const captured: { where?: any; set?: Record<string, unknown> } = {};
    const returning = vi.fn(async () => returned);
    const where = vi.fn((condition: any) => {
        captured.where = condition;
        return { returning };
    });
    const set = vi.fn((data: Record<string, unknown>) => {
        captured.set = data;
        return { where };
    });
    const update = vi.fn(() => ({ set }));
    const remove = vi.fn(() => ({ where }));
    return {
        captured,
        update,
        remove,
        driver: { getDb: () => ({ update, delete: remove }) },
    };
}

describe('atomic model mutations', () => {
    it('carries tenant and version predicates into the UPDATE statement', async () => {
        const db = mutationDriver([{ id: 'r1', organizationId: 'org-1', title: 'After', updatedAt: 11 }]);

        const result = await GuardedRow.updateConstrained(
            'r1',
            { title: 'After' },
            { where: { organizationId: 'org-1' }, expected: { updatedAt: 10 } },
            { id: 'r1', organizationId: 'org-1', title: 'Before', updatedAt: 10 },
            db.driver as never,
        );

        const expected = and(
            eq(guardedRows.id, 'r1'),
            eq(guardedRows.organizationId, 'org-1'),
            eq(guardedRows.updatedAt, 10),
        );
        expect(result.get('title')).toBe('After');
        expect(conditionSql(db.captured.where)).toBe(conditionSql(expected));
    });

    it('returns a conflict when the guarded row no longer matches', async () => {
        const db = mutationDriver([]);
        await expect(
            GuardedRow.updateConstrained(
                'r1',
                { title: 'After' },
                { where: { organizationId: 'org-1' }, expected: { updatedAt: 10 } },
                undefined,
                db.driver as never,
            ),
        ).rejects.toBeInstanceOf(ConcurrentMutationError);
    });

    it('normalizes Date snapshots and advances the managed version timestamp', async () => {
        const snapshotTime = new Date(Date.now() + 60_000);
        const db = mutationDriver([
            { id: 'r1', organizationId: 'org-1', title: 'After', updatedAt: snapshotTime.getTime() + 1 },
        ]);

        await GuardedRow.updateConstrained(
            'r1',
            { title: 'After' },
            { where: { organizationId: 'org-1' }, expected: { updatedAt: snapshotTime } },
            { id: 'r1', organizationId: 'org-1', title: 'Before', updatedAt: snapshotTime },
            db.driver as never,
        );

        const expected = and(
            eq(guardedRows.id, 'r1'),
            eq(guardedRows.organizationId, 'org-1'),
            eq(guardedRows.updatedAt, snapshotTime.getTime()),
        );
        expect(conditionSql(db.captured.where)).toBe(conditionSql(expected));
        expect(db.captured.set?.updatedAt).toBe(snapshotTime.getTime() + 1);
    });

    it('uses the same guard for a hard delete', async () => {
        const db = mutationDriver([{ primaryKey: 'r1' }]);
        await GuardedRow.deleteConstrained(
            'r1',
            { where: { organizationId: 'org-1' }, expected: { updatedAt: 10 } },
            db.driver as never,
        );

        const expected = and(
            eq(guardedRows.id, 'r1'),
            eq(guardedRows.organizationId, 'org-1'),
            eq(guardedRows.updatedAt, 10),
        );
        expect(db.remove).toHaveBeenCalledOnce();
        expect(conditionSql(db.captured.where)).toBe(conditionSql(expected));
    });

    it('normalizes Date snapshots in a guarded hard delete', async () => {
        const snapshotTime = new Date('2026-08-27T10:00:00.000Z');
        const db = mutationDriver([{ primaryKey: 'r1' }]);
        await GuardedRow.deleteConstrained(
            'r1',
            { where: { organizationId: 'org-1' }, expected: { updatedAt: snapshotTime } },
            db.driver as never,
        );

        const expected = and(
            eq(guardedRows.id, 'r1'),
            eq(guardedRows.organizationId, 'org-1'),
            eq(guardedRows.updatedAt, snapshotTime.getTime()),
        );
        expect(conditionSql(db.captured.where)).toBe(conditionSql(expected));
    });

    it('fails closed when a legacy custom update has not joined the shared hook', async () => {
        class LegacyRow extends GuardedRow {
            static entity = 'legacy_rows';
            static async update(id: string, data: Record<string, unknown>, driver?: any) {
                return super.update(id, data, driver);
            }
        }
        const db = mutationDriver([]);
        await expect(
            LegacyRow.updateConstrained(
                'r1',
                {},
                { where: { organizationId: 'org-1' } },
                undefined,
                db.driver as never,
            ),
        ).rejects.toThrow(/prepareUpdateMutation/);
        expect(db.update).not.toHaveBeenCalled();
    });
});
