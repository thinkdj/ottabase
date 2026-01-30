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
});
