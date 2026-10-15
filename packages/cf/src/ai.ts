/**
 * Workers AI wrapper
 * `run()` for any model, plus the two calls almost every app makes: embed text, generate text.
 * For provider routing, keys and spend tracking use `@ottabase/ottaai`; this is the raw binding.
 *
 * @see https://developers.cloudflare.com/workers-ai/
 */

import type { Ai } from '@cloudflare/workers-types';
import { attempt, CloudflareError, type Result } from './types';

export interface AiConfig {
    ai: Ai;
    /** Default embedding model. */
    embeddingModel?: string;
    /** Default text model. */
    textModel?: string;
    /** Route every call through an AI Gateway (caching, logs, rate limits). */
    gateway?: { id: string; skipCache?: boolean; cacheTtl?: number };
}

export interface AiMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface AiTextOptions {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    /** Prepended as the system message when `input` is a plain prompt. */
    system?: string;
}

export const DEFAULT_EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';
export const DEFAULT_TEXT_MODEL = '@cf/meta/llama-3.1-8b-instruct';

type RunFn = (model: string, inputs: unknown, options?: unknown) => Promise<unknown>;

/** Workers AI, typed loosely on purpose: the model catalogue changes faster than any type can. */
export class AiClient {
    private ai: Ai;
    private embeddingModel: string;
    private textModel: string;
    private gateway: AiConfig['gateway'];

    constructor(config: AiConfig) {
        if (!config.ai) {
            throw new CloudflareError('Workers AI binding is required', 'AI_MISSING_BINDING');
        }
        this.ai = config.ai;
        this.embeddingModel = config.embeddingModel ?? DEFAULT_EMBEDDING_MODEL;
        this.textModel = config.textModel ?? DEFAULT_TEXT_MODEL;
        this.gateway = config.gateway;
    }

    /** Any model, any inputs. The gateway option is added when configured. */
    run<T = unknown>(model: string, inputs: unknown, options: Record<string, unknown> = {}): Promise<Result<T, Error>> {
        const run = this.ai.run as unknown as RunFn;
        const merged = this.gateway ? { gateway: this.gateway, ...options } : options;
        return attempt(() => run.call(this.ai, model, inputs, merged) as Promise<T>);
    }

    /** Embeddings for one text or many, in input order. */
    async embed(text: string | string[], model = this.embeddingModel): Promise<Result<number[][], Error>> {
        const texts = Array.isArray(text) ? text : [text];
        if (texts.length === 0) return { success: true, data: [] };
        const result = await this.run<{ data?: number[][] }>(model, { text: texts });
        if (!result.success) return result;
        const data = result.data?.data;
        if (!Array.isArray(data) || data.length !== texts.length) {
            return {
                success: false,
                error: new CloudflareError(
                    `Embedding model ${model} returned ${data?.length ?? 0} vectors for ${texts.length} texts`,
                    'AI_BAD_RESPONSE',
                ),
            };
        }
        return { success: true, data };
    }

    /** One completion as a string, from a prompt or a message list. */
    async generateText(input: string | AiMessage[], options: AiTextOptions = {}): Promise<Result<string, Error>> {
        const messages: AiMessage[] =
            typeof input === 'string'
                ? [
                      ...(options.system ? [{ role: 'system' as const, content: options.system }] : []),
                      { role: 'user', content: input },
                  ]
                : input;
        const result = await this.run<{ response?: string }>(options.model ?? this.textModel, {
            messages,
            ...(options.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
            ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        });
        if (!result.success) return result;
        if (typeof result.data?.response !== 'string') {
            return { success: false, error: new CloudflareError('Text model returned no response', 'AI_BAD_RESPONSE') };
        }
        return { success: true, data: result.data.response };
    }
}

export function createAiClient(config: AiConfig): AiClient {
    return new AiClient(config);
}
