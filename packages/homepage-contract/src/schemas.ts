/**
 * @ottabase/homepage-contract — Zod schemas
 *
 * Single source of truth for the homepage/pages data API contract.
 * Used by the TanStack worker (producer) and the Next.js app (consumer).
 *
 * Contains both legacy homepage schemas and new flexible page system schemas.
 */

import { z } from 'zod';

// ============================================================================
// LEGACY HOMEPAGE SCHEMAS (kept for backward compatibility)
// ============================================================================

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

// ============================================================================
// NEW FLEXIBLE PAGE SYSTEM SCHEMAS
// ============================================================================

// ── Page feature (within a section) ─────────────────────────────────────────

export const PageFeatureSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    icon: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    href: z.string().nullable().optional(),
});

// ── Page action (CTA button within a section) ───────────────────────────────

export const PageActionSchema = z.object({
    id: z.string(),
    label: z.string(),
    href: z.string(),
    variant: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    external: z.boolean().optional().default(false),
});

// ── Page section (block within a page) ──────────────────────────────────────

export const PageSectionSchema = z.object({
    id: z.string(),
    slot: z.string(),
    title: z.string().nullable(),
    subtitle: z.string().nullable(),
    body: z.string().nullable(),
    variant: z.string().nullable().optional(),
    githubUrl: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    enabled: z.boolean().default(true),
    cssClasses: z.string().nullable().optional(),
    metadata: z.record(z.unknown()).nullable().optional(),
    sortOrder: z.number().default(0),
    features: z.array(PageFeatureSchema).default([]),
    actions: z.array(PageActionSchema).default([]),
});

// ── Page display settings ───────────────────────────────────────────────────

export const PageDisplaySchema = z.object({
    variantBySlot: z.record(z.string()).nullable(),
    themePreset: z.string().nullable(),
    fallbackThemePresetId: z.string().nullable().optional(),
    customCss: z.string().nullable().optional(),
    seoTitle: z.string().nullable().optional(),
    seoDescription: z.string().nullable().optional(),
    seoImage: z.string().nullable().optional(),
});

// ── Page metadata ───────────────────────────────────────────────────────────

export const PageMetaSchema = z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    type: z.enum(['block', 'content']),
    status: z.enum(['draft', 'published', 'archived']),
    showInNav: z.boolean().default(false),
    navOrder: z.number().default(0),
    navLabel: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
});

// ── Page content (for content-type pages, links to ottablog Post) ───────────

export const PageContentSchema = z
    .object({
        title: z.string(),
        body: z.string(),
        excerpt: z.string().nullable().optional(),
    })
    .nullable();

// ── Full page data payload (from GET /api/pages/:slug) ──────────────────────

export const PageDataSchema = z.object({
    page: PageMetaSchema,
    sections: z.array(PageSectionSchema).default([]),
    display: PageDisplaySchema,
    content: PageContentSchema,
});

// ── Nav page (from GET /api/pages/nav) ──────────────────────────────────────

export const NavPageSchema = z.object({
    slug: z.string(),
    title: z.string(),
    navLabel: z.string().nullable().optional(),
    navOrder: z.number().default(0),
    icon: z.string().nullable().optional(),
});

// ── Pages list response ─────────────────────────────────────────────────────

export const PagesListSchema = z.object({
    pages: z.array(
        z.object({
            id: z.string(),
            slug: z.string(),
            title: z.string(),
            type: z.enum(['block', 'content']),
            status: z.enum(['draft', 'published', 'archived']),
            showInNav: z.boolean().default(false),
            navOrder: z.number().default(0),
            createdAt: z.string(),
            updatedAt: z.string(),
        }),
    ),
});

// ── Nav pages response ──────────────────────────────────────────────────────

export const NavPagesSchema = z.object({
    pages: z.array(NavPageSchema),
});
