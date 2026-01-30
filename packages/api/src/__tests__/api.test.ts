import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApiClient, ApiError, isApiError, getErrorMessage, getErrorMessages } from '../index';

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
            const mockFetch = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    headers: new Headers({ 'content-type': 'application/json' }),
                    json: () => Promise.resolve({ message: 'Hello' }),
                } as Response),
            );
            global.fetch = mockFetch;

            const api = createApiClient({ baseUrl: 'https://api.example.com' });
            const result = await api<{ message: string }>('/hello');

            expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/hello', expect.any(Object));
            expect(result).toEqual({ message: 'Hello' });
        });

        it('should handle POST requests with body', async () => {
            const mockFetch = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    status: 201,
                    headers: new Headers({ 'content-type': 'application/json' }),
                    json: () => Promise.resolve({ id: 1 }),
                } as Response),
            );
            global.fetch = mockFetch;

            const api = createApiClient();
            const body = { name: 'test' };
            await api('/posts', { method: 'POST', body });

            const callArgs = mockFetch.mock.calls[0];
            expect(callArgs[0]).toBe('/posts');
            expect(callArgs[1].method).toBe('POST');
            expect(callArgs[1].body).toBe(JSON.stringify(body));
        });

        it('should inject auth token when provided', async () => {
            const mockFetch = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    headers: new Headers({ 'content-type': 'application/json' }),
                    json: () => Promise.resolve({}),
                } as Response),
            );
            global.fetch = mockFetch;

            const api = createApiClient({
                getAuthToken: () => 'test-token-123',
            });
            await api('/protected');

            const headers = mockFetch.mock.calls[0][1].headers;
            expect(headers['Authorization']).toBe('Bearer test-token-123');
        });

        it('should skip auth when skipAuth is true', async () => {
            const mockFetch = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    headers: new Headers({ 'content-type': 'application/json' }),
                    json: () => Promise.resolve({}),
                } as Response),
            );
            global.fetch = mockFetch;

            const api = createApiClient({
                getAuthToken: () => 'test-token',
            });
            await api('/public', { skipAuth: true });

            const headers = mockFetch.mock.calls[0][1].headers;
            expect(headers['Authorization']).toBeUndefined();
        });

        it('should add query params to URL', async () => {
            const mockFetch = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    headers: new Headers({ 'content-type': 'application/json' }),
                    json: () => Promise.resolve([]),
                } as Response),
            );
            global.fetch = mockFetch;

            const api = createApiClient({ baseUrl: '/api' });
            await api('/posts', { params: { limit: 10, skip: 5 } });

            const url = mockFetch.mock.calls[0][0];
            expect(url).toContain('limit=10');
            expect(url).toContain('skip=5');
        });

        it('should handle error responses', async () => {
            const mockFetch = vi.fn(() =>
                Promise.resolve({
                    ok: false,
                    status: 404,
                    statusText: 'Not Found',
                    headers: new Headers({ 'content-type': 'application/json' }),
                    json: () =>
                        Promise.resolve({
                            error: 'Resource not found',
                            messages: ['Post not found'],
                        }),
                } as Response),
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

        it('should call onError callback on error', async () => {
            const mockFetch = vi.fn(() =>
                Promise.resolve({
                    ok: false,
                    status: 500,
                    statusText: 'Server Error',
                    headers: new Headers({ 'content-type': 'application/json' }),
                    json: () => Promise.resolve({ error: 'Server error' }),
                } as Response),
            );
            global.fetch = mockFetch;

            const onError = vi.fn();
            const api = createApiClient({ onError });

            try {
                await api('/fail');
            } catch (error) {
                // error is expected
            }

            expect(onError).toHaveBeenCalledWith(expect.any(ApiError));
        });

        it('should call onUnauthorized for 401 responses', async () => {
            const mockFetch = vi.fn(() =>
                Promise.resolve({
                    ok: false,
                    status: 401,
                    statusText: 'Unauthorized',
                    headers: new Headers({ 'content-type': 'application/json' }),
                    json: () => Promise.resolve({ error: 'Unauthorized' }),
                } as Response),
            );
            global.fetch = mockFetch;

            const onUnauthorized = vi.fn();
            const api = createApiClient({ onUnauthorized });

            try {
                await api('/protected');
            } catch (error) {
                // error is expected
            }

            expect(onUnauthorized).toHaveBeenCalled();
        });

        it('should handle shorthand method syntax', async () => {
            const mockFetch = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    headers: new Headers({ 'content-type': 'application/json' }),
                    json: () => Promise.resolve({}),
                } as Response),
            );
            global.fetch = mockFetch;

            const api = createApiClient();
            await api('/posts/1', 'DELETE');

            expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
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
