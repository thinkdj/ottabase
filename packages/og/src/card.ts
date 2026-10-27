// ============================================================
// @ottabase/og — the card
// ============================================================
// What a social image says, as plain fields. The same card travels three ways: as the query
// string of the image URL, as the input of the HTML template, and as the cache key of the
// rendered PNG. Every field is bounded here so a URL anyone can type never becomes a page of
// arbitrary size.
// ============================================================

/** Open Graph's size; Twitter, LinkedIn and Slack read the same image. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

export interface OgCard {
    title: string;
    subtitle?: string;
    /** The small line above the title: "Blog", "Changelog", a category. */
    eyebrow?: string;
    siteName?: string;
    /** Shown in the footer, e.g. `acme.dev`. */
    domain?: string;
    author?: string;
    /** Already formatted for display. */
    date?: string;
    /** `#rrggbb`: the brand color behind the eyebrow and the top band. */
    accent?: string;
    /** `#rrggbb`: the card's background, when the theme's own is not wanted. */
    background?: string;
    /** An https image drawn behind the text, darkened so the text stays readable. */
    imageUrl?: string;
    /** An https image for the footer. */
    logoUrl?: string;
    theme?: 'light' | 'dark';
}

/** Longest value accepted per field, in characters. */
export const CARD_LIMITS: Record<keyof OgCard, number> = {
    title: 200,
    subtitle: 300,
    eyebrow: 60,
    siteName: 80,
    domain: 100,
    author: 80,
    date: 40,
    accent: 7,
    background: 7,
    imageUrl: 1_000,
    logoUrl: 1_000,
    theme: 5,
};

/** The fields, in the one order every canonical form uses. */
export const CARD_FIELDS = Object.keys(CARD_LIMITS) as (keyof OgCard)[];

const COLOR = /^#[0-9a-f]{6}$/i;

export const isColor = (value: string): boolean => COLOR.test(value);

/** An absolute http(s) URL, else null: a `javascript:` or data URL never reaches the page. */
export function httpUrl(value: string | undefined): string | null {
    if (!value) return null;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch {
        return null;
    }
}

/** A card from a query string, or the first thing wrong with it. Unknown keys are ignored. */
export function cardFromParams(params: URLSearchParams): { card: OgCard } | { error: string } {
    const card: Partial<OgCard> = {};
    for (const field of CARD_FIELDS) {
        const value = params.get(field)?.trim();
        if (!value) continue;
        if (value.length > CARD_LIMITS[field])
            return { error: `${field} is longer than ${CARD_LIMITS[field]} characters` };
        if ((field === 'accent' || field === 'background') && !isColor(value))
            return { error: `${field} must be #rrggbb` };
        if ((field === 'imageUrl' || field === 'logoUrl') && !httpUrl(value))
            return { error: `${field} must be an http(s) URL` };
        if (field === 'theme' && value !== 'light' && value !== 'dark') return { error: 'theme must be light or dark' };
        (card as Record<string, string>)[field] = value;
    }
    if (!card.title) return { error: 'title is required' };
    return { card: card as OgCard };
}

/** The card as query parameters, fields in canonical order, empty ones left out. */
export function cardParams(card: Partial<OgCard>): URLSearchParams {
    const params = new URLSearchParams();
    for (const field of CARD_FIELDS) {
        const value = card[field];
        if (value) params.set(field, value);
    }
    return params;
}

/** The card's canonical string: what is signed and what is hashed. */
export const canonicalCard = (card: Partial<OgCard>): string => cardParams(card).toString();

const hex = (bytes: ArrayBuffer) =>
    Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');

/** A stable id for the rendered image: the card and the template version, hashed. */
export async function cardId(card: OgCard, version: string): Promise<string> {
    const bytes = new TextEncoder().encode(`${version}\n${canonicalCard(card)}`);
    return hex(await crypto.subtle.digest('SHA-256', bytes));
}
