/**
 * Save a rendered chart as a file. Charts draw with CSS variables and Tailwind classes,
 * which a standalone file cannot resolve, so every computed fill, stroke and font is
 * written onto a clone first.
 */

const COPIED = [
    'fill',
    'fill-opacity',
    'stop-color',
    'stop-opacity',
    'stroke',
    'stroke-width',
    'stroke-dasharray',
    'stroke-linecap',
    'stroke-linejoin',
    'opacity',
    'font-family',
    'font-size',
    'font-weight',
    'text-anchor',
    'dominant-baseline',
] as const;

/** A self-contained SVG string of a chart's `<svg>` element, with styles inlined and a background. */
export function chartToSvg(svg: SVGSVGElement, background = 'transparent'): string {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const source = svg.querySelectorAll<SVGElement>('*');
    const target = clone.querySelectorAll<SVGElement>('*');
    source.forEach((el, i) => {
        const computed = getComputedStyle(el);
        const out = target[i];
        if (!out) return;
        for (const prop of COPIED) {
            const v = computed.getPropertyValue(prop);
            if (v) out.style.setProperty(prop, v);
        }
        // Clip paths keep their ids; transitions would replay in a viewer.
        out.style.removeProperty('transition');
        out.removeAttribute('class');
    });
    const w = svg.clientWidth || Number(svg.getAttribute('width')) || 0;
    const h = svg.clientHeight || Number(svg.getAttribute('height')) || 0;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
    clone.removeAttribute('class');
    clone.removeAttribute('aria-hidden');
    if (background !== 'transparent') {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', '100%');
        rect.setAttribute('height', '100%');
        rect.setAttribute('fill', background);
        clone.insertBefore(rect, clone.firstChild);
    }
    return new XMLSerializer().serializeToString(clone);
}

export interface ExportChartOptions {
    /** Default `png`. */
    format?: 'png' | 'svg';
    /** Without extension. Default `chart`. */
    filename?: string;
    /** PNG pixel density. Default 2. */
    scale?: number;
    /** Page background behind the chart. Default: the element's computed background, else white. */
    background?: string;
}

function download(url: string, name: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
}

// Revoking in the same tick as the click can cancel the download in Firefox and Safari.
const revokeLater = (url: string) => setTimeout(() => URL.revokeObjectURL(url), 30_000);

/**
 * Download a chart. Pass the chart's root element (anything containing one `<svg>`)
 * or the `<svg>` itself. PNG rasterises the inlined SVG on a canvas at `scale`×.
 */
export async function exportChart(element: Element, options: ExportChartOptions = {}): Promise<void> {
    const { format = 'png', filename = 'chart', scale = 2 } = options;
    const svg = element instanceof SVGSVGElement ? element : element.querySelector('svg');
    if (!svg) throw new Error('exportChart: no <svg> found');
    let background = options.background;
    if (!background) {
        // Walk up to the first painted background so dark themes export dark.
        let node: Element | null = svg;
        while (node && !background) {
            const bg = getComputedStyle(node).backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') background = bg;
            node = node.parentElement;
        }
        background ??= '#ffffff';
    }
    const markup = chartToSvg(svg, background);
    const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    if (format === 'svg') {
        download(url, `${filename}.svg`);
        revokeLater(url);
        return;
    }
    // The PNG is a data URL, so the blob is only needed until the image has loaded.
    try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('exportChart: could not rasterise the SVG'));
            img.src = url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round((svg.clientWidth || img.width) * scale);
        canvas.height = Math.round((svg.clientHeight || img.height) * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('exportChart: canvas unavailable');
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        download(canvas.toDataURL('image/png'), `${filename}.png`);
    } finally {
        URL.revokeObjectURL(url);
    }
}

/** Put CSV text on the clipboard. Returns false when the clipboard is unavailable (insecure context). */
export async function copyText(text: string): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
}

/** Download text as a file (a CSV from `toCsv`). */
export function downloadText(text: string, filename: string, type = 'text/csv;charset=utf-8'): void {
    const url = URL.createObjectURL(new Blob([text], { type }));
    download(url, filename);
    revokeLater(url);
}
