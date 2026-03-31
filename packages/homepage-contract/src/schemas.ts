/**
 * @ottabase/homepage-contract — Zod schemas
 *
 * Single source of truth for the homepage data API contract.
 * Used by the TanStack worker (producer) and the Next.js app (consumer).
 */

import { z } from 'zod';

// ── Leaf schemas ────────────────────────────────────────────────────────────

export const ExposedPageSchema = z.object({
    slug: z.string(),
    title: z.string(),
});

export const FeatureSchema = z.object({
    title: z.string(),
    description: z.string(),
    icon: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    href: z.string().nullable().optional(),
});

export const ActionSchema = z.object({
    label: z.string(),
    href: z.string(),
    variant: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    external: z.boolean().optional().default(false),
});

// ── Section schema ──────────────────────────────────────────────────────────

export const SectionSchema = z.object({
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

// ── Display settings schema ─────────────────────────────────────────────────

export const DisplaySchema = z.object({
    variantBySlot: z.record(z.string()).nullable(),
    themePreset: z.string().nullable(),
    fallbackThemePresetId: z.string().nullable().optional(),
    customCss: z.string().nullable().optional(),
    seoTitle: z.string().nullable().optional(),
    seoDescription: z.string().nullable().optional(),
});

// ── Top-level payload schema ────────────────────────────────────────────────

export const HomepageDataSchema = z.object({
    sections: z.array(SectionSchema).default([]),
    display: DisplaySchema,
    exposedPages: z.array(ExposedPageSchema).default([]),
});
