/**
 * Pages Admin Hooks
 *
 * Pre-configured model hooks for the flexible page system entities.
 * Used by the admin UI to manage pages, sections, features, and actions.
 *
 * This replaces the legacy homepageHooks.ts for new integrations.
 */
import { createModelHooks } from '@ottabase/ottaorm/client';

// ── Row types ───────────────────────────────────────────────────────────────

export interface PageRow {
    id: string;
    slug: string;
    title: string;
    type: 'block' | 'content';
    status: 'draft' | 'published' | 'archived';
    postId: string | null;
    themePreset: string | null;
    fallbackThemePresetId: string | null;
    customCss: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    seoImage: string | null;
    variantBySlotJson: Record<string, string> | null;
    showInNav: boolean;
    navOrder: number;
    navLabel: string | null;
    icon: string | null;
    metadata: Record<string, unknown> | null;
    appId: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface PageSectionRow {
    id: string;
    pageId: string;
    slot: string;
    title: string | null;
    subtitle: string | null;
    body: string | null;
    variant: string | null;
    githubUrl: string | null;
    icon: string | null;
    imageUrl: string | null;
    videoUrl: string | null;
    logoUrl: string | null;
    cssClasses: string | null;
    backgroundColor: string | null;
    enabled: boolean;
    metadata: Record<string, unknown> | null;
    sortOrder: number;
    appId: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface PageFeatureRow {
    id: string;
    sectionId: string;
    title: string;
    description: string;
    icon: string | null;
    imageUrl: string | null;
    href: string | null;
    sortOrder: number;
    appId: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface PageActionRow {
    id: string;
    sectionId: string;
    label: string;
    href: string;
    variant: string | null;
    icon: string | null;
    external: boolean;
    sortOrder: number;
    appId: string | null;
    createdAt: string;
    updatedAt: string;
}

// ── Hooks ───────────────────────────────────────────────────────────────────

export const pageHooks = createModelHooks<PageRow>({
    entityName: 'pages',
});

export const pageSectionHooks = createModelHooks<PageSectionRow>({
    entityName: 'page_sections',
});

export const pageFeatureHooks = createModelHooks<PageFeatureRow>({
    entityName: 'page_features',
});

export const pageActionHooks = createModelHooks<PageActionRow>({
    entityName: 'page_actions',
});

// ── Convenience exports ─────────────────────────────────────────────────────

export const {
    useList: usePages,
    useDetail: usePage,
    useCreate: useCreatePage,
    useUpdate: useUpdatePage,
    useDelete: useDeletePage,
} = pageHooks;

export const {
    useList: usePageSections,
    useCreate: useCreatePageSection,
    useUpdate: useUpdatePageSection,
    useDelete: useDeletePageSection,
} = pageSectionHooks;

export const {
    useList: usePageFeatures,
    useCreate: useCreatePageFeature,
    useUpdate: useUpdatePageFeature,
    useDelete: useDeletePageFeature,
} = pageFeatureHooks;

export const {
    useList: usePageActions,
    useCreate: useCreatePageAction,
    useUpdate: useUpdatePageAction,
    useDelete: useDeletePageAction,
} = pageActionHooks;
