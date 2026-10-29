// ============================================================
// @ottabase/auth - Locale and timezone defaults from a request
// ============================================================
// A new account should never start with a blank timezone or locale.
// Cloudflare tells us the zone (`request.cf.timezone`); the browser
// tells us the language (`Accept-Language`). Both are validated with
// Intl before they are stored.
// ============================================================

export interface RequestLocaleDefaults {
    timezone: string | null;
    locale: string | null;
}

function validTimezone(zone: unknown): string | null {
    if (typeof zone !== 'string' || !zone.trim()) return null;
    try {
        new Intl.DateTimeFormat('en', { timeZone: zone.trim() });
        return zone.trim();
    } catch {
        return null;
    }
}

/**
 * The best `Accept-Language` tag whose language is one the app ships (when `languages` is given),
 * canonicalised by Intl. `en-GB;q=0.8, fr` picks by quality, then order.
 */
export function pickLocaleFromAcceptLanguage(header: string | null, languages?: readonly string[]): string | null {
    if (!header) return null;
    const candidates = header
        .split(',')
        .map((part, index) => {
            const [tag, ...params] = part.trim().split(';');
            const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
            const quality = q ? Number(q.slice(2)) : 1;
            return { tag: tag.trim(), quality: Number.isFinite(quality) ? quality : 0, index };
        })
        .filter((c) => c.tag && c.tag !== '*' && c.quality > 0)
        .sort((a, b) => b.quality - a.quality || a.index - b.index);

    for (const candidate of candidates) {
        let canonical: string;
        try {
            canonical = Intl.getCanonicalLocales(candidate.tag)[0];
        } catch {
            continue;
        }
        if (!canonical) continue;
        const language = canonical.split('-')[0].toLowerCase();
        if (!languages || languages.includes(language)) return canonical;
    }
    return null;
}

/** Timezone from Cloudflare's request geolocation, locale from `Accept-Language`; null when unknown. */
export function requestLocaleDefaults(request: Request, languages?: readonly string[]): RequestLocaleDefaults {
    const cf = (request as Request & { cf?: { timezone?: unknown } }).cf;
    return {
        timezone: validTimezone(cf?.timezone),
        locale: pickLocaleFromAcceptLanguage(request.headers.get('accept-language'), languages),
    };
}
