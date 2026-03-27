/**
 * Core types for @ottabase/cf-ai
 * Shared across AI Gateway, Workers AI, and Universal clients
 *
 * @see https://developers.cloudflare.com/ai-gateway/
 * @see https://developers.cloudflare.com/workers-ai/
 */

// ---------------------------------------------------------------------------
// Result type (mirrors @ottabase/cf convention)
// ---------------------------------------------------------------------------

/** Discriminated union for operation outcomes — avoids throwing by default. */
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class AIError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly provider?: string,
        public readonly statusCode?: number,
        public readonly details?: unknown,
    ) {
        super(message);
        this.name = 'AIError';
    }
}

// ---------------------------------------------------------------------------
// Chat completion types (OpenAI-compatible, used by AI Gateway universal endpoint)
// ---------------------------------------------------------------------------

/** A single message in a chat conversation. */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    /** Optional name for multi-participant conversations */
    name?: string;
}

/** Tool / function definition for function-calling models. */
export interface ChatTool {
    type: 'function';
    function: {
        name: string;
        description?: string;
        parameters?: Record<string, unknown>;
    };
}

/** Request body for the universal `/chat/completions` endpoint. */
export interface ChatCompletionRequest {
    /** Model identifier — provider-specific (e.g. "gpt-4o", "@cf/meta/llama-3.1-8b-instruct") */
    model: string;
    messages: ChatMessage[];
    /** Sampling temperature (0–2). */
    temperature?: number;
    /** Nucleus sampling cutoff (0–1). */
    top_p?: number;
    /** Maximum tokens to generate. */
    max_tokens?: number;
    /** Whether to stream the response via SSE. */
    stream?: boolean;
    /** Stop sequences. */
    stop?: string | string[];
    /** Frequency penalty (-2 to 2). */
    frequency_penalty?: number;
    /** Presence penalty (-2 to 2). */
    presence_penalty?: number;
    /** Number of completions to generate. */
    n?: number;
    /** Tools / function definitions. */
    tools?: ChatTool[];
    /** Deterministic sampling seed (where supported). */
    seed?: number;
    /** Response format hint. */
    response_format?: { type: 'text' | 'json_object' };
    /** Arbitrary extra fields for provider-specific params. */
    [key: string]: unknown;
}

/** A single choice in a chat completion response. */
export interface ChatCompletionChoice {
    index: number;
    message: ChatMessage;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

/** Token usage stats returned with the completion. */
export interface ChatCompletionUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

/** Full response from a non-streaming chat completion. */
export interface ChatCompletionResponse {
    id: string;
    object: 'chat.completion';
    created: number;
    model: string;
    choices: ChatCompletionChoice[];
    usage?: ChatCompletionUsage;
}

/** A single chunk in a streamed chat completion. */
export interface ChatCompletionChunk {
    id: string;
    object: 'chat.completion.chunk';
    created: number;
    model: string;
    choices: Array<{
        index: number;
        delta: Partial<ChatMessage>;
        finish_reason: string | null;
    }>;
}

// ---------------------------------------------------------------------------
// Workers AI types
// ---------------------------------------------------------------------------

/** Configuration for text-generation models on Workers AI. */
export interface WorkersAITextGenOptions {
    /** Workers AI model name, e.g. "@cf/meta/llama-3.1-8b-instruct" */
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    stream?: boolean;
    /** Repetition penalty (Workers AI specific). */
    repetition_penalty?: number;
}

/** Workers AI text-generation response (non-streaming). */
export interface WorkersAITextGenResponse {
    response: string;
    /** Some models return usage info. */
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

/** Configuration for text-embedding models on Workers AI. */
export interface WorkersAIEmbeddingOptions {
    /** Workers AI model name, e.g. "@cf/baai/bge-base-en-v1.5" */
    model: string;
    text: string | string[];
}

/** Workers AI embedding response. */
export interface WorkersAIEmbeddingResponse {
    shape: number[];
    data: number[][];
}

/** Configuration for image-generation models on Workers AI. */
export interface WorkersAIImageGenOptions {
    /** Workers AI model name, e.g. "@cf/stabilityai/stable-diffusion-xl-base-1.0" */
    model: string;
    prompt: string;
    /** Negative prompt. */
    negative_prompt?: string;
    height?: number;
    width?: number;
    num_steps?: number;
    guidance?: number;
    seed?: number;
}

/** Workers AI translation options. */
export interface WorkersAITranslationOptions {
    model: string;
    text: string;
    source_lang: string;
    target_lang: string;
}

/** Workers AI summarization options. */
export interface WorkersAISummarizationOptions {
    model: string;
    input_text: string;
    max_length?: number;
}

/** Workers AI speech-to-text options. */
export interface WorkersAISpeechToTextOptions {
    model: string;
    /** Audio bytes as ArrayBuffer. */
    audio: ArrayBuffer;
}

// ---------------------------------------------------------------------------
// AI Gateway types
// ---------------------------------------------------------------------------

/** AI Gateway configuration. */
export interface AIGatewayConfig {
    /** Cloudflare account ID. */
    accountId: string;
    /** AI Gateway name (slug). */
    gateway: string;
    /** Optional default API key for provider auth — can be overridden per-request. */
    apiKey?: string;
}

/** Per-request options when calling through the AI Gateway. */
export interface AIGatewayRequestOptions {
    /** Override the API key for this specific request. */
    apiKey?: string;
    /**
     * AI Gateway cache TTL in seconds (0 = no cache).
     * @see https://developers.cloudflare.com/ai-gateway/configuration/caching/
     */
    cacheTtl?: number;
    /**
     * Skip AI Gateway cache for this request.
     */
    skipCache?: boolean;
    /**
     * Custom metadata to attach to the request log.
     * @see https://developers.cloudflare.com/ai-gateway/configuration/custom-metadata/
     */
    metadata?: Record<string, string>;
    /**
     * Request timeout in milliseconds.
     */
    timeout?: number;
    /**
     * External AbortSignal for request cancellation (e.g. user navigates away, "Stop" button).
     * When provided, this signal is used instead of (or in addition to) the timeout-based abort.
     */
    abortSignal?: AbortSignal;
    /**
     * Custom headers to merge into the request.
     */
    headers?: Record<string, string>;
}

/** Combined options for the universal chat endpoint. */
export interface UniversalChatOptions extends AIGatewayRequestOptions {
    /** Provider to route to (required for universal endpoint). */
    provider: string;
}

// ---------------------------------------------------------------------------
// Fallback / multi-provider types
// ---------------------------------------------------------------------------

/** A single step in a fallback chain. */
export interface FallbackStep {
    /** Provider key (e.g. "openai", "anthropic", "workers-ai"). */
    provider: string;
    /** Model to use for this step. */
    model: string;
    /** Optional API key override for this step. */
    apiKey?: string;
    /** Optional per-step request overrides. */
    options?: Omit<AIGatewayRequestOptions, 'apiKey'>;
}

/** Configuration for the UniversalAIClient. */
export interface UniversalAIConfig extends AIGatewayConfig {
    /** Fallback chain — tried in order until one succeeds. */
    fallbacks?: FallbackStep[];
    /** Default provider when none specified per-request. */
    defaultProvider?: string;
    /** Default model when none specified per-request. */
    defaultModel?: string;
}
