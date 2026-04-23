import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseModel } from '../base/BaseModel';
import { clearModelRegistry, registerModel } from '../registry';

const testTable = sqliteTable('things', {
    id: text('id').primaryKey(),
    name: text('name'),
    updatedAt: integer('updated_at'),
});

class Thing extends BaseModel {
    static entity = 'things';
    static table = testTable;
    static primaryKey = 'id';
}

/**
 * Regression test for the bug where `BaseModel.update()` included the primary
 * key in the SQL UPDATE SET clause, which caused D1 to reject the query with
 * "id is readonly" when the PK was a rowid-backed column.
 */
describe('BaseModel.update() — primary key exclusion', () => {
    let setPayload: Record<string, any> | undefined;

    beforeEach(() => {
        clearModelRegistry();
        registerModel(Thing);
        setPayload = undefined;

        // Build a fake drizzle-shaped driver that captures the object passed
        // to `.set(...)` and returns a non-empty array from `.returning()`.
        vi.spyOn(Thing as any, 'getDriver').mockReturnValue({
            getDb: () => ({
                update: () => ({
                    set: (payload: Record<string, any>) => {
                        setPayload = payload;
                        return {
                            where: () => ({
                                returning: async () => [{ id: 'thing-1', name: 'updated', updatedAt: 123 }],
                            }),
                        };
                    },
                }),
            }),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('does not include the primary key in the UPDATE SET clause', async () => {
        await Thing.update('thing-1', { id: 'thing-1', name: 'updated' });

        expect(setPayload).toBeDefined();
        expect(setPayload!).not.toHaveProperty('id');
        expect(setPayload!.name).toBe('updated');
    });

    it('strips the PK even when the caller forgets to omit it', async () => {
        await Thing.update('thing-1', { id: 'attempted-rename', name: 'ok' });

        expect(setPayload!).not.toHaveProperty('id');
    });

    it('still writes non-PK fields', async () => {
        await Thing.update('thing-1', { name: 'new-name' });

        expect(setPayload!.name).toBe('new-name');
    });
});
