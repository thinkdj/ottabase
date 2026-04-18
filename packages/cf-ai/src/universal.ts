/**
 * Universal AI Client
 * Unified interface that wraps AI Gateway with multi-provider fallback.
 *
 * This is the recommended high-level client:
 * - Single `chat()` method that works across all providers
 * - Automatic fallback chain (try OpenAI → Anthropic → Workers AI)
 * - Uses AI Gateway's universal OpenAI-compatible endpoint
 *
 * @see https://developers.cloudflare.com/ai-gateway/usage/chat-completion/
 */

import { AIGatewayClient } from './gateway';
import { type AIProviderKey } from './providers';
import type { ChatCompletionRequest, ChatCompletionResponse, ChatMessage, Result, UniversalAIConfig } from './types';
import { AIError } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for a single `chat()` call. */
export interface ChatOptions {
    /** Provider to use. Falls back to config.defaultProvider. */
    provider?: AIProviderKey;
    /** Model to use. Falls back to config.defaultModel. */
    model?: string;
    /** API key override for this request. */
    apiKey?: string;
    /** Cache TTL in seconds (AI Gateway caching). */
    cacheTtl?: number;
    /** Skip cache for this request. */
    skipCache?: boolean;
    /** Custom metadata for AI Gateway logging. */
    metadata?: Record<string, string>;
    /** Temperature (0–2). */
    temperature?: number;
    /** Max tokens. */
    max_tokens?: number;
    /** System prompt — prepended as a system message if provided. */
    systemPrompt?: string;
    /** Extra request body fields (provider-specific). */
    extra?: Record<string, unknown>;
}

/** Simplified response from `chat()`. */
export interface ChatResult {
    /** The assistant's reply text. */
    text: string;
    /** Full response object for advanced usage. */
    raw: ChatCompletionResponse;
    /** Which provider ultimately served the request. */
    provider: string;
    /** Which model was used. */
    model: string;
    /** Token usage (if the provider returned it). */
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Universal AI client with multi-provider fallback.
 *
 * @example
 * ```ts
 * import { createUniversalAIClient } from '@ottabase/cf-ai/universal';
 *
 * const ai = createUniversalAIClient({
 *     accountId: env.CLOUDFLARE_ACCOUNT_ID,
 *     gateway: 'production',
 *     defaultProvider: 'openai',
 *     defaultModel: 'gpt-4o-mini',
 *     fallbacks: [
 *         { provider: 'openai', model: 'gpt-4o-mini', apiKey: env.CFAI_OPENAI_API_KEY },
 *         { provider: 'anthropic', model: 'claude-sonnet-4-20250514', apiKey: env.CFAI_ANTHROPIC_API_KEY },
 *         { provider: 'workers-ai', model: '@cf/meta/llama-3.1-8b-instruct', apiKey: env.CF_API_TOKEN },
 *     ],
 * });
 *
 * // Simple usage — uses defaultProvider + defaultModel
 * const result = await ai.chat('What is the capital of France?');
 *
 * // With options
 * const result2 = await ai.chat('Summarize this article', {
 *     provider: 'anthropic',
 *     model: 'claude-sonnet-4-20250514',
 *     apiKey: env.CFAI_ANTHROPIC_API_KEY,
 *     temperature: 0.3,
 *     systemPrompt: 'You are a concise summarizer.',
 * });
 *
 * // Auto-fallback — tries each provider in the fallback chain
 * const result3 = await ai.chatWithFallback('Hello!');
 * ```
 */
export class UniversalAIClient {
    private gateway: AIGatewayClient;
    private config: UniversalAIConfig;

    constructor(config: UniversalAIConfig) {
        this.config = config;
        this.gateway = new AIGatewayClient({
            accountId: config.accountId,
            gateway: config.gateway,
            apiKey: config.apiKey,
        });
    }

    // -----------------------------------------------------------------------
    // High-level chat
    // -----------------------------------------------------------------------

    /**
     * Send a chat message (string or messages array) and get a text reply.
     * Routes through the AI Gateway using provider-specific endpoints.
     */
    async chat(input: string | ChatMessage[], options?: ChatOptions): Promise<Result<ChatResult>> {
        const provider = (options?.provider ?? this.config.defaultProvider) as AIProviderKey | undefined;
        const model = options?.model ?? this.config.defaultModel;

        if (!provider) {
            return {
                success: false,
                error: new AIError('No provider specified and no defaultProvider configured', 'UNIVERSAL_NO_PROVIDER'),
            };
        }
        if (!model) {
            return {
                success: false,
                error: new AIError('No model specified and no defaultModel configured', 'UNIVERSAL_NO_MODEL', provider),
            };
        }

        // Build messages array
        const messages = this.buildMessages(input, options?.systemPrompt);

        // Build request body
        const request: ChatCompletionRequest = {
            model,
            messages,
            ...(options?.temperature !== undefined && { temperature: options.temperature }),
            ...(options?.max_tokens !== undefined && { max_tokens: options.max_tokens }),
            ...options?.extra,
        };

        const result = await this.gateway.chatCompletion(provider, request, {
            apiKey: options?.apiKey,
            cacheTtl: options?.cacheTtl,
            skipCache: options?.skipCache,
            metadata: options?.metadata,
        });

        if (!result.success) {
            return result;
        }

        return {
            success: true,
            data: this.toChatResult(result.data, provider, model),
        };
    }

    /**
     * Send a chat message with automatic fallback through the configured chain.
     * Tries each provider in order and returns the first successful response.
     */
    async chatWithFallback(
        input: string | ChatMessage[],
        options?: Omit<ChatOptions, 'provider' | 'model' | 'apiKey'>,
    ): Promise<Result<ChatResult>> {
        const fallbacks = this.config.fallbacks;
        if (!fallbacks || fallbacks.length === 0) {
            return {
                success: false,
                error: new AIError(
                    'No fallback chain configured — set config.fallbacks or use chat() with explicit provider',
                    'UNIVERSAL_NO_FALLBACKS',
                ),
            };
        }

        const errors: Array<{ provider: string; model: string; error: Error }> = [];

        for (const step of fallbacks) {
            const result = await this.chat(input, {
                ...options,
                provider: step.provider as AIProviderKey,
                model: step.model,
                apiKey: step.apiKey,
                ...step.options,
            });

            if (result.success) {
                return result;
            }

            // Log the error and try next provider
            errors.push({ provider: step.provider, model: step.model, error: result.error });
        }

        // All providers failed — return a combined error
        const errorSummary = errors.map((e) => `${e.provider}/${e.model}: ${e.error.message}`).join('; ');
        return {
            success: false,
            error: new AIError(
                `All fallback providers failed: ${errorSummary}`,
                'UNIVERSAL_ALL_FALLBACKS_FAILED',
                undefined,
                undefined,
                errors,
            ),
        };
    }

    // -----------------------------------------------------------------------
    // Streaming chat
    // -----------------------------------------------------------------------

    /**
     * Send a streaming chat request through a specific provider.
     * Returns a ReadableStream of SSE chunks.
     */
    async chatStream(
        input: string | ChatMessage[],
        options?: ChatOptions,
    ): Promise<Result<ReadableStream<Uint8Array>>> {
        const provider = (options?.provider ?? this.config.defaultProvider) as AIProviderKey | undefined;
        const model = options?.model ?? this.config.defaultModel;

        if (!provider) {
            return {
                success: false,
                error: new AIError('No provider specified and no defaultProvider configured', 'UNIVERSAL_NO_PROVIDER'),
            };
        }
        if (!model) {
            return {
                success: false,
                error: new AIError('No model specified and no defaultModel configured', 'UNIVERSAL_NO_MODEL', provider),
            };
        }

        const messages = this.buildMessages(input, options?.systemPrompt);

        const request: ChatCompletionRequest = {
            model,
            messages,
            ...(options?.temperature !== undefined && { temperature: options.temperature }),
            ...(options?.max_tokens !== undefined && { max_tokens: options.max_tokens }),
            ...options?.extra,
        };

        return this.gateway.chatCompletionStream(provider, request, {
            apiKey: options?.apiKey,
            cacheTtl: options?.cacheTtl,
            skipCache: options?.skipCache,
            metadata: options?.metadata,
        });
    }

    // -----------------------------------------------------------------------
    // Lower-level access
    // -----------------------------------------------------------------------

    /** Get the underlying AIGatewayClient for direct gateway calls. */
    getGateway(): AIGatewayClient {
        return this.gateway;
    }

    /** Get the current configuration. */
    getConfig(): Readonly<UniversalAIConfig> {
        return this.config;
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /** Convert string or messages array to ChatMessage[]. */
    private buildMessages(input: string | ChatMessage[], systemPrompt?: string): ChatMessage[] {
        const messages: ChatMessage[] = [];

        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }

        if (typeof input === 'string') {
            messages.push({ role: 'user', content: input });
        } else {
            messages.push(...input);
        }

        return messages;
    }

    /** Map a raw ChatCompletionResponse into our simplified ChatResult. */
    private toChatResult(raw: ChatCompletionResponse, provider: string, model: string): ChatResult {
        const choice = raw.choices?.[0];
        return {
            text: choice?.message?.content ?? '',
            raw,
            provider,
            model: raw.model ?? model,
            usage: raw.usage,
        };
    }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a UniversalAIClient with multi-provider fallback support. */
export function createUniversalAIClient(config: UniversalAIConfig): UniversalAIClient {
    return new UniversalAIClient(config);
}
