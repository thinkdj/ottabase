import { and, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
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

    it('should skip empty arrays', () => {
        const conditions = TestableModel.testBuildWhere({ status: [] });
        expect(conditions).toHaveLength(0);
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
});
