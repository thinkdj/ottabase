/**
 * Homepage data fetcher with Zod validation.
 *
 * Wraps the raw `fetchHomepageData()` API call with schema validation
 * and provides typed, validated payloads for the Next.js consumer.
 * Falls back to safe defaults when the API is unavailable or returns invalid data.
 */

import { z } from 'zod';
import type { HomepageDataPayload } from './api';
import { fetchHomepageData } from './api';

// ── Zod schemas for API payload validation ──────────────────────────────────

const ExposedPageSchema = z.object({
    slug: z.string(),
    title: z.string(),
});

const FeatureSchema = z.object({
    title: z.string(),
    description: z.string(),
    icon: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    href: z.string().nullable().optional(),
});

const ActionSchema = z.object({
    label: z.string(),
    href: z.string(),
    variant: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    external: z.boolean().optional().default(false),
});

const SectionSchema = z.object({
    id: z.string(),
    slot: z.string(),
    title: z.string().nullable(),
    subtitle: z.string().nullable(),
    body: z.string().nullable(),
    githubUrl: z.string().nullable(),
    icon: z.string().nullable(),
    enabled: z.boolean().default(true),
    cssClasses: z.string().nullable(),
    metadata: z.record(z.unknown()).nullable(),
    sortOrder: z.number().default(0),
    features: z.array(FeatureSchema).default([]),
    actions: z.array(ActionSchema).default([]),
});

const DisplaySchema = z.object({
    variantBySlot: z.record(z.string()).nullable(),
    themePreset: z.string().nullable(),
    fallbackThemePresetId: z.string().nullable().optional(),
    customCss: z.string().nullable().optional(),
    seoTitle: z.string().nullable().optional(),
    seoDescription: z.string().nullable().optional(),
});

export const HomepageDataSchema = z.object({
    sections: z.array(SectionSchema).default([]),
    display: DisplaySchema,
    exposedPages: z.array(ExposedPageSchema).default([]),
});

export type ValidatedHomepageData = z.infer<typeof HomepageDataSchema>;

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
