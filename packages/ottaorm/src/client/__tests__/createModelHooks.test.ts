import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createModelHooks } from '../createModelHooks';

// Mock fetch globally
global.fetch = vi.fn();

interface TestModel {
    id: string;
    slug: string;
    title: string;
}

describe('createModelHooks - useFind', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('queryKeys.find', () => {
        it('should generate correct query key', () => {
            const hooks = createModelHooks<TestModel>({ entityName: 'posts' });
            const queryKey = hooks.queryKeys.find('slug', 'test-slug');

            expect(queryKey).toEqual(['posts', 'find', 'slug', 'test-slug']);
        });

        it('should generate correct query key for numeric values', () => {
            const hooks = createModelHooks<TestModel>({ entityName: 'posts' });
            const queryKey = hooks.queryKeys.find('id', 123);

            expect(queryKey).toEqual(['posts', 'find', 'id', 123]);
        });
    });

    describe('fetchers.fetchFind', () => {
        it('should fetch single object by field/value', async () => {
            const mockData: TestModel = {
                id: 'test-1',
                slug: 'test-slug',
                title: 'Test Title',
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockData,
            });

            const hooks = createModelHooks<TestModel>({ entityName: 'posts' });
            const result = await hooks.fetchers.fetchFind('slug', 'test-slug');

            expect(result).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledWith('/api/ottaorm/posts?field=slug&value=test-slug');
        });

        it('should return null when record not found (404)', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: async () => ({ error: 'Not found' }),
            });

            const hooks = createModelHooks<TestModel>({ entityName: 'posts' });
            const result = await hooks.fetchers.fetchFind('slug', 'non-existent');

            expect(result).toBeNull();
            expect(global.fetch).toHaveBeenCalledWith('/api/ottaorm/posts?field=slug&value=non-existent');
        });

        it('should throw error on non-404 errors', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({ error: 'Server error' }),
            });

            const hooks = createModelHooks<TestModel>({ entityName: 'posts' });

            await expect(hooks.fetchers.fetchFind('slug', 'test-slug')).rejects.toThrow();
        });

        it('should handle numeric values', async () => {
            const mockData: TestModel = {
                id: '123',
                slug: 'test-slug',
                title: 'Test Title',
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockData,
            });

            const hooks = createModelHooks<TestModel>({ entityName: 'posts' });
            const result = await hooks.fetchers.fetchFind('id', 123);

            expect(result).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledWith('/api/ottaorm/posts?field=id&value=123');
        });

        it('should use custom API path when provided', async () => {
            const mockData: TestModel = {
                id: 'test-1',
                slug: 'test-slug',
                title: 'Test Title',
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockData,
            });

            const hooks = createModelHooks<TestModel>({
                entityName: 'posts',
                apiPath: '/api/custom/posts',
            });
            const result = await hooks.fetchers.fetchFind('slug', 'test-slug');

            expect(result).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledWith('/api/custom/posts?field=slug&value=test-slug');
        });

        it('should handle empty string value', async () => {
            const mockData: TestModel = {
                id: 'test-1',
                slug: '',
                title: 'Test Title',
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockData,
            });

            const hooks = createModelHooks<TestModel>({ entityName: 'posts' });
            const result = await hooks.fetchers.fetchFind('slug', '');

            expect(result).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledWith('/api/ottaorm/posts?field=slug&value=');
        });

        it('should handle network errors', async () => {
            (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

            const hooks = createModelHooks<TestModel>({ entityName: 'posts' });

            await expect(hooks.fetchers.fetchFind('slug', 'test-slug')).rejects.toThrow('Network error');
        });
    });

    describe('fetchers.fetchList / normalizeListResponse', () => {
        it('should return array when API returns plain array', async () => {
            const mockList: TestModel[] = [
                { id: '1', slug: 'a', title: 'A' },
                { id: '2', slug: 'b', title: 'B' },
            ];
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockList,
            });

            const hooks = createModelHooks<TestModel>({ entityName: 'posts' });
            const result = await hooks.fetchers.fetchList();

            expect(result).toEqual(mockList);
            expect(Array.isArray(result)).toBe(true);
        });

        it('should return data array when API returns { data: array, pagination } (version history shape)', async () => {
            const mockList: TestModel[] = [
                { id: '1', slug: 'a', title: 'A' },
                { id: '2', slug: 'b', title: 'B' },
            ];
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ data: mockList, pagination: { page: 1, perPage: 10, total: 2 } }),
            });

            const hooks = createModelHooks<TestModel>({ entityName: 'posts' });
            const result = await hooks.fetchers.fetchList();

            expect(result).toEqual(mockList);
            expect(result).toHaveLength(2);
        });

        it('should return inner data when API returns { data: { data: array, pagination } }', async () => {
            const mockList: TestModel[] = [{ id: '1', slug: 'x', title: 'X' }];
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ data: { data: mockList, pagination: {} } }),
            });

            const hooks = createModelHooks<TestModel>({ entityName: 'posts' });
            const result = await hooks.fetchers.fetchList();

            expect(result).toEqual(mockList);
            expect(result).toHaveLength(1);
        });

        it('should return empty array when API returns empty or unexpected shape', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({}),
            });

            const hooks = createModelHooks<TestModel>({ entityName: 'posts' });
            const result = await hooks.fetchers.fetchList();

            expect(result).toEqual([]);
        });
    });
});
