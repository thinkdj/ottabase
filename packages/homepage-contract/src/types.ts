/**
 * @ottabase/homepage-contract — TypeScript types
 *
 * All types are inferred from the Zod schemas so there is no drift.
 */

import type { z } from 'zod';
import type {
    ExposedPageSchema,
    FeatureSchema,
    ActionSchema,
    SectionSchema,
    DisplaySchema,
    HomepageDataSchema,
} from './schemas';

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
