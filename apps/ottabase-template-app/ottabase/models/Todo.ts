// ============================================================
// Todo Model (App-specific)
// ============================================================

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { BaseModel, IModelConstructorParams, ModelFields } from '@ottabase/ottaorm';

/**
 * Todo table schema
 */
export const todosTable = sqliteTable('todos', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    completed: integer('completed', { mode: 'boolean' }).default(false).notNull(),
    userId: text('user_id'),
    createdAt: integer('created_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .$onUpdateFn(() => new Date())
        .notNull(),
});

/**
 * Todo model type
 */
export type TodoType = typeof todosTable.$inferSelect;
export type NewTodoType = typeof todosTable.$inferInsert;

/**
 * Todo model - App-specific fat model
 *
 * @example
 * ```typescript
 * import { Todo } from "./models/Todo";
 * import { setDriver } from "@ottabase/ottaorm";
 *
 * setDriver(createD1Driver(env.DB));
 *
 * // Create todo
 * const todo = await Todo.create({
 *   title: "Buy groceries",
 *   userId: "user-123"
 * });
 *
 * // Toggle completed
 * await todo.toggle();
 *
 * // Get incomplete todos
 * const incomplete = await Todo.incomplete();
 * ```
 */
export class Todo extends BaseModel {
    static entity = 'todos';
    static table = todosTable;
    static primaryKey = 'id';

    static casts = {
        completed: 'boolean' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static defaults = {
        completed: false,
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: {
                label: 'ID',
            },
        },
        title: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Title',
                description: 'Todo title',
                placeholder: 'What needs to be done?',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 'auto',
            },
            validation: {
                rules: 'required',
                messages: {
                    required: 'Title is required',
                },
            },
        },
        completed: {
            type: 'boolean',
            editable: true,
            filterable: true,
            sortable: true,
            uiConfig: {
                label: 'Completed',
                description: 'Is todo completed?',
                defaultValue: false,
            },
            formConfig: {
                visible: true,
                fieldType: 'boolean',
            },
            tableConfig: {
                visible: true,
                colWidth: 100,
            },
        },
        userId: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: {
                label: 'User',
                description: 'Todo owner',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
            },
            tableConfig: {
                visible: false,
            },
        },
        createdAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Created',
            },
            tableConfig: {
                visible: true,
                colWidth: 150,
            },
        },
        updatedAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Updated',
            },
            tableConfig: {
                visible: false,
            },
        },
    };

    protected static validationRules = {
        title: {
            rules: 'required',
            fieldName: 'Title',
            messages: {
                required: 'Title is required',
            },
        },
    };

    constructor(data: { [key: string]: any }) {
        const params: IModelConstructorParams = { entity: Todo.entity, data };
        super(params);
    }

    // ============================================================
    // RELATIONSHIPS
    // ============================================================

    /**
     * Get the user who owns this todo (BelongsTo User)
     */
    async user(select?: string[]) {
        const { User } = await import('@ottabase/ottaorm');

        return this.belongsTo(User, 'userId', {
            select: select || ['id', 'name', 'email'],
        });
    }

    // ============================================================
    // HELPER METHODS
    // ============================================================

    /**
     * Get all incomplete todos
     */
    static async incomplete(options?: { orderBy?: string; orderDirection?: 'asc' | 'desc' }) {
        return this.where(
            { completed: false },
            {
                orderBy: options?.orderBy || 'createdAt',
                orderDirection: options?.orderDirection || 'asc',
            },
        );
    }

    /**
     * Get all completed todos
     */
    static async completed(options?: { orderBy?: string; orderDirection?: 'asc' | 'desc' }) {
        return this.where(
            { completed: true },
            {
                orderBy: options?.orderBy || 'createdAt',
                orderDirection: options?.orderDirection || 'desc',
            },
        );
    }

    /**
     * Toggle completed status
     */
    async toggle() {
        this.set('completed', !this.get('completed'));
        return this.save();
    }

    /**
     * Mark as completed
     */
    async complete() {
        this.set('completed', true);
        return this.save();
    }

    /**
     * Mark as incomplete
     */
    async uncomplete() {
        this.set('completed', false);
        return this.save();
    }
}
