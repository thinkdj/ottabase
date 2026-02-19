// ---------------------------------------------------------------------------
// Brand Engine – Email branding
// Replaces placeholders in email HTML with brand values.
// ---------------------------------------------------------------------------

import type { ResolvedBrandConfig } from '../persistence/types';

/** Converts "221.2 83.2% 53.3%" HSL string to #hex */
function hslStringToHex(hsl: string): string {
    const match = /^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/.exec(hsl.trim());
    if (!match) return '#3b82f6'; // fallback blue
    const h = parseFloat(match[1]);
    const s = parseFloat(match[2]);
    let l = parseFloat(match[3]);

    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color)
            .toString(16)
            .padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Applies brand config to email HTML by replacing placeholders.
 *
 * Placeholders:
 * - `{{brandName}}` – brand display name
 * - `{{tagline}}` – optional tagline
 * - `{{logoUrl}}` – logo URL (email-logo or primary)
 * - `{{iconUrl}}` – icon/favicon URL
 * - `{{ogImageUrl}}` – OG image URL
 * - `{{primaryColor}}` – primary color as HSL (e.g. for CSS)
 * - `{{primaryColorHex}}` – primary color as hex (e.g. #3b82f6)
 *
 * @example
 * ```ts
 * const html = '<img src="{{logoUrl}}" /> <h1>{{brandName}}</h1>';
 * const branded = applyBrandToEmail(html, config);
 * ```
 */
export function applyBrandToEmail(html: string, config: ResolvedBrandConfig): string {
    const logoUrl = config.logos?.emailLogo ?? config.logos?.primary ?? '';
    const iconUrl = config.logos?.icon ?? config.logos?.primary ?? '';
    const ogImageUrl = config.logos?.ogImage ?? config.logos?.primary ?? '';
    const primaryHsl = config.theme?.colors?.primary ?? '221.2 83.2% 53.3%';
    const primaryHex = hslStringToHex(primaryHsl);

    let out = html;
    out = out.replace(/\{\{brandName\}\}/g, config.brandName ?? 'My App');
    out = out.replace(/\{\{tagline\}\}/g, config.tagline ?? '');
    out = out.replace(/\{\{logoUrl\}\}/g, logoUrl);
    out = out.replace(/\{\{iconUrl\}\}/g, iconUrl);
    out = out.replace(/\{\{ogImageUrl\}\}/g, ogImageUrl);
    out = out.replace(/\{\{primaryColor\}\}/g, primaryHsl);
    out = out.replace(/\{\{primaryColorHex\}\}/g, primaryHex);

    return out;
}
