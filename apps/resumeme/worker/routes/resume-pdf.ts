/**
 * Worker route — Server-side PDF generation.
 *
 * POST /api/resume/pdf
 *
 * Accepts the pre-rendered, self-contained HTML string captured directly from
 * the browser's live DOM (including all CSS). Puppeteer renders it and returns
 * a PDF that is an exact visual replica of what the user sees on screen.
 *
 * PDF generation, metadata injection, and response building are delegated to
 * `@ottabase/cf-pdf` — this route handles only auth, validation, and orchestration.
 *
 * Requirements:
 *  - User must be authenticated (session cookie forwarded with request).
 *  - OBCF_BROWSER binding must be configured (Browser Rendering API).
 *
 * Graceful degradation:
 *  - 503 returned when OBCF_BROWSER is absent (local dev without binding).
 *    The client silently falls back to window.print() on 503.
 */

import puppeteer from '@cloudflare/puppeteer';
import { getSession } from '@ottabase/auth/backend';
import type { PdfMetadata } from '@ottabase/cf-pdf';
import { injectPdfInfoMetadata } from '@ottabase/cf-pdf/metadata';
import { buildPdfResponse, generatePdf } from '@ottabase/cf-pdf/server';
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
    /** Optional PDF document metadata to embed in the Info dictionary */
    metadata?: PdfMetadata;
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

    // ── 4. Generate PDF via @ottabase/cf-pdf ───────────────────────────────
    let pdfBuffer: Uint8Array;
    try {
        pdfBuffer = await generatePdf(body.html, env.OBCF_BROWSER, {
            puppeteer,
            format: 'Letter',
            viewportWidth: 816,
            viewportHeight: 1056,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return errorResponse(`PDF generation failed: ${message}`, 500, { code: 'PDF_GENERATION_ERROR' });
    }

    // ── 5. Inject PDF metadata via incremental binary update ─────────────
    if (body.metadata) {
        try {
            pdfBuffer = injectPdfInfoMetadata(pdfBuffer, body.metadata, {
                creator: 'ResumeMe by @thinkdj',
                producer: 'ResumeMe',
            });
        } catch (metaErr) {
            // Non-fatal — deliver the original Puppeteer buffer without metadata.
            console.warn('[resume-pdf] metadata injection failed:', metaErr);
        }
    }

    // ── 6. Return the PDF ──────────────────────────────────────────────────
    return buildPdfResponse(pdfBuffer, body.fileName ?? 'resume');
}
