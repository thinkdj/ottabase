import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient, getErrorMessage, getErrorMessages, isApiError } from '../index';

type MockResponseOptions = {
    ok?: boolean;
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
    jsonData?: unknown;
};

const defaultHeaders = { 'content-type': 'application/json' };

function createMockResponse(options: MockResponseOptions = {}): Response {
    const { ok = true, status = 200, statusText = 'OK', headers = defaultHeaders, jsonData = {} } = options;

    return {
        ok,
        status,
        statusText,
        headers: new Headers(headers),
        json: vi.fn(() => Promise.resolve(jsonData)),
        clone: () =>
            createMockResponse({
                ok,
                status,
                statusText,
                headers,
                jsonData,
            }),
    } as unknown as Response;
}

function getFetchCall(mockFetch: ReturnType<typeof vi.fn>, index = 0): [RequestInfo | URL, RequestInit] {
    return mockFetch.mock.calls[index] as unknown as [RequestInfo | URL, RequestInit];
}

async function captureApiError(request: Promise<unknown>): Promise<ApiError> {
    try {
        await request;
        throw new Error('Expected request to fail');
    } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        return error;
    }
}

describe('API Client', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createApiClient', () => {
        it('should create an API client', () => {
            const api = createApiClient();
            expect(typeof api).toBe('function');
        });

        it('should make GET requests', async () => {
            const mockFetch = vi.fn(() => Promise.resolve(createMockResponse({ jsonData: { message: 'Hello' } })));
            global.fetch = mockFetch;

            const api = createApiClient({ baseUrl: 'https://api.example.com' });
            const result = await api<{ message: string }>('/hello');

            expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/hello', expect.any(Object));
            expect(result).toEqual({ message: 'Hello' });
        });

        it('should handle POST requests with body', async () => {
            const mockFetch = vi.fn(() => Promise.resolve(createMockResponse({ status: 201, jsonData: { id: 1 } })));
            global.fetch = mockFetch;

            const api = createApiClient();
            const body = { name: 'test' };
            await api('/posts', { method: 'POST', body });

            const callArgs = getFetchCall(mockFetch);
            expect(callArgs[0]).toBe('/posts');
            expect(callArgs[1].method).toBe('POST');
            expect(callArgs[1].body).toBe(JSON.stringify(body));
        });

        it('should inject auth token when provided', async () => {
            const mockFetch = vi.fn(() => Promise.resolve(createMockResponse()));
            global.fetch = mockFetch;

            const api = createApiClient({
                getAuthToken: () => 'test-token-123',
            });
            await api('/protected');

            const headers = getFetchCall(mockFetch)[1].headers as Record<string, string>;
            expect(headers['Authorization']).toBe('Bearer test-token-123');
        });

        it('should skip auth when skipAuth is true', async () => {
            const mockFetch = vi.fn(() => Promise.resolve(createMockResponse()));
            global.fetch = mockFetch;

            const api = createApiClient({
                getAuthToken: () => 'test-token',
            });
            await api('/public', { skipAuth: true });

            const headers = getFetchCall(mockFetch)[1].headers as Record<string, string>;
            expect(headers['Authorization']).toBeUndefined();
        });

        it('should add query params to URL', async () => {
            const mockFetch = vi.fn(() => Promise.resolve(createMockResponse({ jsonData: [] })));
            global.fetch = mockFetch;

            const api = createApiClient({ baseUrl: '/api' });
            await api('/posts', { params: { limit: 10, skip: 5 } });

            const url = getFetchCall(mockFetch)[0].toString();
            expect(url).toContain('limit=10');
            expect(url).toContain('skip=5');
        });

        it('should handle error responses', async () => {
            const mockFetch = vi.fn(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: false,
                        status: 404,
                        statusText: 'Not Found',
                        jsonData: {
                            error: 'Resource not found',
                            messages: ['Post not found'],
                        },
                    }),
                ),
            );
            global.fetch = mockFetch;

            const api = createApiClient();

            try {
                await api('/posts/999');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(isApiError(error)).toBe(true);
                expect((error as ApiError).status).toBe(404);
                expect((error as ApiError).isNotFound()).toBe(true);
            }
        });

        it('should handle shorthand method syntax', async () => {
            const mockFetch = vi.fn(() => Promise.resolve(createMockResponse()));
            global.fetch = mockFetch;

            const api = createApiClient();
            await api('/posts/1', 'DELETE');

            expect(getFetchCall(mockFetch)[1].method).toBe('DELETE');
        });

        it('performs each request exactly once without hidden coalescing', async () => {
            const mockFetch = vi.fn(() => Promise.resolve(createMockResponse({ jsonData: { message: 'Hello' } })));
            global.fetch = mockFetch;

            const api = createApiClient({ baseUrl: 'https://api.example.com' });
            const [first, second] = await Promise.all([
                api<{ message: string }>('/hello'),
                api<{ message: string }>('/hello'),
            ]);

            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(first).toEqual({ message: 'Hello' });
            expect(second).toEqual({ message: 'Hello' });
        });

        it('performs parallel mutation requests independently', async () => {
            let id = 0;
            const mockFetch = vi.fn(() =>
                Promise.resolve(
                    createMockResponse({
                        jsonData: { uploadId: ++id },
                    }),
                ),
            );
            global.fetch = mockFetch;

            const api = createApiClient({ baseUrl: '/api' });
            const fd1 = new FormData();
            fd1.append('file', new Blob(['x']), 'same.txt');
            const fd2 = new FormData();
            fd2.append('file', new Blob(['x']), 'same.txt');

            const [r1, r2] = await Promise.all([
                api<{ uploadId: number }>('/upload', { method: 'POST', body: fd1 }),
                api<{ uploadId: number }>('/upload', { method: 'POST', body: fd2 }),
            ]);

            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(r1.uploadId).toBe(1);
            expect(r2.uploadId).toBe(2);
        });

        it('returns a retryable network error after one safe-read attempt', async () => {
            const mockFetch = vi.fn().mockRejectedValue(new Error('socket hang up'));
            global.fetch = mockFetch;

            const api = createApiClient();
            const error = await captureApiError(api('/health'));

            expect(error.code).toBe('NETWORK_ERROR');
            expect(error.retryable).toBe(true);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('marks only explicitly transient safe-read responses as retryable', async () => {
            const mockFetch = vi
                .fn()
                .mockResolvedValueOnce(
                    createMockResponse({
                        ok: false,
                        status: 403,
                        jsonData: { error: 'Forbidden', code: 'FORBIDDEN' },
                    }),
                )
                .mockResolvedValueOnce(
                    createMockResponse({
                        ok: false,
                        status: 503,
                        headers: { ...defaultHeaders, 'Retry-After': '2' },
                        jsonData: { error: 'Unavailable', code: 'UPSTREAM_UNAVAILABLE' },
                    }),
                );
            global.fetch = mockFetch;

            const api = createApiClient();
            const forbidden = await captureApiError(api('/forbidden'));
            const unavailable = await captureApiError(api('/unavailable'));

            expect(forbidden.retryable).toBe(false);
            expect(unavailable.retryable).toBe(true);
            expect(unavailable.retryAfterMs).toBe(2000);
        });

        it('preserves the HTTP classification when an error body has an invalid shape', async () => {
            const mockFetch = vi.fn().mockResolvedValue(
                createMockResponse({
                    ok: false,
                    status: 403,
                    statusText: 'Forbidden',
                    jsonData: null,
                }),
            );
            global.fetch = mockFetch;

            const api = createApiClient();
            const error = await captureApiError(api('/forbidden'));

            expect(error.message).toBe('Forbidden');
            expect(error.status).toBe(403);
            expect(error.retryable).toBe(false);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('never marks a failed write as retryable and performs one attempt', async () => {
            const mockFetch = vi.fn().mockResolvedValue(
                createMockResponse({
                    ok: false,
                    status: 503,
                    jsonData: { error: 'Unavailable' },
                }),
            );
            global.fetch = mockFetch;

            const api = createApiClient();
            const error = await captureApiError(api('/items', { method: 'POST', body: { name: 'one' } }));

            expect(error.retryable).toBe(false);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('classifies a safe-read timeout without issuing another fetch', async () => {
            const mockFetch = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
                return new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
                });
            });
            global.fetch = mockFetch;

            const api = createApiClient({ timeout: 1 });
            const error = await captureApiError(api('/slow'));

            expect(error.code).toBe('TIMEOUT');
            expect(error.retryable).toBe(true);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('keeps the timeout active while consuming the response body', async () => {
            const mockFetch = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
                const response = createMockResponse();
                response.json = vi.fn(
                    () =>
                        new Promise((_resolve, reject) => {
                            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
                        }),
                );
                return Promise.resolve(response);
            });
            global.fetch = mockFetch;

            const api = createApiClient({ timeout: 1 });
            const error = await captureApiError(api('/slow-body'));

            expect(error.code).toBe('TIMEOUT');
            expect(error.retryable).toBe(true);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('classifies invalid success JSON as a deterministic response error', async () => {
            const response = createMockResponse();
            response.json = vi.fn().mockRejectedValue(new SyntaxError('Unexpected token'));
            const mockFetch = vi.fn().mockResolvedValue(response);
            global.fetch = mockFetch;

            const api = createApiClient();
            const error = await captureApiError(api('/invalid-json'));

            expect(error.code).toBe('INVALID_RESPONSE');
            expect(error.status).toBe(200);
            expect(error.retryable).toBe(false);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('preserves caller cancellation instead of converting it to a network error', async () => {
            const controller = new AbortController();
            const mockFetch = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
                return new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
                });
            });
            global.fetch = mockFetch;

            const api = createApiClient();
            const request = api('/slow', { signal: controller.signal });
            controller.abort(new DOMException('scope changed', 'AbortError'));

            await expect(request).rejects.toMatchObject({ name: 'AbortError' });
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('ApiError class', () => {
        it('should create ApiError with proper properties', () => {
            const error = new ApiError({
                error: 'Not Found',
                code: 'NOT_FOUND',
                status: 404,
            });

            expect(error.message).toBe('Not Found');
            expect(error.code).toBe('NOT_FOUND');
            expect(error.status).toBe(404);
        });

        it('should have status check methods', () => {
            const error401 = new ApiError({ error: 'Unauthorized', status: 401 });
            const error403 = new ApiError({ error: 'Forbidden', status: 403 });
            const error404 = new ApiError({ error: 'Not Found', status: 404 });
            const error500 = new ApiError({ error: 'Server Error', status: 500 });

            expect(error401.isUnauthorized()).toBe(true);
            expect(error403.isForbidden()).toBe(true);
            expect(error404.isNotFound()).toBe(true);
            expect(error500.isServerError()).toBe(true);
        });

        it('should aggregate error messages', () => {
            const error = new ApiError({
                error: 'Validation failed',
                messages: ['Email is required', 'Password is too short'],
                status: 400,
            });

            expect(error.getAllMessages()).toBe('Email is required, Password is too short');
        });

        it('preserves safe metadata and request correlation fields', () => {
            const error = new ApiError({
                error: 'Conflict',
                metadata: { currentVersion: 3 },
                requestId: 'request-123',
                status: 409,
            });

            expect(error.metadata).toEqual({ currentVersion: 3 });
            expect(error.requestId).toBe('request-123');
            expect(error.toJSON()).toMatchObject({
                metadata: { currentVersion: 3 },
                requestId: 'request-123',
            });
        });
    });

    describe('Type guards and helpers', () => {
        it('should identify ApiError instances', () => {
            const apiError = new ApiError({ error: 'Test', status: 400 });
            const regularError = new Error('Test');

            expect(isApiError(apiError)).toBe(true);
            expect(isApiError(regularError)).toBe(false);
        });

        it('should extract error messages', () => {
            const apiError = new ApiError({ error: 'API failed', status: 500 });
            expect(getErrorMessage(apiError)).toBe('API failed');
            expect(getErrorMessage('String error')).toBe('String error');
        });

        it('should extract all error messages from ApiError', () => {
            const apiError = new ApiError({
                error: 'Main error',
                messages: ['Error 1', 'Error 2'],
                status: 400,
            });

            expect(getErrorMessages(apiError)).toEqual(['Error 1', 'Error 2']);
        });
    });
});
