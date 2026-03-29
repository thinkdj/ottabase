// ============================================================
// AI Conversation Model (App-specific)
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { aiConversationsTable, type AiConversationType, type NewAiConversationType } from './AiConversation.schema';

export { aiConversationsTable, type AiConversationType, type NewAiConversationType } from './AiConversation.schema';

/**
 * AiConversation model - stores AI chat conversation metadata.
 *
 * @example
 * ```typescript
 * const conversation = await AiConversation.create({
 *   title: 'Code Review Help',
 *   model: '@cf/meta/llama-3.1-8b-instruct',
 *   provider: 'workers-ai',
 *   userId: 'user-123',
 * });
 *
 * const messages = await conversation.messages();
 * ```
 */
export class AiConversation extends BaseModel {
    static entity = 'ai_conversations';
    static table = aiConversationsTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    static casts = {
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static defaults = {
        title: 'New Chat',
        model: '@cf/meta/llama-3.1-8b-instruct',
        provider: 'workers-ai',
    };

    static writable = {
        create: ['title', 'model', 'provider', 'systemPrompt', 'userId'],
        update: ['title', 'model', 'provider', 'systemPrompt'],
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: { label: 'ID' },
        },
        title: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Title',
                description: 'Conversation title',
                placeholder: 'New Chat',
            },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 'auto' },
            validation: { rules: 'required', messages: { required: 'Title is required' } },
        },
        model: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: { label: 'Model', description: 'AI model identifier' },
            formConfig: { visible: true, fieldType: 'select' },
            tableConfig: { visible: true, colWidth: 200 },
        },
        provider: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: { label: 'Provider', description: 'AI provider' },
            formConfig: { visible: true, fieldType: 'select' },
            tableConfig: { visible: true, colWidth: 150 },
        },
        systemPrompt: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'System Prompt', description: 'System instructions for the AI' },
            formConfig: { visible: true, fieldType: 'textarea' },
            tableConfig: { visible: false },
        },
        userId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'User' },
            tableConfig: { visible: false },
        },
        createdAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Created' },
            tableConfig: { visible: true, colWidth: 150 },
        },
        updatedAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Updated' },
            tableConfig: { visible: false },
        },
    };

    // ============================================================
    // RELATIONSHIPS
    // ============================================================

    /** Get all messages in this conversation */
    async messages(select?: string[]) {
        const { AiMessage } = await import('./AiMessage');
        return this.hasMany(AiMessage, 'conversationId', {
            select,
            orderBy: 'createdAt',
            orderDirection: 'asc',
        });
    }

    /** Get the user who owns this conversation */
    async user(select?: string[]) {
        const { User } = await import('@ottabase/ottaorm');
        return this.belongsTo(User, 'userId', {
            select: select || ['id', 'name', 'email'],
        });
    }

    // ============================================================
    // HELPER METHODS
    // ============================================================

    /** Update the conversation title from the first user message */
    async updateTitleFromMessage(message: string) {
        // Truncate to first 80 chars as title
        const title = message.length > 80 ? message.substring(0, 77) + '...' : message;
        this.set('title', title);
        return this.save();
    }

    /** Get conversations for a specific user, ordered by most recent */
    static async forUser(userId: string, options?: { limit?: number; offset?: number }) {
        return this.where(
            { userId },
            {
                orderBy: 'updatedAt',
                orderDirection: 'desc',
                limit: options?.limit || 50,
                offset: options?.offset || 0,
            },
        );
    }
}
