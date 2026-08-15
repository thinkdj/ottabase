/**
 * Browser-side DOM capture and download helpers.
 *
 * This module deliberately does not make HTTP requests. Applications should
 * send the captured HTML through their own authenticated, scoped API client,
 * then pass the returned Blob to `downloadBlob`.
 */

import { DEFAULT_PDF_RESOURCE_ORIGINS, normalizePdfResourceOrigins, sanitizeFileName } from './security';
import type { DomCaptureOptions } from './types';

export { DEFAULT_PDF_RESOURCE_ORIGINS, sanitizeFileName } from './security';

const DEFAULT_CSS_VAR_PATTERNS = ['--font-', '--typography-'];

/** CSS pixel heights for common print page sizes at 96dpi. */
const PAGE_HEIGHT_PX: Record<NonNullable<DomCaptureOptions['pageSize']>, number> = {
    letter: 1056,
    a4: 1123,
    legal: 1344,
    a3: 1587,
    tabloid: 1584,
};

const VALID_PAGE_SIZES = new Set<NonNullable<DomCaptureOptions['pageSize']>>([
    'letter',
    'a4',
    'legal',
    'a3',
    'tabloid',
]);

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeStyleContent(value: string): string {
    // A closing style tag would let serialized CSS escape the static document.
    return value.replace(/<\/style/gi, '<\\/style');
}

function normalizePageSize(value: DomCaptureOptions['pageSize']): NonNullable<DomCaptureOptions['pageSize']> {
    return value && VALID_PAGE_SIZES.has(value) ? value : 'letter';
}

function parseZoom(value: string | undefined): number | undefined {
    const trimmed = value?.trim();
    if (!trimmed) return undefined;

    const parsed = trimmed.endsWith('%') ? Number.parseFloat(trimmed.slice(0, -1)) / 100 : Number.parseFloat(trimmed);
    return Number.isFinite(parsed) && parsed > 0 && parsed <= 10 ? parsed : undefined;
}

/**
 * Converts a CSS `zoom` declaration to `transform: scale()` without
 * overwriting a pre-existing transform.
 */
export function convertZoomToTransform(element: HTMLElement): void {
    const zoom = parseZoom(element.style.zoom);
    if (zoom === undefined) return;

    element.style.zoom = '';
    const existingTransform = element.style.transform.trim();
    element.style.transform =
        existingTransform && existingTransform !== 'none' ? `scale(${zoom}) ${existingTransform}` : `scale(${zoom})`;
    element.style.transformOrigin = element.style.transformOrigin || 'top left';

    if (zoom !== 1 && !element.style.width) {
        element.style.width = `${100 / zoom}%`;
    }
}

function removeExecutableMarkup(root: HTMLElement): void {
    root.querySelectorAll('script, base, iframe, object, embed, meta[http-equiv="refresh"]').forEach((node) => {
        node.remove();
    });

    for (const element of [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]) {
        for (const attribute of Array.from(element.attributes)) {
            const attributeName = attribute.name.toLowerCase();
            const attributeValue = attribute.value.trim().toLowerCase();

            if (attributeName.startsWith('on')) {
                element.removeAttribute(attribute.name);
                continue;
            }

            if (
                (attributeName === 'href' || attributeName === 'src' || attributeName === 'xlink:href') &&
                (attributeValue.startsWith('javascript:') || attributeValue.startsWith('vbscript:'))
            ) {
                element.removeAttribute(attribute.name);
            }
        }
    }
}

function collectPageCss(stripPrintMedia: boolean): string {
    let css = '';

    for (const sheet of Array.from(document.styleSheets)) {
        try {
            for (const rule of Array.from(sheet.cssRules ?? [])) {
                if (stripPrintMedia && /^@media\s+print\b/i.test(rule.cssText)) continue;
                css += `${rule.cssText}\n`;
            }
        } catch {
            // Cross-origin stylesheets intentionally remain unavailable. Approved
            // stylesheets are re-attached as explicit URLs below.
        }
    }

    return css;
}

function collectExternalLinks(allowedOrigins: readonly string[]): string[] {
    const allowedOriginSet = new Set(allowedOrigins);
    const links: string[] = [];
    const seen = new Set<string>();

    for (const link of Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))) {
        const rawHref = link.getAttribute('href');
        if (!rawHref) continue;

        try {
            const href = new URL(rawHref, document.baseURI);
            if (href.protocol !== 'https:' || !allowedOriginSet.has(href.origin) || seen.has(href.href)) continue;

            seen.add(href.href);
            links.push(`<link rel="stylesheet" href="${escapeHtml(href.href)}">`);
        } catch {
            // An invalid href cannot be safely made part of the PDF document.
        }
    }

    for (const origin of allowedOrigins) {
        if (!seen.has(origin)) {
            links.unshift(`<link rel="preconnect" href="${escapeHtml(origin)}" crossorigin>`);
        }
    }

    return links;
}

function collectRootVariables(patterns: readonly string[]): string {
    const variables: string[] = [];
    const style = document.documentElement.style;

    for (let index = 0; index < style.length; index += 1) {
        const property = style[index];
        if (!patterns.some((pattern) => property.startsWith(pattern))) continue;

        const value = style.getPropertyValue(property).trim();
        if (value) variables.push(`${property}: ${value}`);
    }

    return variables.length > 0 ? `:root {\n  ${variables.join(';\n  ')};\n}\n\n` : '';
}

/**
 * Serialises a live DOM element and its available CSS into a static document.
 * The output has no executable controls and only retains explicitly approved
 * HTTPS stylesheet origins. The Worker renderer independently enforces the
 * same policy, so callers should not treat this client-side pass as a trust
 * boundary.
 */
export function captureDomAsHtml(elementId: string, options: DomCaptureOptions = {}): string {
    const {
        title = 'Document',
        stripPrintMedia = true,
        resourceOrigins,
        cssVariablePatterns = DEFAULT_CSS_VAR_PATTERNS,
        fitHeight = false,
        fitWidth = false,
    } = options;
    const pageSize = normalizePageSize(options.pageSize);
    const allowedOrigins = normalizePdfResourceOrigins(resourceOrigins, DEFAULT_PDF_RESOURCE_ORIGINS);

    const source = document.getElementById(elementId);
    if (!source) {
        throw new Error(`Element with id "${elementId}" was not found. Render it before capturing a PDF.`);
    }

    const clone = source.cloneNode(true) as HTMLElement;
    removeExecutableMarkup(clone);
    Object.assign(clone.style, {
        boxShadow: 'none',
        borderRadius: '0',
        outline: 'none',
        maxWidth: 'none',
        aspectRatio: 'auto',
        overflow: 'visible',
        margin: '0',
        padding: '0',
    });

    const firstChild = clone.firstElementChild as HTMLElement | null;
    if (fitHeight) {
        const pageHeight = PAGE_HEIGHT_PX[pageSize];
        clone.style.minHeight = `${pageHeight}px`;
        if (firstChild) firstChild.style.minHeight = `${pageHeight}px`;
    }
    if (fitWidth && firstChild) {
        firstChild.style.maxWidth = '100%';
        firstChild.style.width = '100%';
    }

    convertZoomToTransform(clone);
    for (const element of Array.from(clone.querySelectorAll<HTMLElement>('[style*="zoom"]'))) {
        convertZoomToTransform(element);
    }

    const safePatterns = cssVariablePatterns.filter(
        (pattern): pattern is string => typeof pattern === 'string' && pattern.length > 0 && pattern.length <= 64,
    );
    const rootVariables = collectRootVariables(safePatterns);
    const css = escapeStyleContent(`${rootVariables}${collectPageCss(stripPrintMedia)}`);
    const externalLinks = collectExternalLinks(allowedOrigins);

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title.slice(0, 256))}</title>
  ${externalLinks.join('\n  ')}
  <style>
    @page { size: ${pageSize}; margin: 0; }
    *, *::before, *::after { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { margin: 0; padding: 0; background: white; color-scheme: light; height: fit-content !important; min-height: unset !important; }
    section, .break-inside-avoid { break-inside: avoid; }
    ${css}
    html, body { height: fit-content !important; min-height: unset !important; }
  </style>
</head>
<body>${clone.outerHTML}</body>
</html>`;
}

/** Trigger a browser download from an already-authorized Blob response. */
export function downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = sanitizeFileName(fileName);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
