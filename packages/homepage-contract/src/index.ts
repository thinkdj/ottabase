/**
 * @ottabase/homepage-contract
 *
 * Shared Zod schemas and TypeScript types for the homepage/pages data contract.
 * Used by the TanStack worker (producer) and the Next.js app (consumer).
 *
 * Contains both legacy homepage schemas and new flexible page system schemas.
 *
 * @example
 * ```ts
 * // Legacy homepage API
 * import { HomepageDataSchema, type HomepageDataPayload } from '@ottabase/homepage-contract';
 * const result = HomepageDataSchema.safeParse(raw);
 *
 * // New flexible page system
 * import { PageDataSchema, type PageDataPayload } from '@ottabase/homepage-contract';
 * const page = PageDataSchema.safeParse(raw);
 * ```
 */

// ============================================================================
// LEGACY HOMEPAGE SCHEMAS (kept for backward compatibility)
// ============================================================================

// Zod schemas (runtime validation)
export {
    ActionSchema,
    DisplaySchema,
    ExposedPageSchema,
    FeatureSchema,
    HomepageDataSchema,
    SectionSchema,
} from './schemas';

// TypeScript types (inferred from schemas — no drift)
export type {
    ExposedPage,
    HomepageActionPayload,
    HomepageDataPayload,
    HomepageDisplayPayload,
    HomepageFeaturePayload,
    HomepageSectionPayload,
} from './types';

// ============================================================================
// NEW FLEXIBLE PAGE SYSTEM SCHEMAS
// ============================================================================

// Zod schemas (runtime validation)
export {
    NavPageSchema,
    NavPagesSchema,
    PageActionSchema,
    PageContentSchema,
    PageDataSchema,
    PageDisplaySchema,
    PageFeatureSchema,
    PageMetaSchema,
    PageSectionSchema,
    PagesListSchema,
} from './schemas';

// TypeScript types (inferred from schemas — no drift)
export type {
    NavPagePayload,
    NavPagesPayload,
    PageActionPayload,
    PageContentPayload,
    PageDataPayload,
    PageDisplayPayload,
    PageFeaturePayload,
    PageMetaPayload,
    PageSectionPayload,
    PagesListPayload,
} from './types';
