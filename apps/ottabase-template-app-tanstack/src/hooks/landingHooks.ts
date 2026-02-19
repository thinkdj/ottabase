/**
 * Landing Page Hooks
 *
 * Pre-configured model hooks for ottalanding entities.
 */
import { createModelHooks } from '@ottabase/ottaorm/client';

export interface LandingSiteItem {
    id: string;
    name: string;
    tagline?: string;
    logoUrl?: string;
    logoDarkUrl?: string;
    faviconUrl?: string;
    navLinks: Array<{ label: string; href: string }>;
    navCta?: { label: string; href: string } | null;
    footerSections: Array<{ title: string; links: Array<{ label: string; href: string }> }>;
    socialLinks: Array<{ name: string; href: string; icon?: string }>;
    legal?: { copyright?: string; links?: Array<{ label: string; href: string }> } | null;
    themeId: string;
    homePageId?: string | null;
    appId?: string;
    organizationId?: string;
    createdAt: number;
    updatedAt: number;
}

export interface LandingPageItem {
    id: string;
    siteId: string;
    slug: string;
    title: string;
    metaDescription?: string;
    ogImage?: string;
    order: number;
    isPublished: boolean;
    appId?: string;
    createdAt: number;
    updatedAt: number;
}

export interface LandingSectionItem {
    id: string;
    pageId: string;
    sectionType: string;
    content: Record<string, unknown>;
    order: number;
    visible: boolean;
    appId?: string;
    createdAt: number;
    updatedAt: number;
}

export const landingSiteHooks = createModelHooks<LandingSiteItem>({ entityName: 'ottalanding_sites' });
export const landingPageHooks = createModelHooks<LandingPageItem>({ entityName: 'ottalanding_pages' });
export const landingSectionHooks = createModelHooks<LandingSectionItem>({ entityName: 'ottalanding_sections' });
