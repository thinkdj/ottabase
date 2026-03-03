/**
 * PDF binary metadata injection — zero-dependency incremental update.
 *
 * Appends a new Info dictionary to any existing PDF via the incremental update
 * mechanism (PDF spec §7.5.6). Works with PDF 1.4–2.0, cross-reference streams,
 * and any structure Puppeteer / Chromium produces.
 *
 * @example
 * ```ts
 * import { injectPdfInfoMetadata } from '@ottabase/cf-pdf/metadata';
 *
 * const enriched = injectPdfInfoMetadata(pdfBytes, {
 *     title: 'My Document',
 *     author: 'Acme Corp',
 *     subject: 'Quarterly Report',
 *     keywords: 'finance, Q1, 2026',
 * });
 * ```
 *
 * @module
 */

import type { PdfMetadata } from './index';

// ---------------------------------------------------------------------------
// PDF string encoding
// ---------------------------------------------------------------------------

/**
 * Encodes a JavaScript string as a PDF string object.
 *
 * - ASCII-only text → PDF literal string `(text)` with `\`, `(`, `)` escaped.
 * - Any non-ASCII codepoint → PDF hex string `<FEFF...>` in UTF-16BE with BOM,
 *   which all PDF readers support for international characters.
 */
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

// ---------------------------------------------------------------------------
// PDF date encoding
// ---------------------------------------------------------------------------

/**
 * Formats a `Date` as a PDF date string: `D:YYYYMMDDHHmmSS+00'00'`.
 *
 * Always emits UTC (`+00'00'`) — Cloudflare Workers run in UTC and most
 * PDF readers normalise to local time on display anyway.
 */
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

// ---------------------------------------------------------------------------
// Incremental PDF update — Info dictionary injection
// ---------------------------------------------------------------------------

/**
 * Appends a PDF incremental update that sets/replaces the document Info
 * dictionary (Title, Author, Subject, Keywords, Creator, Producer,
 * CreationDate, ModDate).
 *
 * Strategy — incremental update (PDF spec §7.5.6):
 *  1. Scan the source PDF for the last `startxref` value (byte offset of the
 *     last cross-reference table, needed for the new trailer's `/Prev` entry).
 *  2. Find the highest existing object number via `N 0 obj` patterns.
 *  3. Append a new Info dictionary object at the current end of the file.
 *  4. Append a minimal cross-reference section for just that one object.
 *  5. Append a new trailer that points to the new Info object and chains back
 *     to the previous xref via `/Prev`.
 *
 * This approach is library-free, works with PDF 1.4–2.0, cross-reference
 * streams, AcroForm PDFs, and encrypted-but-not-user-password PDFs (because
 * we never parse nor re-serialise the existing body).
 *
 * @param pdfBytes  Original PDF file bytes (e.g. from Puppeteer's `page.pdf()`).
 * @param meta      Metadata fields to embed.
 * @param options   Optional overrides.
 * @param options.creator   `/Creator` field (default: `'cf-pdf'`).
 * @param options.producer  `/Producer` field (default: `'cf-pdf'`).
 * @param options.now       Timestamp for `/CreationDate` and `/ModDate` (default: `new Date()`).
 * @returns A new `Uint8Array` with the incremental update appended, or the
 *          original buffer unchanged if the input is not a valid PDF.
 */
export function injectPdfInfoMetadata(
    pdfBytes: Uint8Array,
    meta: PdfMetadata,
    options: { creator?: string; producer?: string; now?: Date } = {},
): Uint8Array {
    const { creator = 'cf-pdf', producer = 'cf-pdf', now = new Date() } = options;
    const enc = new TextEncoder();

    // Decode as latin-1 for pattern matching — byte positions remain accurate.
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

    // ── 3. Find the /Root reference in the last trailer ──────────────────
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
        `  /Creator ${toPdfString(creator)}`,
        `  /Producer ${toPdfString(producer)}`,
        `  /CreationDate ${pdfDate}`,
        `  /ModDate ${pdfDate}`,
        `>>`,
        `endobj`,
        ``, // trailing newline
    ].join('\n');

    const infoObjBytes = enc.encode(infoObjText);

    // ── 5. Build the cross-reference section ─────────────────────────────
    // Each entry is exactly 20 bytes: offset(10) SP gen(5) SP 'n' CRLF = 20
    const offsetStr = String(infoByteOffset).padStart(10, '0');
    const xrefEntry = `${offsetStr} 00000 n\r\n`;

    const xrefByteOffset = infoByteOffset + infoObjBytes.length;
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

    // ── 7. Concatenate: original PDF + Info object + xref + trailer ──────
    const result = new Uint8Array(pdfBytes.length + infoObjBytes.length + xrefBytes.length + trailerBytes.length);
    result.set(pdfBytes, 0);
    result.set(infoObjBytes, pdfBytes.length);
    result.set(xrefBytes, pdfBytes.length + infoObjBytes.length);
    result.set(trailerBytes, pdfBytes.length + infoObjBytes.length + xrefBytes.length);
    return result;
}
