import { z } from 'zod';

/** Single nav / footer link */
export const homepageNavLinkSchema = z.object({
    href: z.string().min(1),
    label: z.string().min(1),
    external: z.boolean().optional(),
});

export type HomepageNavLink = z.infer<typeof homepageNavLinkSchema>;

/** Navbar slot (maps to NavbarData) */
export const homepageNavbarContentSchema = z.object({
    title: z.string().min(1),
    githubUrl: z.string().optional(),
    links: z.array(homepageNavLinkSchema).default([]),
});

export type HomepageNavbarContent = z.infer<typeof homepageNavbarContentSchema>;

/** Footer slot */
export const homepageFooterContentSchema = z.object({
    siteName: z.string().min(1),
    tagline: z.string().optional(),
    links: z.array(homepageNavLinkSchema).default([]),
});

export type HomepageFooterContent = z.infer<typeof homepageFooterContentSchema>;

const actionVariantSchema = z.enum(['default', 'secondary', 'outline', 'ghost']);

/** Hero / CTA action row */
export const homepageActionSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    href: z.string().min(1),
    variant: actionVariantSchema.default('default'),
    icon: z.string().nullable().optional(),
    isExternal: z.boolean().default(false),
});

export type HomepageAction = z.infer<typeof homepageActionSchema>;

export const homepageHeroContentSchema = z.object({
    title: z.string().min(1),
    subtitle: z.string().optional(),
    body: z.string().optional(),
    actions: z.array(homepageActionSchema).default([]),
});

export type HomepageHeroContent = z.infer<typeof homepageHeroContentSchema>;

/** One feature row (title + description) */
export const homepageFeatureItemSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    icon: z.string().nullable().optional(),
});

export type HomepageFeatureItem = z.infer<typeof homepageFeatureItemSchema>;

export const homepageFeaturesContentSchema = z.object({
    title: z.string().optional(),
    items: z.array(homepageFeatureItemSchema).default([]),
});

export type HomepageFeaturesContent = z.infer<typeof homepageFeaturesContentSchema>;

export const homepageCtaContentSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    actions: z.array(homepageActionSchema).default([]),
});

export type HomepageCtaContent = z.infer<typeof homepageCtaContentSchema>;

export const homepageAboutContentSchema = z.object({
    title: z.string().optional(),
    body: z.string().optional(),
});

export type HomepageAboutContent = z.infer<typeof homepageAboutContentSchema>;

/** Published Ottablog `page` posts flagged “expose to homepage” (navbar links on Next.js). */
export const homepageExposedPageSchema = z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
});

export type HomepageExposedPage = z.infer<typeof homepageExposedPageSchema>;

export const homepageSlotNames = ['navbar', 'hero', 'features', 'cta', 'footer', 'about'] as const;

export type HomepageSlotName = (typeof homepageSlotNames)[number];

/** Variant id per slot (matches Next.js HomepageConfig) */
export const homepageVariantBySlotSchema = z.record(z.string(), z.string());

export const homepagePublicPayloadSlotsSchema = z.object({
    navbar: homepageNavbarContentSchema,
    hero: homepageHeroContentSchema,
    features: homepageFeaturesContentSchema,
    cta: homepageCtaContentSchema,
    footer: homepageFooterContentSchema,
    about: homepageAboutContentSchema,
});

/** Full public API contract (GET /api/homepage/data) — version 1 */
export const homepagePublicPayloadV1Schema = z.object({
    version: z.literal(1),
    themePresetId: z.string().min(1),
    variantBySlot: homepageVariantBySlotSchema,
    slots: homepagePublicPayloadSlotsSchema,
    exposedPages: z.array(homepageExposedPageSchema).default([]),
});

export type HomepagePublicPayloadV1 = z.infer<typeof homepagePublicPayloadV1Schema>;

/** Loose JSON for navbar/footer stored in `homepage_sections.content_json` */
export const homepageNavbarContentJsonSchema = homepageNavbarContentSchema;
export const homepageFooterContentJsonSchema = homepageFooterContentSchema;
