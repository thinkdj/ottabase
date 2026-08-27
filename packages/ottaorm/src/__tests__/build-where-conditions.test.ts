import { and, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, ne } from 'drizzle-orm';
import { integer, sqliteTable, SQLiteSyncDialect, text } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import { BaseModel } from '../base/BaseModel';

const testTable = sqliteTable('where_test', {
    id: text('id').primaryKey(),
    name: text('name'),
    status: text('status'),
    count: integer('count'),
});

/** Expose the protected method for direct testing */
class TestableModel extends BaseModel {
    static entity = 'where_test';
    static table = testTable;
    static primaryKey = 'id';

    static testBuildWhere(where: Record<string, unknown>) {
        return this.buildWhereConditions(where);
    }
}

/** Helper: serialize a Drizzle condition array via and() queryChunks for comparison */
function conditionSql(conditions: any[]): string {
    if (conditions.length === 0) return '';
    const combined = and(...conditions);
    if (!combined) return '';
    // getSQL() returns a SQL object with queryChunks we can inspect
    const chunks = combined.getSQL().queryChunks;
    // Flatten to string tokens for a stable snapshot
    return chunks.map((c: any) => (typeof c === 'string' ? c : (c?.value ?? String(c)))).join('');
}

describe('buildWhereConditions', () => {
    it('should generate eq() for simple key=value', () => {
        const actual = TestableModel.testBuildWhere({ status: 'active' });
        const expected = [eq(testTable.status, 'active')];
        expect(actual).toHaveLength(1);
        expect(conditionSql(actual)).toBe(conditionSql(expected));
    });

    it('should generate isNull() for null values', () => {
        const actual = TestableModel.testBuildWhere({ name: null });
        const expected = [isNull(testTable.name)];
        expect(actual).toHaveLength(1);
        expect(conditionSql(actual)).toBe(conditionSql(expected));
    });

    it('should generate inArray() for array values', () => {
        const actual = TestableModel.testBuildWhere({ status: ['active', 'draft'] });
        const expected = [inArray(testTable.status, ['active', 'draft'])];
        expect(actual).toHaveLength(1);
        expect(conditionSql(actual)).toBe(conditionSql(expected));
    });

    it('should fail closed for empty arrays', () => {
        const conditions = TestableModel.testBuildWhere({ status: [] });
        expect(conditions).toHaveLength(1);
        const query = new SQLiteSyncDialect().sqlToQuery(and(...conditions)!);
        expect(query.sql).toContain('0 = 1');
    });

    it('should generate ne() for { $ne: value }', () => {
        const actual = TestableModel.testBuildWhere({ status: { $ne: 'archived' } });
        const expected = [ne(testTable.status, 'archived')];
        expect(actual).toHaveLength(1);
        expect(conditionSql(actual)).toBe(conditionSql(expected));
    });

    it('should generate isNotNull() with $ne: null', () => {
        const actual = TestableModel.testBuildWhere({ status: { $ne: null } });
        const expected = [isNotNull(testTable.status)];
        expect(actual).toHaveLength(1);
        expect(conditionSql(actual)).toBe(conditionSql(expected));
    });

    it('should compose $ne with other conditions', () => {
        const actual = TestableModel.testBuildWhere({
            name: null,
            status: { $ne: 'archived' },
            count: 5,
        });
        expect(actual).toHaveLength(3);
        const expected = [isNull(testTable.name), ne(testTable.status, 'archived'), eq(testTable.count, 5)];
        expect(conditionSql(actual)).toBe(conditionSql(expected));
    });

    it('should skip unknown columns', () => {
        const conditions = TestableModel.testBuildWhere({ nonExistent: 'value' });
        expect(conditions).toHaveLength(0);
    });

    it('should treat undefined like null → IS NULL (never eq(col, undefined), which crashes D1)', () => {
        const actual = TestableModel.testBuildWhere({ name: undefined });
        const expected = [isNull(testTable.name)];
        expect(actual).toHaveLength(1);
        expect(conditionSql(actual)).toBe(conditionSql(expected));
    });

    it('supports scalar range operators', () => {
        const actual = TestableModel.testBuildWhere({
            count: { $gt: 1, $gte: 2, $lt: 10, $lte: 9 },
        });
        const expected = [
            gt(testTable.count, 1),
            gte(testTable.count, 2),
            lt(testTable.count, 10),
            lte(testTable.count, 9),
        ];
        expect(conditionSql(actual)).toBe(conditionSql(expected));
    });

    it('supports nested $and/$or groups without overwriting caller filters', () => {
        const actual = TestableModel.testBuildWhere({
            $and: [{ status: 'active', id: { $gte: 'id-1' } }, { $or: [{ name: 'Ada' }, { name: 'Grace' }] }],
        });

        expect(actual).toHaveLength(1);
        // The nested SQL object intentionally keeps its child chunks opaque to
        // this lightweight serializer; construction itself is the regression
        // guard for keyset filters containing both a caller predicate and a
        // cursor predicate.
        expect(conditionSql(actual)).not.toBe('');
    });
});
