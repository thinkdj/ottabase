// ============================================================
// Built-in Style Presets
// ============================================================
// Each preset defines prompt engineering and model parameters
// that produce a consistent, recognizable art style.
// ============================================================

import type { StyleConfig } from '../ottaorm-models/RecraftStylePreset';

export interface BuiltInPreset {
    name: string;
    slug: string;
    description: string;
    category: string;
    styleConfig: StyleConfig;
    thumbnailUrl?: string;
}

export const BUILT_IN_PRESETS: BuiltInPreset[] = [
    // ── Illustration Styles ─────────────────────────────────
    {
        name: 'Hand-Drawn Sketch',
        slug: 'hand-drawn',
        description: 'Authentic hand-drawn pencil sketch style with visible strokes and organic imperfections',
        category: 'illustration',
        styleConfig: {
            promptSuffix:
                'hand-drawn pencil sketch style, organic line work, visible pencil strokes, textured paper background, artistic imperfections, sketched illustration',
            negativePrompt: 'photorealistic, 3d render, smooth gradients, digital art, pixel art, blurry',
            guidanceScale: 7.5,
            steps: 30,
        },
    },
    {
        name: "Children's Book",
        slug: 'childrens-book',
        description: 'Whimsical, colorful illustration style inspired by classic children\'s picture books',
        category: 'illustration',
        styleConfig: {
            promptSuffix:
                "children's book illustration style, whimsical, soft colors, storybook art, gentle watercolor washes, rounded shapes, warm and inviting, picture book quality",
            negativePrompt: 'scary, dark, realistic, horror, violent, complex, detailed textures',
            guidanceScale: 7.0,
            steps: 28,
        },
    },
    {
        name: 'Retro Hand-Drawn',
        slug: 'retro-hand-drawn',
        description: 'Vintage hand-drawn style with retro color palettes and mid-century aesthetics',
        category: 'illustration',
        styleConfig: {
            promptSuffix:
                'retro hand-drawn illustration, vintage style, mid-century modern aesthetic, muted retro color palette, screen-printed look, 1950s-1960s advertising art style, textured',
            negativePrompt: 'modern, digital, neon colors, 3d, photorealistic, minimalist',
            guidanceScale: 7.5,
            steps: 30,
        },
    },
    {
        name: 'Watercolor',
        slug: 'watercolor',
        description: 'Soft watercolor painting with flowing pigments, gentle bleeds, and translucent washes',
        category: 'illustration',
        styleConfig: {
            promptSuffix:
                'watercolor painting style, soft flowing pigments, translucent washes, gentle color bleeds, wet-on-wet technique, watercolor paper texture, artistic and painterly',
            negativePrompt: 'sharp edges, digital, pixel art, 3d render, hard lines, photorealistic',
            guidanceScale: 7.0,
            steps: 28,
        },
    },
    {
        name: 'Flat Design',
        slug: 'flat-design',
        description: 'Clean, modern flat design with bold colors, geometric shapes, and minimal shadows',
        category: 'illustration',
        styleConfig: {
            promptSuffix:
                'flat design illustration, clean geometric shapes, bold solid colors, minimal shadows, modern vector style, simplified forms, no gradients, graphic design aesthetic',
            negativePrompt: 'realistic, 3d, textured, gradients, shadows, photographic, sketchy',
            guidanceScale: 8.0,
            steps: 25,
        },
    },
    {
        name: 'Line Art',
        slug: 'line-art',
        description: 'Clean, precise line art with consistent stroke weight and minimal color fills',
        category: 'illustration',
        styleConfig: {
            promptSuffix:
                'clean line art illustration, precise outlines, consistent stroke weight, minimal color fills, black ink lines on white background, technical illustration quality',
            negativePrompt: 'painted, textured, colorful, gradient, blurry, photorealistic, 3d',
            guidanceScale: 8.0,
            steps: 25,
        },
    },
    {
        name: 'Geometric Abstract',
        slug: 'geometric',
        description: 'Bold geometric shapes, abstract compositions, and vibrant color blocks',
        category: 'illustration',
        styleConfig: {
            promptSuffix:
                'geometric abstract art, bold shapes, vibrant color blocks, mathematical precision, Bauhaus-inspired, abstract composition, clean edges, modern art',
            negativePrompt: 'organic shapes, realistic, photographic, messy, hand-drawn, sketchy',
            guidanceScale: 8.5,
            steps: 25,
        },
    },
    {
        name: 'Vintage Engraved',
        slug: 'engraved',
        description: 'Classic engraved illustration style with fine cross-hatching and detailed linework',
        category: 'illustration',
        styleConfig: {
            promptSuffix:
                'vintage engraved illustration, fine cross-hatching, detailed linework, etching style, old-world craftsmanship, woodcut print aesthetic, monochrome or sepia tones',
            negativePrompt: 'colorful, modern, digital, flat design, cartoon, anime',
            guidanceScale: 7.5,
            steps: 35,
        },
    },
    {
        name: 'Pop Art',
        slug: 'pop-art',
        description: 'Bold pop art with Ben-Day dots, strong outlines, and vibrant contrasting colors',
        category: 'illustration',
        styleConfig: {
            promptSuffix:
                'pop art style, bold colors, Ben-Day dots, thick black outlines, comic book aesthetic, Andy Warhol inspired, high contrast, vibrant and energetic',
            negativePrompt: 'subtle, muted colors, realistic, watercolor, pastel, minimalist',
            guidanceScale: 8.0,
            steps: 28,
        },
    },
    {
        name: 'Isometric',
        slug: 'isometric',
        description: 'Clean isometric 3D illustration style with precise angles and vibrant colors',
        category: 'illustration',
        styleConfig: {
            promptSuffix:
                'isometric illustration, 30-degree angle, clean 3D perspective, vibrant flat colors, technical precision, modern infographic style, crisp edges',
            negativePrompt: 'perspective distortion, realistic, messy, hand-drawn, blurry, photographic',
            guidanceScale: 8.0,
            steps: 28,
        },
    },
    {
        name: 'Minimalist',
        slug: 'minimalist',
        description: 'Ultra-clean minimalist design with maximum negative space and essential forms only',
        category: 'illustration',
        styleConfig: {
            promptSuffix:
                'minimalist design, maximum negative space, essential forms only, simple and clean, reduced palette, elegant simplicity, modern minimal aesthetic',
            negativePrompt: 'complex, busy, detailed, textured, ornate, colorful, realistic',
            guidanceScale: 8.5,
            steps: 25,
        },
    },
    {
        name: 'Sticker Art',
        slug: 'sticker',
        description: 'Fun sticker-style illustrations with thick outlines, vibrant fills, and die-cut edges',
        category: 'illustration',
        styleConfig: {
            promptSuffix:
                'sticker art style, thick outlines, vibrant color fills, die-cut edge look, fun and playful, slightly raised 3D effect, white border, kawaii influence',
            negativePrompt: 'realistic, dark, scary, complex, muted colors, photographic',
            guidanceScale: 7.5,
            steps: 25,
        },
    },

    // ── Logo Styles ─────────────────────────────────────────
    {
        name: 'Modern Logo',
        slug: 'modern-logo',
        description: 'Clean, contemporary logo design with bold typography and geometric marks',
        category: 'logo',
        styleConfig: {
            promptSuffix:
                'modern logo design, clean typography, geometric mark, professional branding, simple and memorable, vector quality, on white background, corporate identity',
            negativePrompt: 'complex, busy, photorealistic, hand-drawn, vintage, multiple colors, gradient',
            guidanceScale: 8.5,
            steps: 30,
        },
    },
    {
        name: 'Vintage Badge',
        slug: 'vintage-badge',
        description: 'Retro badge-style logos with ornate frames, ribbon banners, and aged textures',
        category: 'logo',
        styleConfig: {
            promptSuffix:
                'vintage badge logo, retro emblem design, ornate frame, ribbon banner, aged texture, classic typography, heritage brand aesthetic, stamp-like quality',
            negativePrompt: 'modern, minimalist, flat, digital, neon, futuristic',
            guidanceScale: 7.5,
            steps: 30,
        },
    },
    {
        name: 'Wordmark',
        slug: 'wordmark',
        description: 'Typography-focused logo with custom lettering and distinctive character',
        category: 'logo',
        styleConfig: {
            promptSuffix:
                'wordmark logo design, custom typography, distinctive lettering, text-based logo, clean professional typeface, brand name as the logo, on white background',
            negativePrompt: 'icon, symbol, illustration, complex, photorealistic, busy background',
            guidanceScale: 8.5,
            steps: 30,
        },
    },

    // ── Icon Styles ─────────────────────────────────────────
    {
        name: 'Glyph Icons',
        slug: 'glyph-icons',
        description: 'Clean filled icons with consistent weight, perfect for app and UI use',
        category: 'icon',
        styleConfig: {
            promptSuffix:
                'clean glyph icon, solid fill, consistent weight, app icon style, simple recognizable shape, single color, UI/UX icon design, on transparent background',
            negativePrompt: 'detailed, realistic, complex, multi-color, 3d, photographic, text',
            guidanceScale: 9.0,
            steps: 25,
        },
    },
    {
        name: 'Outlined Icons',
        slug: 'outlined-icons',
        description: 'Consistent outlined icons with uniform stroke weight for interface design',
        category: 'icon',
        styleConfig: {
            promptSuffix:
                'outlined icon, consistent stroke weight, clean lines, no fill, interface icon design, simple and clear, uniform line thickness, on white background',
            negativePrompt: 'filled, solid, colorful, detailed, realistic, complex, text',
            guidanceScale: 9.0,
            steps: 25,
        },
    },

    // ── Pattern Styles ──────────────────────────────────────
    {
        name: 'Seamless Pattern',
        slug: 'seamless-pattern',
        description: 'Tileable seamless patterns perfect for backgrounds and textile designs',
        category: 'pattern',
        styleConfig: {
            promptSuffix:
                'seamless repeating pattern, tileable design, consistent spacing, decorative motif, surface pattern design, textile quality, repeating elements',
            negativePrompt: 'non-repeating, asymmetric, photorealistic, 3d, text, logo',
            guidanceScale: 7.5,
            steps: 30,
        },
    },
    {
        name: 'Botanical Pattern',
        slug: 'botanical-pattern',
        description: 'Elegant botanical patterns with hand-drawn florals and organic leaf motifs',
        category: 'pattern',
        styleConfig: {
            promptSuffix:
                'botanical pattern, hand-drawn florals, organic leaves and stems, elegant plant motifs, surface pattern design, natural color palette, repeating botanical elements',
            negativePrompt: 'geometric, digital, neon, abstract, photorealistic, 3d',
            guidanceScale: 7.0,
            steps: 30,
        },
    },
];

/** Get a built-in preset by slug */
export function getBuiltInPreset(slug: string): BuiltInPreset | undefined {
    return BUILT_IN_PRESETS.find((p) => p.slug === slug);
}

/** Get all preset slugs */
export function getPresetSlugs(): string[] {
    return BUILT_IN_PRESETS.map((p) => p.slug);
}

/** Get presets grouped by category */
export function getPresetsByCategory(): Record<string, BuiltInPreset[]> {
    const grouped: Record<string, BuiltInPreset[]> = {};
    for (const preset of BUILT_IN_PRESETS) {
        if (!grouped[preset.category]) grouped[preset.category] = [];
        grouped[preset.category].push(preset);
    }
    return grouped;
}
