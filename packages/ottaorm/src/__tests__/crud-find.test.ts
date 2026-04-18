import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseModel } from '../base/BaseModel';
import { handleCrud, parseCrudRequest } from '../crud';
import { clearModelRegistry, registerModel } from '../registry';
import { ValidationError } from '../validation';

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

    describe('handleCrud - model not found', () => {
        it('should include available models in error hint', async () => {
            registerModel(TestModel);

            const result = await handleCrud({
                method: 'GET',
                model: 'nonexistent',
            });

            expect(result.success).toBe(false);
            expect(result.status).toBe(404);
            expect(result.code).toBe('MODEL_NOT_FOUND');
            expect(result.hint).toContain('tests');
        });
    });

    describe('parseCrudRequest - malformed input fails closed', () => {
        it('should flag invalid JSON in "where" query param as parseError', async () => {
            const url = new URL('http://localhost/api/ottaorm/tests?where=not-json');
            const request = new Request(url.toString(), { method: 'GET' });
            const parsed = await parseCrudRequest(request, url, '/api/ottaorm');

            expect(parsed?.parseError).toBeDefined();
            expect(parsed?.parseError?.code).toBe('INVALID_QUERY');
        });

        it('should flag invalid JSON body on POST as parseError', async () => {
            const url = new URL('http://localhost/api/ottaorm/tests');
            const request = new Request(url.toString(), {
                method: 'POST',
                body: 'not-json',
                headers: { 'Content-Type': 'application/json' },
            });
            const parsed = await parseCrudRequest(request, url, '/api/ottaorm');

            expect(parsed?.parseError).toBeDefined();
            expect(parsed?.parseError?.code).toBe('INVALID_BODY');
        });

        it('handleCrud should short-circuit with 400 when parseError is present', async () => {
            registerModel(TestModel);

            const result = await handleCrud({
                method: 'POST',
                model: 'tests',
                body: {},
                parseError: { message: 'Invalid JSON in request body', code: 'INVALID_BODY' },
            });

            expect(result.success).toBe(false);
            expect(result.status).toBe(400);
            expect(result.code).toBe('INVALID_BODY');
        });
    });

    describe('handleCrud - ValidationError handling', () => {
        it('should return 422 with fieldErrors on ValidationError', async () => {
            // Make create throw a ValidationError
            vi.spyOn(TestModel, 'create').mockRejectedValue(
                new ValidationError({ email: 'Email is required', name: 'Name is too short' }),
            );

            registerModel(TestModel);

            const result = await handleCrud({
                method: 'POST',
                model: 'tests',
                body: { email: '', name: 'a' },
            });

            expect(result.success).toBe(false);
            expect(result.status).toBe(422);
            expect(result.code).toBe('VALIDATION_ERROR');
            expect(result.fieldErrors).toBeDefined();
            expect(result.fieldErrors!.email).toContain('Email is required');
            expect(result.fieldErrors!.name).toContain('Name is too short');
        });
    });
});

describe('handleCrud - list query limit/offset capping', () => {
    beforeEach(() => {
        clearModelRegistry();
    });

    it('should cap limit to MAX_LIST_LIMIT (1000)', async () => {
        const whereSpy = vi.spyOn(TestModel, 'where').mockResolvedValue([]);
        registerModel(TestModel);

        await handleCrud({
            method: 'GET',
            model: 'tests',
            query: { limit: 99999 },
        });

        expect(whereSpy).toHaveBeenCalledWith({}, expect.objectContaining({ limit: 1000 }));
        whereSpy.mockRestore();
    });

    it('should cap offset to MAX_LIST_OFFSET (100000)', async () => {
        const whereSpy = vi.spyOn(TestModel, 'where').mockResolvedValue([]);
        registerModel(TestModel);

        await handleCrud({
            method: 'GET',
            model: 'tests',
            query: { offset: 9999999 },
        });

        expect(whereSpy).toHaveBeenCalledWith({}, expect.objectContaining({ offset: 100000 }));
        whereSpy.mockRestore();
    });

    it('should pass through valid limit/offset unchanged', async () => {
        const whereSpy = vi.spyOn(TestModel, 'where').mockResolvedValue([]);
        registerModel(TestModel);

        await handleCrud({
            method: 'GET',
            model: 'tests',
            query: { limit: 50, offset: 100 },
        });

        expect(whereSpy).toHaveBeenCalledWith({}, expect.objectContaining({ limit: 50, offset: 100 }));
        whereSpy.mockRestore();
    });

    it('should floor negative limit to 1', async () => {
        const whereSpy = vi.spyOn(TestModel, 'where').mockResolvedValue([]);
        registerModel(TestModel);

        await handleCrud({
            method: 'GET',
            model: 'tests',
            query: { limit: -5 },
        });

        expect(whereSpy).toHaveBeenCalledWith({}, expect.objectContaining({ limit: 1 }));
        whereSpy.mockRestore();
    });
});

describe('BaseModel - soft delete', () => {
    it('should have softDeletes disabled by default', () => {
        expect(TestModel.softDeletes).toBe(false);
    });

    it('should throw if forceDelete has no driver connection', async () => {
        class NoPkModel extends BaseModel {
            static entity = 'nopk';
            static table = testTable;
            static primaryKey = 'nonexistent';
        }

        // forceDelete requires a registered driver connection
        await expect(NoPkModel.forceDelete('123')).rejects.toThrow('not registered');
    });

    it('should throw if restore is called on non-softDelete model', async () => {
        await expect(TestModel.restore('123')).rejects.toThrow('does not have soft deletes');
    });
});

describe('BaseModel - eager loading', () => {
    it('should throw if relationship method does not exist', async () => {
        const record = new TestModel({
            entity: 'tests',
            data: { id: 'test-1', slug: 'test' },
        });

        await expect(record.load('nonexistentRelation')).rejects.toThrow(
            'Relationship "nonexistentRelation" is not defined',
        );
    });

    it('should call relationship method and attach result', async () => {
        class PostModel extends BaseModel {
            static entity = 'posts';
            static table = testTable;
            static primaryKey = 'id';

            async author() {
                // Simulate a belongsTo returning a model instance
                return new TestModel({
                    entity: 'tests',
                    data: { id: 'author-1', slug: 'author', email: 'a@b.com' },
                });
            }
        }

        const post = new PostModel({
            entity: 'posts',
            data: { id: 'post-1', slug: 'post-slug' },
        });

        await post.load('author');

        const author = post.get('author');
        expect(author).toBeDefined();
        expect((author as any).id).toBe('author-1');
    });

    it('should handle null relationship result', async () => {
        class PostModel extends BaseModel {
            static entity = 'posts';
            static table = testTable;
            static primaryKey = 'id';

            async author() {
                return null;
            }
        }

        const post = new PostModel({
            entity: 'posts',
            data: { id: 'post-1', slug: 'post-slug' },
        });

        await post.load('author');
        expect(post.get('author')).toBeNull();
    });

    it('should handle array relationship result', async () => {
        class PostModel extends BaseModel {
            static entity = 'posts';
            static table = testTable;
            static primaryKey = 'id';

            async comments() {
                return [
                    new TestModel({ entity: 'tests', data: { id: 'c1', slug: 'comment-1' } }),
                    new TestModel({ entity: 'tests', data: { id: 'c2', slug: 'comment-2' } }),
                ];
            }
        }

        const post = new PostModel({
            entity: 'posts',
            data: { id: 'post-1', slug: 'post-slug' },
        });

        await post.load('comments');
        const comments = post.get('comments') as any[];
        expect(comments).toHaveLength(2);
        expect(comments[0].id).toBe('c1');
    });
});

describe('BaseModel - batch', () => {
    it('should throw if driver does not support executeBatch', async () => {
        // Mock a driver without executeBatch
        const mockDriver = {
            getDb: () => ({}),
            execute: vi.fn(),
            executeRaw: vi.fn(),
        };

        await expect(TestModel.batch(['SELECT 1'], mockDriver as any)).rejects.toThrow(
            'Driver does not support executeBatch',
        );
    });

    it('should call executeBatch on driver', async () => {
        const executeBatchMock = vi.fn().mockResolvedValue([]);
        const mockDriver = {
            getDb: () => ({}),
            execute: vi.fn(),
            executeRaw: vi.fn(),
            executeBatch: executeBatchMock,
        };

        await TestModel.batch(['INSERT INTO tests VALUES ("1", "a", "b", "c")'], mockDriver as any);
        expect(executeBatchMock).toHaveBeenCalledWith(['INSERT INTO tests VALUES ("1", "a", "b", "c")']);
    });
});

describe('BaseModel - withTrashed', () => {
    it('should return a scoped query object with all query methods', () => {
        const scoped = TestModel.withTrashed();
        expect(typeof scoped.find).toBe('function');
        expect(typeof scoped.first).toBe('function');
        expect(typeof scoped.where).toBe('function');
        expect(typeof scoped.whereIn).toBe('function');
        expect(typeof scoped.all).toBe('function');
        expect(typeof scoped.count).toBe('function');
        expect(typeof scoped.search).toBe('function');
        expect(typeof scoped.searchPaginate).toBe('function');
    });
});
