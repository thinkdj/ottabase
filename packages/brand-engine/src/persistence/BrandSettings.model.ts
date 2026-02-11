// ---------------------------------------------------------------------------
// Brand Engine – BrandSettings OttaORM Model
// Fat model for brand_settings table with resolve, draft, publish logic
// ---------------------------------------------------------------------------

import { BaseModel, type PackageType } from '@ottabase/ottaorm';
import { brandSettingsTable } from './schema';
import type { BrandTheme } from '../theme';
import type { DesignTokens } from '../tokens';
import type { LayoutConfig } from '../layout';
import { LayoutTemplate } from './LayoutTemplate.model';
import { LAYOUT_PRESETS } from '../layouts/presets';

export interface RouteMappingRow {
    pathPattern: string;
    layoutTemplateId: string;
    priority: number;
}

export class BrandSettings extends BaseModel {
    static entity = 'brand_settings';
    static table = brandSettingsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/brand-engine';
    static packageType: PackageType = 'package' as PackageType;

    static casts = {
        isDraft: 'boolean' as const,
        isActive: 'boolean' as const,
        allowDarkModeToggle: 'boolean' as const,
        hideOttabaseBranding: 'boolean' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    // ═══════════════════════════════════════════════════════════════════
    // QUERIES
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Resolve default brand settings (name IS NULL). Order: draft → app → org → default
     */
    static async resolve(
        organizationId: string | null,
        appId?: string | null,
        userId?: string | null,
    ): Promise<BrandSettings | null> {
        const baseWhere = { name: null } as const;

        // 1. Draft (user-specific preview)
        if (userId) {
            const draft = await this.first({
                ...baseWhere,
                organizationId,
                appId: appId || null,
                isDraft: true,
            });
            if (draft) return draft;
        }

        // 2. App-level
        if (appId && organizationId) {
            const appSettings = await this.first({
                ...baseWhere,
                organizationId,
                appId,
                isDraft: false,
            });
            if (appSettings) return appSettings;
        }

        // 3. Org-level
        if (organizationId) {
            const orgSettings = await this.first({
                ...baseWhere,
                organizationId,
                appId: null,
                isDraft: false,
            });
            if (orgSettings) return orgSettings;
        }

        // 4. System default
        return this.getOrCreateDefault();
    }

    /**
     * Find active preset (isActive=true) for org/app
     */
    static async findActive(organizationId: string | null, appId?: string | null): Promise<BrandSettings | null> {
        if (appId && organizationId) {
            const appActive = await this.first({
                organizationId,
                appId,
                isActive: true,
            });
            if (appActive) return appActive;
        }
        if (organizationId) {
            const orgActive = await this.first({
                organizationId,
                appId: null,
                isActive: true,
            });
            if (orgActive) return orgActive;
        }
        return this.first({
            organizationId: null,
            appId: null,
            isActive: true,
        });
    }

    /** Deactivate all presets for org/app */
    static async deactivateAll(organizationId: string | null, appId?: string | null): Promise<void> {
        const rows = (await this.where({
            organizationId: organizationId ?? null,
            appId: appId ?? null,
        })) as BrandSettings[];
        for (const row of rows) {
            if (row.get('isActive')) {
                row.set('isActive', false);
                await row.save();
            }
        }
    }

    /** Activate this preset; deactivates others first */
    async activate(): Promise<void> {
        const orgId = this.get('organizationId') as string | null;
        const appId = this.get('appId') as string | null;
        await BrandSettings.deactivateAll(orgId, appId);
        this.set('isActive', true);
        await this.save();
    }

    /** Get route mappings from JSON or empty array */
    getRouteMappings(): RouteMappingRow[] {
        const raw = this.get('routeMappingsJson');
        if (!raw || typeof raw !== 'string') return [];
        try {
            return JSON.parse(raw) as RouteMappingRow[];
        } catch {
            return [];
        }
    }

    /** Get layout templates snapshot from JSON */
    getLayoutTemplatesSnapshot(): Record<string, { componentKey: string; config: LayoutConfig }> {
        const raw = this.get('layoutTemplatesSnapshotJson');
        if (!raw || typeof raw !== 'string') return {};
        try {
            return JSON.parse(raw) as Record<string, { componentKey: string; config: LayoutConfig }>;
        } catch {
            return {};
        }
    }

    /**
     * Snapshot current layout templates into layoutTemplatesSnapshotJson
     */
    async snapshot(): Promise<void> {
        const routeMappings = this.getRouteMappings();
        const defaultIds = ['app-shell', 'homepage'];
        const templateIds = [...new Set([...routeMappings.map((m) => m.layoutTemplateId), ...defaultIds])];
        const snapshotMap: Record<string, { componentKey: string; config: LayoutConfig }> = {};

        for (const [key, preset] of Object.entries(LAYOUT_PRESETS)) {
            snapshotMap[key] = { componentKey: preset.componentKey, config: preset.config };
        }
        for (const id of templateIds) {
            const template = (await LayoutTemplate.find(id)) as InstanceType<typeof LayoutTemplate> | null;
            if (template) {
                snapshotMap[id] = {
                    componentKey: template.get('componentKey') as string,
                    config: template.getConfig(),
                };
            }
        }
        this.set('layoutTemplatesSnapshotJson', JSON.stringify(snapshotMap));
        await this.save();
    }

    /**
     * Get or create default brand settings (name=null)
     */
    static async getOrCreateDefault(): Promise<BrandSettings> {
        const existing = await this.first({
            organizationId: null,
            appId: null,
            name: null,
            isDraft: false,
        });
        if (existing) return existing;

        return this.create({
            organizationId: null,
            appId: null,
            name: null,
            brandName: 'Ottabase',
            defaultColorScheme: 'system',
            allowDarkModeToggle: true,
        });
    }

    /**
     * Create a draft copy for preview
     */
    async createDraft(userId: string): Promise<BrandSettings> {
        const draft = await BrandSettings.create({
            organizationId: this.get('organizationId'),
            appId: this.get('appId'),
            brandName: this.get('brandName'),
            tagline: this.get('tagline'),
            tokensJson: this.get('tokensJson'),
            layoutJson: this.get('layoutJson'),
            logoKey: this.get('logoKey'),
            logoDarkKey: this.get('logoDarkKey'),
            iconKey: this.get('iconKey'),
            isDraft: true,
        });
        return draft;
    }

    /**
     * Publish draft. Replaces existing published row to avoid duplicates (F4).
     */
    async publish(): Promise<void> {
        if (!this.get('isDraft')) {
            throw new Error('Only drafts can be published');
        }

        const orgId = this.get('organizationId') as string | null;
        const appId = this.get('appId') as string | null;
        const published = await BrandSettings.first({
            organizationId: orgId,
            appId,
            name: null,
            isDraft: false,
        });

        if (published && published.get('id') !== this.get('id')) {
            this.set('previousVersionJson', JSON.stringify(published.toJson()));
            this.set('version', (published.get('version') || 1) + 1);
            await published.destroy();
        }

        this.set('isDraft', false);
        await this.save();
    }

    // ═══════════════════════════════════════════════════════════════════
    // CONVERTERS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Convert to BrandTheme for use with brand-engine
     */
    toBrandTheme(): BrandTheme {
        const tokensJson = this.get('tokensJson');
        let tokens: Partial<DesignTokens> = {};

        if (tokensJson) {
            try {
                tokens = JSON.parse(tokensJson as string);
            } catch {
                // ignore parse errors
            }
        }

        const layoutJson = this.get('layoutJson');
        let layout: Partial<LayoutConfig> | undefined;
        if (layoutJson) {
            try {
                layout = JSON.parse(layoutJson as string);
            } catch {
                // ignore parse errors
            }
        }

        return {
            name: `brand-${this.get('organizationId') || 'default'}-${this.get('appId') || 'default'}`,
            tokens: tokens as DesignTokens,
            layout: layout as LayoutConfig,
        };
    }

    /**
     * Get logo URLs (R2 public URLs)
     */
    getLogoUrls(r2PublicUrl: string): {
        logo?: string;
        logoDark?: string;
        icon?: string;
        ogImage?: string;
        emailLogo?: string;
    } {
        const baseUrl = r2PublicUrl || '';
        return {
            logo: this.get('logoKey') ? `${baseUrl}/${this.get('logoKey')}` : undefined,
            logoDark: this.get('logoDarkKey') ? `${baseUrl}/${this.get('logoDarkKey')}` : undefined,
            icon: this.get('iconKey') ? `${baseUrl}/${this.get('iconKey')}` : undefined,
            ogImage: this.get('ogImageKey') ? `${baseUrl}/${this.get('ogImageKey')}` : undefined,
            emailLogo: this.get('emailLogoKey') ? `${baseUrl}/${this.get('emailLogoKey')}` : undefined,
        };
    }
}
