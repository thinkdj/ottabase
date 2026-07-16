// ---------------------------------------------------------------------------
// Brand Engine – Effect & Keyframe registries
//
// Reusable CSS building blocks referenced from theme tokens by `registry:key`
// (same grammar as the cursor registry). Registry entries are code, shipped
// with the engine; themes reference them from JSON so artwork/recipes can be
// tuned centrally without editing every theme.
//
//   • EFFECT_REGISTRY  – declaration blocks for `effects.utilities`
//                        ("scanlines", "noise", …) → generated `.{class} { … }`
//   • KEYFRAME_REGISTRY – @keyframes bodies for `motion.keyframes`
//                        ("shimmer", "blink", …) → generated `@keyframes name { … }`
// ---------------------------------------------------------------------------

/** SVG feTurbulence film-grain tile, encoded once (used by the noise effect) */
const NOISE_SVG_URI =
    "url(\"data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='128' height='128' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

/**
 * Effect utility declaration blocks. Values are raw CSS declarations (no
 * selector, no braces) — the effects stylesheet builder wraps them in the
 * theme-chosen class name. Color-bearing effects read theme vars so they
 * retint with the brand.
 */
export const EFFECT_REGISTRY: Record<string, string> = {
    /** CRT scanline overlay – subtle horizontal line texture */
    scanlines:
        'background-image: repeating-linear-gradient(0deg, rgb(0 0 0 / 0.06) 0px, rgb(0 0 0 / 0.06) 1px, transparent 1px, transparent 3px);',

    /** Film-grain noise texture (SVG feTurbulence tile) */
    noise: `background-image: ${NOISE_SVG_URI}; background-size: 128px 128px;`,

    /** Blueprint/graph-paper grid over the current background */
    grid: 'background-image: linear-gradient(hsl(var(--border) / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.6) 1px, transparent 1px); background-size: 24px 24px;',

    /** Photographic vignette – darkened corners via inset shadow */
    vignette: 'box-shadow: inset 0 0 120px 30px rgb(0 0 0 / 0.35);',

    /** 90s bevel/groove divider treatment for hr-like elements */
    groove: 'border: 0; border-top: 1px solid rgb(0 0 0 / 0.25); border-bottom: 1px solid rgb(255 255 255 / 0.55); height: 0;',

    /** Perforated (dotted) divider */
    perforation:
        'border: 0; height: 2px; background-image: radial-gradient(circle, hsl(var(--border)) 1px, transparent 1.5px); background-size: 8px 2px; background-repeat: repeat-x;',

    /** Soft brand glow halo (reads --primary so it retints live) */
    glow: 'box-shadow: 0 0 24px 2px hsl(var(--primary) / 0.35);',
};

/**
 * Named @keyframes bodies (content between the braces of `@keyframes name { … }`).
 */
export const KEYFRAME_REGISTRY: Record<string, string> = {
    /** Loading shimmer sweep (pair with a gradient background) */
    shimmer: '0% { background-position: -200% 0; } 100% { background-position: 200% 0; }',

    /** Typing caret / status dot blink */
    'caret-blink': '0%, 70%, 100% { opacity: 1; } 20%, 50% { opacity: 0; }',

    /** Pulsing dot (live indicators) */
    dotpulse: '0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.45; transform: scale(0.85); }',

    /** Classic 90s text blink */
    blink: '0%, 49% { visibility: visible; } 50%, 100% { visibility: hidden; }',

    /** Horizontal marquee scroll (element should be duplicated for seamless loop) */
    marquee: '0% { transform: translateX(0); } 100% { transform: translateX(-50%); }',
};

/**
 * Resolve a `registry:key` reference against a registry map.
 * Non-registry values pass through verbatim (raw CSS authored in the theme).
 */
export function resolveRegistryValue(raw: string, registry: Record<string, string>): string | undefined {
    if (raw.startsWith('registry:')) {
        const key = raw.slice('registry:'.length).trim();
        return registry[key];
    }
    return raw;
}
