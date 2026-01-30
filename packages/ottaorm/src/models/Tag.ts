// ============================================================
// @ottabase/ottaorm - Tag Model
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { BaseModel, IModelConstructorParams, ModelFields, type PackageType } from '../base/BaseModel';

/**
 * Tag table schema
 */
export const tagsTable = sqliteTable('tags', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    // App identifier for multi-app database sharing (nullable, opt-in)
    appId: text('app_id'),
    createdAt: integer('created_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .$onUpdateFn(() => new Date())
        .notNull(),
});

/**
 * Tag model type
 */
export type TagType = typeof tagsTable.$inferSelect;
export type NewTagType = typeof tagsTable.$inferInsert;

/**
 * Tag model - Fat Model Pattern
 *
 * All metadata (schema, fields, validation, etc.) in one place
 *
 * @example
 * ```typescript
 * import { Tag } from "@ottabase/ottaorm/models";
 * import { setDriver } from "@ottabase/ottaorm";
 * import { createD1Driver } from "@ottabase/db/drizzle-d1";
 *
 * setDriver(createD1Driver(env.OBCF_D1));
 *
 * // Find tag by slug
 * const tag = await Tag.first({ slug: "javascript" });
 *
 * // Create tag
 * const newTag = await Tag.create({
 *   name: "JavaScript",
 *   slug: "javascript"
 * });
 *
 * // Get all tags
 * const tags = await Tag.all({ orderBy: "name" });
 *
 * // Generate slug
 * const slug = Tag.generateSlug("My New Tag");
 * ```
 */
export class Tag extends BaseModel {
    static entity = 'tags';
    static table = tagsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottaorm';
    static packageType: PackageType = 'core';

    // UI/Forms metadata
    static displayName = 'Tag';
    static displayNamePlural = 'Tags';
    static defaultSort = 'name';
    static defaultSortDirection = 'asc' as const;

    static casts = {
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
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
                description: 'Name of the tag',
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
                description: 'Slug of the tag',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 200,
            },
            validation: {
                rules: 'required|unique:tags,slug',
                messages: {
                    required: 'Slug is required',
                    unique: 'This slug already exists',
                },
            },
        },
        createdAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Created At',
            },
            tableConfig: {
                visible: true,
            },
        },
        updatedAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Updated At',
            },
            tableConfig: {
                visible: false,
            },
        },
    };

    protected static validationRules = {
        name: {
            rules: 'required',
            fieldName: 'Name',
            messages: {
                required: 'Name is required',
            },
        },
        slug: {
            rules: 'required',
            fieldName: 'Slug',
            messages: {
                required: 'Slug is required',
                unique: 'This slug already exists',
            },
        },
    };

    constructor(data: { [key: string]: any }) {
        const params: IModelConstructorParams = { entity: Tag.entity, data };
        super(params);
    }

    // ============================================================
    // HELPER METHODS
    // ============================================================

    /**
     * Generate slug from name
     */
    static generateSlug(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Create tag with auto-generated slug
     */
    static async createWithSlug(name: string) {
        const slug = this.generateSlug(name);
        return this.create({ name, slug });
    }
}
