/**
 * LandingPage Model
 *
 * OttaORM fat model for landing pages (home, about, contact, etc.).
 * Each page belongs to a LandingSite and contains ordered LandingSections.
 */
import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { landingPagesTable, type LandingPageType, type NewLandingPageType } from './LandingPage.schema';

export { landingPagesTable, type LandingPageType, type NewLandingPageType } from './LandingPage.schema';

export class LandingPage extends BaseModel {
    static entity = 'ottalanding_pages';
    static table = landingPagesTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottalanding';
    static packageType: PackageType = 'package';

    static casts = {
        isPublished: 'boolean' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static defaults = {
        isPublished: true,
        order: 0,
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: { label: 'ID' },
        },
        siteId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'Site ID', description: 'Parent landing site' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        slug: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Slug',
                description: 'URL path (e.g. "home", "about")',
                placeholder: 'home',
            },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 150 },
        },
        title: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Page Title',
                description: 'Title for the page (browser tab + heading)',
                placeholder: 'Home',
            },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 'auto' },
        },
        metaDescription: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Meta Description',
                description: 'SEO meta description',
            },
            formConfig: { visible: true, fieldType: 'textarea' },
            tableConfig: { visible: false },
        },
        ogImage: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'OG Image', description: 'Open Graph image URL' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: false },
        },
        order: {
            type: 'integer',
            editable: true,
            sortable: true,
            uiConfig: {
                label: 'Order',
                description: 'Display order in navigation',
                defaultValue: 0,
            },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 80 },
        },
        isPublished: {
            type: 'boolean',
            editable: true,
            filterable: true,
            sortable: true,
            uiConfig: {
                label: 'Published',
                description: 'Whether the page is live',
                defaultValue: true,
            },
            formConfig: { visible: true, fieldType: 'boolean' },
            tableConfig: { visible: true, colWidth: 100 },
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
        siteId: {
            rules: 'required',
            fieldName: 'Site ID',
            messages: { required: 'Site ID is required' },
        },
        slug: {
            rules: 'required|min:1|max:100',
            fieldName: 'Slug',
            messages: { required: 'Page slug is required' },
        },
        title: {
            rules: 'required|min:1|max:200',
            fieldName: 'Title',
            messages: { required: 'Page title is required' },
        },
    };

    // ─── Query helpers ───────────────────────────────────────────────

    /** Get all pages for a site, ordered */
    static async findBySite(siteId: string) {
        return this.where({ siteId }, { orderBy: 'order', orderDirection: 'asc' });
    }

    /** Find a page by site + slug */
    static async findBySlug(siteId: string, slug: string): Promise<LandingPage | null> {
        const results = await this.where({ siteId, slug });
        return results.length > 0 ? (results[0] as LandingPage) : null;
    }

    /** Get all published pages for a site */
    static async findPublished(siteId: string) {
        return this.where(
            { siteId, isPublished: true },
            { orderBy: 'order', orderDirection: 'asc' },
        );
    }
}
