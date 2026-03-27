import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIGatewayClient, createAIGatewayClient } from '../gateway';
import { AIError } from '../types';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('AIGatewayClient', () => {
    const baseConfig = {
        accountId: 'acc123',
        gateway: 'test-gw',
        apiKey: 'default-key',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create a client with valid config', () => {
            const client = new AIGatewayClient(baseConfig);
            expect(client).toBeInstanceOf(AIGatewayClient);
        });

        it('should throw when accountId is missing', () => {
            expect(() => new AIGatewayClient({ accountId: '', gateway: 'gw' })).toThrow(AIError);
        });

        it('should throw when gateway is missing', () => {
            expect(() => new AIGatewayClient({ accountId: 'acc', gateway: '' })).toThrow(AIError);
        });
    });

    describe('createAIGatewayClient factory', () => {
        it('should create a client', () => {
            const client = createAIGatewayClient(baseConfig);
            expect(client).toBeInstanceOf(AIGatewayClient);
        });
    });

    describe('getBaseUrl', () => {
        it('should return the gateway base URL', () => {
            const client = new AIGatewayClient(baseConfig);
            expect(client.getBaseUrl()).toBe('https://gateway.ai.cloudflare.com/v1/acc123/test-gw');
        });
    });

    describe('getAccountId / getGateway', () => {
        it('should return config values', () => {
            const client = new AIGatewayClient(baseConfig);
            expect(client.getAccountId()).toBe('acc123');
            expect(client.getGateway()).toBe('test-gw');
        });
    });

    describe('chatCompletion', () => {
        it('should return error for unknown provider', async () => {
            const client = new AIGatewayClient(baseConfig);
            const result = await client.chatCompletion('fake-provider' as any, {
                model: 'test',
                messages: [{ role: 'user', content: 'hi' }],
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('GATEWAY_UNKNOWN_PROVIDER');
            }
        });

        it('should make a fetch request to the correct URL for openai', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: 'chatcmpl-test',
                    object: 'chat.completion',
                    created: Date.now(),
                    model: 'gpt-4o',
                    choices: [{ index: 0, message: { role: 'assistant', content: 'Hello!' }, finish_reason: 'stop' }],
                    usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
                }),
            });

            const client = new AIGatewayClient(baseConfig);
            const result = await client.chatCompletion('openai', {
                model: 'gpt-4o',
                messages: [{ role: 'user', content: 'Hi' }],
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.choices[0].message.content).toBe('Hello!');
            }

            // Verify the URL
            expect(mockFetch).toHaveBeenCalledOnce();
            const [url, init] = mockFetch.mock.calls[0];
            expect(url).toBe('https://gateway.ai.cloudflare.com/v1/acc123/test-gw/openai/v1/chat/completions');
            expect(init.method).toBe('POST');

            // Verify auth header
            const headers = new Headers(init.headers);
            expect(headers.get('Authorization')).toBe('Bearer default-key');
        });

        it('should use per-request apiKey over default', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: 'test',
                    object: 'chat.completion',
                    created: 0,
                    model: 'gpt-4o',
                    choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
                }),
            });

            const client = new AIGatewayClient(baseConfig);
            await client.chatCompletion(
                'openai',
                { model: 'gpt-4o', messages: [{ role: 'user', content: 'test' }] },
                { apiKey: 'override-key' },
            );

            const headers = new Headers(mockFetch.mock.calls[0][1].headers);
            expect(headers.get('Authorization')).toBe('Bearer override-key');
        });

        it('should set cache headers when cacheTtl is provided', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: 'test',
                    object: 'chat.completion',
                    created: 0,
                    model: 'gpt-4o',
                    choices: [],
                }),
            });

            const client = new AIGatewayClient(baseConfig);
            await client.chatCompletion(
                'openai',
                { model: 'gpt-4o', messages: [{ role: 'user', content: 'test' }] },
                { cacheTtl: 3600, skipCache: true, metadata: { user: 'u1' } },
            );

            const headers = new Headers(mockFetch.mock.calls[0][1].headers);
            expect(headers.get('cf-aig-cache-ttl')).toBe('3600');
            expect(headers.get('cf-aig-skip-cache')).toBe('true');
            expect(headers.get('cf-aig-metadata')).toBe('{"user":"u1"}');
        });

        it('should set x-api-key header for anthropic', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: 'test',
                    object: 'chat.completion',
                    created: 0,
                    model: 'claude-3',
                    choices: [],
                }),
            });

            const client = new AIGatewayClient({ ...baseConfig, apiKey: 'ant-key' });
            await client.chatCompletion('anthropic', {
                model: 'claude-3',
                messages: [{ role: 'user', content: 'test' }],
            });

            const [url, init] = mockFetch.mock.calls[0];
            expect(url).toContain('/anthropic/v1/messages');
            const headers = new Headers(init.headers);
            expect(headers.get('x-api-key')).toBe('ant-key');
        });

        it('should handle fetch errors gracefully', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const client = new AIGatewayClient(baseConfig);
            const result = await client.chatCompletion('openai', {
                model: 'gpt-4o',
                messages: [{ role: 'user', content: 'test' }],
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('GATEWAY_ERROR');
                expect(result.error.message).toContain('Network error');
            }
        });

        it('should handle non-OK HTTP responses', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                text: async () => 'Rate limited',
            });

            const client = new AIGatewayClient(baseConfig);
            const result = await client.chatCompletion('openai', {
                model: 'gpt-4o',
                messages: [{ role: 'user', content: 'test' }],
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('GATEWAY_REQUEST_FAILED');
                expect(result.error.statusCode).toBe(429);
            }
        });
    });

    describe('chatCompletionStream', () => {
        it('should return a ReadableStream on success', async () => {
            const mockStream = new ReadableStream();
            mockFetch.mockResolvedValueOnce({
                ok: true,
                body: mockStream,
            });

            const client = new AIGatewayClient(baseConfig);
            const result = await client.chatCompletionStream('openai', {
                model: 'gpt-4o',
                messages: [{ role: 'user', content: 'test' }],
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBeInstanceOf(ReadableStream);
            }

            // Should include stream: true in body
            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.stream).toBe(true);
        });

        it('should return error if response has no body', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                body: null,
            });

            const client = new AIGatewayClient(baseConfig);
            const result = await client.chatCompletionStream('openai', {
                model: 'gpt-4o',
                messages: [{ role: 'user', content: 'test' }],
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('GATEWAY_NO_STREAM_BODY');
            }
        });
    });

    describe('request (generic)', () => {
        it('should allow arbitrary provider endpoints', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: [{ url: 'https://example.com/image.png' }] }),
            });

            const client = new AIGatewayClient(baseConfig);
            const result = await client.request('openai', '/v1/images/generations', {
                prompt: 'A cat',
                n: 1,
                size: '1024x1024',
            });

            expect(result.success).toBe(true);
            const [url] = mockFetch.mock.calls[0];
            expect(url).toContain('/openai/v1/images/generations');
        });
    });

    describe('abortSignal support', () => {
        it('should pass external abortSignal to fetch', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: 'test',
                    object: 'chat.completion',
                    created: 0,
                    model: 'gpt-4o',
                    choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
                }),
            });

            const controller = new AbortController();
            const client = new AIGatewayClient(baseConfig);
            await client.chatCompletion(
                'openai',
                { model: 'gpt-4o', messages: [{ role: 'user', content: 'test' }] },
                { abortSignal: controller.signal },
            );

            // Verify that the fetch was called with a signal
            const fetchInit = mockFetch.mock.calls[0][1];
            expect(fetchInit.signal).toBeDefined();
        });

        it('should abort fetch when external signal fires', async () => {
            // Simulate a slow fetch that resolves after abort
            mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
                return new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => {
                        reject(new DOMException('The operation was aborted.', 'AbortError'));
                    });
                });
            });

            const controller = new AbortController();
            const client = new AIGatewayClient(baseConfig);

            const promise = client.chatCompletion(
                'openai',
                { model: 'gpt-4o', messages: [{ role: 'user', content: 'test' }] },
                { abortSignal: controller.signal },
            );

            // Abort immediately
            controller.abort();

            const result = await promise;
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('GATEWAY_ERROR');
            }
        });

        it('should pass abortSignal to stream fetch', async () => {
            const mockStream = new ReadableStream();
            mockFetch.mockResolvedValueOnce({
                ok: true,
                body: mockStream,
            });

            const controller = new AbortController();
            const client = new AIGatewayClient(baseConfig);
            await client.chatCompletionStream(
                'openai',
                { model: 'gpt-4o', messages: [{ role: 'user', content: 'test' }] },
                { abortSignal: controller.signal },
            );

            const fetchInit = mockFetch.mock.calls[0][1];
            expect(fetchInit.signal).toBe(controller.signal);
        });
    });
});
