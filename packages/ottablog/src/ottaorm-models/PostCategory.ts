/**
 * PostCategory Model
 *
 * OttaORM model for post categories with hierarchy support.
 */
import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { prepareCreateSlug, prepareUpdateSlug, type SlugLifecycleConfig } from '../slug-utils';
import { generateSlug } from '../types';
import { categoriesTable } from './PostCategory.schema';

export {
    categoriesTable,
    type Category,
    type NewCategory,
    type NewPostCategoryType,
    type PostCategoryType,
} from './PostCategory.schema';

export class PostCategory extends BaseModel {
    static entity = 'categories';
    static table = categoriesTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottablog';
    static packageType: PackageType = 'package';

    static writable = {
        create: ['name', 'slug', 'description', 'parentId', 'sortOrder', 'type', 'appId'],
        update: ['name', 'slug', 'description', 'parentId', 'sortOrder', 'type'],
    };

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

    // ==================== Slug Lifecycle Config ====================

    private static readonly slugConfig: SlugLifecycleConfig = {
        slugPrefix: 'category',
        nameField: 'name',
        hasType: true,
        entityLabel: 'categories',
    };

    // ==================== Query Scopes ====================

    static async create<T extends typeof BaseModel>(
        this: T,
        data: Record<string, any>,
        driver?: any,
    ): Promise<InstanceType<T>> {
        await prepareCreateSlug(this, data, PostCategory.slugConfig, driver);
        return (await super.create.call(this, data, driver)) as InstanceType<T>;
    }

    static async update<T extends typeof BaseModel>(
        this: T,
        id: string | number,
        data: Record<string, any>,
        driver?: any,
    ): Promise<InstanceType<T>> {
        await prepareUpdateSlug(this, id, data, PostCategory.slugConfig, driver);
        return (await super.update.call(this, id, data, driver)) as InstanceType<T>;
    }

    /**
     * Get root categories (no parent).
     * appId is required — matches NOT NULL schema constraint and prevents cross-tenant data leaks.
     */
    static async roots(options: { appId: string; orderBy?: string; orderDirection?: 'asc' | 'desc' }) {
        const query: Record<string, unknown> = { parentId: null, appId: options.appId };

        return this.where(query, {
            orderBy: options?.orderBy || 'sortOrder',
            orderDirection: options?.orderDirection || 'asc',
        });
    }

    /**
     * Get children of a category.
     * appId is required — matches NOT NULL schema constraint and prevents cross-tenant data leaks.
     */
    static async children(
        parentId: string,
        options: {
            appId: string;
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
        },
    ) {
        const query: Record<string, unknown> = { parentId, appId: options.appId };

        return this.where(query, {
            orderBy: options?.orderBy || 'sortOrder',
            orderDirection: options?.orderDirection || 'asc',
        });
    }

    /**
     * Find category by slug
     */
    static async findBySlug(slug: string, options: { appId: string; type?: string }): Promise<PostCategory | null> {
        const query: Record<string, unknown> = { slug, appId: options.appId };
        if (options.type) query.type = options.type;

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
