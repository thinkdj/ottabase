// ---------------------------------------------------------------------------
// Brand Engine – Cursor SVG Registry
// Themed cursor art referenced from theme configs (e.g. cursors.default:
// "registry:arrow-crimson"). Each entry carries its hotspot — the click point
// in SVG user units; without one the browser anchors clicks at the top-left
// corner, which makes centered cursors (crosshair, I-beam) unusable — and the
// CSS keyword to fall back to where the image cannot render.
// ---------------------------------------------------------------------------

export interface CursorDef {
    /** Single-line SVG markup, encoded into a data: URI at resolve time */
    svg: string;
    /** Click point in SVG user units */
    hotspot: readonly [x: number, y: number];
    /** CSS cursor keyword for contexts where the image cannot render */
    fallback: string;
}

// All cursors share a 24x24 canvas. Depth comes from three stacked paths —
// an offset dark blob, a white halo, then the colored body — instead of an
// SVG filter, so rasterization is identical across browsers.
const svg24 = (inner: string): string =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${inner}</svg>`;

const layered = (d: string, fill: string, edge: string, halo = '#fff'): string =>
    svg24(
        `<path d="${d}" fill="rgba(15,23,42,.32)" stroke="rgba(15,23,42,.32)" stroke-width="3.4" stroke-linejoin="round" transform="translate(.4 1)"/>` +
            `<path d="${d}" fill="${halo}" stroke="${halo}" stroke-width="3" stroke-linejoin="round"/>` +
            `<path d="${d}" fill="${fill}" stroke="${edge}" stroke-width=".75" stroke-linejoin="round"/>`,
    );

const strokes = (parts: readonly string[], color: string, width: number): string =>
    parts
        .map((d) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`)
        .join('');

const ARROW_D = 'M2.5 1.5v16.9l4.3-3.9 2.6 6.1 3.2-1.4-2.6-6h5.9z';
const HAND_D =
    'M8 3.4a1.5 1.5 0 0 1 3 0v6.8h.4a1.5 1.5 0 0 1 2.9.4h.4a1.5 1.5 0 0 1 2.9.5h.3a1.55 1.55 0 0 1 2.4 1.3v3.4a5.2 5.2 0 0 1-5.2 5.2h-3.2a4.6 4.6 0 0 1-3.6-1.7l-3.6-4.5a1.5 1.5 0 0 1 2.3-1.9l1 1.1z';
const IBEAM_PARTS = [
    'M9.4 3.5c1.3 0 2.1.4 2.6 1.1.5-.7 1.3-1.1 2.6-1.1',
    'M12 4.6v14.8',
    'M9.4 20.5c1.3 0 2.1-.4 2.6-1.1.5.7 1.3 1.1 2.6 1.1',
] as const;
const CROSS_PARTS = ['M12 2.8v6', 'M12 15.2v6', 'M2.8 12h6', 'M15.2 12h6'] as const;

// Neutral ink for the precision cursors (I-beam, crosshair)
const INK = '#1f2328';

// Colorway fills track the built-in theme primaries so themed cursors read
// as part of the brand rather than generic recolors. The white colorway
// inverts the halo (dark outline) so it stays legible on light surfaces.
const COLORWAYS: Record<string, { fill: string; edge: string; halo?: string }> = {
    classic: { fill: '#1f2328', edge: '#000000' }, // neutral
    white: { fill: '#ffffff', edge: '#0b0d10', halo: '#1f2328' }, // inverted
    crimson: { fill: '#af284c', edge: '#851e3a' }, // artisan  hsl(344 63% 42%)
    emerald: { fill: '#10b981', edge: '#047857' }, // jewel emerald; pairs with funky/verdant greens
    violet: { fill: '#6d54cf', edge: '#4f38a8' }, // midnight hsl(252 56% 57%)
    azure: { fill: '#2563eb', edge: '#1d4ed8' }, // default  hsl(221.2 83.2% 53.3%)
    fauscia: { fill: '#d82042', edge: '#bb1c39' }, // upp      hsl(348.9 74.2% 48.6%)
};

const colorwayEntries: Record<string, CursorDef> = {};
for (const [name, { fill, edge, halo }] of Object.entries(COLORWAYS)) {
    colorwayEntries[`arrow-${name}`] = {
        svg: layered(ARROW_D, fill, edge, halo),
        hotspot: [2, 2],
        fallback: 'default',
    };
    colorwayEntries[`hand-${name}`] = { svg: layered(HAND_D, fill, edge, halo), hotspot: [9, 2], fallback: 'pointer' };
}

export const CURSOR_SVG_REGISTRY: Record<string, CursorDef> = {
    ...colorwayEntries,
    'text-beam': {
        svg: svg24(strokes(IBEAM_PARTS, '#fff', 3.4) + strokes(IBEAM_PARTS, INK, 1.5)),
        hotspot: [12, 12],
        fallback: 'text',
    },
    crosshair: {
        svg: svg24(
            strokes(CROSS_PARTS, '#fff', 3.6) +
                `<circle cx="12" cy="12" r="1.2" fill="none" stroke="#fff" stroke-width="3.2"/>` +
                strokes(CROSS_PARTS, INK, 1.6) +
                `<circle cx="12" cy="12" r="1.2" fill="none" stroke="${INK}" stroke-width="1.2"/>`,
        ),
        hotspot: [12, 12],
        fallback: 'crosshair',
    },
};

/** Resolve a cursor token to a CSS cursor declaration. Supports registry:key, svg:..., url(...), http(s) URLs, and plain keywords. */
export function resolveCursor(value: string, registry: Record<string, CursorDef> = CURSOR_SVG_REGISTRY): string {
    if (!value) return 'auto';
    if (!value.includes(':') && !value.includes('(')) return value;

    if (value.startsWith('registry:')) {
        const def = registry[value.slice(9)];
        if (!def) return 'auto';
        return `${svgToCursorUrl(def.svg)} ${def.hotspot[0]} ${def.hotspot[1]}, ${def.fallback}`;
    }
    if (value.startsWith('svg:')) return `${svgToCursorUrl(value.slice(4))}, auto`;
    if (value.startsWith('url(')) return value;
    if (value.startsWith('http')) return `url(${value}), auto`;
    return value;
}

function svgToCursorUrl(svg: string): string {
    return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}")`;
}
