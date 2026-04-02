/**
 * @ottabase/homepage-contract — TypeScript types
 *
 * All types are inferred from the Zod schemas so there is no drift.
 * Contains both legacy homepage types and new flexible page system types.
 */

import type { z } from 'zod';
import type {
    ActionSchema,
    DisplaySchema,
    // Legacy homepage schemas
    ExposedPageSchema,
    FeatureSchema,
    HomepageDataSchema,
    NavPageSchema,
    NavPagesSchema,
    PageActionSchema,
    PageContentSchema,
    PageDataSchema,
    PageDisplaySchema,
    // New flexible page system schemas
    PageFeatureSchema,
    PageMetaSchema,
    PageSectionSchema,
    PagesListSchema,
    SectionSchema,
} from './schemas';

// ============================================================================
// LEGACY HOMEPAGE TYPES (kept for backward compatibility)
// ============================================================================

/** Exposed page link for homepage navbar */
export type ExposedPage = z.infer<typeof ExposedPageSchema>;

/** Feature item within a homepage section */
export type HomepageFeaturePayload = z.infer<typeof FeatureSchema>;

/** Action button within a homepage section */
export type HomepageActionPayload = z.infer<typeof ActionSchema>;

/** Homepage section (with nested features and actions) */
export type HomepageSectionPayload = z.infer<typeof SectionSchema>;

/** Homepage display settings (variants, theme, SEO, custom CSS) */
export type HomepageDisplayPayload = z.infer<typeof DisplaySchema>;

/** Full homepage data payload from GET /api/homepage/data */
export type HomepageDataPayload = z.infer<typeof HomepageDataSchema>;

// ============================================================================
// NEW FLEXIBLE PAGE SYSTEM TYPES
// ============================================================================

/** Feature item within a page section */
export type PageFeaturePayload = z.infer<typeof PageFeatureSchema>;

/** Action button (CTA) within a page section */
export type PageActionPayload = z.infer<typeof PageActionSchema>;

/** Page section (block within a page) */
export type PageSectionPayload = z.infer<typeof PageSectionSchema>;

/** Page display settings (variants, theme, SEO) */
export type PageDisplayPayload = z.infer<typeof PageDisplaySchema>;

/** Page metadata */
export type PageMetaPayload = z.infer<typeof PageMetaSchema>;

/** Page content (for content-type pages linking to ottablog Post) */
export type PageContentPayload = z.infer<typeof PageContentSchema>;

/** Full page data payload from GET /api/pages/:slug */
export type PageDataPayload = z.infer<typeof PageDataSchema>;

/** Nav page item from GET /api/pages/nav */
export type NavPagePayload = z.infer<typeof NavPageSchema>;

/** Pages list response from GET /api/pages */
export type PagesListPayload = z.infer<typeof PagesListSchema>;

/** Nav pages response from GET /api/pages/nav */
export type NavPagesPayload = z.infer<typeof NavPagesSchema>;
