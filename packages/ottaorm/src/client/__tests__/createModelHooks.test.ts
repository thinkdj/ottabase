import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createModelClient, createModelHooks } from '../createModelHooks';
import type { ApiClientError, ApiClientFunction } from '../types';

interface TestModel {
    id: string;
    slug: string;
    title: string;
}

const record: TestModel = {
    id: 'record/with?reserved',
    slug: 'test-slug',
    title: 'Test Title',
};

function apiError(status: number): ApiClientError {
    return Object.assign(new Error(`HTTP ${status}`), {
        name: 'ApiError' as const,
        status,
        messages: [`HTTP ${status}`],
        retryable: false,
    });
}

function mockApi(result: unknown = record): {
    api: ApiClientFunction;
    fn: ReturnType<typeof vi.fn>;
} {
    const fn = vi.fn().mockResolvedValue(result);
    return {
        api: fn as unknown as ApiClientFunction,
        fn,
    };
}

describe('createModelHooks query keys', () => {
    it('includes find identity and infinite page size', () => {
        const hooks = createModelHooks<TestModel>({ entityName: 'posts' });

        expect(hooks.queryKeys.find('slug', 'test-slug')).toEqual(['posts', 'find', 'slug', 'test-slug']);
        expect(hooks.queryKeys.infinite({ search: 'query' }, 25)).toEqual([
            'posts',
            'infinite',
            {
                filters: { search: 'query' },
                perPage: 25,
            },
        ]);
    });
});

describe('createModelClient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses the mandatory client and forwards the query AbortSignal', async () => {
        const { api, fn } = mockApi({ data: [record] });
        const client = createModelClient<TestModel>({ entityName: 'posts' }, api);
        const controller = new AbortController();

        await expect(client.fetchList({ search: 'hello' }, controller.signal)).resolves.toEqual([record]);
        expect(fn).toHaveBeenCalledWith('/api/ottaorm/posts?search=hello', {
            method: 'GET',
            signal: controller.signal,
        });
    });

    it('encodes resource IDs before placing them in a URL path', async () => {
        const { api, fn } = mockApi(record);
        const client = createModelClient<TestModel>({ entityName: 'posts' }, api);

        await expect(client.fetchDetail(record.id)).resolves.toEqual(record);
        expect(fn).toHaveBeenCalledWith('/api/ottaorm/posts/record%2Fwith%3Freserved', {
            method: 'GET',
            signal: undefined,
        });
    });

    it('maps a typed 404 lookup failure to null', async () => {
        const fn = vi.fn().mockRejectedValue(apiError(404));
        const client = createModelClient<TestModel>({ entityName: 'posts' }, fn as unknown as ApiClientFunction);

        await expect(client.fetchFind('slug', 'missing')).resolves.toBeNull();
        expect(fn).toHaveBeenCalledWith('/api/ottaorm/posts?field=slug&value=missing', {
            method: 'GET',
            signal: undefined,
        });
    });

    it('preserves non-404 structured failures', async () => {
        const error = apiError(403);
        const fn = vi.fn().mockRejectedValue(error);
        const client = createModelClient<TestModel>({ entityName: 'posts' }, fn as unknown as ApiClientFunction);

        await expect(client.fetchDetail('forbidden')).rejects.toBe(error);
    });

    it('normalizes the supported list envelope', async () => {
        const { api } = mockApi({
            data: {
                data: [record],
                pagination: { page: 1, perPage: 10, total: 1 },
            },
        });
        const client = createModelClient<TestModel>({ entityName: 'posts' }, api);

        await expect(client.fetchList()).resolves.toEqual([record]);
    });

    it('normalizes wrapped mutation records', async () => {
        const { api, fn } = mockApi({ data: record });
        const client = createModelClient<TestModel>({ entityName: 'posts' }, api);

        await expect(client.createItem({ slug: 'test-slug' })).resolves.toEqual(record);
        expect(fn).toHaveBeenCalledWith('/api/ottaorm/posts', {
            method: 'POST',
            body: { slug: 'test-slug' },
        });
    });

    it('encodes update/delete IDs', async () => {
        const { api, fn } = mockApi(record);
        const client = createModelClient<TestModel>({ entityName: 'posts' }, api);

        await client.updateItem(record.id, { title: 'Updated' });
        await client.deleteItem(record.id);

        expect(fn).toHaveBeenNthCalledWith(1, '/api/ottaorm/posts/record%2Fwith%3Freserved', {
            method: 'PATCH',
            body: { title: 'Updated' },
        });
        expect(fn).toHaveBeenNthCalledWith(2, '/api/ottaorm/posts/record%2Fwith%3Freserved', {
            method: 'DELETE',
        });
    });
});
