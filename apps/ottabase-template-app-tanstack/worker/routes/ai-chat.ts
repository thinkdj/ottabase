/**
 * Worker route handler for AI Chat feature.
 * Provides conversation management and multi-turn AI chat with history.
 */
import type { ChatMessage } from '@ottabase/cf-ai';
import { AIError } from '@ottabase/cf-ai';
import { createAIGatewayClient } from '@ottabase/cf-ai/gateway';
import { AI_PROVIDERS, type AIProviderKey } from '@ottabase/cf-ai/providers';
import { createWorkersAIClient } from '@ottabase/cf-ai/workers-ai';
import { getSession } from '@ottabase/auth/backend';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';
import { AiConversation } from '../../ottabase/models/AiConversation';
import { AiMessage } from '../../ottabase/models/AiMessage';
import { getAuthOptions } from '../lib/auth-utils';
import type { ApiRouteContext } from './router';

/** Maximum number of recent messages to include in the AI context window */
const MAX_CONTEXT_MESSAGES = 20;

/** Build an error response from an Error or AIError */
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

/** Resolve API key from env by provider name */
function resolveApiKey(env: CloudflareEnv, provider: AIProviderKey): string | null {
    const keyMap: Partial<Record<AIProviderKey, string | undefined>> = {
        'workers-ai': env.CFAI_CF_API_TOKEN,
        openai: env.CFAI_OPENAI_API_KEY,
        anthropic: env.CFAI_ANTHROPIC_API_KEY,
        'google-ai-studio': env.CFAI_GOOGLE_AI_API_KEY,
    };
    return keyMap[provider] ?? null;
}

/** Get authenticated user ID from session */
async function getAuthUserId(context: ApiRouteContext): Promise<string | null> {
    const session = await getSession(context.request, context.env as any, getAuthOptions(context.env));
    return session?.user?.id ?? null;
}

// ============================================================
// CONVERSATION CRUD
// ============================================================

/**
 * GET /api/ai/conversations — List user's conversations
 */
export async function handleAiConversationsList(context: ApiRouteContext): Promise<Response> {
    const userId = await getAuthUserId(context);
    if (!userId) return errorResponse('Authentication required', 401, { code: 'AUTH_REQUIRED' });

    const conversations = await AiConversation.forUser(userId);
    return jsonResponse({ conversations: conversations.map((c) => c.toJson()) });
}

/**
 * POST /api/ai/conversations — Create a new conversation
 */
export async function handleAiConversationCreate(context: ApiRouteContext): Promise<Response> {
    const userId = await getAuthUserId(context);
    if (!userId) return errorResponse('Authentication required', 401, { code: 'AUTH_REQUIRED' });

    let body: { title?: string; model?: string; provider?: string; systemPrompt?: string };
    try {
        body = await context.request.json();
    } catch {
        body = {};
    }

    const conversation = await AiConversation.create({
        title: body.title || 'New Chat',
        model: body.model || '@cf/meta/llama-3.1-8b-instruct',
        provider: body.provider || 'workers-ai',
        systemPrompt: body.systemPrompt || null,
        userId,
    });

    return jsonResponse({ conversation: conversation.toJson() }, 201);
}

/**
 * GET /api/ai/conversations/:id — Get conversation with messages
 */
export async function handleAiConversationDetail(context: ApiRouteContext, conversationId: string): Promise<Response> {
    const userId = await getAuthUserId(context);
    if (!userId) return errorResponse('Authentication required', 401, { code: 'AUTH_REQUIRED' });

    const conversation = await AiConversation.find(conversationId);
    if (!conversation || conversation.get('userId') !== userId) {
        return errorResponse('Conversation not found', 404, { code: 'NOT_FOUND' });
    }

    const messages = await AiMessage.forConversation(conversationId);

    return jsonResponse({
        conversation: conversation.toJson(),
        messages: messages.map((m) => m.toJson()),
    });
}

/**
 * PATCH /api/ai/conversations/:id — Update conversation metadata
 */
export async function handleAiConversationUpdate(context: ApiRouteContext, conversationId: string): Promise<Response> {
    const userId = await getAuthUserId(context);
    if (!userId) return errorResponse('Authentication required', 401, { code: 'AUTH_REQUIRED' });

    const conversation = await AiConversation.find(conversationId);
    if (!conversation || conversation.get('userId') !== userId) {
        return errorResponse('Conversation not found', 404, { code: 'NOT_FOUND' });
    }

    let body: { title?: string; model?: string; provider?: string; systemPrompt?: string };
    try {
        body = await context.request.json();
    } catch {
        return errorResponse('Invalid JSON body', 400, { code: 'INVALID_JSON' });
    }

    if (body.title !== undefined) conversation.set('title', body.title);
    if (body.model !== undefined) conversation.set('model', body.model);
    if (body.provider !== undefined) conversation.set('provider', body.provider);
    if (body.systemPrompt !== undefined) conversation.set('systemPrompt', body.systemPrompt);

    await conversation.save();
    return jsonResponse({ conversation: conversation.toJson() });
}

/**
 * DELETE /api/ai/conversations/:id — Delete conversation and its messages
 */
export async function handleAiConversationDelete(context: ApiRouteContext, conversationId: string): Promise<Response> {
    const userId = await getAuthUserId(context);
    if (!userId) return errorResponse('Authentication required', 401, { code: 'AUTH_REQUIRED' });

    const conversation = await AiConversation.find(conversationId);
    if (!conversation || conversation.get('userId') !== userId) {
        return errorResponse('Conversation not found', 404, { code: 'NOT_FOUND' });
    }

    // Delete all messages in the conversation first
    const messages = await AiMessage.forConversation(conversationId);
    for (const message of messages) {
        await message.destroy();
    }

    await conversation.destroy();
    return jsonResponse({ success: true });
}

// ============================================================
// AI CHAT (send message + get AI response)
// ============================================================

/**
 * POST /api/ai/chat — Send a message and get AI response
 * Stores both user message and assistant response in the conversation.
 *
 * Body: { conversationId?: string, message: string, model?: string, provider?: string, systemPrompt?: string }
 */
export async function handleAiChatMessage(context: ApiRouteContext): Promise<Response> {
    const userId = await getAuthUserId(context);
    if (!userId) return errorResponse('Authentication required', 401, { code: 'AUTH_REQUIRED' });

    let body: {
        conversationId?: string;
        message?: string;
        model?: string;
        provider?: string;
        systemPrompt?: string;
    };
    try {
        body = await context.request.json();
    } catch {
        return errorResponse('Invalid JSON body', 400, { code: 'INVALID_JSON' });
    }

    if (!body.message || typeof body.message !== 'string') {
        return errorResponse('message is required', 400, { code: 'VALIDATION_ERROR' });
    }

    // Get or create conversation
    let conversation;
    if (body.conversationId) {
        conversation = await AiConversation.find(body.conversationId);
        if (!conversation || conversation.get('userId') !== userId) {
            return errorResponse('Conversation not found', 404, { code: 'NOT_FOUND' });
        }
    } else {
        // Auto-create conversation with title from first message
        const title = AiConversation.truncateToTitle(body.message);
        conversation = await AiConversation.create({
            title,
            model: body.model || '@cf/meta/llama-3.1-8b-instruct',
            provider: body.provider || 'workers-ai',
            systemPrompt: body.systemPrompt || null,
            userId,
        });
    }

    const conversationId = conversation.get('id') as string;
    const provider = (body.provider || (conversation.get('provider') as string) || 'workers-ai') as AIProviderKey;
    const model = body.model || (conversation.get('model') as string) || '@cf/meta/llama-3.1-8b-instruct';

    // Save user message
    await AiMessage.create({
        conversationId,
        role: 'user',
        content: body.message,
    });

    // Build message history for context
    const historyMessages = await AiMessage.forConversation(conversationId);
    const chatMessages: ChatMessage[] = [];

    // Add system prompt if set
    const systemPrompt = body.systemPrompt || (conversation.get('systemPrompt') as string);
    if (systemPrompt) {
        chatMessages.push({ role: 'system', content: systemPrompt });
    }

    // Add conversation history (limit to recent messages for context window)
    const recentHistory = historyMessages.slice(-MAX_CONTEXT_MESSAGES);
    for (const msg of recentHistory) {
        const role = msg.get('role') as 'user' | 'assistant' | 'system';
        if (role === 'user' || role === 'assistant') {
            chatMessages.push({ role, content: msg.get('content') as string });
        }
    }

    // Call AI based on provider
    let responseText = '';
    let responseUsage: unknown;
    const actualProvider = provider;
    const actualModel = model;

    try {
        if (provider === 'workers-ai') {
            // Direct Workers AI binding
            if (!context.env.OBCF_AI) {
                return errorResponse('Workers AI binding (OBCF_AI) not configured', 500, { code: 'CONFIG_ERROR' });
            }
            const client = createWorkersAIClient({ binding: context.env.OBCF_AI });
            const result = await client.textGeneration({ model, messages: chatMessages });
            if (!result.success) return aiErrorResponse(result.error);
            responseText = result.data.response;
            responseUsage = result.data.usage;
        } else if (context.env.CFAI_GATEWAY_NAME && context.env.CLOUDFLARE_ACCOUNT_ID) {
            // Use AI Gateway for non-Workers AI providers
            const apiKey = resolveApiKey(context.env, provider);
            if (!apiKey) {
                return errorResponse(`No API key for provider "${provider}"`, 400, { code: 'MISSING_API_KEY' });
            }
            const gateway = createAIGatewayClient({
                accountId: context.env.CLOUDFLARE_ACCOUNT_ID,
                gateway: context.env.CFAI_GATEWAY_NAME,
                apiKey,
            });
            const result = await gateway.chatCompletion(provider, { model, messages: chatMessages });
            if (!result.success) return aiErrorResponse(result.error);
            const choice = result.data.choices?.[0];
            responseText = choice?.message?.content || '';
            responseUsage = result.data.usage;
        } else {
            return errorResponse('AI Gateway not configured for this provider', 500, { code: 'CONFIG_ERROR' });
        }
    } catch (err) {
        return aiErrorResponse(err instanceof Error ? err : new Error(String(err)));
    }

    // Save assistant response
    const assistantMessage = await AiMessage.create({
        conversationId,
        role: 'assistant',
        content: responseText,
        model: actualModel,
        provider: actualProvider,
        usage: responseUsage ? JSON.stringify(responseUsage) : null,
    });

    // Update conversation's updatedAt timestamp
    conversation.set('updatedAt', Date.now());
    await conversation.save();

    return jsonResponse({
        conversationId,
        message: assistantMessage.toJson(),
        provider: actualProvider,
        model: actualModel,
        usage: responseUsage,
    });
}

/**
 * GET /api/ai/models — List available models per provider
 */
export async function handleAiModelsList(_context: ApiRouteContext): Promise<Response> {
    const models = {
        'workers-ai': [
            { id: '@cf/meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', context: '8K' },
            { id: '@cf/meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', context: '8K' },
            { id: '@cf/meta/llama-3.2-3b-instruct', name: 'Llama 3.2 3B', context: '8K' },
            { id: '@cf/meta/llama-3.2-1b-instruct', name: 'Llama 3.2 1B', context: '8K' },
            { id: '@cf/mistral/mistral-7b-instruct-v0.2', name: 'Mistral 7B v0.2', context: '32K' },
            { id: '@cf/google/gemma-7b-it', name: 'Gemma 7B', context: '8K' },
            { id: '@hf/thebloke/deepseek-coder-6.7b-instruct-awq', name: 'DeepSeek Coder 6.7B', context: '4K' },
        ],
        openai: [
            { id: 'gpt-4o', name: 'GPT-4o', context: '128K' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', context: '128K' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', context: '128K' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', context: '16K' },
        ],
        anthropic: [
            { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', context: '200K' },
            { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', context: '200K' },
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', context: '200K' },
        ],
        'google-ai-studio': [
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', context: '1M' },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', context: '1M' },
        ],
    };

    const providers = Object.entries(AI_PROVIDERS).map(([key, p]) => ({
        key,
        name: p.name,
    }));

    return jsonResponse({ models, providers });
}
