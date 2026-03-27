/**
 * AI Provider definitions and URL builders for Cloudflare AI Gateway
 *
 * AI Gateway acts as a proxy — each provider has a specific path prefix.
 * @see https://developers.cloudflare.com/ai-gateway/usage/providers/
 */

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

/** Supported AI providers that can be routed through AI Gateway. */
export const AI_PROVIDERS = {
    'workers-ai': {
        name: 'Workers AI',
        pathPrefix: 'workers-ai',
        /** Workers AI auth uses the CF API token, sent via Authorization header. */
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
    },
    openai: {
        name: 'OpenAI',
        pathPrefix: 'openai',
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
    },
    anthropic: {
        name: 'Anthropic',
        pathPrefix: 'anthropic',
        authHeader: 'x-api-key',
        authPrefix: '',
    },
    'google-ai-studio': {
        name: 'Google AI Studio',
        pathPrefix: 'google-ai-studio',
        /** Google AI Studio uses query param `key=...` — handled specially in gateway client. */
        authHeader: null,
        authPrefix: '',
    },
    azure: {
        name: 'Azure OpenAI',
        pathPrefix: 'azure-openai',
        authHeader: 'api-key',
        authPrefix: '',
    },
    mistral: {
        name: 'Mistral AI',
        pathPrefix: 'mistral',
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
    },
    groq: {
        name: 'Groq',
        pathPrefix: 'groq',
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
    },
    cohere: {
        name: 'Cohere',
        pathPrefix: 'cohere',
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
    },
    'hugging-face': {
        name: 'Hugging Face',
        pathPrefix: 'hugging-face',
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
    },
    perplexity: {
        name: 'Perplexity AI',
        pathPrefix: 'perplexity-ai',
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
    },
    deepseek: {
        name: 'DeepSeek',
        pathPrefix: 'deepseek',
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
    },
} as const;

/** Union of all supported provider keys. */
export type AIProviderKey = keyof typeof AI_PROVIDERS;

/** Provider configuration object. */
export type AIProviderConfig = (typeof AI_PROVIDERS)[AIProviderKey];

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

const GATEWAY_BASE = 'https://gateway.ai.cloudflare.com/v1';

/**
 * Build the AI Gateway base URL for a given account + gateway.
 *
 * @example
 * buildGatewayBaseUrl('abc123', 'my-gateway')
 * // => "https://gateway.ai.cloudflare.com/v1/abc123/my-gateway"
 */
export function buildGatewayBaseUrl(accountId: string, gateway: string): string {
    return `${GATEWAY_BASE}/${accountId}/${gateway}`;
}

/**
 * Build the full provider-specific URL through AI Gateway.
 *
 * @example
 * buildProviderUrl('abc123', 'my-gateway', 'openai', '/chat/completions')
 * // => "https://gateway.ai.cloudflare.com/v1/abc123/my-gateway/openai/chat/completions"
 */
export function buildProviderUrl(accountId: string, gateway: string, provider: AIProviderKey, path: string): string {
    const providerConfig = AI_PROVIDERS[provider];
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${GATEWAY_BASE}/${accountId}/${gateway}/${providerConfig.pathPrefix}${cleanPath}`;
}

/**
 * Build the universal chat completions URL (OpenAI-compatible endpoint).
 *
 * @example
 * buildUniversalChatUrl('abc123', 'my-gateway')
 * // => "https://gateway.ai.cloudflare.com/v1/abc123/my-gateway"
 *
 * @see https://developers.cloudflare.com/ai-gateway/usage/chat-completion/
 */
export function buildUniversalChatUrl(accountId: string, gateway: string): string {
    return `${GATEWAY_BASE}/${accountId}/${gateway}`;
}

/**
 * Build auth headers for a specific provider.
 * Returns an empty object if the provider uses query-param auth (e.g. Google AI Studio).
 */
export function buildAuthHeaders(provider: AIProviderKey, apiKey: string): Record<string, string> {
    const config = AI_PROVIDERS[provider];
    if (!config.authHeader) return {};
    return { [config.authHeader]: `${config.authPrefix}${apiKey}` };
}

/**
 * Get the provider config by key, or undefined if not found.
 */
export function getProvider(provider: string): AIProviderConfig | undefined {
    return AI_PROVIDERS[provider as AIProviderKey];
}

/**
 * Check whether a provider key is valid / supported.
 */
export function isValidProvider(provider: string): provider is AIProviderKey {
    return provider in AI_PROVIDERS;
}
