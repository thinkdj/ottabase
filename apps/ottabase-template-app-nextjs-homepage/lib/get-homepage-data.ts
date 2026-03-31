/**
 * Homepage data fetcher with Zod validation.
 *
 * Wraps the raw `fetchHomepageData()` API call with schema validation
 * using the shared `@ottabase/homepage-contract` schemas.
 * Falls back to safe defaults when the API is unavailable or returns invalid data.
 */

import { HomepageDataSchema, type HomepageDataPayload } from '@ottabase/homepage-contract';
import { fetchHomepageData } from './api';

// Re-export for consumers that imported from here (e.g. tests)
export { HomepageDataSchema };

export type ValidatedHomepageData = HomepageDataPayload;

// ── Safe defaults ───────────────────────────────────────────────────────────

const EMPTY_PAYLOAD: HomepageDataPayload = {
    sections: [],
    display: {
        variantBySlot: null,
        themePreset: null,
        fallbackThemePresetId: null,
        customCss: null,
        seoTitle: null,
        seoDescription: null,
    },
    exposedPages: [],
};

/**
 * Fetch and validate homepage data from the worker API.
 * Returns validated data or safe defaults on failure.
 */
export async function getHomepageData(): Promise<ValidatedHomepageData> {
    try {
        const raw = await fetchHomepageData();
        const result = HomepageDataSchema.safeParse(raw);
        if (result.success) {
            return result.data;
        }
        // Log validation errors but don't hard-fail
        console.warn('[get-homepage-data] API validation failed for /api/homepage/data:', result.error.issues);
        return HomepageDataSchema.parse(EMPTY_PAYLOAD);
    } catch {
        return HomepageDataSchema.parse(EMPTY_PAYLOAD);
    }
}
