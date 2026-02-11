// ---------------------------------------------------------------------------
// Brand Engine – Google Fonts metadata and utilities
// Curated list for admin font picker. Same categories as theme typography.
// ---------------------------------------------------------------------------

export interface GoogleFontMeta {
    family: string;
    /** Suggested weights for heading (bold), body (regular), or handwriting */
    category: 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';
    weights: number[];
}

/** Curated Google Fonts. Used by built-in themes: Inter, Outfit, Caveat, Playfair Display, etc. */
export const GOOGLE_FONTS: GoogleFontMeta[] = [
    // Sans-serif (body, headings)
    { family: 'Inter', category: 'sans-serif', weights: [300, 400, 500, 600, 700] },
    { family: 'Outfit', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },
    { family: 'Plus Jakarta Sans', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },
    { family: 'DM Sans', category: 'sans-serif', weights: [400, 500, 700] },
    { family: 'Space Grotesk', category: 'sans-serif', weights: [300, 400, 500, 600, 700] },
    { family: 'Manrope', category: 'sans-serif', weights: [400, 500, 600, 700] },
    { family: 'Nunito Sans', category: 'sans-serif', weights: [400, 600, 700] },
    { family: 'Work Sans', category: 'sans-serif', weights: [400, 500, 600, 700] },
    { family: 'Source Sans 3', category: 'sans-serif', weights: [400, 500, 600, 700] },
    { family: 'Open Sans', category: 'sans-serif', weights: [400, 600, 700] },
    { family: 'Lato', category: 'sans-serif', weights: [400, 700] },
    { family: 'Poppins', category: 'sans-serif', weights: [400, 500, 600, 700] },
    { family: 'Montserrat', category: 'sans-serif', weights: [400, 500, 600, 700] },
    { family: 'Raleway', category: 'sans-serif', weights: [400, 500, 600, 700] },
    { family: 'Roboto', category: 'sans-serif', weights: [400, 500, 700] },
    { family: 'Lexend', category: 'sans-serif', weights: [400, 500, 600, 700] },
    { family: 'Sora', category: 'sans-serif', weights: [400, 500, 600, 700] },
    { family: 'Figtree', category: 'sans-serif', weights: [400, 500, 600, 700] },
    // Serif (headings, body)
    { family: 'Playfair Display', category: 'serif', weights: [400, 500, 600, 700] },
    { family: 'Merriweather', category: 'serif', weights: [400, 700] },
    { family: 'Lora', category: 'serif', weights: [400, 600, 700] },
    { family: 'Source Serif 4', category: 'serif', weights: [400, 600, 700] },
    { family: 'Libre Baskerville', category: 'serif', weights: [400, 700] },
    { family: 'Crimson Text', category: 'serif', weights: [400, 600, 700] },
    { family: 'EB Garamond', category: 'serif', weights: [400, 500, 600, 700] },
    // Display (headings)
    { family: 'Bebas Neue', category: 'display', weights: [400] },
    { family: 'Oswald', category: 'display', weights: [400, 500, 600, 700] },
    { family: 'Bitter', category: 'display', weights: [400, 600, 700] },
    { family: 'Archivo Black', category: 'display', weights: [400] },
    // Handwriting
    { family: 'Caveat', category: 'handwriting', weights: [400, 500, 600, 700] },
    { family: 'Dancing Script', category: 'handwriting', weights: [400, 700] },
    { family: 'Pacifico', category: 'handwriting', weights: [400] },
    { family: 'Satisfy', category: 'handwriting', weights: [400] },
    { family: 'Great Vibes', category: 'handwriting', weights: [400] },
    { family: 'Amatic SC', category: 'handwriting', weights: [400, 700] },
    { family: 'Kalam', category: 'handwriting', weights: [400, 700] },
    { family: 'Patrick Hand', category: 'handwriting', weights: [400] },
    // Monospace (optional for code)
    { family: 'JetBrains Mono', category: 'monospace', weights: [400, 500, 600, 700] },
    { family: 'Fira Code', category: 'monospace', weights: [400, 500, 600, 700] },
    { family: 'Source Code Pro', category: 'monospace', weights: [400, 500, 600, 700] },
];

/** Build Google Fonts URL for a single font family and weights */
export function buildGoogleFontUrl(fontFamily: string, weights: number[] = [400, 500, 600, 700]): string {
    const encoded = `family=${encodeURIComponent(fontFamily)}:wght@${weights.join(';')}`;
    return `https://fonts.googleapis.com/css2?${encoded}&display=swap`;
}

/** Get typography object for a font (fontFamily + url) */
export function fontToTypography(fontFamily: string, role?: 'heading' | 'body' | 'handwriting') {
    const meta = GOOGLE_FONTS.find((f) => f.family === fontFamily);
    const weights = meta?.weights ?? [400, 500, 600, 700];
    if (role === 'heading') {
        const w = weights.filter((x) => x >= 600).length ? weights.filter((x) => x >= 600) : [600, 700];
        return { fontFamily, url: buildGoogleFontUrl(fontFamily, w) };
    }
    if (role === 'handwriting') {
        return { fontFamily, url: buildGoogleFontUrl(fontFamily, [400, 700]) };
    }
    return { fontFamily, url: buildGoogleFontUrl(fontFamily, weights.slice(0, 4)) };
}
