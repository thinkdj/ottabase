import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseModel } from '../base/BaseModel';
import { handleCrud, parseCrudRequest } from '../crud';
import { clearModelRegistry, registerModel } from '../registry';

const testTable = sqliteTable('tests', {
    id: text('id').primaryKey(),
    slug: text('slug'),
    appId: text('app_id'),
});

class TestModel extends BaseModel {
    static entity = 'tests';
    static table = testTable;
    static primaryKey = 'id';
}

describe('OttaORM uniqueness helpers', () => {
    beforeEach(() => {
        clearModelRegistry();
    });

    it('BaseModel.isUnique returns true when no records match', async () => {
        const driver = {
            getDb: () => ({
                select: () => ({
                    from: () => ({
                        where: () => ({
                            limit: () => [],
                        }),
                    }),
                }),
            }),
        } as any;

        const result = await TestModel.isUnique('slug', 'hello', {
            driver,
            where: { appId: 'app-1' },
            ignoreId: 'id-1',
        });

        expect(result).toBe(true);
    });

    it('BaseModel.isUnique returns false when a record exists', async () => {
        const driver = {
            getDb: () => ({
                select: () => ({
                    from: () => ({
                        where: () => ({
                            limit: () => [{ id: 'id-1' }],
                        }),
                    }),
                }),
            }),
        } as any;

        const result = await TestModel.isUnique('slug', 'hello', { driver });

        expect(result).toBe(false);
    });

    it('handleCrud unique route delegates to isUnique', async () => {
        class UniqueModel extends BaseModel {
            static entity = 'tests';
            static table = testTable;
            static primaryKey = 'id';
        }

        const spy = vi.spyOn(UniqueModel, 'isUnique').mockResolvedValue(false);

        registerModel(UniqueModel);

        const result = await handleCrud({
            method: 'GET',
            model: 'tests',
            id: 'unique',
            query: {
                uniqueField: 'slug',
                uniqueValue: 'hello',
                uniqueIgnoreId: 'id-2',
                where: { appId: 'app-1' },
            },
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ unique: false });
        expect(spy).toHaveBeenCalledWith('slug', 'hello', {
            where: { appId: 'app-1' },
            ignoreId: 'id-2',
        });
    });

    it('parseCrudRequest includes unique params', async () => {
        const url = new URL(
            'http://localhost/api/ottaorm/tests/unique?uniqueField=slug&uniqueValue=hello&uniqueIgnoreId=123&where=%7B%22appId%22%3A%22app-1%22%7D',
        );

        const request = new Request(url.toString(), { method: 'GET' });
        const parsed = await parseCrudRequest(request, url, '/api/ottaorm');

        expect(parsed?.query?.uniqueField).toBe('slug');
        expect(parsed?.query?.uniqueValue).toBe('hello');
        expect(parsed?.query?.uniqueIgnoreId).toBe('123');
        expect(parsed?.query?.where).toEqual({ appId: 'app-1' });
    });
});
