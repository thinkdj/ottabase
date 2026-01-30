/**
 * PostCategory Model
 *
 * OttaORM model for post categories with hierarchy support.
 */
import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generateSlug } from '../types';

/**
 * Categories table - hierarchical content organization
 */
export const categoriesTable = sqliteTable(
    'categories',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        // Category name
        name: text('name').notNull(),

        // URL-friendly slug
        slug: text('slug').notNull(),

        // Optional description
        description: text('description'),

        // Parent category for hierarchy (null = root category)
        parentId: text('parent_id'),

        // Display order within parent
        sortOrder: integer('sort_order').notNull().default(0),

        // App identifier for multi-app database sharing
        appId: text('app_id'),

        // Content type this category applies to (post, news, docs, etc.)
        type: text('type').notNull().default('post'),

        // Timestamps
        createdAt: integer('created_at', { mode: 'timestamp' })
            .notNull()
            .default(sql`(unixepoch())`),

        updatedAt: integer('updated_at', { mode: 'timestamp' })
            .notNull()
            .default(sql`(unixepoch())`)
            .$onUpdate(() => new Date()),
    },
    (table) => [
        // Lookup by slug with type filtering
        index('categories_slug_type_idx').on(table.slug, table.type),

        // Multi-tenant with type: appId + type for filtering categories by content type
        index('categories_app_id_type_idx').on(table.appId, table.type),

        // Hierarchy traversal: parentId + sortOrder for getting children ordered
        index('categories_parent_id_sort_order_idx').on(table.parentId, table.sortOrder),

        // Root categories: parentId + appId + type + sortOrder
        index('categories_parent_id_app_id_type_idx').on(table.parentId, table.appId, table.type),

        // Type filtering single index for flexibility
        index('categories_type_idx').on(table.type),
    ],
);

export type Category = typeof categoriesTable.$inferSelect;
export type NewCategory = typeof categoriesTable.$inferInsert;

export type PostCategoryType = typeof categoriesTable.$inferSelect;
export type NewPostCategoryType = typeof categoriesTable.$inferInsert;

export class PostCategory extends BaseModel {
    static entity = 'categories';
    static table = categoriesTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottablog';
    static packageType: PackageType = 'package';

    static casts = {
        sortOrder: 'number' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static defaults = {
        sortOrder: 0,
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
        name: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Name',
                description: 'Category name',
                placeholder: 'Enter category name...',
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
                rules: 'required|min:2|max:100',
                messages: {
                    required: 'Name is required',
                },
            },
        },
        slug: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Slug',
                description: 'URL-friendly identifier',
                placeholder: 'auto-generated-from-name',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 200,
            },
        },
        description: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Description',
                description: 'Category description',
                placeholder: 'Brief description of this category...',
            },
            formConfig: {
                visible: true,
                fieldType: 'textarea',
            },
            tableConfig: {
                visible: true,
                colWidth: 300,
            },
        },
        parentId: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: {
                label: 'Parent Category',
                description: 'Parent category for nesting',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
            },
            tableConfig: {
                visible: true,
                colWidth: 150,
            },
        },
        sortOrder: {
            type: 'number',
            editable: true,
            sortable: true,
            uiConfig: {
                label: 'Sort Order',
                description: 'Display order (lower = first)',
                defaultValue: 0,
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 100,
            },
        },
        type: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: {
                label: 'Type',
                description: 'Content type (post, news, docs, etc.)',
                defaultValue: 'post',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 100,
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
    };

    protected static validationRules = {
        name: {
            rules: 'required|min:2|max:100',
            fieldName: 'Name',
            messages: {
                required: 'Category name is required',
            },
        },
    };

    // ==================== Query Scopes ====================

    /**
     * Get root categories (no parent)
     */
    static async roots(options?: { appId?: string; orderBy?: string; orderDirection?: 'asc' | 'desc' }) {
        const query: Record<string, unknown> = { parentId: null };
        if (options?.appId) query.appId = options.appId;

        return this.where(query, {
            orderBy: options?.orderBy || 'sortOrder',
            orderDirection: options?.orderDirection || 'asc',
        });
    }

    /**
     * Get children of a category
     */
    static async children(
        parentId: string,
        options?: {
            appId?: string;
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
        },
    ) {
        const query: Record<string, unknown> = { parentId };
        if (options?.appId) query.appId = options.appId;

        return this.where(query, {
            orderBy: options?.orderBy || 'sortOrder',
            orderDirection: options?.orderDirection || 'asc',
        });
    }

    /**
     * Find category by slug
     */
    static async findBySlug(slug: string, options?: { appId?: string }): Promise<PostCategory | null> {
        const query: Record<string, unknown> = { slug };
        if (options?.appId) query.appId = options.appId;

        const results = await this.where(query);
        return results.length > 0 ? (results[0] as PostCategory) : null;
    }

    // ==================== Instance Methods ====================

    /**
     * Auto-generate slug from name if not set
     */
    generateSlug() {
        const name = this.get('name') as string;
        if (name && !this.get('slug')) {
            this.set('slug', generateSlug(name));
        }
    }
}
