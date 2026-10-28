// ============================================================
// brandFromTheme: the brand block, read off the Brand Engine theme the app already runs on
// ============================================================
// An Ottabase app has its colours and its type in one place, the theme. The brand block of
// otta.json should come from there, not be typed a second time. The theme keeps colours as
// HSL channels ("221.2 83.2% 53.3%") and fonts as CSS families; the brand block wants #rrggbb
// and a family name. Structural types only: the engine itself is not imported, so this file
// costs nothing to an app that does not use it.
// ============================================================

import type { Brand } from '@ottabase/context';

interface Typography {
    fontFamily?: string;
}
/** A value, or the same value per colour scheme (Brand Engine's ModeValue). */
type Mode<T> = T | { light?: T; dark?: T; [scheme: string]: T | undefined };

export interface ThemeLike {
    tokens: {
        color?: Mode<Partial<Record<'primary' | 'secondary' | 'background' | 'foreground', string>>>;
        typography?: Mode<Record<string, Typography | undefined>>;
    };
}

/** The light side of a ModeValue, or the value itself when it is not split. */
const light = <T>(v: Mode<T> | undefined): T | undefined => {
    if (!v || typeof v !== 'object') return v as T | undefined;
    const o = v as { light?: T; dark?: T };
    return 'light' in o || 'dark' in o ? o.light : (v as T);
};

/** HSL channels, "221.2 83.2% 53.3%" or "hsl(221 83% 53%)", or a #rrggbb that is already one, as #rrggbb. '' for
 *  anything else (a CSS variable, a named colour). */
export function cssColorToHex(value: string | undefined): string {
    if (!value) return '';
    const s = value.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(s)) return s;
    const m = /^(?:hsla?\()?\s*(-?[\d.]+)(?:deg)?[\s,]+(-?[\d.]+)%[\s,]+(-?[\d.]+)%/.exec(s);
    if (!m) return '';
    const h = ((Number(m[1]) % 360) + 360) % 360;
    const sat = Math.min(100, Math.max(0, Number(m[2]))) / 100;
    const lig = Math.min(100, Math.max(0, Number(m[3]))) / 100;
    const c = (1 - Math.abs(2 * lig - 1)) * sat;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const mm = lig - c / 2;
    const [r, g, b] =
        h < 60
            ? [c, x, 0]
            : h < 120
              ? [x, c, 0]
              : h < 180
                ? [0, c, x]
                : h < 240
                  ? [0, x, c]
                  : h < 300
                    ? [x, 0, c]
                    : [c, 0, x];
    const hex = (n: number) =>
        Math.round((n + mm) * 255)
            .toString(16)
            .padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** The first family of a CSS font stack, unquoted: 'Inter, system-ui, sans-serif' is Inter. '' for a generic. */
export function fontFamilyName(stack: string | undefined): string {
    const first =
        (stack ?? '')
            .split(',')[0]
            ?.trim()
            .replace(/^["']|["']$/g, '') ?? '';
    return /^(serif|sans-serif|monospace|system-ui|ui-sans-serif|ui-serif|ui-monospace|cursive|fantasy|inherit)$/i.test(
        first,
    )
        ? ''
        : first;
}

/** The brand block from a theme, with the marks the theme does not know given by hand. Only what the theme has. */
export function brandFromTheme(
    theme: ThemeLike,
    marks: Pick<Brand, 'logo' | 'logoDark' | 'wordmark' | 'icon' | 'naming' | 'pronounce'> = {},
): Brand {
    const colors = light(theme.tokens.color) ?? {};
    const type = light(theme.tokens.typography) ?? {};
    const out: Brand = { ...marks };
    const set = (k: keyof Brand, v: string) => {
        if (v) out[k] = v;
    };
    set('primary', cssColorToHex(colors.primary));
    set('secondary', cssColorToHex(colors.secondary));
    set('background', cssColorToHex(colors.background));
    set('foreground', cssColorToHex(colors.foreground));
    set('fontHeading', fontFamilyName(type.heading?.fontFamily));
    set('fontBody', fontFamilyName(type.body?.fontFamily));
    return out;
}
