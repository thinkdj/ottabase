import { createModelHooks } from '@ottabase/ottaorm/client';

export type HomepageSectionRow = {
    id: string;
    slot: string;
    title?: string | null;
    subtitle?: string | null;
    description?: string | null;
    body?: string | null;
    contentJson?: Record<string, unknown> | null;
    isActive?: boolean | null;
    sortOrder?: number | null;
};

export type HomepageFeatureRow = {
    id: string;
    sectionId: string;
    title: string;
    description: string;
    icon?: string | null;
    sortOrder?: number | null;
};

export type HomepageActionRow = {
    id: string;
    sectionId: string;
    label: string;
    href: string;
    variant?: string | null;
    icon?: string | null;
    isExternal?: boolean | null;
    sortOrder?: number | null;
};

export type HomepageDisplayRow = {
    id: string;
    variantBySlotJson: Record<string, string>;
    themePresetId: string;
};

export const sectionHooks = createModelHooks<HomepageSectionRow>({ entityName: 'homepage_sections' });
export const featureHooks = createModelHooks<HomepageFeatureRow>({ entityName: 'homepage_features' });
export const actionHooks = createModelHooks<HomepageActionRow>({ entityName: 'homepage_actions' });
export const displayHooks = createModelHooks<HomepageDisplayRow>({ entityName: 'homepage_display_settings' });
