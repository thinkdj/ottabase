import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseModel } from '../base/BaseModel';
import { handleCrud, parseCrudRequest } from '../crud';
import { clearModelRegistry, registerModel } from '../registry';

const testTable = sqliteTable('tests', {
    id: text('id').primaryKey(),
    slug: text('slug'),
    email: text('email'),
    appId: text('app_id'),
});

class TestModel extends BaseModel {
    static entity = 'tests';
    static table = testTable;
    static primaryKey = 'id';
}

describe('OttaORM field/value find functionality', () => {
    beforeEach(() => {
        clearModelRegistry();
    });

    describe('handleCrud - GET with field/value', () => {
        it('should find record by field/value and return object directly', async () => {
            const mockRecord = new TestModel({
                entity: 'tests',
                data: {
                    id: 'test-1',
                    slug: 'test-slug',
                    email: 'test@example.com',
                    appId: 'app-1',
                },
            } as any);

            const firstSpy = vi.spyOn(TestModel, 'first').mockResolvedValue(mockRecord);
            const toJsonSpy = vi.spyOn(mockRecord, 'toJson').mockReturnValue({
                id: 'test-1',
                slug: 'test-slug',
                email: 'test@example.com',
                appId: 'app-1',
            });

            registerModel(TestModel);

            const result = await handleCrud({
                method: 'GET',
                model: 'tests',
                query: {
                    field: 'slug',
                    value: 'test-slug',
                },
            });

            expect(result.success).toBe(true);
            expect(result.status).toBe(200);
            expect(result.data).toEqual({
                id: 'test-1',
                slug: 'test-slug',
                email: 'test@example.com',
                appId: 'app-1',
            });
            expect(firstSpy).toHaveBeenCalledWith({ slug: 'test-slug' });
            expect(toJsonSpy).toHaveBeenCalled();

            firstSpy.mockRestore();
            toJsonSpy.mockRestore();
        });

        it('should return 404 when record not found', async () => {
            const firstSpy = vi.spyOn(TestModel, 'first').mockResolvedValue(null);

            registerModel(TestModel);

            const result = await handleCrud({
                method: 'GET',
                model: 'tests',
                query: {
                    field: 'slug',
                    value: 'non-existent',
                },
            });

            expect(result.success).toBe(false);
            expect(result.status).toBe(404);
            expect(result.error).toBe("tests with slug 'non-existent' not found");
            expect(firstSpy).toHaveBeenCalledWith({ slug: 'non-existent' });

            firstSpy.mockRestore();
        });

        it('should handle numeric values', async () => {
            const mockRecord = new TestModel({
                entity: 'tests',
                data: {
                    id: 'test-1',
                    slug: 'test-slug',
                },
            } as any);

            const firstSpy = vi.spyOn(TestModel, 'first').mockResolvedValue(mockRecord);
            vi.spyOn(mockRecord, 'toJson').mockReturnValue({
                id: 'test-1',
                slug: 'test-slug',
            });

            registerModel(TestModel);

            const result = await handleCrud({
                method: 'GET',
                model: 'tests',
                query: {
                    field: 'id',
                    value: '123',
                },
            });

            expect(result.success).toBe(true);
            expect(firstSpy).toHaveBeenCalledWith({ id: '123' });

            firstSpy.mockRestore();
        });

        it('should not trigger field/value lookup when field is missing', async () => {
            const whereSpy = vi.spyOn(TestModel, 'where').mockResolvedValue([]);

            registerModel(TestModel);

            const result = await handleCrud({
                method: 'GET',
                model: 'tests',
                query: {
                    value: 'test-value',
                    // field is missing
                },
            });

            // Should fall through to regular list query
            expect(whereSpy).toHaveBeenCalled();
            expect(result.success).toBe(true);

            whereSpy.mockRestore();
        });

        it('should not trigger field/value lookup when value is undefined', async () => {
            const whereSpy = vi.spyOn(TestModel, 'where').mockResolvedValue([]);

            registerModel(TestModel);

            const result = await handleCrud({
                method: 'GET',
                model: 'tests',
                query: {
                    field: 'slug',
                    value: undefined,
                },
            });

            // Should fall through to regular list query
            expect(whereSpy).toHaveBeenCalled();
            expect(result.success).toBe(true);

            whereSpy.mockRestore();
        });

        it('should handle empty string value', async () => {
            const mockRecord = new TestModel({
                entity: 'tests',
                data: {
                    id: 'test-1',
                    slug: '',
                },
            } as any);

            const firstSpy = vi.spyOn(TestModel, 'first').mockResolvedValue(mockRecord);
            vi.spyOn(mockRecord, 'toJson').mockReturnValue({
                id: 'test-1',
                slug: '',
            });

            registerModel(TestModel);

            const result = await handleCrud({
                method: 'GET',
                model: 'tests',
                query: {
                    field: 'slug',
                    value: '',
                },
            });

            expect(result.success).toBe(true);
            expect(firstSpy).toHaveBeenCalledWith({ slug: '' });

            firstSpy.mockRestore();
        });

        it('should merge query.where into field/value lookup', async () => {
            const mockRecord = new TestModel({
                entity: 'tests',
                data: { id: 'test-1', slug: 'test-slug', appId: 'app-1' },
            } as any);

            const firstSpy = vi.spyOn(TestModel, 'first').mockResolvedValue(mockRecord);
            vi.spyOn(mockRecord, 'toJson').mockReturnValue({
                id: 'test-1',
                slug: 'test-slug',
                appId: 'app-1',
            });

            registerModel(TestModel);

            const result = await handleCrud({
                method: 'GET',
                model: 'tests',
                query: {
                    field: 'slug',
                    value: 'test-slug',
                    where: { appId: 'app-1' },
                },
            });

            expect(result.success).toBe(true);
            expect(firstSpy).toHaveBeenCalledWith({ appId: 'app-1', slug: 'test-slug' });

            firstSpy.mockRestore();
        });

        it('should return 404 when query.where conflicts with field/value', async () => {
            const firstSpy = vi.spyOn(TestModel, 'first');

            registerModel(TestModel);

            const result = await handleCrud({
                method: 'GET',
                model: 'tests',
                query: {
                    field: 'slug',
                    value: 'test-slug',
                    where: { slug: 'other' },
                },
            });

            expect(result.success).toBe(false);
            expect(result.status).toBe(404);
            expect(firstSpy).not.toHaveBeenCalled();

            firstSpy.mockRestore();
        });
    });

    describe('parseCrudRequest - field/value query params', () => {
        it('should parse field and value query parameters', async () => {
            const url = new URL('http://localhost/api/ottaorm/tests?field=slug&value=test-slug');

            const request = new Request(url.toString(), { method: 'GET' });
            const parsed = await parseCrudRequest(request, url, '/api/ottaorm');

            expect(parsed?.query?.field).toBe('slug');
            expect(parsed?.query?.value).toBe('test-slug');
            expect(parsed?.model).toBe('tests');
            expect(parsed?.method).toBe('GET');
        });

        it('should handle numeric value in query params', async () => {
            const url = new URL('http://localhost/api/ottaorm/tests?field=id&value=123');

            const request = new Request(url.toString(), { method: 'GET' });
            const parsed = await parseCrudRequest(request, url, '/api/ottaorm');

            expect(parsed?.query?.field).toBe('id');
            expect(parsed?.query?.value).toBe('123');
        });

        it('should handle empty string value', async () => {
            const url = new URL('http://localhost/api/ottaorm/tests?field=slug&value=');

            const request = new Request(url.toString(), { method: 'GET' });
            const parsed = await parseCrudRequest(request, url, '/api/ottaorm');

            expect(parsed?.query?.field).toBe('slug');
            expect(parsed?.query?.value).toBe('');
        });

        it('should not include field/value if not present', async () => {
            const url = new URL('http://localhost/api/ottaorm/tests');

            const request = new Request(url.toString(), { method: 'GET' });
            const parsed = await parseCrudRequest(request, url, '/api/ottaorm');

            expect(parsed?.query?.field).toBeUndefined();
            expect(parsed?.query?.value).toBeUndefined();
        });

        it('should work alongside other query params', async () => {
            const url = new URL(
                'http://localhost/api/ottaorm/tests?field=slug&value=test-slug&orderBy=createdAt&orderDirection=desc',
            );

            const request = new Request(url.toString(), { method: 'GET' });
            const parsed = await parseCrudRequest(request, url, '/api/ottaorm');

            expect(parsed?.query?.field).toBe('slug');
            expect(parsed?.query?.value).toBe('test-slug');
            expect(parsed?.query?.orderBy).toBe('createdAt');
            expect(parsed?.query?.orderDirection).toBe('desc');
        });

        it('should parse search query parameter', async () => {
            const url = new URL('http://localhost/api/ottaorm/tests?search=hello');

            const request = new Request(url.toString(), { method: 'GET' });
            const parsed = await parseCrudRequest(request, url, '/api/ottaorm');

            expect(parsed?.query?.search).toBe('hello');
        });
    });
});
