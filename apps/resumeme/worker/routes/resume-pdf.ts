/**
 * Worker route — Server-side PDF generation.
 *
 * POST /api/resume/pdf
 *
 * Accepts the pre-rendered, self-contained HTML string captured directly from
 * the browser's live DOM (including all CSS). Puppeteer renders it and returns
 * a PDF that is an exact visual replica of what the user sees on screen.
 *
 * The client (`src/lib/resume-export.ts → captureResumeHtml`) is responsible
 * for serialising the DOM — this route is intentionally thin.
 *
 * Requirements:
 *  - User must be authenticated (session cookie forwarded with request).
 *  - OBCF_BROWSER binding must be configured (Browser Rendering API).
 *
 * Graceful degradation:
 *  - 503 returned when OBCF_BROWSER is absent (local dev without binding).
 *    The client silently falls back to window.print() on 503.
 */

import { getSession } from '@ottabase/auth/backend';
import { errorResponse } from '@ottabase/utils/http-errors';
import { getAuthOptions } from '../lib/auth-utils';
import type { ApiRouteContext } from './router';

// ---------------------------------------------------------------------------
// Request body shape
// ---------------------------------------------------------------------------

interface PdfRequestBody {
    /** Fully self-contained HTML string captured from the browser DOM */
    html: string;
    /** Suggested PDF download filename (without extension) */
    fileName?: string;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * POST /api/resume/pdf
 *
 * Returns `application/pdf` on success.
 * Returns 503 when the Browser Rendering binding is unavailable (local dev).
 */
export async function handleResumePdf(context: ApiRouteContext): Promise<Response> {
    const { request, env } = context;

    // ── 1. Auth check ──────────────────────────────────────────────────────
    const session = await getSession(request, env as any, getAuthOptions(env));
    if (!session?.user?.id) {
        return errorResponse('Unauthorized — please sign in to generate a PDF', 401, {
            code: 'UNAUTHORIZED',
        });
    }

    // ── 2. Browser binding availability check ──────────────────────────────
    // Not available in local wrangler dev unless using `wrangler dev --remote`.
    if (!env.OBCF_BROWSER) {
        return errorResponse(
            'PDF generation is not available in this environment. Use browser print (Ctrl+P / Cmd+P) as a fallback.',
            503,
            { code: 'BROWSER_BINDING_UNAVAILABLE' },
        );
    }

    // ── 3. Parse request body ──────────────────────────────────────────────
    let body: PdfRequestBody;
    try {
        body = (await request.json()) as PdfRequestBody;
    } catch {
        return errorResponse('Invalid JSON body', 400, { code: 'INVALID_BODY' });
    }

    if (!body?.html?.trim()) {
        return errorResponse('Missing required field: html', 400, { code: 'MISSING_HTML' });
    }

    // ── 4. Launch Puppeteer, set captured HTML, generate PDF ───────────────
    // Dynamic import keeps @cloudflare/puppeteer out of the bundle when absent.
    let pdfBuffer: Uint8Array;
    try {
        const puppeteer = await import('@cloudflare/puppeteer');
        const browser = await puppeteer.default.launch(env.OBCF_BROWSER as any);
        const page = await browser.newPage();

        // Match the 816 px resume canvas width (US Letter at 96 dpi)
        await page.setViewport({ width: 816, height: 1056 });

        // Inject the captured HTML directly — avoids data: URL length limits.
        // networkidle0 waits until there are no more than 0 network connections
        // for 500ms — this ensures all external font stylesheets (Google Fonts
        // etc.) and their referenced .woff2 files are fully downloaded.
        await page.setContent(body.html, { waitUntil: 'networkidle0' });

        // Wait for web fonts to be fully loaded and ready for rendering.
        // document.fonts.ready resolves when all font-face rules referenced by
        // visible text have finished loading. We add a 5s timeout as a safety
        // net — if fonts fail to load, we still generate the PDF (with fallback
        // system fonts) rather than hanging indefinitely.
        await page.evaluate(() => {
            return Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 5000))]);
        });

        // No Puppeteer margins — the HTML already carries its own padding.
        // printBackground preserves accent colours and backgrounds.
        // The captured HTML includes @page { size: letter; margin: 0 } for
        // consistency between CSS-level and API-level page geometry.
        const pdf = await page.pdf({
            format: 'Letter',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
        });

        await browser.close();
        pdfBuffer = pdf;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return errorResponse(`PDF generation failed: ${message}`, 500, { code: 'PDF_GENERATION_ERROR' });
    }

    // ── 5. Build safe filename ─────────────────────────────────────────────
    const rawName = (body.fileName ?? 'resume').trim();
    const safeName = rawName.replace(/[\\/:*?"<>|]/g, '_');

    // ── 6. Return the PDF ──────────────────────────────────────────────────
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
