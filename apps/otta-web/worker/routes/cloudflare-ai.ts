/**
 * Worker route handler for Cloudflare AI demos.
 * Exposes endpoints for Workers AI, AI Gateway, and Universal chat.
 */
import type { ChatMessage } from '@ottabase/cf-ai';
import { AIError } from '@ottabase/cf-ai';
import { createAIGatewayClient } from '@ottabase/cf-ai/gateway';
import { AI_PROVIDERS, type AIProviderKey } from '@ottabase/cf-ai/providers';
import { createUniversalAIClient } from '@ottabase/cf-ai/universal';
import { createWorkersAIClient } from '@ottabase/cf-ai/workers-ai';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';

/** Build an error response from an Error or AIError, forwarding code/details when available. */
function aiErrorResponse(error: Error, fallbackStatus = 500): Response {
    if (error instanceof AIError) {
        return errorResponse(error.message, error.statusCode ?? fallbackStatus, {
            code: error.code,
            ...(error.details !== undefined && {
                details: typeof error.details === 'string' ? error.details : JSON.stringify(error.details),
            }),
        });
    }
    return errorResponse(error.message, fallbackStatus, { code: 'AI_ERROR' });
}

export interface AIRouteContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
}

/**
 * GET /api/cloudflare/ai/providers — list available providers
 */
export async function handleAIProviders(_context: AIRouteContext): Promise<Response> {
    const providers = Object.entries(AI_PROVIDERS).map(([key, p]) => ({
        key,
        name: p.name,
        pathPrefix: p.pathPrefix,
    }));
    return jsonResponse({ providers });
}

/**
 * GET /api/cloudflare/ai/status — check which AI bindings are configured
 */
export async function handleAIStatus(context: AIRouteContext): Promise<Response> {
    const { env } = context;
    return jsonResponse({
        workersAI: !!env.OBCF_AI, // Binding presence is the best check for Workers AI since it doesn't use API keys
        aiGateway: !!env.CFAI_GATEWAY_NAME,
        openai: !!env.CFAI_OPENAI_API_KEY,
        anthropic: !!env.CFAI_ANTHROPIC_API_KEY,
        googleAI: !!env.CFAI_GOOGLE_AI_API_KEY,
    });
}

/**
 * POST /api/cloudflare/ai/chat — Workers AI text generation
 * Body: { prompt: string, model?: string, systemPrompt?: string }
 */
export async function handleAIChat(context: AIRouteContext): Promise<Response> {
    const { env, request } = context;

    if (!env.OBCF_AI) {
        return errorResponse('Workers AI binding (OBCF_AI) not configured. Add ai binding in wrangler.jsonc', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    let body: { prompt?: string; model?: string; systemPrompt?: string };
    try {
        body = await request.json();
    } catch {
        return errorResponse('Invalid JSON body', 400, { code: 'INVALID_JSON' });
    }

    if (!body.prompt || typeof body.prompt !== 'string') {
        return errorResponse('prompt is required and must be a string', 400, { code: 'VALIDATION_ERROR' });
    }

    const client = createWorkersAIClient({ binding: env.OBCF_AI });
    const model = body.model || '@cf/meta/llama-3.1-8b-instruct';

    // Build messages array with optional system prompt
    const messages: ChatMessage[] = [];
    if (body.systemPrompt) {
        messages.push({ role: 'system', content: body.systemPrompt });
    }
    messages.push({ role: 'user', content: body.prompt });

    const result = await client.textGeneration({ model, messages });

    if (!result.success) {
        return aiErrorResponse(result.error);
    }

    return jsonResponse({
        text: result.data.response,
        model,
        provider: 'workers-ai',
        usage: result.data.usage,
    });
}

/**
 * POST /api/cloudflare/ai/gateway/chat — AI Gateway chat completion
 * Body: { provider: string, model: string, prompt: string, systemPrompt?: string, apiKey?: string }
 */
export async function handleAIGatewayChat(context: AIRouteContext): Promise<Response> {
    const { env, request } = context;

    if (!env.CFAI_GATEWAY_NAME) {
        return errorResponse('CFAI_GATEWAY_NAME not configured. Set it in wrangler.jsonc vars or .dev.vars', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    if (!env.CLOUDFLARE_ACCOUNT_ID) {
        return errorResponse(
            'CLOUDFLARE_ACCOUNT_ID not configured. Required for AI Gateway. Set it in wrangler.jsonc vars or .dev.vars',
            500,
            { code: 'CONFIG_ERROR' },
        );
    }

    let body: {
        provider?: string;
        model?: string;
        prompt?: string;
        systemPrompt?: string;
        apiKey?: string;
    };
    try {
        body = await request.json();
    } catch {
        return errorResponse('Invalid JSON body', 400, { code: 'INVALID_JSON' });
    }

    if (!body.provider || !body.model || !body.prompt) {
        return errorResponse('provider, model, and prompt are required', 400, { code: 'VALIDATION_ERROR' });
    }

    // Resolve the API key: explicit > env-based fallback
    const apiKey = body.apiKey || resolveApiKey(env, body.provider as AIProviderKey);

    if (!apiKey && body.provider !== 'workers-ai') {
        return errorResponse(
            `No API key available for provider "${body.provider}". Provide apiKey in body or set the corresponding env var.`,
            400,
            { code: 'MISSING_API_KEY' },
        );
    }

    const gateway = createAIGatewayClient({
        accountId: env.CLOUDFLARE_ACCOUNT_ID,
        gateway: env.CFAI_GATEWAY_NAME,
        apiKey: apiKey || '',
    });

    const messages: ChatMessage[] = [];
    if (body.systemPrompt) {
        messages.push({ role: 'system', content: body.systemPrompt });
    }
    messages.push({ role: 'user', content: body.prompt });

    // chatCompletion takes (provider, request, options?)
    const result = await gateway.chatCompletion(body.provider as AIProviderKey, {
        model: body.model,
        messages,
    });

    if (!result.success) {
        return aiErrorResponse(result.error);
    }

    return jsonResponse({
        response: result.data,
        provider: body.provider,
        model: body.model,
    });
}

/**
 * POST /api/cloudflare/ai/universal/chat — Universal AI chat with optional fallback
 * Body: { prompt: string, systemPrompt?: string, provider?: string, model?: string, fallback?: Array<{ provider, model, apiKey? }> }
 */
export async function handleAIUniversalChat(context: AIRouteContext): Promise<Response> {
    const { env, request } = context;

    if (!env.CFAI_GATEWAY_NAME) {
        return errorResponse('CFAI_GATEWAY_NAME not configured', 500, { code: 'CONFIG_ERROR' });
    }

    if (!env.CLOUDFLARE_ACCOUNT_ID) {
        return errorResponse(
            'CLOUDFLARE_ACCOUNT_ID not configured. Required for Universal AI. Set it in wrangler.jsonc vars or .dev.vars',
            500,
            { code: 'CONFIG_ERROR' },
        );
    }

    let body: {
        prompt?: string;
        systemPrompt?: string;
        provider?: string;
        model?: string;
        fallback?: Array<{ provider: string; model: string; apiKey?: string }>;
    };
    try {
        body = await request.json();
    } catch {
        return errorResponse('Invalid JSON body', 400, { code: 'INVALID_JSON' });
    }

    if (!body.prompt) {
        return errorResponse('prompt is required', 400, { code: 'VALIDATION_ERROR' });
    }

    const provider = (body.provider || 'workers-ai') as AIProviderKey;
    const model = body.model || '@cf/meta/llama-3.1-8b-instruct';
    const apiKey = resolveApiKey(env, provider);

    // Build fallback chain from request body if provided
    const fallbacks = body.fallback?.map((s) => ({
        provider: s.provider,
        model: s.model,
        apiKey: s.apiKey || resolveApiKey(env, s.provider as AIProviderKey) || '',
    }));

    const universal = createUniversalAIClient({
        accountId: env.CLOUDFLARE_ACCOUNT_ID,
        gateway: env.CFAI_GATEWAY_NAME,
        defaultProvider: provider,
        defaultModel: model,
        apiKey: apiKey || '',
        fallbacks,
    });

    // If fallback chain is provided, use chatWithFallback
    if (fallbacks && fallbacks.length > 0) {
        const result = await universal.chatWithFallback(body.prompt, {
            systemPrompt: body.systemPrompt,
        });

        if (!result.success) {
            return aiErrorResponse(result.error);
        }

        return jsonResponse({
            text: result.data.text,
            provider: result.data.provider,
            model: result.data.model,
            usage: result.data.usage,
        });
    }

    // Simple single-provider chat
    const result = await universal.chat(body.prompt, {
        systemPrompt: body.systemPrompt,
    });

    if (!result.success) {
        return aiErrorResponse(result.error);
    }

    return jsonResponse({
        text: result.data.text,
        provider: result.data.provider,
        model: result.data.model,
        usage: result.data.usage,
    });
}

/**
 * Resolve API key from env by provider name.
 * Workers AI through the gateway requires a Cloudflare API token.
 */
function resolveApiKey(env: CloudflareEnv, provider: AIProviderKey): string | null {
    const keyMap: Partial<Record<AIProviderKey, string | undefined>> = {
        'workers-ai': env.CFAI_CF_API_TOKEN,
        openai: env.CFAI_OPENAI_API_KEY,
        anthropic: env.CFAI_ANTHROPIC_API_KEY,
        'google-ai-studio': env.CFAI_GOOGLE_AI_API_KEY,
    };
    return keyMap[provider] ?? null;
}
