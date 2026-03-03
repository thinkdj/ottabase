/**
 * Worker route — Server-side PDF generation.
 *
 * POST /api/resume/pdf
 *
 * Accepts the pre-rendered, self-contained HTML string captured directly from
 * the browser's live DOM (including all CSS). Puppeteer renders it and returns
 * a PDF that is an exact visual replica of what the user sees on screen.
 *
 * PDF Info dictionary metadata (title, author, subject, keywords) is injected
 * via an incremental binary update appended to the Puppeteer output — no external
 * library required, works with any PDF version/structure.
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

/** PDF document metadata supplied by the client. */
export interface PdfMetadata {
    /** e.g. "Jane Doe - Software Engineer" */
    title: string;
    /** Always "ResumeMe" */
    author: string;
    /** e.g. "Software Engineer Resume" */
    subject: string;
    /** Comma-separated keywords derived from skills, titles, tech stack, etc. */
    keywords: string;
}

interface PdfRequestBody {
    /** Fully self-contained HTML string captured from the browser DOM */
    html: string;
    /** Suggested PDF download filename (without extension) */
    fileName?: string;
    /** Optional PDF document metadata to embed in the Info dictionary */
    metadata?: PdfMetadata;
}

// ---------------------------------------------------------------------------
// PDF incremental update — raw binary metadata injection
// ---------------------------------------------------------------------------

/**
 * Encodes a JavaScript string as a PDF string object.
 *
 * - ASCII-only text → PDF literal string `(text)` with `\`, `(`, `)` escaped.
 * - Any non-ASCII codepoint → PDF hex string `<FEFF...>` in UTF-16BE with BOM,
 *   which all PDF readers support for international characters.
 */
/** @internal exported for unit tests */
export function toPdfString(text: string): string {
    const hasNonAscii = Array.from(text).some((ch) => ch.codePointAt(0)! > 0x7e);

    if (!hasNonAscii) {
        // Literal string — escape the three special chars
        const escaped = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
        return `(${escaped})`;
    }

    // UTF-16BE hex string with BOM
    const bytes: number[] = [0xfe, 0xff]; // BOM
    for (const ch of Array.from(text)) {
        const code = ch.codePointAt(0)!;
        if (code <= 0xffff) {
            bytes.push((code >> 8) & 0xff, code & 0xff);
        } else {
            // Supplementary — encode as surrogate pair
            const hi = 0xd800 + ((code - 0x10000) >> 10);
            const lo = 0xdc00 + ((code - 0x10000) & 0x3ff);
            bytes.push((hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff);
        }
    }
    return `<${bytes.map((b) => b.toString(16).padStart(2, '0')).join('')}>`;
}

/**
 * Formats a Date as a PDF date string: `D:YYYYMMDDHHmmSS+HH'mm'`.
 * Always emits UTC offset `+00'00'` since Workers always run in UTC.
 */
/** @internal exported for unit tests */
export function toPdfDate(date: Date): string {
    const pad = (n: number, w = 2) => String(n).padStart(w, '0');
    return (
        `D:` +
        `${date.getUTCFullYear()}` +
        `${pad(date.getUTCMonth() + 1)}` +
        `${pad(date.getUTCDate())}` +
        `${pad(date.getUTCHours())}` +
        `${pad(date.getUTCMinutes())}` +
        `${pad(date.getUTCSeconds())}` +
        `+00'00'`
    );
}

/**
 * Appends a PDF incremental update to `pdfBytes` that sets/replaces the
 * document Info dictionary (Title, Author, Subject, Keywords, Creator, Producer,
 * CreationDate, ModDate).
 *
 * Strategy — incremental update (PDF spec §7.5.6):
 *  1. Scan the source PDF for the last `startxref` value (= byte offset of the
 *     last cross-reference table, needed for the new trailer's `/Prev` entry).
 *  2. Find the highest existing object number by scanning "N 0 obj" patterns.
 *  3. Append a new Info dictionary object at the current end of the file.
 *  4. Append a minimal cross-reference section for just that one object.
 *  5. Append a new trailer dict that points to the new Info object and
 *     chains back to the previous xref via `/Prev`.
 *
 * This approach is library-free, works with PDF 1.4–2.0, cross-reference
 * streams, AcroForm PDFs, and encrypted-but-not-user-password PDFs (because
 * we never parse nor re-serialise the existing body).
 */
/** @internal exported for unit tests */
export function injectPdfInfoMetadata(pdfBytes: Uint8Array, meta: PdfMetadata, now: Date = new Date()): Uint8Array {
    const enc = new TextEncoder();
    // Decode as latin-1 for pattern matching — we never re-encode this string,
    // so byte positions remain accurate regardless of character encoding.
    const pdfStr = new TextDecoder('latin1').decode(pdfBytes);

    // ── 1. Find the last `startxref` value ──────────────────────────────
    const sxIdx = pdfStr.lastIndexOf('startxref');
    if (sxIdx === -1) return pdfBytes; // not a valid PDF
    const afterSx = pdfStr.slice(sxIdx + 9).trimStart();
    const prevStartxref = parseInt(afterSx, 10);
    if (isNaN(prevStartxref)) return pdfBytes;

    // ── 2. Find the highest existing object number ────────────────────────
    let maxObjNo = 0;
    for (const m of pdfStr.matchAll(/\b(\d+)\s+0\s+obj\b/g)) {
        const n = parseInt(m[1], 10);
        if (n > maxObjNo) maxObjNo = n;
    }

    // ── 3. Find the /Root reference in the last trailer dict ─────────────
    // Strategy A: traditional `trailer` keyword (most Chromium-generated PDFs).
    // Strategy B: scan the whole file for `/Root N 0 R` (cross-reference streams).
    const lastTrailerIdx = pdfStr.lastIndexOf('trailer');
    const trailerSection = lastTrailerIdx >= 0 ? pdfStr.slice(lastTrailerIdx, lastTrailerIdx + 600) : '';
    const rootMatchA = trailerSection.match(/\/Root\s+(\d+\s+0\s+R)/);
    const rootMatchB = rootMatchA ? null : pdfStr.match(/\/Root\s+(\d+\s+0\s+R)/);
    const rootRef = (rootMatchA ?? rootMatchB)?.[1] ?? '1 0 R';

    // ── 4. Build the Info dictionary object ──────────────────────────────
    const infoObjNo = maxObjNo + 1;
    const infoByteOffset = pdfBytes.length; // appended right at the end

    const pdfDate = toPdfString(toPdfDate(now));

    const infoObjText = [
        `${infoObjNo} 0 obj`,
        `<<`,
        `  /Title ${toPdfString(meta.title)}`,
        `  /Author ${toPdfString(meta.author)}`,
        `  /Subject ${toPdfString(meta.subject)}`,
        `  /Keywords ${toPdfString(meta.keywords)}`,
        `  /Creator ${toPdfString('ResumeMe by @thinkdj')}`,
        `  /Producer ${toPdfString('ResumeMe')}`,
        `  /CreationDate ${pdfDate}`,
        `  /ModDate ${pdfDate}`,
        `>>`,
        `endobj`,
        ``, // trailing newline
    ].join('\n');

    const infoObjBytes = enc.encode(infoObjText);

    // ── 5. Build the cross-reference section ─────────────────────────────
    // Each entry is exactly 20 bytes: 10-digit-offset SP 5-digit-gen SP 'n' CRLF
    const offsetStr = String(infoByteOffset).padStart(10, '0');
    // NOTE: xrefEntry must be exactly 20 bytes — offset(10) + SP(1) + gen(5) + SP(1) + 'n'(1) + CRLF(2) = 20
    const xrefEntry = `${offsetStr} 00000 n\r\n`;

    const xrefByteOffset = infoByteOffset + infoObjBytes.length;
    // Build xref section — NOT using array.join() to avoid adding extra newlines
    // after the CRLF already at the end of xrefEntry.
    const xrefText = `xref\n${infoObjNo} 1\n${xrefEntry}`;
    const xrefBytes = enc.encode(xrefText);

    // ── 6. Build the new trailer ──────────────────────────────────────────
    const trailerText = [
        `trailer`,
        `<<`,
        `  /Size ${infoObjNo + 1}`,
        `  /Root ${rootRef}`,
        `  /Info ${infoObjNo} 0 R`,
        `  /Prev ${prevStartxref}`,
        `>>`,
        `startxref`,
        `${xrefByteOffset}`,
        `%%EOF`,
        ``,
    ].join('\n');
    const trailerBytes = enc.encode(trailerText);

    // ── 7. Concatenate: original PDF + new object + xref + trailer ───────
    const result = new Uint8Array(pdfBytes.length + infoObjBytes.length + xrefBytes.length + trailerBytes.length);
    result.set(pdfBytes, 0);
    result.set(infoObjBytes, pdfBytes.length);
    result.set(xrefBytes, pdfBytes.length + infoObjBytes.length);
    result.set(trailerBytes, pdfBytes.length + infoObjBytes.length + xrefBytes.length);
    return result;
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

    // ── 5. Inject PDF metadata via incremental binary update ─────────────
    // Appends a new Info dictionary object + xref + trailer to the end of the
    // Puppeteer-generated PDF. This approach:
    //   • Requires no external library — pure Uint8Array/TextEncoder manipulation.
    //   • Works with any PDF version (1.4, 1.5+ cross-reference streams, etc.)
    //   • Is non-fatal: on any parsing failure the original buffer is preserved.
    if (body.metadata) {
        try {
            pdfBuffer = injectPdfInfoMetadata(pdfBuffer, body.metadata, new Date());
        } catch (metaErr) {
            // Non-fatal — deliver the original Puppeteer buffer without metadata.
            console.warn('[resume-pdf] metadata injection failed:', metaErr);
        }
    }

    // ── 6. Build safe filename ─────────────────────────────────────────────
    const rawName = (body.fileName ?? 'resume').trim();
    const safeName = rawName.replace(/[\\/:*?"<>|]/g, '_');

    // ── 7. Return the PDF ──────────────────────────────────────────────────
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
