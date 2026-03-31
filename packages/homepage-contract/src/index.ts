/**
 * @ottabase/homepage-contract
 *
 * Shared Zod schemas and TypeScript types for the homepage data contract.
 * Used by the TanStack worker (producer) and the Next.js app (consumer).
 *
 * @example
 * ```ts
 * import { HomepageDataSchema, type HomepageDataPayload } from '@ottabase/homepage-contract';
 *
 * // Validate API response
 * const result = HomepageDataSchema.safeParse(raw);
 *
 * // Type-safe usage
 * const payload: HomepageDataPayload = result.data;
 * ```
 */

// Zod schemas (runtime validation)
export {
    ExposedPageSchema,
    FeatureSchema,
    ActionSchema,
    SectionSchema,
    DisplaySchema,
    HomepageDataSchema,
} from './schemas';

// TypeScript types (inferred from schemas — no drift)
export type {
    ExposedPage,
    HomepageFeaturePayload,
    HomepageActionPayload,
    HomepageSectionPayload,
    HomepageDisplayPayload,
    HomepageDataPayload,
} from './types';
