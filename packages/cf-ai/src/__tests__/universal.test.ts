import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UniversalAIClient, createUniversalAIClient } from '../universal';
import { AIError } from '../types';

// Mock global fetch for the underlying AIGatewayClient
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

/** Helper: create a mock successful OpenAI-style response. */
function mockChatResponse(content: string, model = 'gpt-4o') {
    return {
        ok: true,
        json: async () => ({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: Date.now(),
            model,
            choices: [
                {
                    index: 0,
                    message: { role: 'assistant', content },
                    finish_reason: 'stop',
                },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
    };
}

describe('UniversalAIClient', () => {
    const baseConfig = {
        accountId: 'acc123',
        gateway: 'test-gw',
        apiKey: 'default-key',
        defaultProvider: 'openai' as const,
        defaultModel: 'gpt-4o',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createUniversalAIClient factory', () => {
        it('should create a client', () => {
            const client = createUniversalAIClient(baseConfig);
            expect(client).toBeInstanceOf(UniversalAIClient);
        });
    });

    describe('chat()', () => {
        it('should send a simple string message and return ChatResult', async () => {
            mockFetch.mockResolvedValueOnce(mockChatResponse('Hello!'));

            const client = new UniversalAIClient(baseConfig);
            const result = await client.chat('Hi there');

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.text).toBe('Hello!');
                expect(result.data.provider).toBe('openai');
                expect(result.data.model).toBe('gpt-4o');
                expect(result.data.usage?.total_tokens).toBe(15);
            }
        });

        it('should prepend systemPrompt as a system message', async () => {
            mockFetch.mockResolvedValueOnce(mockChatResponse('Summary done.'));

            const client = new UniversalAIClient(baseConfig);
            await client.chat('Summarize this', { systemPrompt: 'You are a summarizer.' });

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.messages).toEqual([
                { role: 'system', content: 'You are a summarizer.' },
                { role: 'user', content: 'Summarize this' },
            ]);
        });

        it('should accept messages array directly', async () => {
            mockFetch.mockResolvedValueOnce(mockChatResponse('Reply'));

            const client = new UniversalAIClient(baseConfig);
            await client.chat([
                { role: 'system', content: 'Be brief.' },
                { role: 'user', content: 'Hello' },
            ]);

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.messages).toEqual([
                { role: 'system', content: 'Be brief.' },
                { role: 'user', content: 'Hello' },
            ]);
        });

        it('should pass temperature and max_tokens', async () => {
            mockFetch.mockResolvedValueOnce(mockChatResponse('ok'));

            const client = new UniversalAIClient(baseConfig);
            await client.chat('test', { temperature: 0.3, max_tokens: 50 });

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.temperature).toBe(0.3);
            expect(body.max_tokens).toBe(50);
        });

        it('should override provider and model per-request', async () => {
            mockFetch.mockResolvedValueOnce(mockChatResponse('Anthropic reply', 'claude-3'));

            const client = new UniversalAIClient(baseConfig);
            const result = await client.chat('test', {
                provider: 'anthropic',
                model: 'claude-3',
                apiKey: 'ant-key',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.provider).toBe('anthropic');
            }

            // Should hit the anthropic path
            const url = mockFetch.mock.calls[0][0];
            expect(url).toContain('/anthropic/');
        });

        it('should return error when no provider configured', async () => {
            const client = new UniversalAIClient({
                accountId: 'acc',
                gateway: 'gw',
                // No defaultProvider
            });

            const result = await client.chat('hello');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('UNIVERSAL_NO_PROVIDER');
            }
        });

        it('should return error when no model configured', async () => {
            const client = new UniversalAIClient({
                accountId: 'acc',
                gateway: 'gw',
                defaultProvider: 'openai',
                // No defaultModel
            });

            const result = await client.chat('hello');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('UNIVERSAL_NO_MODEL');
            }
        });
    });

    describe('chatWithFallback()', () => {
        it('should succeed on first provider', async () => {
            mockFetch.mockResolvedValueOnce(mockChatResponse('OpenAI says hi'));

            const client = new UniversalAIClient({
                ...baseConfig,
                fallbacks: [
                    { provider: 'openai', model: 'gpt-4o', apiKey: 'oai-key' },
                    { provider: 'anthropic', model: 'claude-3', apiKey: 'ant-key' },
                ],
            });

            const result = await client.chatWithFallback('Hello');
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.text).toBe('OpenAI says hi');
                expect(result.data.provider).toBe('openai');
            }

            // Should only have called fetch once (no fallback needed)
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should fall back to second provider when first fails', async () => {
            // First call fails
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: async () => 'Internal server error',
            });
            // Second call succeeds
            mockFetch.mockResolvedValueOnce(mockChatResponse('Anthropic to the rescue', 'claude-3'));

            const client = new UniversalAIClient({
                ...baseConfig,
                fallbacks: [
                    { provider: 'openai', model: 'gpt-4o', apiKey: 'oai-key' },
                    { provider: 'anthropic', model: 'claude-3', apiKey: 'ant-key' },
                ],
            });

            const result = await client.chatWithFallback('Hello');
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.text).toBe('Anthropic to the rescue');
                expect(result.data.provider).toBe('anthropic');
            }

            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('should return combined error when all providers fail', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                text: async () => 'Server error',
            });

            const client = new UniversalAIClient({
                ...baseConfig,
                fallbacks: [
                    { provider: 'openai', model: 'gpt-4o', apiKey: 'k1' },
                    { provider: 'anthropic', model: 'claude-3', apiKey: 'k2' },
                ],
            });

            const result = await client.chatWithFallback('Hello');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('UNIVERSAL_ALL_FALLBACKS_FAILED');
                expect(result.error.message).toContain('openai');
                expect(result.error.message).toContain('anthropic');
            }
        });

        it('should return error when no fallbacks configured', async () => {
            const client = new UniversalAIClient(baseConfig); // no fallbacks
            const result = await client.chatWithFallback('Hello');

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('UNIVERSAL_NO_FALLBACKS');
            }
        });
    });

    describe('chatStream()', () => {
        it('should return a ReadableStream on success', async () => {
            const mockStream = new ReadableStream();
            mockFetch.mockResolvedValueOnce({
                ok: true,
                body: mockStream,
            });

            const client = new UniversalAIClient(baseConfig);
            const result = await client.chatStream('Hello', {
                provider: 'openai',
                model: 'gpt-4o',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBeInstanceOf(ReadableStream);
            }
        });
    });

    describe('getGateway / getConfig', () => {
        it('should expose the underlying gateway client', () => {
            const client = new UniversalAIClient(baseConfig);
            expect(client.getGateway()).toBeDefined();
            expect(client.getGateway().getAccountId()).toBe('acc123');
        });

        it('should expose the config', () => {
            const client = new UniversalAIClient(baseConfig);
            const config = client.getConfig();
            expect(config.defaultProvider).toBe('openai');
            expect(config.defaultModel).toBe('gpt-4o');
        });
    });
});
