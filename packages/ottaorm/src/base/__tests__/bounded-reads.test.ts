import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearConnection, registerConnection } from '../../context';
import { configureOttaORM, getOttaORMMaxAllRows, OttaORMAllRowsLimitError } from '../../runtime-config';
import { BaseModel } from '../BaseModel';

const rowsTable = sqliteTable('bounded_rows', {
    id: text('id').primaryKey(),
    label: text('label'),
    amount: integer('amount'),
});

class BoundedRow extends BaseModel {
    static entity = 'bounded_rows';
    static table = rowsTable;
    static primaryKey = 'id';
}

function createDriver(options: { count: number; rows: Array<Record<string, unknown>> }) {
    const limitValues: number[] = [];
    const select = vi.fn((selection?: Record<string, unknown>) => {
        let limit: number | undefined;
        const chain: Record<string, unknown> = {
            from: () => chain,
            where: () => chain,
            orderBy: () => chain,
            limit: (value: number) => {
                limit = value;
                limitValues.push(value);
                return chain;
            },
            offset: () => chain,
            then: (resolve: (value: unknown[]) => unknown) => {
                const isCount = Boolean(selection && 'count' in selection);
                const result = isCount ? [{ count: options.count }] : options.rows.slice(0, limit);
                return Promise.resolve(resolve(result));
            },
        };
        return chain;
    });

    return { select, limitValues, getDb: () => ({ select }) };
}

function row(id: string, amount = 1): Record<string, unknown> {
    return { id, label: id, amount };
}

describe('bounded BaseModel collection reads', () => {
    afterEach(() => {
        clearConnection('default');
        configureOttaORM();
    });

    beforeEach(() => {
        configureOttaORM({ maxAllRows: 2 });
    });

    it('rejects unsafe runtime configuration and never exceeds the immutable ceiling', () => {
        expect(() => configureOttaORM({ maxAllRows: 0 })).toThrow(/positive safe integer/);
        expect(() => configureOttaORM({ maxAllRows: Number.MAX_SAFE_INTEGER + 1 })).toThrow(/positive safe integer/);
        expect(configureOttaORM({ maxAllRows: 20_000 })).toBe(10_000);
    });

    it('uses a count and rejects an implicit all above the effective ceiling', async () => {
        const driver = createDriver({ count: 3, rows: [row('1'), row('2'), row('3')] });
        registerConnection('default', driver as never);

        await expect(BoundedRow.all()).rejects.toMatchObject<Partial<OttaORMAllRowsLimitError>>({
            code: 'OTTAORM_ALL_ROWS_LIMIT',
            requested: 3,
            maximum: 2,
        });
        expect(driver.select).toHaveBeenCalledTimes(1);
    });

    it('reads a sentinel row and rejects a concurrent insert crossing the ceiling', async () => {
        const driver = createDriver({ count: 2, rows: [row('1'), row('2'), row('3')] });
        registerConnection('default', driver as never);

        await expect(BoundedRow.all()).rejects.toBeInstanceOf(OttaORMAllRowsLimitError);
        expect(driver.select).toHaveBeenCalledTimes(2);
    });

    it('validates explicit limits and allows the zero-row fast path', async () => {
        const driver = createDriver({ count: 0, rows: [] });
        registerConnection('default', driver as never);

        await expect(BoundedRow.all({ limit: 3 })).rejects.toBeInstanceOf(OttaORMAllRowsLimitError);
        await expect(BoundedRow.all({ limit: -1 })).rejects.toThrow(/non-negative safe integer/);
        await expect(BoundedRow.all({ limit: 0 })).resolves.toEqual([]);
        expect(driver.select).not.toHaveBeenCalled();
    });

    it('caps intentional keyset pages and advances from the primary key', async () => {
        configureOttaORM({ maxAllRows: 2 });
        const driver = createDriver({ count: 0, rows: [row('1'), row('2')] });
        registerConnection('default', driver as never);

        const pages: string[][] = [];
        for await (const page of BoundedRow.pages({ perPage: 99 })) {
            pages.push(page.map((record) => String(record.get('id'))));
            if (pages.length === 1) break;
        }

        expect(pages).toEqual([['1', '2']]);
        const firstQuery = driver.select.mock.results[0]?.value as { limit?: (n: number) => unknown };
        expect(firstQuery).toBeDefined();
        expect(getOttaORMMaxAllRows()).toBe(2);
    });

    it('keeps the primary key in a projected keyset page', async () => {
        const driver = createDriver({ count: 0, rows: [row('1')] });
        registerConnection('default', driver as never);

        for await (const _page of BoundedRow.pages({ perPage: 1, select: ['label'] })) break;

        expect(driver.select.mock.calls[0]?.[0]).toHaveProperty('id');
        expect(driver.select.mock.calls[0]?.[0]).toHaveProperty('label');
    });

    it('splits whereIn lists that exceed the complete D1 binding budget', async () => {
        const driver = createDriver({ count: 0, rows: [row('1')] });
        registerConnection('default', driver as never);

        await BoundedRow.whereIn(
            'id',
            Array.from({ length: 99 }, (_, index) => `row-${index}`),
        );

        expect(driver.select).toHaveBeenCalledTimes(2);
    });

    it('bounds every large-list chunk to the requested global window', async () => {
        const driver = createDriver({ count: 0, rows: Array.from({ length: 20 }, (_, index) => row(String(index))) });
        registerConnection('default', driver as never);

        await BoundedRow.whereIn(
            'id',
            Array.from({ length: 197 }, (_, index) => `row-${index}`),
            { limit: 3, offset: 2 },
        );

        expect(driver.select).toHaveBeenCalledTimes(3);
        expect(driver.limitValues).toEqual([5, 5, 5]);
    });

    it('rejects invalid collection windows before querying', async () => {
        const driver = createDriver({ count: 0, rows: [] });
        registerConnection('default', driver as never);

        await expect(BoundedRow.where({}, { limit: -1 })).rejects.toThrow(/non-negative safe integer/);
        await expect(BoundedRow.whereIn('id', ['1'], { offset: -1 })).rejects.toThrow(/non-negative safe integer/);
        expect(driver.select).not.toHaveBeenCalled();
    });

    it('splits and de-duplicates large where lists for count queries too', async () => {
        const driver = createDriver({ count: 1, rows: [row('shared')] });
        registerConnection('default', driver as never);

        await expect(BoundedRow.count({ id: Array.from({ length: 99 }, (_, index) => `row-${index}`) })).resolves.toBe(
            1,
        );
        expect(driver.select).toHaveBeenCalledTimes(2);
    });

    it('plans nested $in and $or predicates and de-duplicates overlapping rows', async () => {
        const driver = createDriver({ count: 0, rows: [row('shared')] });
        registerConnection('default', driver as never);

        const records = await BoundedRow.where({
            $or: [
                { id: { $in: Array.from({ length: 150 }, (_, index) => `row-${index}`) } },
                { label: 'always-overlaps' },
            ],
        });

        expect(driver.select).toHaveBeenCalledTimes(2);
        expect(records.map((record) => record.get('id'))).toEqual(['shared']);
    });

    it('budgets multiple lists and scalar predicates together', async () => {
        const driver = createDriver({ count: 0, rows: [row('shared')] });
        registerConnection('default', driver as never);

        await BoundedRow.where({
            $and: [
                { id: Array.from({ length: 80 }, (_, index) => `id-${index}`) },
                { label: Array.from({ length: 80 }, (_, index) => `label-${index}`) },
            ],
        });

        expect(driver.select).toHaveBeenCalledTimes(4);
    });

    it('keeps merge ordering columns internal to an explicit projection', async () => {
        const driver = createDriver({ count: 0, rows: [row('shared')] });
        registerConnection('default', driver as never);

        const [record] = await BoundedRow.where(
            { id: Array.from({ length: 99 }, (_, index) => `id-${index}`) },
            { select: ['id'], orderBy: 'label' },
        );

        expect(record.get('id')).toBe('shared');
        expect(() => record.get('label')).toThrow(/was not loaded/);
    });

    it('de-duplicates sums across overlapping query plans', async () => {
        const driver = createDriver({ count: 0, rows: [row('shared', 7)] });
        registerConnection('default', driver as never);

        await expect(
            BoundedRow.sums(['amount'], {
                $or: [{ id: { $in: Array.from({ length: 150 }, (_, index) => `row-${index}`) } }, { label: 'overlap' }],
            }),
        ).resolves.toEqual({ amount: 7 });
    });
});
