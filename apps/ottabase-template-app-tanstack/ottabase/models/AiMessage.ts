// ============================================================
// AI Message Model (App-specific)
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { aiMessagesTable, type AiMessageType, type NewAiMessageType } from './AiMessage.schema';

export { aiMessagesTable, type AiMessageType, type NewAiMessageType } from './AiMessage.schema';

/**
 * AiMessage model - stores individual messages in an AI conversation.
 *
 * @example
 * ```typescript
 * const message = await AiMessage.create({
 *   conversationId: 'conv-123',
 *   role: 'user',
 *   content: 'What is TypeScript?',
 * });
 * ```
 */
export class AiMessage extends BaseModel {
    static entity = 'ai_messages';
    static table = aiMessagesTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    static casts = {
        createdAt: 'date' as const,
    };

    static writable = {
        create: ['conversationId', 'role', 'content', 'model', 'provider', 'usage'] as const,
        update: [] as const,
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: { label: 'ID' },
        },
        conversationId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'Conversation' },
            tableConfig: { visible: false },
        },
        role: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'Role', description: 'Message role (user/assistant/system)' },
            tableConfig: { visible: true, colWidth: 100 },
        },
        content: {
            type: 'string',
            editable: false,
            searchable: true,
            uiConfig: { label: 'Content' },
            tableConfig: { visible: true, colWidth: 'auto' },
        },
        model: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'Model' },
            tableConfig: { visible: true, colWidth: 150 },
        },
        provider: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'Provider' },
            tableConfig: { visible: true, colWidth: 120 },
        },
        usage: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'Token Usage' },
            tableConfig: { visible: false },
        },
        createdAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Created' },
            tableConfig: { visible: true, colWidth: 150 },
        },
    };

    // ============================================================
    // RELATIONSHIPS
    // ============================================================

    /** Get the conversation this message belongs to */
    async conversation(select?: string[]) {
        const { AiConversation } = await import('./AiConversation');
        return this.belongsTo(AiConversation, 'conversationId', { select });
    }

    // ============================================================
    // HELPER METHODS
    // ============================================================

    /** Get all messages for a conversation, ordered chronologically */
    static async forConversation(conversationId: string) {
        return this.where(
            { conversationId },
            {
                orderBy: 'createdAt',
                orderDirection: 'asc',
            },
        );
    }
}
