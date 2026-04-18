/**
 * PostTag Model
 *
 * Blog-specific tag model for @ottabase/ottablog.
 * Includes color and type fields for enhanced blog tagging.
 *
 * For universal/core tags (non-blog), use Tag from @ottabase/ottaorm.
 */
import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { prepareCreateSlug, prepareUpdateSlug, type SlugLifecycleConfig } from '../slug-utils';
import { generateSlug } from '../types';
import { postTagsTable } from './PostTag.schema';

export { postTagsTable, type NewPostTagType, type PostTagType } from './PostTag.schema';

/**
 * PostTag Model - Blog-specific tags
 *
 * @example
 * ```typescript
 * import { PostTag } from "@ottabase/ottablog";
 *
 * // Find tag by slug (appId required)
 * const tag = await PostTag.findBySlug("javascript", { appId: "my-app-id" });
 *
 * // Create tag (appId required)
 * const newTag = await PostTag.create({
 *   name: "JavaScript",
 *   slug: "javascript",
 *   color: "#f7df1e",
 *   appId: "my-app-id",
 * });
 *
 * // Get all tags for an app
 * const tags = await PostTag.forApp("my-app-id");
 * ```
 */
export class PostTag extends BaseModel {
    static entity = 'post_tags';
    static table = postTagsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottablog';
    static packageType: PackageType = 'package';

    static writable = {
        create: ['name', 'slug', 'color', 'type', 'appId'],
        update: ['name', 'slug', 'color', 'type'],
    };

    static casts = {
        createdAt: 'date' as const,
    };

    protected static defaults = {
        type: 'post',
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
                description: 'Tag name',
                placeholder: 'Enter tag name...',
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
                rules: 'required|min:2|max:50',
                messages: {
                    required: 'Name is required',
                },
            },
        },
        slug: {
            type: 'string',
            unique: true,
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
        color: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Color',
                description: 'Tag color (hex code)',
                placeholder: '#3b82f6',
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
            rules: 'required|min:2|max:50',
            fieldName: 'Name',
            messages: {
                required: 'Tag name is required',
            },
        },
    };

    // ==================== Slug Lifecycle Config ====================

    private static readonly slugConfig: SlugLifecycleConfig = {
        slugPrefix: 'tag',
        nameField: 'name',
        hasType: true,
        entityLabel: 'post_tags',
    };

    // ==================== Query Scopes ====================

    static async create<T extends typeof BaseModel>(
        this: T,
        data: Record<string, any>,
        driver?: any,
    ): Promise<InstanceType<T>> {
        await prepareCreateSlug(this, data, PostTag.slugConfig, driver);
        return (await super.create.call(this, data, driver)) as InstanceType<T>;
    }

    static async update<T extends typeof BaseModel>(
        this: T,
        id: string | number,
        data: Record<string, any>,
        driver?: any,
    ): Promise<InstanceType<T>> {
        await prepareUpdateSlug(this, id, data, PostTag.slugConfig, driver);
        return (await super.update.call(this, id, data, driver)) as InstanceType<T>;
    }

    /**
     * Find post tag by slug
     */
    static async findBySlug(slug: string, options: { appId: string; type?: string }): Promise<PostTag | null> {
        const query: Record<string, unknown> = { slug, appId: options.appId };
        if (options?.type) query.type = options.type;

        const results = await this.where(query);
        return results.length > 0 ? (results[0] as PostTag) : null;
    }

    /**
     * Get all post tags for an app
     */
    static async forApp(
        appId: string,
        options?: {
            type?: string;
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
        },
    ) {
        const query: Record<string, unknown> = { appId };
        if (options?.type) query.type = options.type;

        return this.where(query, {
            orderBy: options?.orderBy || 'name',
            orderDirection: options?.orderDirection || 'asc',
        });
    }

    /**
     * Get all post tags by type.
     * appId is required — matches NOT NULL schema constraint and prevents cross-tenant data leaks.
     */
    static async byType(
        type: string,
        options: {
            appId: string;
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
        },
    ) {
        const query: Record<string, unknown> = { type, appId: options.appId };

        return this.where(query, {
            orderBy: options?.orderBy || 'name',
            orderDirection: options?.orderDirection || 'asc',
        });
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

    /**
     * Get tag style for UI
     */
    getStyle(): { backgroundColor: string; color: string } {
        const color = this.get('color') as string | null;
        if (!color) {
            return {
                backgroundColor: '#e5e7eb',
                color: '#374151',
            };
        }
        // Simple contrast calculation
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        return {
            backgroundColor: color,
            color: luminance > 0.5 ? '#000000' : '#ffffff',
        };
    }
}
