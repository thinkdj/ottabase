import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for AI Chat models (AiConversation & AiMessage schemas).
 * Validates schema definitions, default values, and type exports.
 */

describe('AI Chat Schema Tests', () => {
    describe('AiConversation Schema', () => {
        it('should export aiConversationsTable with correct columns', async () => {
            const { aiConversationsTable } = await import('../../ottabase/models/AiConversation.schema');
            expect(aiConversationsTable).toBeDefined();

            // Check required columns exist
            const columns = Object.keys(aiConversationsTable);
            expect(columns).toContain('id');
            expect(columns).toContain('title');
            expect(columns).toContain('model');
            expect(columns).toContain('provider');
            expect(columns).toContain('systemPrompt');
            expect(columns).toContain('userId');
            expect(columns).toContain('createdAt');
            expect(columns).toContain('updatedAt');
        });

        it('should export type definitions', async () => {
            const schema = await import('../../ottabase/models/AiConversation.schema');
            expect(schema.aiConversationsTable).toBeDefined();
            // Type exports are validated at compile time
        });
    });

    describe('AiMessage Schema', () => {
        it('should export aiMessagesTable with correct columns', async () => {
            const { aiMessagesTable } = await import('../../ottabase/models/AiMessage.schema');
            expect(aiMessagesTable).toBeDefined();

            const columns = Object.keys(aiMessagesTable);
            expect(columns).toContain('id');
            expect(columns).toContain('conversationId');
            expect(columns).toContain('role');
            expect(columns).toContain('content');
            expect(columns).toContain('model');
            expect(columns).toContain('provider');
            expect(columns).toContain('usage');
            expect(columns).toContain('createdAt');
        });
    });

    describe('AiConversation Model', () => {
        it('should have correct entity name and primary key', async () => {
            const { AiConversation } = await import('../../ottabase/models/AiConversation');
            expect(AiConversation.entity).toBe('ai_conversations');
            expect(AiConversation.primaryKey).toBe('id');
        });

        it('should have correct writable fields', async () => {
            const { AiConversation } = await import('../../ottabase/models/AiConversation');
            expect(AiConversation.writable.create).toContain('title');
            expect(AiConversation.writable.create).toContain('model');
            expect(AiConversation.writable.create).toContain('provider');
            expect(AiConversation.writable.create).toContain('systemPrompt');
            expect(AiConversation.writable.create).toContain('userId');
        });

        it('should have correct defaults', async () => {
            const { AiConversation } = await import('../../ottabase/models/AiConversation');
            expect((AiConversation as any).defaults.title).toBe('New Chat');
            expect((AiConversation as any).defaults.model).toBe('@cf/meta/llama-3.1-8b-instruct');
            expect((AiConversation as any).defaults.provider).toBe('workers-ai');
        });

        it('should have correct casts', async () => {
            const { AiConversation } = await import('../../ottabase/models/AiConversation');
            expect(AiConversation.casts).toEqual({
                createdAt: 'date',
                updatedAt: 'date',
            });
        });
    });

    describe('AiMessage Model', () => {
        it('should have correct entity name and primary key', async () => {
            const { AiMessage } = await import('../../ottabase/models/AiMessage');
            expect(AiMessage.entity).toBe('ai_messages');
            expect(AiMessage.primaryKey).toBe('id');
        });

        it('should have correct writable fields', async () => {
            const { AiMessage } = await import('../../ottabase/models/AiMessage');
            expect(AiMessage.writable.create).toContain('conversationId');
            expect(AiMessage.writable.create).toContain('role');
            expect(AiMessage.writable.create).toContain('content');
            expect(AiMessage.writable.create).toContain('model');
            expect(AiMessage.writable.create).toContain('provider');
            expect(AiMessage.writable.create).toContain('usage');
            // Update should be empty (messages are immutable)
            expect(AiMessage.writable.update).toHaveLength(0);
        });

        it('should have correct casts', async () => {
            const { AiMessage } = await import('../../ottabase/models/AiMessage');
            expect(AiMessage.casts).toEqual({
                createdAt: 'date',
            });
        });
    });

    describe('AiConversation.truncateToTitle', () => {
        it('should return short messages unchanged', async () => {
            const { AiConversation } = await import('../../ottabase/models/AiConversation');
            expect(AiConversation.truncateToTitle('Hello world')).toBe('Hello world');
        });

        it('should return 80-char messages unchanged', async () => {
            const { AiConversation } = await import('../../ottabase/models/AiConversation');
            const msg = 'A'.repeat(80);
            expect(AiConversation.truncateToTitle(msg)).toBe(msg);
        });

        it('should truncate messages longer than 80 chars with ellipsis', async () => {
            const { AiConversation } = await import('../../ottabase/models/AiConversation');
            const msg = 'A'.repeat(100);
            const result = AiConversation.truncateToTitle(msg);
            expect(result.length).toBe(80);
            expect(result.endsWith('...')).toBe(true);
        });

        it('should handle empty strings', async () => {
            const { AiConversation } = await import('../../ottabase/models/AiConversation');
            expect(AiConversation.truncateToTitle('')).toBe('');
        });
    });
});

describe('AI Chat Route Handler Tests', () => {
    const mockHandleAiModelsList = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('handleAiModelsList should return models and providers', async () => {
        const { handleAiModelsList } = await import('../../worker/routes/ai-chat');
        const mockContext = {
            request: new Request('http://localhost/api/ai/models'),
            env: {},
            url: new URL('http://localhost/api/ai/models'),
            route: '/api/ai/models',
            method: 'GET',
            withAuthCors: (r: Response) => r,
            corsHeaders: {},
        };

        const response = await handleAiModelsList(mockContext as any);
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('models');
        expect(data).toHaveProperty('providers');

        // Check providers list
        expect(data.providers.length).toBeGreaterThan(0);
        expect(data.providers.some((p: any) => p.key === 'workers-ai')).toBe(true);
        expect(data.providers.some((p: any) => p.key === 'openai')).toBe(true);

        // Check models per provider
        expect(data.models['workers-ai']).toBeDefined();
        expect(data.models['workers-ai'].length).toBeGreaterThan(0);
        expect(data.models.openai).toBeDefined();
        expect(data.models.anthropic).toBeDefined();
        expect(data.models['google-ai-studio']).toBeDefined();

        // Each model should have id, name, context
        const firstModel = data.models['workers-ai'][0];
        expect(firstModel).toHaveProperty('id');
        expect(firstModel).toHaveProperty('name');
        expect(firstModel).toHaveProperty('context');
    });
});
