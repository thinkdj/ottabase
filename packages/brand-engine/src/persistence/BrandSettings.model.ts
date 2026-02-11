// ---------------------------------------------------------------------------
// Brand Engine – BrandSettings OttaORM Model
// Fat model for brand_settings table with resolve, draft, publish logic
// ---------------------------------------------------------------------------

import { BaseModel, type PackageType } from '@ottabase/ottaorm';
import { brandSettingsTable } from './schema';
import type { BrandTheme } from '../theme';
import type { DesignTokens } from '../tokens';
import type { LayoutConfig } from '../layout';
import { DEFAULT_LAYOUT } from '../layout';

export class BrandSettings extends BaseModel {
    static entity = 'brand_settings';
    static table = brandSettingsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/brand-engine';
    static packageType: PackageType = 'package' as PackageType;

    static casts = {
        isDraft: 'boolean' as const,
        allowDarkModeToggle: 'boolean' as const,
        hideOttabaseBranding: 'boolean' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    // ═══════════════════════════════════════════════════════════════════
    // QUERIES
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Resolve brand settings for an organization/app combination
     * Follows resolution order: draft → app → org → default
     */
    static async resolve(
        organizationId: string | null,
        appId?: string | null,
        userId?: string | null,
    ): Promise<BrandSettings | null> {
        // 1. Check for draft (user-specific preview)
        if (userId) {
            const draft = await this.first({
                organizationId,
                appId: appId || null,
                isDraft: true,
            });
            if (draft) return draft;
        }

        // 2. Check app-level settings
        if (appId) {
            const appSettings = await this.first({
                organizationId,
                appId,
                isDraft: false,
            });
            if (appSettings) return appSettings;
        }

        // 3. Check org-level settings
        if (organizationId) {
            const orgSettings = await this.first({
                organizationId,
                appId: null,
                isDraft: false,
            });
            if (orgSettings) return orgSettings;
        }

        // 4. Fall back to system default
        return this.getOrCreateDefault();
    }

    /**
     * Get or create default brand settings
     */
    static async getOrCreateDefault(): Promise<BrandSettings> {
        const existing = await this.first({
            organizationId: null,
            appId: null,
            isDraft: false,
        });
        if (existing) return existing;

        return this.create({
            organizationId: null,
            appId: null,
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
     * Publish draft (create version snapshot, mark as published)
     */
    async publish(): Promise<void> {
        if (!this.get('isDraft')) {
            throw new Error('Only drafts can be published');
        }

        // Find existing published version
        const published = await BrandSettings.first({
            organizationId: this.get('organizationId'),
            appId: this.get('appId'),
            isDraft: false,
        });

        // Save previous version snapshot
        if (published) {
            this.set('previousVersionJson', JSON.stringify(published.toJson()));
            this.set('version', (published.get('version') || 1) + 1);
        }

        // Mark as published
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
