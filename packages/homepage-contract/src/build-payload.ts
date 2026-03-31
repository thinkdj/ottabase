import {
    homepageAboutContentSchema,
    homepageCtaContentSchema,
    homepageFeaturesContentSchema,
    homepageFooterContentJsonSchema,
    homepageHeroContentSchema,
    homepageNavbarContentJsonSchema,
    homepagePublicPayloadV1Schema,
    type HomepageAboutContent,
    type HomepageCtaContent,
    type HomepageFeaturesContent,
    type HomepageFooterContent,
    type HomepageHeroContent,
    type HomepageNavbarContent,
    type HomepageExposedPage,
    type HomepagePublicPayloadV1,
} from './schemas';

/** Raw section shape from worker (before public payload) */
export type HomepageDbSectionInput = {
    id: string;
    slot: string;
    title?: string | null;
    subtitle?: string | null;
    description?: string | null;
    body?: string | null;
    contentJson?: unknown;
    isActive?: boolean | null;
    features: HomepageDbFeatureInput[];
    actions: HomepageDbActionInput[];
};

export type HomepageDbFeatureInput = {
    id: string;
    title: string;
    description: string;
    icon?: string | null;
    sortOrder?: number | null;
};

export type HomepageDbActionInput = {
    id: string;
    label: string;
    href: string;
    variant?: string | null;
    icon?: string | null;
    isExternal?: boolean | null;
    sortOrder?: number | null;
};

export type HomepageDbDisplayInput = {
    themePresetId: string;
    variantBySlotJson: Record<string, string>;
} | null;

const DEFAULT_VARIANT_BY_SLOT: Record<string, string> = {
    navbar: 'default',
    hero: 'centered',
    features: 'grid',
    cta: 'default',
    footer: 'default',
    about: 'default',
};

function sortByOrder<T extends { sortOrder?: number | null }>(rows: T[]): T[] {
    return [...rows].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function parseVariant(v: string | null | undefined): 'default' | 'secondary' | 'outline' | 'ghost' {
    if (v === 'secondary' || v === 'outline' || v === 'ghost') return v;
    return 'default';
}

function buildNavbar(section: HomepageDbSectionInput | undefined): HomepageNavbarContent {
    const raw = section?.contentJson;
    const parsed = homepageNavbarContentJsonSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    return homepageNavbarContentJsonSchema.parse({
        title: typeof section?.title === 'string' && section.title ? section.title : 'Ottabase',
        githubUrl: '',
        links: [],
    });
}

function buildFooter(section: HomepageDbSectionInput | undefined): HomepageFooterContent {
    const raw = section?.contentJson;
    const parsed = homepageFooterContentJsonSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    return homepageFooterContentJsonSchema.parse({
        siteName: typeof section?.title === 'string' && section.title ? section.title : 'Ottabase',
        tagline: section?.description ?? '',
        links: [],
    });
}

function buildHero(section: HomepageDbSectionInput | undefined): HomepageHeroContent {
    const actions = sortByOrder(section?.actions ?? []).map((a) => ({
        id: a.id,
        label: a.label,
        href: a.href,
        variant: parseVariant(a.variant ?? undefined),
        icon: a.icon ?? null,
        isExternal: Boolean(a.isExternal),
    }));
    return homepageHeroContentSchema.parse({
        title: section?.title?.trim() || 'Ottabase',
        subtitle: section?.subtitle ?? undefined,
        body: section?.body ?? undefined,
        actions,
    });
}

function buildFeatures(section: HomepageDbSectionInput | undefined): HomepageFeaturesContent {
    const items = sortByOrder(section?.features ?? []).map((f) => ({
        id: f.id,
        title: f.title,
        description: f.description,
        icon: f.icon ?? null,
    }));
    return homepageFeaturesContentSchema.parse({
        title: section?.title ?? undefined,
        items,
    });
}

function buildCta(section: HomepageDbSectionInput | undefined): HomepageCtaContent {
    const actions = sortByOrder(section?.actions ?? []).map((a) => ({
        id: a.id,
        label: a.label,
        href: a.href,
        variant: parseVariant(a.variant ?? undefined),
        icon: a.icon ?? null,
        isExternal: Boolean(a.isExternal),
    }));
    return homepageCtaContentSchema.parse({
        title: section?.title?.trim() || 'CTA',
        description: section?.description ?? undefined,
        actions,
    });
}

function buildAbout(section: HomepageDbSectionInput | undefined): HomepageAboutContent {
    return homepageAboutContentSchema.parse({
        title: section?.title ?? undefined,
        body: section?.body ?? undefined,
    });
}

export type BuildHomepagePublicPayloadV1Options = {
    /** Ottablog marketing pages to append as nav links on the Next.js homepage */
    exposedPages?: HomepageExposedPage[];
};

/**
 * Build the version-1 public payload from normalized DB rows (worker GET /api/homepage/data).
 */
export function buildHomepagePublicPayloadV1(
    sections: HomepageDbSectionInput[],
    display: HomepageDbDisplayInput,
    fallbackThemePresetId: string,
    options?: BuildHomepagePublicPayloadV1Options,
): HomepagePublicPayloadV1 {
    const active = sections.filter((s) => s.isActive !== false);
    const bySlot = (slot: string) => active.find((s) => s.slot === slot);

    const variantBySlot = {
        ...DEFAULT_VARIANT_BY_SLOT,
        ...(display?.variantBySlotJson ?? {}),
    };

    const themePresetId = (display?.themePresetId?.trim() || fallbackThemePresetId).toLowerCase();

    const slots = {
        navbar: buildNavbar(bySlot('navbar')),
        hero: buildHero(bySlot('hero')),
        features: buildFeatures(bySlot('features')),
        cta: buildCta(bySlot('cta')),
        footer: buildFooter(bySlot('footer')),
        about: buildAbout(bySlot('about')),
    };

    return homepagePublicPayloadV1Schema.parse({
        version: 1,
        themePresetId,
        variantBySlot,
        slots,
        exposedPages: options?.exposedPages ?? [],
    });
}
