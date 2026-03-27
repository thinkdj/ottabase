/**
 * @ottabase/cf-ai
 * Cloudflare AI Gateway & Workers AI wrapper
 *
 * Multi-provider AI with fallback, streaming, and caching — built for Cloudflare Workers.
 *
 * Sub-path imports for tree-shaking:
 *   @ottabase/cf-ai/gateway     — AI Gateway proxy client
 *   @ottabase/cf-ai/workers-ai  — Direct Workers AI binding client
 *   @ottabase/cf-ai/universal   — Unified client with fallback chain
 *   @ottabase/cf-ai/providers   — Provider registry and URL builders
 *
 * @see https://developers.cloudflare.com/ai-gateway/
 * @see https://developers.cloudflare.com/workers-ai/
 */

// Types
export type {
    AIGatewayConfig,
    AIGatewayRequestOptions,
    ChatCompletionChoice,
    ChatCompletionChunk,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatCompletionUsage,
    ChatMessage,
    ChatTool,
    FallbackStep,
    Result,
    UniversalAIConfig,
    UniversalChatOptions,
    WorkersAIEmbeddingOptions,
    WorkersAIEmbeddingResponse,
    WorkersAIImageGenOptions,
    WorkersAISpeechToTextOptions,
    WorkersAISummarizationOptions,
    WorkersAITextGenOptions,
    WorkersAITextGenResponse,
    WorkersAITranslationOptions,
} from './types';

// AIError is a class — export as value (not type-only) so consumers can use `instanceof`
export { AIError } from './types';

// AI Gateway
export { AIGatewayClient, createAIGatewayClient } from './gateway';

// Workers AI
export { createWorkersAIClient, WorkersAIClient, type WorkersAIConfig } from './workers-ai';

// Universal (recommended)
export { createUniversalAIClient, UniversalAIClient, type ChatOptions, type ChatResult } from './universal';

// Providers
export {
    AI_PROVIDERS,
    buildAuthHeaders,
    buildGatewayBaseUrl,
    buildProviderUrl,
    buildUniversalChatUrl,
    getProvider,
    isValidProvider,
    type AIProviderConfig,
    type AIProviderKey,
} from './providers';
