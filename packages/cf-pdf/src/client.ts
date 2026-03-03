/**
 * Client-side DOM capture and PDF download utilities.
 *
 * Serialises a live DOM element + all page CSS into a self-contained HTML
 * string suitable for server-side rendering via Puppeteer. Also provides
 * helpers for triggering file downloads from blobs or fetch responses.
 *
 * @example
 * ```ts
 * import { captureDomAsHtml, fetchAndDownloadPdf } from '@ottabase/cf-pdf/client';
 *
 * const html = captureDomAsHtml('preview-container', {
 *     title: 'My Report',
 *     pageSize: 'a4',
 * });
 *
 * await fetchAndDownloadPdf('/api/pdf', { html, fileName: 'report' }, 'report');
 * ```
 *
 * @module
 */

import type { DomCaptureOptions } from './index';

// ---------------------------------------------------------------------------
// CSS zoom → transform:scale() conversion
// ---------------------------------------------------------------------------

/**
 * Converts a CSS `zoom` property on an element to an equivalent
 * `transform: scale()`. `zoom` is non-standard and behaves inconsistently
 * in Puppeteer's print/PDF context; `transform: scale()` is reliable.
 *
 * Also adjusts `transform-origin` and `width` so the scaled content fills
 * the page correctly.
 */
export function convertZoomToTransform(element: HTMLElement): void {
    const zoomValue = element.style.zoom;
    if (!zoomValue) return;

    const zoom = parseFloat(zoomValue);
    if (isNaN(zoom) || zoom === 0) return;

    // Remove the non-standard zoom property
    element.style.zoom = '';

    // Apply standards-based transform instead
    element.style.transform = `scale(${zoom})`;
    element.style.transformOrigin = 'top left';

    // When an element is scaled with transform, it still occupies its
    // original layout box. Widen the container so the scaled content
    // can fill the full page width.
    if (zoom !== 1) {
        element.style.width = `${100 / zoom}%`;
    }
}

// ---------------------------------------------------------------------------
// DOM capture → self-contained HTML
// ---------------------------------------------------------------------------

/** Default domains for which `<link rel="preconnect">` hints are injected. */
const DEFAULT_PRECONNECT = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

/** Default CSS custom property prefixes to capture from `:root` inline style. */
const DEFAULT_CSS_VAR_PATTERNS = ['--font-', '--typography-'];

/**
 * CSS pixel heights for common print page sizes at 96 dpi.
 * Used by the `fitHeight` option to enforce minimum page-height on
 * the captured element so sidebar backgrounds fill the full first page.
 *
 * Calculation: inches × 96 px/in  (or mm / 25.4 × 96).
 */
const PAGE_HEIGHT_PX: Record<string, number> = {
    letter: 1056, // 11 in × 96
    a4: 1123, // 297 mm / 25.4 × 96 ≈ 1122.5 → 1123
    legal: 1344, // 14 in × 96
    a3: 1587, // 420 mm / 25.4 × 96 ≈ 1586.9 → 1587
    tabloid: 1584, // 17 in × 96 (same as A3 landscape — landscape not handled here)
};

/**
 * Serialises a live DOM element (identified by `elementId`) together with
 * every CSS rule loaded on the page into a fully self-contained HTML string.
 *
 * The resulting string can be POSTed to a Cloudflare Worker where Puppeteer
 * renders it into a pixel-perfect PDF replica of what the user sees on screen.
 *
 * Key behaviours:
 *  - CSS `zoom` is converted to `transform: scale()` for reliable PDF rendering.
 *  - `@page` CSS is injected for explicit page-size control in Puppeteer.
 *  - External font `<link>` tags (Google Fonts etc.) are re-attached so Puppeteer
 *    can fetch them with full network access.
 *  - `@media print` blocks from the app shell are stripped by default — they
 *    often contain rules like `header { display:none }` that would hide content.
 *  - A "trailing blank page" guard forces `html, body { height: fit-content }`
 *    to prevent Chromium from emitting an empty trailing page.
 *
 * @param elementId  `id` attribute of the DOM element to capture.
 * @param options    Capture configuration — all fields optional with defaults.
 * @returns          Fully self-contained HTML string.
 * @throws           If the element with `elementId` is not found in the DOM.
 */
export function captureDomAsHtml(elementId: string, options: DomCaptureOptions = {}): string {
    const {
        title: docTitle = 'Document',
        pageSize = 'letter',
        containerSelector,
        stripPrintMedia = true,
        preconnectDomains = DEFAULT_PRECONNECT,
        cssVariablePatterns = DEFAULT_CSS_VAR_PATTERNS,
        fitHeight = false,
    } = options;

    const el = document.getElementById(elementId);
    if (!el) {
        throw new Error(
            `Element with id "${elementId}" not found. Ensure the content is fully rendered before capturing.`,
        );
    }

    // Clone so decorative wrapper styles can be stripped without mutating the live DOM.
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.boxShadow = 'none';
    clone.style.borderRadius = '0';
    clone.style.outline = 'none';
    clone.style.maxWidth = 'none'; // let Puppeteer control page width
    clone.style.aspectRatio = 'auto'; // allow content to flow across PDF pages
    clone.style.overflow = 'visible';
    // Reset any screen-layout margin (e.g. Tailwind's .mt-4 on the preview container)
    // so no decorative top/bottom whitespace bleeds into the PDF.
    clone.style.margin = '0';
    clone.style.padding = '0';

    // fitHeight: force the capture element and its direct child template wrapper to
    // be at least one full page tall. This ensures that sidebar flex children stretch
    // to fill the page background (e.g. TemplateModern's dark sidebar column).
    if (fitHeight) {
        const pageHeightPx = PAGE_HEIGHT_PX[pageSize.toLowerCase()] ?? PAGE_HEIGHT_PX.letter;
        clone.style.minHeight = `${pageHeightPx}px`;
        // Also apply min-height to the direct child (the flex template wrapper) so
        // `align-items: stretch` propagates the height to sidebar & main columns.
        const firstChild = clone.firstElementChild as HTMLElement | null;
        if (firstChild) {
            firstChild.style.minHeight = `${pageHeightPx}px`;
        }
    }

    // Convert CSS zoom → transform:scale() on the container and children.
    convertZoomToTransform(clone);
    for (const child of Array.from(clone.querySelectorAll<HTMLElement>('[style*="zoom"]'))) {
        convertZoomToTransform(child);
    }

    // ── Collect CSS ──────────────────────────────────────────────────────────
    let css = '';
    for (const sheet of Array.from(document.styleSheets)) {
        try {
            for (const rule of Array.from(sheet.cssRules ?? [])) {
                // Optionally strip @media print blocks
                if (stripPrintMedia && rule instanceof CSSMediaRule && rule.media.mediaText.includes('print')) {
                    continue;
                }
                css += rule.cssText + '\n';
            }
        } catch {
            // SecurityError from cross-origin sheet — handled via <link> below
        }
    }

    // ── Re-attach external font <link> tags ──────────────────────────────────
    const fontLinks: string[] = [];
    const seenHrefs = new Set<string>();
    for (const linkEl of Array.from(document.head.querySelectorAll('link[rel="stylesheet"], link[rel="preconnect"]'))) {
        const href = linkEl.getAttribute('href') ?? '';
        if (seenHrefs.has(href)) continue;
        seenHrefs.add(href);
        fontLinks.push(linkEl.outerHTML);
    }

    // Add preconnect hints for early DNS + TLS
    for (const domain of preconnectDomains) {
        if (!seenHrefs.has(domain)) {
            fontLinks.unshift(`<link rel="preconnect" href="${domain}" crossorigin>`);
        }
    }

    // ── Capture :root CSS variables ─────────────────────────────────────────
    const rootVars: string[] = [];
    const rootStyle = document.documentElement.style;
    for (let i = 0; i < rootStyle.length; i++) {
        const prop = rootStyle[i];
        if (cssVariablePatterns.some((pattern) => prop.startsWith(pattern))) {
            const val = rootStyle.getPropertyValue(prop).trim();
            if (val) rootVars.push(`${prop}: ${val}`);
        }
    }
    const rootVarsCss = rootVars.length > 0 ? `:root {\n  ${rootVars.join(';\n  ')};\n}\n\n` : '';

    // ── Optional container selector override ────────────────────────────────
    const containerCss = containerSelector
        ? `\n    /* Full-width override for PDF rendering */\n    ${containerSelector} {\n      max-width: 100% !important;\n      width: 100% !important;\n    }\n`
        : '';

    // Escape HTML entities in the title
    const safeTitle = docTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  ${fontLinks.join('\n  ')}
  <style>
    /* ── Page geometry ── */
    @page {
      size: ${pageSize};
      margin: 0;
    }

    /* Ensure colours/backgrounds print exactly as shown on screen */
    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: white;
      color-scheme: light;
    }

    /* Trailing-blank-page guard — prevents app-shell height utilities
       (e.g. Tailwind's h-full / min-h-screen) from forcing an extra page. */
    html, body {
      height: fit-content !important;
      min-height: unset !important;
    }

    /* Prevent sections from being split across page breaks */
    section, .break-inside-avoid {
      break-inside: avoid;
    }
${containerCss}
    /* :root CSS vars + collected page styles */
    ${rootVarsCss}
    ${css}

    /* Trailing-blank-page guard (repeated after collected CSS to win cascade) */
    html, body {
      height: fit-content !important;
      min-height: unset !important;
    }
  </style>
</head>
<body>
  ${clone.outerHTML}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Download helpers
// ---------------------------------------------------------------------------

/**
 * Triggers a file download in the browser by creating a hidden `<a>` element,
 * clicking it, and cleaning up.
 *
 * @param blob      The file contents.
 * @param fileName  Download filename (including extension).
 */
export function downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Release object URL after download is triggered.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Sanitises a filename by replacing characters illegal on Windows/macOS/Linux.
 *
 * @param name  Raw filename (without extension).
 * @returns     Safe filename string.
 */
export function sanitizeFileName(name: string): string {
    return name.trim().replace(/[\\/:*?"<>|]/g, '_') || 'document';
}

/**
 * POSTs a JSON body to `endpoint`, expects a PDF blob back, and triggers a
 * browser download. Throws on non-2xx responses with the server's error message.
 *
 * @param endpoint  URL path (e.g. `/api/pdf`).
 * @param body      JSON-serialisable request body.
 * @param fileName  Download filename **without** the `.pdf` extension.
 */
export async function fetchAndDownloadPdf(
    endpoint: string,
    body: Record<string, unknown>,
    fileName = 'document',
): Promise<void> {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // forward session cookie
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        let errorMessage = `PDF generation failed (HTTP ${response.status})`;
        try {
            const json = (await response.json()) as { error?: string; message?: string };
            errorMessage = json.error ?? json.message ?? errorMessage;
        } catch {
            // ignore JSON parse failure
        }
        throw new Error(errorMessage);
    }

    const blob = await response.blob();
    const safeName = sanitizeFileName(fileName);
    downloadBlob(blob, `${safeName}.pdf`);
}
