/**
 * LandingSection Model
 *
 * OttaORM fat model for individual page sections.
 * Each section has a type (hero, features, pricing, etc.) and
 * typed JSON content matching that type's schema.
 */
import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { SECTION_TYPES, type SectionType } from '../types';
import { landingSectionsTable, type LandingSectionType, type NewLandingSectionType } from './LandingSection.schema';

export { landingSectionsTable, type LandingSectionType, type NewLandingSectionType } from './LandingSection.schema';

export class LandingSection extends BaseModel {
    static entity = 'ottalanding_sections';
    static table = landingSectionsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottalanding';
    static packageType: PackageType = 'package';

    static casts = {
        content: 'json' as const,
        visible: 'boolean' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static defaults = {
        order: 0,
        visible: true,
        content: {},
    };

    /** pageId writable on create only (parent FK); appId injected by RLS */
    static writable = {
        create: ['pageId', 'sectionType', 'content', 'order', 'visible', 'appId'],
        update: ['sectionType', 'content', 'order', 'visible'],
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: { label: 'ID' },
        },
        pageId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'Page ID', description: 'Parent landing page' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        sectionType: {
            type: 'string',
            editable: true,
            filterable: true,
            sortable: true,
            uiConfig: {
                label: 'Section Type',
                description: 'Type of section (hero, features, pricing, etc.)',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
                options: SECTION_TYPES.map((t) => ({ label: t, value: t })),
            },
            tableConfig: { visible: true, colWidth: 150 },
        },
        content: {
            type: 'json',
            editable: true,
            uiConfig: {
                label: 'Content',
                description: 'Section content (JSON — shape depends on sectionType)',
            },
            formConfig: { visible: true, fieldType: 'json' },
            tableConfig: { visible: false },
        },
        order: {
            type: 'integer',
            editable: true,
            sortable: true,
            uiConfig: {
                label: 'Order',
                description: 'Display order within the page',
                defaultValue: 0,
            },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 80 },
        },
        visible: {
            type: 'boolean',
            editable: true,
            filterable: true,
            uiConfig: {
                label: 'Visible',
                description: 'Show this section',
                defaultValue: true,
            },
            formConfig: { visible: true, fieldType: 'boolean' },
            tableConfig: { visible: true, colWidth: 80 },
        },
        appId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'App ID' },
            formConfig: { visible: false },
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

    protected static validationRules = {
        pageId: {
            rules: 'required',
            fieldName: 'Page ID',
            messages: { required: 'Page ID is required' },
        },
        sectionType: {
            rules: 'required|min:1|max:50',
            fieldName: 'Section Type',
            messages: { required: 'Section type is required' },
        },
    };

    // ─── Query helpers ───────────────────────────────────────────────

    /** Get all sections for a page, ordered */
    static async findByPage(pageId: string) {
        return this.where({ pageId }, { orderBy: 'order', orderDirection: 'asc' });
    }

    /** Get visible sections for a page, ordered */
    static async findVisibleByPage(pageId: string) {
        return this.where({ pageId, visible: true }, { orderBy: 'order', orderDirection: 'asc' });
    }

    /** Find sections of a specific type within a page */
    static async findByType(pageId: string, sectionType: SectionType) {
        return this.where({ pageId, sectionType }, { orderBy: 'order', orderDirection: 'asc' });
    }

    // ─── Instance methods ────────────────────────────────────────────

    /** Update section content */
    async updateContent(content: Record<string, unknown>) {
        this.set('content', content);
        return this.save();
    }

    /** Toggle visibility */
    async toggleVisible() {
        this.set('visible', !this.get('visible'));
        return this.save();
    }

    /** Convert to PageSection shape (for rendering) */
    toPageSection() {
        return {
            type: this.get('sectionType') as SectionType,
            content: this.get('content') as Record<string, unknown>,
            order: this.get('order') as number,
            visible: this.get('visible') as boolean,
        };
    }
}
