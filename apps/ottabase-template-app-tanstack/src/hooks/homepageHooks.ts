/**
 * Homepage Admin Hooks
 *
 * Pre-configured model hooks for homepage entities to avoid duplication across pages.
 * Follows the same pattern as blogHooks.ts / mediaLibraryHooks.ts.
 */
import { createModelHooks } from '@ottabase/ottaorm/client';

// ── Row types ───────────────────────────────────────────────────────────────

export interface HomepageSectionRow {
    id: string;
    slot: string;
    title: string | null;
    subtitle: string | null;
    body: string | null;
    githubUrl: string | null;
    icon: string | null;
    enabled: boolean;
    cssClasses: string | null;
    metadata: Record<string, unknown> | null;
    sortOrder: number;
    appId: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface HomepageFeatureRow {
    id: string;
    sectionId: string;
    title: string;
    description: string;
    icon: string | null;
    imageUrl: string | null;
    href: string | null;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

export interface HomepageActionRow {
    id: string;
    sectionId: string;
    label: string;
    href: string;
    variant: string | null;
    icon: string | null;
    external: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

export interface HomepageDisplaySettingsRow {
    id: string;
    variantBySlotJson: Record<string, string> | null;
    themePreset: string | null;
    fallbackThemePresetId: string | null;
    customCss: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    appId: string | null;
    createdAt: string;
    updatedAt: string;
}

// ── Hooks ───────────────────────────────────────────────────────────────────

export const homepageSectionHooks = createModelHooks<HomepageSectionRow>({
    entityName: 'homepage_sections',
});

export const homepageFeatureHooks = createModelHooks<HomepageFeatureRow>({
    entityName: 'homepage_features',
});

export const homepageActionHooks = createModelHooks<HomepageActionRow>({
    entityName: 'homepage_actions',
});

export const homepageDisplaySettingsHooks = createModelHooks<HomepageDisplaySettingsRow>({
    entityName: 'homepage_display_settings',
});
