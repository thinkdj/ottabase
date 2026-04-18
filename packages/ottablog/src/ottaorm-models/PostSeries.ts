/**
 * PostSeries Model
 *
 * OttaORM model for blog series - groups related posts into ordered collections.
 * Perfect for multi-part tutorials, article series, or themed content.
 */
import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { prepareCreateSlug, prepareUpdateSlug, type SlugLifecycleConfig } from '../slug-utils';
import { generateSlug } from '../types';
import { seriesTable } from './PostSeries.schema';

export {
    seriesTable,
    type NewPostSeriesType,
    type NewSeries,
    type PostSeriesType,
    type Series,
} from './PostSeries.schema';

export class PostSeries extends BaseModel {
    static entity = 'series';
    static table = seriesTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottablog';
    static packageType: PackageType = 'package';

    static writable = {
        create: ['title', 'slug', 'description', 'coverImage', 'isComplete', 'sortOrder', 'appId'],
        update: ['title', 'slug', 'description', 'coverImage', 'isComplete', 'sortOrder'],
    };

    static casts = {
        coverImage: 'json' as const,
        isComplete: 'boolean' as const,
        sortOrder: 'number' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static defaults = {
        isComplete: false,
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
        title: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Title',
                description: 'Series title',
                placeholder: 'Enter series title...',
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
                rules: 'required|min:3|max:200',
                messages: {
                    required: 'Title is required',
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
                placeholder: 'auto-generated-from-title',
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
                description: 'Series description',
                placeholder: 'What is this series about?',
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
        coverImage: {
            type: 'json',
            editable: true,
            uiConfig: {
                label: 'Cover Image',
                description: 'Series cover image',
            },
            formConfig: {
                visible: true,
                fieldType: 'image',
            },
            tableConfig: {
                visible: false,
            },
        },
        isComplete: {
            type: 'boolean',
            editable: true,
            filterable: true,
            sortable: true,
            uiConfig: {
                label: 'Complete',
                description: 'Mark series as complete',
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
                fieldType: 'number',
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
        title: {
            rules: 'required|min:3|max:200',
            fieldName: 'Title',
            messages: {
                required: 'Series title is required',
            },
        },
    };

    // ==================== Slug Lifecycle Config ====================

    private static readonly slugConfig: SlugLifecycleConfig = {
        slugPrefix: 'series',
        nameField: 'title',
        // Series are not type-scoped — unlike tags/categories, a series groups posts
        // regardless of content type, so slug uniqueness is per-app only.
        hasType: false,
        entityLabel: 'series',
    };

    // ==================== Query Scopes ====================

    static async create<T extends typeof BaseModel>(
        this: T,
        data: Record<string, any>,
        driver?: any,
    ): Promise<InstanceType<T>> {
        await prepareCreateSlug(this, data, PostSeries.slugConfig, driver);
        return (await super.create.call(this, data, driver)) as InstanceType<T>;
    }

    static async update<T extends typeof BaseModel>(
        this: T,
        id: string | number,
        data: Record<string, any>,
        driver?: any,
    ): Promise<InstanceType<T>> {
        await prepareUpdateSlug(this, id, data, PostSeries.slugConfig, driver);
        return (await super.update.call(this, id, data, driver)) as InstanceType<T>;
    }

    /**
     * Get all series.
     * appId is required — matches NOT NULL schema constraint and prevents cross-tenant data leaks.
     */
    static async list(options: { appId: string; orderBy?: string; orderDirection?: 'asc' | 'desc' }) {
        const query: Record<string, unknown> = { appId: options.appId };

        return this.where(query, {
            orderBy: options.orderBy || 'sortOrder',
            orderDirection: options.orderDirection || 'asc',
        });
    }

    /**
     * Get complete series only.
     * appId is required — matches NOT NULL schema constraint and prevents cross-tenant data leaks.
     */
    static async complete(options: { appId: string; orderBy?: string; orderDirection?: 'asc' | 'desc' }) {
        const query: Record<string, unknown> = { isComplete: true, appId: options.appId };

        return this.where(query, {
            orderBy: options.orderBy || 'sortOrder',
            orderDirection: options.orderDirection || 'asc',
        });
    }

    /**
     * Find series by slug
     */
    static async findBySlug(slug: string, options: { appId: string }): Promise<PostSeries | null> {
        const query: Record<string, unknown> = { slug, appId: options.appId };

        const results = await this.where(query);
        return results.length > 0 ? (results[0] as PostSeries) : null;
    }

    // ==================== Instance Methods ====================

    /**
     * Auto-generate slug from title if not set
     */
    generateSlug() {
        const title = this.get('title') as string;
        if (title && !this.get('slug')) {
            this.set('slug', generateSlug(title));
        }
    }
}
