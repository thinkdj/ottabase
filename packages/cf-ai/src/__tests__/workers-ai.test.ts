import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIError } from '../types';
import { WorkersAIClient, createWorkersAIClient } from '../workers-ai';

/** Minimal mock of the Cloudflare `Ai` binding. */
function createMockAiBinding(runImpl?: (...args: any[]) => any) {
    return {
        run: runImpl ?? vi.fn().mockResolvedValue({ response: 'Hello from Workers AI' }),
    } as unknown as Ai;
}

describe('WorkersAIClient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create a client with a valid binding', () => {
            const client = new WorkersAIClient({ binding: createMockAiBinding() });
            expect(client).toBeInstanceOf(WorkersAIClient);
        });

        it('should throw when binding is missing', () => {
            expect(() => new WorkersAIClient({ binding: null as any })).toThrow(AIError);
        });
    });

    describe('createWorkersAIClient factory', () => {
        it('should create a client', () => {
            const client = createWorkersAIClient({ binding: createMockAiBinding() });
            expect(client).toBeInstanceOf(WorkersAIClient);
        });
    });

    describe('textGeneration', () => {
        it('should return text from non-streaming response', async () => {
            const mockRun = vi.fn().mockResolvedValue({ response: 'Hi there!' });
            const client = new WorkersAIClient({ binding: createMockAiBinding(mockRun) });

            const result = await client.textGeneration({
                model: '@cf/meta/llama-3.1-8b-instruct',
                messages: [{ role: 'user', content: 'Hello' }],
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.response).toBe('Hi there!');
            }

            expect(mockRun).toHaveBeenCalledWith('@cf/meta/llama-3.1-8b-instruct', {
                messages: [{ role: 'user', content: 'Hello' }],
                stream: false,
            });
        });

        it('should forward usage when the binding returns it', async () => {
            const mockRun = vi.fn().mockResolvedValue({
                response: 'Hi!',
                usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
            });
            const client = new WorkersAIClient({ binding: createMockAiBinding(mockRun) });

            const result = await client.textGeneration({
                model: '@cf/meta/llama-3.1-8b-instruct',
                messages: [{ role: 'user', content: 'Hello' }],
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.response).toBe('Hi!');
                expect(result.data.usage).toEqual({
                    prompt_tokens: 5,
                    completion_tokens: 2,
                    total_tokens: 7,
                });
            }
        });

        it('should omit usage when the binding does not return it', async () => {
            const mockRun = vi.fn().mockResolvedValue({ response: 'Hi!' });
            const client = new WorkersAIClient({ binding: createMockAiBinding(mockRun) });

            const result = await client.textGeneration({
                model: '@cf/meta/llama-3.1-8b-instruct',
                messages: [{ role: 'user', content: 'Hello' }],
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.usage).toBeUndefined();
            }
        });

        it('should handle string response format', async () => {
            const mockRun = vi.fn().mockResolvedValue('plain string response');
            const client = new WorkersAIClient({ binding: createMockAiBinding(mockRun) });

            const result = await client.textGeneration({
                model: '@cf/meta/llama-3.1-8b-instruct',
                messages: [{ role: 'user', content: 'Hello' }],
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.response).toBe('plain string response');
            }
        });

        it('should return error when stream=true is passed', async () => {
            const client = new WorkersAIClient({ binding: createMockAiBinding() });
            const result = await client.textGeneration({
                model: '@cf/meta/llama-3.1-8b-instruct',
                messages: [{ role: 'user', content: 'Hello' }],
                stream: true,
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('WORKERS_AI_USE_STREAM');
            }
        });

        it('should handle runtime errors gracefully', async () => {
            const mockRun = vi.fn().mockRejectedValue(new Error('Model not found'));
            const client = new WorkersAIClient({ binding: createMockAiBinding(mockRun) });

            const result = await client.textGeneration({
                model: '@cf/nonexistent/model',
                messages: [{ role: 'user', content: 'Hello' }],
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('WORKERS_AI_ERROR');
                expect(result.error.message).toContain('Model not found');
            }
        });

        it('should pass through optional params like temperature', async () => {
            const mockRun = vi.fn().mockResolvedValue({ response: 'ok' });
            const client = new WorkersAIClient({ binding: createMockAiBinding(mockRun) });

            await client.textGeneration({
                model: '@cf/meta/llama-3.1-8b-instruct',
                messages: [{ role: 'user', content: 'Hello' }],
                temperature: 0.7,
                max_tokens: 100,
            });

            expect(mockRun).toHaveBeenCalledWith('@cf/meta/llama-3.1-8b-instruct', {
                messages: [{ role: 'user', content: 'Hello' }],
                stream: false,
                temperature: 0.7,
                max_tokens: 100,
            });
        });
    });

    describe('textGenerationStream', () => {
        it('should return a ReadableStream', async () => {
            const mockStream = new ReadableStream();
            const mockRun = vi.fn().mockResolvedValue(mockStream);
            const client = new WorkersAIClient({ binding: createMockAiBinding(mockRun) });

            const result = await client.textGenerationStream({
                model: '@cf/meta/llama-3.1-8b-instruct',
                messages: [{ role: 'user', content: 'Hello' }],
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBeInstanceOf(ReadableStream);
            }

            expect(mockRun).toHaveBeenCalledWith('@cf/meta/llama-3.1-8b-instruct', {
                messages: [{ role: 'user', content: 'Hello' }],
                stream: true,
            });
        });

        it('should return error if result is not a ReadableStream', async () => {
            const mockRun = vi.fn().mockResolvedValue({ response: 'not a stream' });
            const client = new WorkersAIClient({ binding: createMockAiBinding(mockRun) });

            const result = await client.textGenerationStream({
                model: '@cf/meta/llama-3.1-8b-instruct',
                messages: [{ role: 'user', content: 'Hello' }],
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('WORKERS_AI_STREAM_ERROR');
            }
        });
    });

    describe('embeddings', () => {
        it('should return embeddings for a single string', async () => {
            const mockRun = vi.fn().mockResolvedValue({
                shape: [1, 768],
                data: [[0.1, 0.2, 0.3]],
            });
            const client = new WorkersAIClient({ binding: createMockAiBinding(mockRun) });

            const result = await client.embeddings({
                model: '@cf/baai/bge-base-en-v1.5',
                text: 'Hello world',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.shape).toEqual([1, 768]);
                expect(result.data.data[0]).toEqual([0.1, 0.2, 0.3]);
            }

            // Single string should be wrapped in array
            expect(mockRun).toHaveBeenCalledWith('@cf/baai/bge-base-en-v1.5', {
                text: ['Hello world'],
            });
        });

        it('should pass through array of strings', async () => {
            const mockRun = vi.fn().mockResolvedValue({ shape: [2, 768], data: [[0.1], [0.2]] });
            const client = new WorkersAIClient({ binding: createMockAiBinding(mockRun) });

            await client.embeddings({
                model: '@cf/baai/bge-base-en-v1.5',
                text: ['Hello', 'World'],
            });

            expect(mockRun).toHaveBeenCalledWith('@cf/baai/bge-base-en-v1.5', {
                text: ['Hello', 'World'],
            });
        });
    });

    describe('translation', () => {
        it('should translate text', async () => {
            const mockRun = vi.fn().mockResolvedValue({ translated_text: 'Bonjour' });
            const client = new WorkersAIClient({ binding: createMockAiBinding(mockRun) });

            const result = await client.translation({
                model: '@cf/meta/m2m100-1.2b',
                text: 'Hello',
                source_lang: 'en',
                target_lang: 'fr',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.translated_text).toBe('Bonjour');
            }
        });
    });

    describe('summarization', () => {
        it('should summarize text', async () => {
            const mockRun = vi.fn().mockResolvedValue({ summary: 'TL;DR: stuff happened' });
            const client = new WorkersAIClient({ binding: createMockAiBinding(mockRun) });

            const result = await client.summarization({
                model: '@cf/facebook/bart-large-cnn',
                input_text: 'A long article about many things...',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.summary).toBe('TL;DR: stuff happened');
            }
        });
    });

    describe('run (generic)', () => {
        it('should run any model with arbitrary inputs', async () => {
            const mockRun = vi.fn().mockResolvedValue({ result: 'custom output' });
            const client = new WorkersAIClient({ binding: createMockAiBinding(mockRun) });

            const result = await client.run<{ result: string }>('@cf/custom/model', {
                input: 'test',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.result).toBe('custom output');
            }
        });
    });

    describe('getRaw', () => {
        it('should return the raw Ai binding', () => {
            const binding = createMockAiBinding();
            const client = new WorkersAIClient({ binding });
            expect(client.getRaw()).toBe(binding);
        });
    });
});
