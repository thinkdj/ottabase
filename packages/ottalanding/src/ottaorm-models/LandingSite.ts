/**
 * LandingSite Model
 *
 * OttaORM fat model for site-level landing page config.
 * Stores name, branding, navigation, footer, and active theme.
 */
import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { landingSitesTable, type LandingSiteType, type NewLandingSiteType } from './LandingSite.schema';

export { landingSitesTable, type LandingSiteType, type NewLandingSiteType } from './LandingSite.schema';

export class LandingSite extends BaseModel {
    static entity = 'ottalanding_sites';
    static table = landingSitesTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottalanding';
    static packageType: PackageType = 'package';

    static casts = {
        navLinks: 'json' as const,
        navCta: 'json' as const,
        footerSections: 'json' as const,
        socialLinks: 'json' as const,
        legal: 'json' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static defaults = {
        themeId: 'atlas',
        navLinks: [
            { label: 'Home', href: '/' },
            { label: 'About', href: '/about' },
            { label: 'Contact', href: '/contact' },
        ],
        footerSections: [],
        socialLinks: [],
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: { label: 'ID' },
        },
        name: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Site Name',
                description: 'Product or app name',
                placeholder: 'My Awesome App',
            },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 'auto' },
        },
        tagline: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Tagline',
                description: 'Short tagline for the site',
                placeholder: 'The best tool for...',
            },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 300 },
        },
        logoUrl: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Logo URL', description: 'Logo image (light mode)' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: false },
        },
        logoDarkUrl: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Logo URL (Dark)', description: 'Logo image (dark mode)' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: false },
        },
        faviconUrl: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Favicon URL' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: false },
        },
        navLinks: {
            type: 'json',
            editable: true,
            uiConfig: {
                label: 'Navigation Links',
                description: 'Primary nav links (JSON array)',
            },
            formConfig: { visible: true, fieldType: 'json' },
            tableConfig: { visible: false },
        },
        navCta: {
            type: 'json',
            editable: true,
            uiConfig: { label: 'Nav CTA', description: 'Call-to-action button in navbar' },
            formConfig: { visible: true, fieldType: 'json' },
            tableConfig: { visible: false },
        },
        footerSections: {
            type: 'json',
            editable: true,
            uiConfig: { label: 'Footer Sections', description: 'Footer link groups (JSON)' },
            formConfig: { visible: true, fieldType: 'json' },
            tableConfig: { visible: false },
        },
        socialLinks: {
            type: 'json',
            editable: true,
            uiConfig: { label: 'Social Links', description: 'Social media links (JSON)' },
            formConfig: { visible: true, fieldType: 'json' },
            tableConfig: { visible: false },
        },
        legal: {
            type: 'json',
            editable: true,
            uiConfig: { label: 'Legal', description: 'Copyright and legal links (JSON)' },
            formConfig: { visible: true, fieldType: 'json' },
            tableConfig: { visible: false },
        },
        themeId: {
            type: 'string',
            editable: true,
            sortable: true,
            filterable: true,
            uiConfig: {
                label: 'Theme',
                description: 'Active landing page theme ID',
            },
            formConfig: { visible: true, fieldType: 'select' },
            tableConfig: { visible: true, colWidth: 150 },
        },
        homePageId: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: {
                label: 'Homepage',
                description: 'Which page shows at / (leave empty for first page or slug "home")',
            },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        appId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'App ID' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        organizationId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'Organization ID' },
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
        name: {
            rules: 'required|min:1|max:200',
            fieldName: 'Site Name',
            messages: { required: 'Site name is required' },
        },
        themeId: {
            rules: 'required|min:1|max:100',
            fieldName: 'Theme ID',
            messages: { required: 'Theme ID is required' },
        },
    };

    // ─── Query helpers ───────────────────────────────────────────────

    /** Find site by appId */
    static async findByAppId(appId: string): Promise<LandingSite | null> {
        const results = await this.where({ appId });
        return results.length > 0 ? (results[0] as LandingSite) : null;
    }

    /** Find site by organization */
    static async findByOrganization(organizationId: string) {
        return this.where({ organizationId }, { orderBy: 'name', orderDirection: 'asc' });
    }

    // ─── Instance methods ────────────────────────────────────────────

    /** Switch theme */
    async setTheme(themeId: string) {
        this.set('themeId', themeId);
        return this.save();
    }

    /** Convert to SiteContent shape (for rendering) */
    toSiteContent() {
        return {
            name: this.get('name') as string,
            tagline: this.get('tagline') as string | undefined,
            logoUrl: this.get('logoUrl') as string | undefined,
            logoDarkUrl: this.get('logoDarkUrl') as string | undefined,
            faviconUrl: this.get('faviconUrl') as string | undefined,
            navLinks: (this.get('navLinks') as Array<{ label: string; href: string }>) || [],
            navCta: this.get('navCta') as { label: string; href: string } | undefined,
            footerSections:
                (this.get('footerSections') as Array<{
                    title: string;
                    links: Array<{ label: string; href: string }>;
                }>) || [],
            socialLinks: (this.get('socialLinks') as Array<{ name: string; href: string; icon?: string }>) || [],
            legal: this.get('legal') as
                | { copyright?: string; links?: Array<{ label: string; href: string }> }
                | undefined,
        };
    }
}
