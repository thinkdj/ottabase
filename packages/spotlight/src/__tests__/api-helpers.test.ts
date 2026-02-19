import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpotlightResult } from '../types';
import { createApiSearchHandler, createApiSearchHandlerWithSignal } from '../utils/api-helpers';

describe('createApiSearchHandler', () => {
    it('returns a function', () => {
        const api = vi.fn().mockResolvedValue([]);
        const handler = createApiSearchHandler({
            api,
            endpoint: '/api/search',
            transform: (item: { id: string; name: string }) => ({
                id: item.id,
                label: item.name,
            }),
        });
        expect(typeof handler).toBe('function');
    });

    it('calls api with endpoint and query param', async () => {
        const api = vi.fn().mockResolvedValue([]);
        const handler = createApiSearchHandler({
            api,
            endpoint: '/api/search',
            queryParamName: 'q',
            transform: (item: any) => ({ id: item.id, label: item.title }),
        });
        await handler('test query');
        expect(api).toHaveBeenCalledWith(
            '/api/search',
            expect.objectContaining({
                params: { q: 'test query' },
            }),
        );
    });

    it('merges additional params', async () => {
        const api = vi.fn().mockResolvedValue([]);
        const handler = createApiSearchHandler({
            api,
            endpoint: '/api/search',
            params: { limit: 10, type: 'post' },
            transform: (item: any) => ({ id: item.id, label: item.title }),
        });
        await handler('foo');
        expect(api).toHaveBeenCalledWith(
            '/api/search',
            expect.objectContaining({
                params: expect.objectContaining({ q: 'foo', limit: 10, type: 'post' }),
            }),
        );
    });

    it('transforms each result', async () => {
        const api = vi.fn().mockResolvedValue([
            { id: '1', title: 'First' },
            { id: '2', title: 'Second' },
        ]);
        const handler = createApiSearchHandler({
            api,
            endpoint: '/api/search',
            transform: (item: { id: string; title: string }): SpotlightResult => ({
                id: item.id,
                label: item.title,
            }),
        });
        const results = await handler('test');
        expect(results).toEqual([
            { id: '1', label: 'First' },
            { id: '2', label: 'Second' },
        ]);
    });

    it('rethrows on api error', async () => {
        const api = vi.fn().mockRejectedValue(new Error('Network error'));
        const handler = createApiSearchHandler({
            api,
            endpoint: '/api/search',
            transform: (item: any) => ({ id: item.id, label: item.label }),
        });
        await expect(handler('test')).rejects.toThrow('Network error');
    });
});

describe('createApiSearchHandlerWithSignal', () => {
    const defaultBaseUrl = 'https://api.example.com';

    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns a function', () => {
        const handler = createApiSearchHandlerWithSignal({
            endpoint: '/search',
            baseUrl: defaultBaseUrl,
            transform: (item: any) => ({ id: item.id, label: item.name }),
        });
        expect(typeof handler).toBe('function');
    });

    it('builds URL with query param and baseUrl', async () => {
        const fetchMock = vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([]),
        } as Response);
        const handler = createApiSearchHandlerWithSignal({
            endpoint: '/search',
            baseUrl: defaultBaseUrl,
            queryParamName: 'q',
            transform: (item: any) => ({ id: item.id, label: item.label }),
        });
        await handler('my query');
        expect(fetchMock).toHaveBeenCalledWith(
            'https://api.example.com/search?q=my+query',
            expect.objectContaining({ method: 'GET' }),
        );
    });

    it('merges additional params into URL', async () => {
        const fetchMock = vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([]),
        } as Response);
        const handler = createApiSearchHandlerWithSignal({
            endpoint: '/search',
            baseUrl: defaultBaseUrl,
            params: { limit: 5 },
            transform: (item: any) => ({ id: item.id, label: item.label }),
        });
        await handler('x');
        const callUrl = fetchMock.mock.calls[0][0] as string;
        expect(callUrl).toContain('q=x');
        expect(callUrl).toContain('limit=5');
    });

    it('passes AbortSignal to fetch', async () => {
        const fetchMock = vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([]),
        } as Response);
        const handler = createApiSearchHandlerWithSignal({
            endpoint: '/search',
            baseUrl: defaultBaseUrl,
            transform: (item: any) => ({ id: item.id, label: item.label }),
        });
        const controller = new AbortController();
        await handler('q', controller.signal);
        expect(fetchMock).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ signal: controller.signal }),
        );
    });

    it('adds Authorization header when getAuthToken returns token', async () => {
        const fetchMock = vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([]),
        } as Response);
        const handler = createApiSearchHandlerWithSignal({
            endpoint: '/search',
            baseUrl: defaultBaseUrl,
            getAuthToken: () => Promise.resolve('jwt-token-123'),
            transform: (item: any) => ({ id: item.id, label: item.label }),
        });
        await handler('q');
        expect(fetchMock).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer jwt-token-123',
                }),
            }),
        );
    });

    it('transforms response array to SpotlightResult[]', async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve([
                    { id: 'a', name: 'Item A' },
                    { id: 'b', name: 'Item B' },
                ]),
        } as Response);
        const handler = createApiSearchHandlerWithSignal({
            endpoint: '/search',
            baseUrl: defaultBaseUrl,
            transform: (item: { id: string; name: string }): SpotlightResult => ({
                id: item.id,
                label: item.name,
            }),
        });
        const results = await handler('test');
        expect(results).toEqual([
            { id: 'a', label: 'Item A' },
            { id: 'b', label: 'Item B' },
        ]);
    });

    it('returns empty array when response is not array', async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ data: [] }),
        } as Response);
        const handler = createApiSearchHandlerWithSignal({
            endpoint: '/search',
            baseUrl: defaultBaseUrl,
            transform: (item: any) => ({ id: item.id, label: item.label }),
        });
        const results = await handler('test');
        expect(results).toEqual([]);
    });

    it('throws when response is not ok', async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: false,
            statusText: 'Forbidden',
        } as Response);
        const handler = createApiSearchHandlerWithSignal({
            endpoint: '/search',
            baseUrl: defaultBaseUrl,
            transform: (item: any) => ({ id: item.id, label: item.label }),
        });
        await expect(handler('test')).rejects.toThrow('Search failed: Forbidden');
    });
});
