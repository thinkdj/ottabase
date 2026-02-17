/**
 * Calculates the relative luminance of a color.
 * Based on WCAG 2.0 formula: https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
const getLuminance = (r: number, g: number, b: number): number => {
    const a = [r, g, b].map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
};

/**
 * Parses a hex color string into RGB values.
 */
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16),
          }
        : null;
};

/**
 * Calculates the contrast ratio between two colors (hex).
 * Returns a value between 1 and 21.
 */
export function calculateContrastRatio(foreground: string, background: string): number {
    const fg = hexToRgb(foreground);
    const bg = hexToRgb(background);

    if (!fg || !bg) return 1;

    const l1 = getLuminance(fg.r, fg.g, fg.b);
    const l2 = getLuminance(bg.r, bg.g, bg.b);

    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Converts HSL to Hex
 */
function hslToHex(h: number, s: number, l: number): string {
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
 * Generates a full tailwind-like color palette (50-950) from a single base color (HSL).
 * Logic approximates generating lighter and darker shades by adjusting lightness.
 */
export function generatePalette(baseH: number, baseS: number, baseL: number): Record<number, string> {
    // This is a naive implementation. For production-grade palette generation,
    // curve interpolation is often better, but this suffices for a starting point.

    // We anchor the base color around 500 (standard).
    // 50  = L 95
    // 500 = Base L
    // 950 = L 5

    const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
    const palette: Record<number, string> = {};

    steps.forEach((step) => {
        let l = baseL;
        if (step < 500) {
            // Lighten
            const factor = (500 - step) / 500; // 0 to 1
            l = baseL + (98 - baseL) * factor; // interpolate towards 98 (near white)
        } else if (step > 500) {
            // Darken
            const factor = (step - 500) / 450; // 0 to 1
            l = baseL - (baseL - 5) * factor; // interpolate towards 5 (near black)
        }

        // Slight saturation boost for lighter/darker shades makes them look more vibrant
        // (optional aesthetic tweak)
        const s = baseS;

        palette[step] = hslToHex(baseH, s, l);
    });

    return palette;
}

/**
 * Converts Hex to HSL
 */
export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;

    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    let l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }
        h /= 6;
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
    };
}

export type SemanticPalette = {
    background: string;
    foreground: string;
    primary: string;
    'primary-foreground': string;
    secondary: string;
    'secondary-foreground': string;
    muted: string;
    'muted-foreground': string;
    accent: string;
    'accent-foreground': string;
    destructive: string;
    'destructive-foreground': string;
    border: string;
    input: string;
    ring: string;
};

/**
 * Generates a starting set of semantic tokens for a LIGHT theme based on a primary brand color.
 * Returns values in "H S% L%" format ready for CSS variables.
 */
export function generateSemanticDefaults(h: number, s: number, l: number): SemanticPalette {
    // Helper to format HSL string
    const f = (h: number, s: number, l: number) => `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;

    // Standard neutrals for light mode
    const background = f(0, 0, 100);
    const foreground = f(222, 47, 11); // Slate-900 like

    // Primary - use input
    const primary = f(h, s, l);
    // Primary foreground - white if primary is dark, black if primary is light
    // Simple logic: if L < 60, use white text
    const primaryForeground = l < 60 ? f(0, 0, 100) : f(0, 0, 0);

    // Secondary - desaturated/lighter version of primary
    const secondary = f(h, 20, 96);
    const secondaryForeground = f(h, 70, 20);

    // Muted - Neutral gray
    const muted = f(210, 40, 96);
    const mutedForeground = f(215, 16, 47);

    // Accent - Similar to secondary but often for hovers
    const accent = f(h, 20, 96);
    const accentForeground = f(h, 70, 20);

    // Destructive - Standard Red
    const destructive = f(0, 84, 60);
    const destructiveForeground = f(0, 0, 98);

    // Borders
    const border = f(214, 32, 91);
    const input = f(214, 32, 91);

    // Ring - usually same as primary or watered down
    const ring = f(h, s, l);

    return {
        background,
        foreground,
        primary,
        'primary-foreground': primaryForeground,
        secondary,
        'secondary-foreground': secondaryForeground,
        muted,
        'muted-foreground': mutedForeground,
        accent,
        'accent-foreground': accentForeground,
        destructive,
        'destructive-foreground': destructiveForeground,
        border,
        input,
        ring,
    };
}

/**
 * Generates dark-mode semantic tokens from a primary brand color (HSL).
 * Pairs with generateSemanticDefaults for light/dark theme creation.
 */
export function generateSemanticDefaultsDark(h: number, s: number, l: number): SemanticPalette {
    const f = (hVal: number, sVal: number, lVal: number) =>
        `${Math.round(hVal)} ${Math.round(sVal)}% ${Math.round(lVal)}%`;

    const background = f(224, 71, 4);
    const foreground = f(213, 31, 91);
    const primary = f(h, Math.min(s + 5, 100), Math.min(l + 10, 70));
    const primaryForeground = f(224, 71, 4);
    const secondary = f(222, 47, 11);
    const secondaryForeground = f(213, 31, 91);
    const muted = f(223, 47, 11);
    const mutedForeground = f(215, 20, 65);
    const accent = f(h, s, l);
    const accentForeground = f(213, 31, 91);
    const destructive = f(0, 62, 35);
    const destructiveForeground = f(213, 31, 91);
    const border = f(216, 34, 12);
    const input = f(216, 34, 12);
    const ring = f(h, s, Math.min(l + 5, 70));

    return {
        background,
        foreground,
        primary,
        'primary-foreground': primaryForeground,
        secondary,
        'secondary-foreground': secondaryForeground,
        muted,
        'muted-foreground': mutedForeground,
        accent,
        'accent-foreground': accentForeground,
        destructive,
        'destructive-foreground': destructiveForeground,
        border,
        input,
        ring,
    };
}

/** Build full tokensJson (color.light + color.dark) for theme variant from base HSL */
export function buildTokensFromBaseColor(
    h: number,
    s: number,
    l: number,
): { color: { light: SemanticPalette; dark: SemanticPalette; [scheme: string]: SemanticPalette | undefined } } {
    return {
        color: {
            light: generateSemanticDefaults(h, s, l),
            dark: generateSemanticDefaultsDark(h, s, l),
        },
    };
}
