// ---------------------------------------------------------------------------
// Brand Engine – BrandKit OttaORM Model
// Self-contained: identity, logos, colors, fonts, theme
// ---------------------------------------------------------------------------

import { BaseModel, type PackageType } from '@ottabase/ottaorm';
import { brandKitsTable } from './schema';
import type { BrandTheme } from '../theme';
import type { DesignTokens } from '../tokens';
import type { LayoutConfig } from '../layout';

export class BrandKit extends BaseModel {
    static entity = 'brand_kits';
    static table = brandKitsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/brand-engine';
    static packageType: PackageType = 'package' as PackageType;

    static casts = {
        allowDarkModeToggle: 'boolean' as const,
        hideOttabaseBranding: 'boolean' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    /** Get or create system default Brand Kit */
    static async getOrCreateDefault(): Promise<BrandKit> {
        const existing = (await this.first({
            organizationId: null,
        })) as BrandKit | null;
        if (existing) return existing;

        return this.create({
            organizationId: null,
            name: 'Default',
            brandName: 'Ottabase',
            themePresetId: 'default',
            defaultColorScheme: 'system',
            allowDarkModeToggle: true,
        }) as Promise<BrandKit>;
    }

    /** Convert to BrandTheme for resolver. Normalizes legacy "colors" -> "color". */
    toBrandTheme(): BrandTheme {
        const tokensJson = this.get('tokensJson');
        let parsed: Record<string, unknown> = {};

        if (tokensJson) {
            try {
                parsed = JSON.parse(tokensJson as string);
            } catch {
                // ignore
            }
        }

        const { cursors: rawCursors, colors: legacyColors, ...tokenRest } = parsed;
        const tokens = { ...tokenRest } as Partial<DesignTokens>;
        if (legacyColors && typeof legacyColors === 'object' && !tokens.color) {
            tokens.color = legacyColors as DesignTokens['color'];
        }
        const cursors = rawCursors as BrandTheme['cursors'] | undefined;

        return {
            name: `brand-kit-${this.get('id')}`,
            tokens: tokens as DesignTokens,
            layout: undefined as unknown as LayoutConfig,
            cursors: cursors && typeof cursors === 'object' ? cursors : undefined,
        };
    }

    /** Get logo URLs (R2 public URLs) */
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
