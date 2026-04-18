/**
 * Workers AI Client
 * Direct wrapper for the Cloudflare Workers AI binding (`env.AI`)
 *
 * Use this when you want to call Cloudflare's built-in AI models directly
 * without the AI Gateway proxy (lower latency, no external network hop).
 *
 * @see https://developers.cloudflare.com/workers-ai/
 */

import type {
    Result,
    WorkersAIEmbeddingOptions,
    WorkersAIEmbeddingResponse,
    WorkersAIImageGenOptions,
    WorkersAISpeechToTextOptions,
    WorkersAISummarizationOptions,
    WorkersAITextGenOptions,
    WorkersAITextGenResponse,
    WorkersAITranslationOptions,
} from './types';
import { AIError } from './types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface WorkersAIConfig {
    /** The `AI` binding from `env.AI` in your Worker. */
    binding: Ai;
}

// ---------------------------------------------------------------------------
// Helpers — Ai.run() expects literal model names from AiModels; we accept
// dynamic strings so we cast through `any` at the call boundary.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Type-safe wrapper around the Workers AI binding.
 *
 * @example
 * ```ts
 * import { createWorkersAIClient } from '@ottabase/cf-ai/workers-ai';
 *
 * const ai = createWorkersAIClient({ binding: env.AI });
 *
 * // Text generation
 * const result = await ai.textGeneration({
 *     model: '@cf/meta/llama-3.1-8b-instruct',
 *     messages: [{ role: 'user', content: 'Hello!' }],
 * });
 *
 * // Embeddings
 * const embeddings = await ai.embeddings({
 *     model: '@cf/baai/bge-base-en-v1.5',
 *     text: 'Some text to embed',
 * });
 * ```
 */
export class WorkersAIClient {
    private ai: Ai;

    constructor(config: WorkersAIConfig) {
        if (!config.binding) {
            throw new AIError('Workers AI binding (env.AI) is required', 'WORKERS_AI_MISSING_BINDING');
        }
        this.ai = config.binding;
    }

    // -----------------------------------------------------------------------
    // Text generation (chat / instruct models)
    // -----------------------------------------------------------------------

    /**
     * Run text-generation (chat) on a Workers AI model.
     * Returns the full response string (non-streaming).
     */
    async textGeneration(options: WorkersAITextGenOptions): Promise<Result<WorkersAITextGenResponse>> {
        try {
            const { model, messages, stream, ...rest } = options;
            if (stream) {
                throw new AIError(
                    'Use textGenerationStream() for streaming responses',
                    'WORKERS_AI_USE_STREAM',
                    'workers-ai',
                );
            }

            // Cast model to `any` — we accept arbitrary model strings at runtime
            const result = await (this.ai as any).run(model, {
                messages,
                stream: false,
                ...rest,
            });

            // Workers AI returns { response: string, usage?: {...} } for non-streaming
            const text = typeof result === 'string' ? result : ((result as { response?: string }).response ?? '');
            const usage =
                typeof result === 'object' && result !== null && 'usage' in result
                    ? (result as { usage?: WorkersAITextGenResponse['usage'] }).usage
                    : undefined;
            return { success: true, data: { response: text, ...(usage && { usage }) } };
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * Run text-generation with SSE streaming.
     * Returns a ReadableStream of server-sent events.
     */
    async textGenerationStream(
        options: Omit<WorkersAITextGenOptions, 'stream'>,
    ): Promise<Result<ReadableStream<Uint8Array>>> {
        try {
            const { model, messages, ...rest } = options;
            const result = await (this.ai as any).run(model, {
                messages,
                stream: true,
                ...rest,
            });

            // When stream=true, Workers AI returns a ReadableStream
            if (result instanceof ReadableStream) {
                return { success: true, data: result as ReadableStream<Uint8Array> };
            }

            throw new AIError(
                'Expected a ReadableStream for streaming response',
                'WORKERS_AI_STREAM_ERROR',
                'workers-ai',
            );
        } catch (error) {
            return this.handleError(error);
        }
    }

    // -----------------------------------------------------------------------
    // Embeddings
    // -----------------------------------------------------------------------

    /** Generate text embeddings. */
    async embeddings(options: WorkersAIEmbeddingOptions): Promise<Result<WorkersAIEmbeddingResponse>> {
        try {
            const { model, text } = options;
            const result = (await (this.ai as any).run(model, {
                text: Array.isArray(text) ? text : [text],
            })) as AiTextEmbeddingsOutput;

            return {
                success: true,
                data: { shape: result.shape, data: result.data },
            };
        } catch (error) {
            return this.handleError(error);
        }
    }

    // -----------------------------------------------------------------------
    // Image generation
    // -----------------------------------------------------------------------

    /** Generate an image from a text prompt. Returns raw image bytes (PNG). */
    async imageGeneration(options: WorkersAIImageGenOptions): Promise<Result<ArrayBuffer>> {
        try {
            const { model, ...rest } = options;
            const result = await (this.ai as any).run(model, rest);

            // Image models return a ReadableStream of the image bytes
            if (result instanceof ReadableStream) {
                const reader = (result as ReadableStream<Uint8Array>).getReader();
                const chunks: Uint8Array[] = [];
                let done = false;
                while (!done) {
                    const { value, done: streamDone } = await reader.read();
                    done = streamDone;
                    if (value) chunks.push(value);
                }
                const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
                const merged = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of chunks) {
                    merged.set(chunk, offset);
                    offset += chunk.length;
                }
                return { success: true, data: merged.buffer };
            }

            return { success: true, data: result as unknown as ArrayBuffer };
        } catch (error) {
            return this.handleError(error);
        }
    }

    // -----------------------------------------------------------------------
    // Translation
    // -----------------------------------------------------------------------

    /** Translate text between languages. */
    async translation(options: WorkersAITranslationOptions): Promise<Result<{ translated_text: string }>> {
        try {
            const { model, ...rest } = options;
            const result = (await (this.ai as any).run(model, rest)) as AiTranslationOutput;
            return { success: true, data: { translated_text: result.translated_text ?? '' } };
        } catch (error) {
            return this.handleError(error);
        }
    }

    // -----------------------------------------------------------------------
    // Summarization
    // -----------------------------------------------------------------------

    /** Summarize text. */
    async summarization(options: WorkersAISummarizationOptions): Promise<Result<{ summary: string }>> {
        try {
            const { model, ...rest } = options;
            const result = (await (this.ai as any).run(model, rest)) as AiSummarizationOutput;
            return { success: true, data: { summary: result.summary } };
        } catch (error) {
            return this.handleError(error);
        }
    }

    // -----------------------------------------------------------------------
    // Speech-to-text
    // -----------------------------------------------------------------------

    /** Transcribe audio to text. */
    async speechToText(
        options: WorkersAISpeechToTextOptions,
    ): Promise<Result<{ text: string; words?: Array<{ word: string; start: number; end: number }> }>> {
        try {
            const { model, audio } = options;
            // Use Array.from() instead of spread to safely convert large audio buffers
            const result = (await (this.ai as any).run(model, {
                audio: Array.from(new Uint8Array(audio)),
            })) as { text: string; words?: Array<{ word: string; start: number; end: number }> };
            return { success: true, data: { text: result.text, words: result.words } };
        } catch (error) {
            return this.handleError(error);
        }
    }

    // -----------------------------------------------------------------------
    // Generic run — escape hatch for any model
    // -----------------------------------------------------------------------

    /**
     * Run any Workers AI model with arbitrary inputs.
     * Use this for models not covered by the typed methods above.
     */
    async run<T = unknown>(model: string, inputs: Record<string, unknown>): Promise<Result<T>> {
        try {
            const result = await (this.ai as any).run(model, inputs);
            return { success: true, data: result as T };
        } catch (error) {
            return this.handleError(error);
        }
    }

    // -----------------------------------------------------------------------
    // Escape hatch
    // -----------------------------------------------------------------------

    /** Get the raw Ai binding for direct access. */
    getRaw(): Ai {
        return this.ai;
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    private handleError<T>(error: unknown): Result<T> {
        if (error instanceof AIError) {
            return { success: false, error };
        }
        return {
            success: false,
            error: new AIError(
                error instanceof Error ? error.message : String(error),
                'WORKERS_AI_ERROR',
                'workers-ai',
                undefined,
                error,
            ),
        };
    }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a WorkersAIClient from the `env.AI` binding. */
export function createWorkersAIClient(config: WorkersAIConfig): WorkersAIClient {
    return new WorkersAIClient(config);
}
