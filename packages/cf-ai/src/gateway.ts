/**
 * AI Gateway Client
 * Proxies requests to any AI provider through Cloudflare AI Gateway.
 *
 * AI Gateway gives you caching, rate limiting, logging, and analytics
 * across all providers — without changing your provider API calls.
 *
 * @see https://developers.cloudflare.com/ai-gateway/
 * @see https://developers.cloudflare.com/ai-gateway/usage/providers/
 */

import { AI_PROVIDERS, buildGatewayBaseUrl, buildProviderUrl, isValidProvider, type AIProviderKey } from './providers';
import type {
    AIGatewayConfig,
    AIGatewayRequestOptions,
    ChatCompletionRequest,
    ChatCompletionResponse,
    Result,
} from './types';
import { AIError } from './types';

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Client that proxies AI requests through Cloudflare AI Gateway.
 *
 * @example
 * ```ts
 * import { createAIGatewayClient } from '@ottabase/cf-ai/gateway';
 *
 * const gw = createAIGatewayClient({
 *     accountId: env.CLOUDFLARE_ACCOUNT_ID,
 *     gateway: 'my-gateway',
 * });
 *
 * // OpenAI through gateway
 * const res = await gw.chatCompletion('openai', {
 *     model: 'gpt-4o',
 *     messages: [{ role: 'user', content: 'Hello!' }],
 * }, { apiKey: env.CFAI_OPENAI_API_KEY });
 *
 * // Workers AI through gateway (with caching)
 * const res2 = await gw.chatCompletion('workers-ai', {
 *     model: '@cf/meta/llama-3.1-8b-instruct',
 *     messages: [{ role: 'user', content: 'Hello!' }],
 * }, { apiKey: env.CLOUDFLARE_API_TOKEN, cacheTtl: 3600 });
 * ```
 */
export class AIGatewayClient {
    private accountId: string;
    private gateway: string;
    private defaultApiKey?: string;

    constructor(config: AIGatewayConfig) {
        if (!config.accountId) {
            throw new AIError('accountId is required for AI Gateway', 'GATEWAY_MISSING_ACCOUNT_ID');
        }
        if (!config.gateway) {
            throw new AIError('gateway name is required for AI Gateway', 'GATEWAY_MISSING_GATEWAY');
        }
        this.accountId = config.accountId;
        this.gateway = config.gateway;
        this.defaultApiKey = config.apiKey;
    }

    // -----------------------------------------------------------------------
    // Chat completions (provider-specific path)
    // -----------------------------------------------------------------------

    /**
     * Send a chat completion request through a specific provider.
     *
     * The request is proxied through AI Gateway, which adds caching, logging,
     * and rate-limiting on top of the provider's native API.
     */
    async chatCompletion(
        provider: AIProviderKey,
        request: ChatCompletionRequest,
        options?: AIGatewayRequestOptions,
    ): Promise<Result<ChatCompletionResponse>> {
        if (!isValidProvider(provider)) {
            return {
                success: false,
                error: new AIError(`Unknown provider: ${provider}`, 'GATEWAY_UNKNOWN_PROVIDER', provider),
            };
        }

        // Build provider-specific URL (e.g. .../openai/chat/completions)
        const chatPath = this.getChatPath(provider);
        const url = buildProviderUrl(this.accountId, this.gateway, provider, chatPath);

        return this.doFetch<ChatCompletionResponse>(url, provider, request, options);
    }

    /**
     * Send a streaming chat completion request.
     * Returns a ReadableStream of SSE chunks.
     */
    async chatCompletionStream(
        provider: AIProviderKey,
        request: Omit<ChatCompletionRequest, 'stream'>,
        options?: AIGatewayRequestOptions,
    ): Promise<Result<ReadableStream<Uint8Array>>> {
        if (!isValidProvider(provider)) {
            return {
                success: false,
                error: new AIError(`Unknown provider: ${provider}`, 'GATEWAY_UNKNOWN_PROVIDER', provider),
            };
        }

        const chatPath = this.getChatPath(provider);
        const url = buildProviderUrl(this.accountId, this.gateway, provider, chatPath);

        return this.doStreamFetch(url, provider, { ...request, stream: true }, options);
    }

    // -----------------------------------------------------------------------
    // Generic provider request (any endpoint)
    // -----------------------------------------------------------------------

    /**
     * Send an arbitrary request to any provider endpoint through AI Gateway.
     * Use this for endpoints not covered by the typed methods above
     * (e.g. image generation, audio, embeddings via a specific provider).
     *
     * @param provider - The provider key (e.g. "openai")
     * @param path     - The provider-relative path (e.g. "/v1/images/generations")
     * @param body     - The JSON request body
     * @param options  - Gateway options (caching, auth, etc.)
     */
    async request<T = unknown>(
        provider: AIProviderKey,
        path: string,
        body: Record<string, unknown>,
        options?: AIGatewayRequestOptions,
    ): Promise<Result<T>> {
        if (!isValidProvider(provider)) {
            return {
                success: false,
                error: new AIError(`Unknown provider: ${provider}`, 'GATEWAY_UNKNOWN_PROVIDER', provider),
            };
        }

        const url = buildProviderUrl(this.accountId, this.gateway, provider, path);
        return this.doFetch<T>(url, provider, body, options);
    }

    /**
     * Send a raw fetch request through AI Gateway with full control over URL and body.
     * This is the lowest-level method available before `getRaw()`.
     */
    async rawRequest<T = unknown>(
        url: string,
        init: RequestInit,
        options?: AIGatewayRequestOptions,
    ): Promise<Result<T>> {
        try {
            const headers = new Headers(init.headers);
            this.applyGatewayHeaders(headers, options);

            const response = await fetch(url, { ...init, headers });

            if (!response.ok) {
                const errorBody = await response.text().catch(() => 'Unknown error');
                return {
                    success: false,
                    error: new AIError(
                        `AI Gateway request failed (${response.status}): ${errorBody}`,
                        'GATEWAY_REQUEST_FAILED',
                        undefined,
                        response.status,
                        errorBody,
                    ),
                };
            }

            const data = (await response.json()) as T;
            return { success: true, data };
        } catch (error) {
            return this.handleError(error);
        }
    }

    // -----------------------------------------------------------------------
    // Escape hatch — returns the gateway base URL
    // -----------------------------------------------------------------------

    /** Get the gateway base URL for direct use. */
    getBaseUrl(): string {
        return buildGatewayBaseUrl(this.accountId, this.gateway);
    }

    /** Get the account ID. */
    getAccountId(): string {
        return this.accountId;
    }

    /** Get the gateway name. */
    getGateway(): string {
        return this.gateway;
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    /**
     * Determine the chat completions path for a given provider.
     * Most providers use OpenAI-compatible paths; some differ.
     */
    private getChatPath(provider: AIProviderKey): string {
        switch (provider) {
            case 'anthropic':
                return '/v1/messages';
            case 'workers-ai':
                // Workers AI through gateway just sends to the model endpoint
                return '/v1/chat/completions';
            case 'google-ai-studio':
                // Google AI uses different endpoint patterns
                return '/v1beta/chat/completions';
            case 'cohere':
                return '/v2/chat';
            default:
                // OpenAI-compatible providers (openai, groq, mistral, perplexity, deepseek, etc.)
                return '/v1/chat/completions';
        }
    }

    /** Apply AI Gateway-specific headers (caching, metadata). */
    private applyGatewayHeaders(headers: Headers, options?: AIGatewayRequestOptions): void {
        // Cache control
        // @see https://developers.cloudflare.com/ai-gateway/configuration/caching/
        if (options?.cacheTtl !== undefined) {
            headers.set('cf-aig-cache-ttl', String(options.cacheTtl));
        }
        if (options?.skipCache) {
            headers.set('cf-aig-skip-cache', 'true');
        }

        // Custom metadata
        // @see https://developers.cloudflare.com/ai-gateway/configuration/custom-metadata/
        if (options?.metadata) {
            headers.set('cf-aig-metadata', JSON.stringify(options.metadata));
        }

        // Merge caller-supplied headers
        if (options?.headers) {
            for (const [key, value] of Object.entries(options.headers)) {
                headers.set(key, value);
            }
        }
    }

    /** Build headers for a provider request (auth + gateway + content-type). */
    private buildHeaders(provider: AIProviderKey, options?: AIGatewayRequestOptions): Headers {
        const headers = new Headers({ 'Content-Type': 'application/json' });

        // Auth
        const apiKey = options?.apiKey ?? this.defaultApiKey;
        if (apiKey) {
            const providerConfig = AI_PROVIDERS[provider];
            if (providerConfig.authHeader) {
                headers.set(providerConfig.authHeader, `${providerConfig.authPrefix}${apiKey}`);
            }
        }

        // Gateway-specific headers
        this.applyGatewayHeaders(headers, options);

        return headers;
    }

    /** Execute a JSON fetch and return Result<T>. */
    private async doFetch<T>(
        url: string,
        provider: AIProviderKey,
        body: Record<string, unknown>,
        options?: AIGatewayRequestOptions,
    ): Promise<Result<T>> {
        try {
            // Handle Google AI Studio query-param auth
            let finalUrl = url;
            const apiKey = options?.apiKey ?? this.defaultApiKey;
            if (provider === 'google-ai-studio' && apiKey) {
                const separator = finalUrl.includes('?') ? '&' : '?';
                finalUrl = `${finalUrl}${separator}key=${apiKey}`;
            }

            const headers = this.buildHeaders(provider, options);

            const fetchOptions: RequestInit = {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            };

            // Optional timeout + external AbortSignal via AbortController
            let controller: AbortController | undefined;
            let timeoutId: ReturnType<typeof setTimeout> | undefined;
            if (options?.timeout || options?.abortSignal) {
                controller = new AbortController();
                fetchOptions.signal = controller.signal;
                if (options.timeout) {
                    timeoutId = setTimeout(() => controller!.abort(), options.timeout);
                }
                // Wire external signal to our controller so callers can cancel dynamically
                if (options.abortSignal) {
                    options.abortSignal.addEventListener('abort', () => controller!.abort(), { once: true });
                }
            }

            const response = await fetch(finalUrl, fetchOptions);

            // Clear timeout — request finished before timeout expired
            if (timeoutId !== undefined) clearTimeout(timeoutId);

            if (!response.ok) {
                const errorBody = await response.text().catch(() => 'Unknown error');
                return {
                    success: false,
                    error: new AIError(
                        `AI Gateway error (${response.status}): ${errorBody}`,
                        'GATEWAY_REQUEST_FAILED',
                        provider,
                        response.status,
                        errorBody,
                    ),
                };
            }

            const data = (await response.json()) as T;
            return { success: true, data };
        } catch (error) {
            return this.handleError(error, provider);
        }
    }

    /** Execute a streaming fetch and return Result<ReadableStream>. */
    private async doStreamFetch(
        url: string,
        provider: AIProviderKey,
        body: Record<string, unknown>,
        options?: AIGatewayRequestOptions,
    ): Promise<Result<ReadableStream<Uint8Array>>> {
        try {
            let finalUrl = url;
            const apiKey = options?.apiKey ?? this.defaultApiKey;
            if (provider === 'google-ai-studio' && apiKey) {
                const separator = finalUrl.includes('?') ? '&' : '?';
                finalUrl = `${finalUrl}${separator}key=${apiKey}`;
            }

            const headers = this.buildHeaders(provider, options);

            const fetchInit: RequestInit = {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            };

            // Wire AbortSignal for streams (e.g. user cancels generation)
            if (options?.abortSignal) {
                fetchInit.signal = options.abortSignal;
            }

            const response = await fetch(finalUrl, fetchInit);

            if (!response.ok) {
                const errorBody = await response.text().catch(() => 'Unknown error');
                return {
                    success: false,
                    error: new AIError(
                        `AI Gateway stream error (${response.status}): ${errorBody}`,
                        'GATEWAY_STREAM_FAILED',
                        provider,
                        response.status,
                        errorBody,
                    ),
                };
            }

            if (!response.body) {
                return {
                    success: false,
                    error: new AIError('No response body for streaming', 'GATEWAY_NO_STREAM_BODY', provider),
                };
            }

            return { success: true, data: response.body };
        } catch (error) {
            return this.handleError(error, provider);
        }
    }

    private handleError<T>(error: unknown, provider?: string): Result<T> {
        if (error instanceof AIError) {
            return { success: false, error };
        }
        return {
            success: false,
            error: new AIError(
                error instanceof Error ? error.message : String(error),
                'GATEWAY_ERROR',
                provider,
                undefined,
                error,
            ),
        };
    }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create an AIGatewayClient. */
export function createAIGatewayClient(config: AIGatewayConfig): AIGatewayClient {
    return new AIGatewayClient(config);
}
