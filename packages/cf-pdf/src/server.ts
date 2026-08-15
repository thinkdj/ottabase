/**
 * Worker-side PDF rendering for Cloudflare Browser Rendering.
 *
 * `html` is treated as untrusted static document input. The renderer disables
 * page JavaScript, injects a restrictive CSP, and only permits explicitly
 * allowlisted HTTPS resource origins. Authentication, tenancy, and request
 * rate limiting remain the responsibility of the consuming Worker route.
 */

import type { BrowserWorker, HTTPRequest, Page } from '@cloudflare/puppeteer';
import { PDF_PAGE_FORMATS, type PdfGenerateOptions, type PdfMargins, type PdfPageFormat } from './types';
import { buildPdfContentDisposition, normalizePdfResourceOrigins, PdfRenderError } from './security';

export { isPdfRenderError, PdfRenderError, type PdfRenderErrorCode } from './security';

const DEFAULT_VIEWPORT_WIDTH = 816;
const DEFAULT_VIEWPORT_HEIGHT = 1056;
const DEFAULT_FONT_TIMEOUT_MS = 3_000;
const DEFAULT_RENDER_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_HTML_BYTES = 1_000_000;
const DEFAULT_MAX_PDF_BYTES = 10 * 1024 * 1024;
const DEFAULT_MARGIN: Required<PdfMargins> = { top: '0', right: '0', bottom: '0', left: '0' };
const MARGIN_PATTERN = /^(?:0|(?:\d+(?:\.\d+)?)(?:px|mm|cm|in))$/;

interface ResolvedPdfGenerateOptions {
    puppeteer: PdfGenerateOptions['puppeteer'];
    format: PdfPageFormat;
    viewportWidth: number;
    viewportHeight: number;
    printBackground: boolean;
    margin: Required<PdfMargins>;
    waitUntil: 'load' | 'domcontentloaded';
    fontTimeoutMs: number;
    renderTimeoutMs: number;
    maxHtmlBytes: number;
    maxPdfBytes: number;
    allowedResourceOrigins: string[];
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number, label: string): number {
    if (value === undefined) return fallback;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) {
        throw new PdfRenderError(
            'INVALID_PDF_OPTION',
            `${label} must be an integer between ${minimum} and ${maximum}.`,
        );
    }
    return value;
}

function resolveMargins(value: PdfMargins | undefined): Required<PdfMargins> {
    const resolved: Required<PdfMargins> = { ...DEFAULT_MARGIN };
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
        const candidate = value?.[side];
        if (candidate === undefined) continue;
        if (typeof candidate !== 'string' || !MARGIN_PATTERN.test(candidate.trim())) {
            throw new PdfRenderError('INVALID_PDF_OPTION', `PDF margin ${side} is invalid.`);
        }
        resolved[side] = candidate.trim();
    }
    return resolved;
}

function resolveOptions(options: PdfGenerateOptions): ResolvedPdfGenerateOptions {
    if (!options?.puppeteer || typeof options.puppeteer.launch !== 'function') {
        throw new PdfRenderError('INVALID_PDF_OPTION', 'A Cloudflare Puppeteer launcher is required.');
    }

    const format = options.format ?? 'Letter';
    if (!PDF_PAGE_FORMATS.includes(format)) {
        throw new PdfRenderError('INVALID_PDF_OPTION', 'The PDF page format is not supported.');
    }

    const waitUntil = options.waitUntil ?? 'load';
    if (waitUntil !== 'load' && waitUntil !== 'domcontentloaded') {
        throw new PdfRenderError('INVALID_PDF_OPTION', 'The PDF wait strategy is not supported.');
    }

    return {
        puppeteer: options.puppeteer,
        format,
        viewportWidth: boundedInteger(options.viewportWidth, DEFAULT_VIEWPORT_WIDTH, 320, 3_840, 'viewportWidth'),
        viewportHeight: boundedInteger(options.viewportHeight, DEFAULT_VIEWPORT_HEIGHT, 320, 4_320, 'viewportHeight'),
        printBackground: options.printBackground ?? true,
        margin: resolveMargins(options.margin),
        waitUntil,
        fontTimeoutMs: boundedInteger(options.fontTimeoutMs, DEFAULT_FONT_TIMEOUT_MS, 0, 10_000, 'fontTimeoutMs'),
        renderTimeoutMs: boundedInteger(
            options.renderTimeoutMs,
            DEFAULT_RENDER_TIMEOUT_MS,
            1_000,
            45_000,
            'renderTimeoutMs',
        ),
        maxHtmlBytes: boundedInteger(options.maxHtmlBytes, DEFAULT_MAX_HTML_BYTES, 1_024, 2_000_000, 'maxHtmlBytes'),
        maxPdfBytes: boundedInteger(options.maxPdfBytes, DEFAULT_MAX_PDF_BYTES, 1_024, 25 * 1024 * 1024, 'maxPdfBytes'),
        allowedResourceOrigins: normalizePdfResourceOrigins(options.allowedResourceOrigins),
    };
}

function createContentSecurityPolicy(allowedOrigins: readonly string[]): string {
    const origins = allowedOrigins.join(' ');
    const styleSources = ["'unsafe-inline'", origins].filter(Boolean).join(' ');
    const imageAndFontSources = ['data:', origins].filter(Boolean).join(' ');

    return [
        "default-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        "object-src 'none'",
        "frame-src 'none'",
        "script-src 'none'",
        "connect-src 'none'",
        `style-src ${styleSources}`,
        `font-src ${imageAndFontSources}`,
        `img-src ${imageAndFontSources}`,
    ].join('; ');
}

/** Defensive markup removal; CSP, JS disablement, and interception remain the security boundary. */
function removeExecutableDocumentControls(html: string): string {
    return html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
        .replace(/<script\b[^>]*\/?\s*>/gi, '')
        .replace(/<base\b[^>]*>/gi, '')
        .replace(/<meta\b[^>]*http-equiv\s*=\s*(["'])?refresh\1?[^>]*>/gi, '')
        .replace(/<(?:iframe|object|embed)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed)\s*>/gi, '')
        .replace(/<(?:iframe|object|embed)\b[^>]*\/?\s*>/gi, '');
}

function addContentSecurityPolicy(html: string, allowedOrigins: readonly string[]): string {
    const csp = createContentSecurityPolicy(allowedOrigins).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const cspTag = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
    const documentHtml = removeExecutableDocumentControls(html);

    if (/<head\b[^>]*>/i.test(documentHtml)) {
        return documentHtml.replace(/<head\b[^>]*>/i, (head) => `${head}${cspTag}`);
    }

    return `<!doctype html><html><head>${cspTag}</head><body>${documentHtml}</body></html>`;
}

function allowsResourceRequest(request: HTTPRequest, allowedOrigins: ReadonlySet<string>): boolean {
    const url = request.url();
    const resourceType = request.resourceType();

    if (url === 'about:blank') return true;
    if (url.startsWith('data:')) return resourceType === 'image' || resourceType === 'font';

    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' && allowedOrigins.has(parsed.origin);
    } catch {
        return false;
    }
}

function installResourcePolicy(page: Page, allowedOrigins: ReadonlySet<string>): void {
    page.on('request', (request: HTTPRequest) => {
        const action = allowsResourceRequest(request, allowedOrigins) ? request.continue() : request.abort();
        void action.catch(() => undefined);
    });
}

async function waitForFonts(page: Page, timeoutMs: number): Promise<void> {
    if (timeoutMs === 0) return;

    await page.evaluate(async (timeout: number) => {
        const fonts = document.fonts;
        if (!fonts) return;
        await Promise.race([fonts.ready, new Promise<void>((resolve) => setTimeout(resolve, timeout))]);
    }, timeoutMs);
}

/**
 * Renders bounded, static HTML into a PDF using Cloudflare Browser Rendering.
 * Browser sessions are always closed; page scripts and unapproved subrequests
 * cannot run.
 */
export async function generatePdf(
    html: string,
    browserBinding: BrowserWorker,
    options: PdfGenerateOptions,
): Promise<Uint8Array> {
    const resolved = resolveOptions(options);
    if (typeof html !== 'string') {
        throw new PdfRenderError('INVALID_PDF_OPTION', 'PDF HTML must be a string.');
    }
    if (new TextEncoder().encode(html).byteLength > resolved.maxHtmlBytes) {
        throw new PdfRenderError('PDF_INPUT_TOO_LARGE', 'The PDF HTML document is too large.');
    }

    const browser = await resolved.puppeteer.launch(browserBinding);
    let completed = false;

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: resolved.viewportWidth, height: resolved.viewportHeight });
        await page.setJavaScriptEnabled(false);
        installResourcePolicy(page, new Set(resolved.allowedResourceOrigins));
        await page.setRequestInterception(true);
        await page.setContent(addContentSecurityPolicy(html, resolved.allowedResourceOrigins), {
            waitUntil: resolved.waitUntil,
            timeout: resolved.renderTimeoutMs,
        });
        await waitForFonts(page, resolved.fontTimeoutMs);

        const pdf = await page.pdf({
            format: resolved.format,
            printBackground: resolved.printBackground,
            margin: resolved.margin,
        });
        if (pdf.byteLength > resolved.maxPdfBytes) {
            throw new PdfRenderError('PDF_OUTPUT_TOO_LARGE', 'The generated PDF is too large.');
        }

        completed = true;
        return pdf;
    } finally {
        try {
            await browser.close();
        } catch {
            if (completed) {
                throw new PdfRenderError('PDF_BROWSER_CLOSE_FAILED', 'The PDF browser session could not be closed.');
            }
        }
    }
}

/**
 * Wrap PDF bytes in a strict attachment response. The exact view bytes are
 * copied before constructing the Response so subarray backing bytes can never
 * leak into the download.
 */
export function buildPdfResponse(pdfBuffer: Uint8Array, fileName = 'document'): Response {
    const ownedBuffer = pdfBuffer.slice().buffer as ArrayBuffer;

    return new Response(ownedBuffer, {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': buildPdfContentDisposition(fileName),
            'Content-Length': String(pdfBuffer.byteLength),
            'Cache-Control': 'no-store',
            'Cross-Origin-Resource-Policy': 'same-origin',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
