/**
 * Server-side PDF generation — Cloudflare Browser Rendering (Puppeteer).
 *
 * Provides a thin, configurable wrapper around `@cloudflare/puppeteer` that
 * turns a self-contained HTML string into a PDF `Uint8Array`, plus a helper
 * to build the final `Response` with correct headers.
 *
 * The consumer must pass in the `@cloudflare/puppeteer` module via
 * `options.puppeteer` because Wrangler only resolves the built-in module
 * when the import lives directly in the worker source (not inside a
 * pre-built package dist file).
 *
 * @example
 * ```ts
 * import puppeteer from '@cloudflare/puppeteer';
 * import { generatePdf, buildPdfResponse } from '@ottabase/cf-pdf/server';
 * import { injectPdfInfoMetadata } from '@ottabase/cf-pdf/metadata';
 *
 * let pdf = await generatePdf(html, env.OBCF_BROWSER, { puppeteer });
 * pdf = injectPdfInfoMetadata(pdf, metadata);
 * return buildPdfResponse(pdf, 'report');
 * ```
 *
 * @module
 */

import type { PdfGenerateOptions } from './index';

// ---------------------------------------------------------------------------
// Puppeteer PDF generation
// ---------------------------------------------------------------------------

/**
 * Renders `html` to a PDF buffer using Cloudflare Browser Rendering.
 *
 * Handles the full lifecycle: launch browser → new page → set viewport →
 * inject HTML → wait for network + fonts → print to PDF → close browser.
 *
 * @param html             Fully self-contained HTML string (as produced by
 *                         `captureDomAsHtml` from `@ottabase/cf-pdf/client`).
 * @param browserBinding   The `OBCF_BROWSER` (or equivalent) Cloudflare binding.
 * @param options          PDF generation settings. `options.puppeteer` is **required**.
 * @returns                PDF file bytes as `Uint8Array`.
 * @throws                 If `options.puppeteer` is missing, or on any Puppeteer error.
 */
export async function generatePdf(
    html: string,
    browserBinding: unknown,
    options: PdfGenerateOptions,
): Promise<Uint8Array> {
    const {
        puppeteer,
        format = 'Letter',
        viewportWidth = 816,
        viewportHeight = 1056,
        printBackground = true,
        margin = { top: '0', right: '0', bottom: '0', left: '0' },
        waitUntil = 'networkidle0',
        fontTimeout = 5000,
    } = options;

    if (!puppeteer) {
        throw new Error(
            'options.puppeteer is required. Pass the @cloudflare/puppeteer module: ' +
                "import puppeteer from '@cloudflare/puppeteer'; generatePdf(html, binding, { puppeteer })",
        );
    }

    // Use the puppeteer module passed by the consumer. Wrangler only resolves
    // @cloudflare/puppeteer when the import lives directly in the worker source,
    // so the package cannot do the import itself from pre-built dist files.
    const launcher = puppeteer.default ?? puppeteer;
    const browser = await launcher.launch(browserBinding as any);

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: viewportWidth, height: viewportHeight });

        // Inject the captured HTML — avoids data: URL length limits.
        // waitUntil ensures external resources (fonts, images) are loaded.
        await page.setContent(html, { waitUntil });

        // Wait for web fonts to be fully loaded and ready for rendering.
        // document.fonts.ready resolves when all font-face rules referenced by
        // visible text have finished loading. The timeout is a safety net — if
        // fonts fail to load, we still generate the PDF with fallback fonts.
        await page.evaluate((timeout: number) => {
            return Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, timeout))]);
        }, fontTimeout);

        // Print to PDF — no Puppeteer margins when the HTML carries its own.
        const pdf = await page.pdf({
            format: format as any,
            printBackground,
            margin,
        });

        return pdf;
    } finally {
        await browser.close();
    }
}

// ---------------------------------------------------------------------------
// Response builder
// ---------------------------------------------------------------------------

/**
 * Wraps a PDF `Uint8Array` in a `Response` with correct headers for browser
 * download (`Content-Disposition: attachment`).
 *
 * @param pdfBuffer   PDF file bytes.
 * @param fileName    Download filename **without** the `.pdf` extension.
 *                    Dangerous characters are sanitised automatically.
 * @returns           A `Response` ready to return from a Worker route.
 */
export function buildPdfResponse(pdfBuffer: Uint8Array, fileName = 'document'): Response {
    const safeName = fileName.trim().replace(/[\\/:*?"<>|]/g, '_') || 'document';

    return new Response(pdfBuffer.buffer as ArrayBuffer, {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
            'Content-Length': String(pdfBuffer.byteLength),
            'Cache-Control': 'no-store',
        },
    });
}
