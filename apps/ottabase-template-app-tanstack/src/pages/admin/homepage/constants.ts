/** Radix `<SelectItem />` must not use `value=""`; use this sentinel for "no icon" in selects only. */
export const HOMEPAGE_ICON_SELECT_NONE = '__none__' as const;

/** Matches Next.js `home-page-client` ICON_MAP keys (stored as null when no icon). */
export const HOMEPAGE_ICON_SLUGS = ['palette', 'github', 'rocket'] as const;

export function iconSlugToSelectValue(icon: string | null | undefined): string {
    const t = icon?.trim();
    if (!t) return HOMEPAGE_ICON_SELECT_NONE;
    if ((HOMEPAGE_ICON_SLUGS as readonly string[]).includes(t)) return t;
    return HOMEPAGE_ICON_SELECT_NONE;
}

export function selectValueToIconSlug(v: string): string | null {
    if (v === HOMEPAGE_ICON_SELECT_NONE) return null;
    return v;
}

export const HOMEPAGE_ACTION_VARIANT_OPTIONS = ['default', 'secondary', 'outline', 'ghost'] as const;
