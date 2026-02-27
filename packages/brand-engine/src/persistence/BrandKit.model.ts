// ---------------------------------------------------------------------------
// Brand Engine – BrandKit OttaORM Model (v2: per-app scoping)
// Self-contained: identity, logos, colors, fonts, theme. Scoped by appId.
// ---------------------------------------------------------------------------

import type { LayoutConfig } from '@ottabase/ottalayout';
import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import type { BrandTheme } from '../theme';
import type { DesignTokens } from '../tokens';
import { brandKitsTable } from './schema';

export class BrandKit extends BaseModel {
    static entity = 'brand_kits';
    static table = brandKitsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/brand-engine';
    static packageType: PackageType = 'package' as PackageType;

    // UI/Forms metadata
    static displayName = 'Brand Kit';
    static displayNamePlural = 'Brand Kits';
    static defaultSort = 'updatedAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        allowDarkModeToggle: 'boolean' as const,
        hideOttabaseBranding: 'boolean' as const,
        isDefault: 'boolean' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: [
            'appId',
            'parentBrandKitId',
            'name',
            'slug',
            'brandName',
            'tagline',
            'themePresetId',
            'tokensJson',
            'defaultColorScheme',
            'allowDarkModeToggle',
            'customCss',
            'hideOttabaseBranding',
        ],
        update: [
            'parentBrandKitId',
            'name',
            'slug',
            'brandName',
            'tagline',
            'themePresetId',
            'tokensJson',
            'defaultColorScheme',
            'allowDarkModeToggle',
            'customCss',
            'hideOttabaseBranding',
        ],
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        appId: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'App' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        isDefault: {
            type: 'boolean',
            editable: false,
            uiConfig: { label: 'Default Kit' },
            tableConfig: { visible: true },
        },
        parentBrandKitId: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Inherits From' },
            tableConfig: { visible: false },
        },
        name: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: { label: 'Name' },
            tableConfig: { visible: true },
        },
        slug: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: { label: 'Slug' },
            tableConfig: { visible: true },
        },
        brandName: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: { label: 'Brand Name' },
            tableConfig: { visible: true },
        },
        tagline: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Tagline' },
            tableConfig: { visible: false },
        },
        themePresetId: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Theme Preset' },
            tableConfig: { visible: true },
        },
        defaultColorScheme: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Color Scheme' },
            tableConfig: { visible: true },
        },
        allowDarkModeToggle: {
            type: 'boolean',
            editable: true,
            uiConfig: { label: 'Dark Mode Toggle' },
            tableConfig: { visible: false },
        },
        hideOttabaseBranding: {
            type: 'boolean',
            editable: true,
            uiConfig: { label: 'Hide Branding' },
            tableConfig: { visible: false },
        },
        createdBy: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'Created By' },
            tableConfig: { visible: false },
        },
        updatedBy: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'Updated By' },
            tableConfig: { visible: false },
        },
        createdAt: {
            type: 'date',
            editable: false,
            uiConfig: { label: 'Created' },
            tableConfig: { visible: true },
        },
        updatedAt: {
            type: 'date',
            editable: false,
            uiConfig: { label: 'Updated' },
            tableConfig: { visible: true },
        },
    };

    /**
     * Get or create system default Brand Kit (appId=null).
     * IMPORTANT: Only call this when truly needed (bootstrap, fallback).
     * Most code should resolve per-app kits via proper resolution pipeline.
     */
    static async getOrCreateDefault(): Promise<BrandKit> {
        const existing = (await this.first({
            appId: null,
        })) as BrandKit | null;
        if (existing) return existing;

        // Bootstrap: Create system default kit
        return this.create({
            appId: null,
            isDefault: true,
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
                console.warn('[BrandKit.toBrandTheme] Failed to parse tokensJson for kit:', this.get('id'));
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
