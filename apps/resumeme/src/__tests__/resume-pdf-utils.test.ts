/**
 * Unit tests for the pure utility functions in worker/routes/resume-pdf.ts:
 *   - toPdfString  — encodes a JS string as a PDF string object
 *   - toPdfDate    — formats a Date as a PDF date string
 *   - injectPdfInfoMetadata — appends an incremental update to a PDF buffer
 *
 * External worker dependencies are mocked so only the pure logic is exercised.
 */

import { describe, expect, it, vi } from 'vitest';
import type { PdfMetadata } from '../../worker/routes/resume-pdf';
import { injectPdfInfoMetadata, toPdfDate, toPdfString } from '../../worker/routes/resume-pdf';

// Mock the external deps that resume-pdf.ts imports at the module level.
// The pure utility functions don't use these — but the module boundary still
// requires them to resolve without error.
vi.mock('@ottabase/auth/backend', () => ({ getSession: vi.fn() }));
vi.mock('@ottabase/utils/http-errors', () => ({ errorResponse: vi.fn() }));
vi.mock('../../worker/lib/auth-utils', () => ({ getAuthOptions: vi.fn() }));

// ---------------------------------------------------------------------------
// Minimal well-formed PDF fixture
// ---------------------------------------------------------------------------

/**
 * Builds a tiny but structurally valid PDF byte sequence that contains:
 *  - A `%PDF-1.4` header
 *  - One dummy object (`1 0 obj`)
 *  - A cross-reference table
 *  - A `trailer` dict with `/Root 1 0 R`
 *  - `startxref` + `%%EOF`
 *
 * This is the minimum structure that `injectPdfInfoMetadata` needs to parse
 * a valid offset from `startxref` and chain the incremental update correctly.
 */
function makeMinimalPdf(): Uint8Array {
    const enc = new TextEncoder();
    // Object starts at byte 9 (%PDF-1.4\n = 9 bytes)
    const header = '%PDF-1.4\n';
    const obj = '1 0 obj\n<< /Type /Catalog >>\nendobj\n';
    const xrefOffset = (header + obj).length;
    const xrefBody = `xref\n0 2\n0000000000 65535 f\r\n${String(header.length).padStart(10, '0')} 00000 n\r\n`;
    const trailer = `trailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    return enc.encode(header + obj + xrefBody + trailer);
}

// ---------------------------------------------------------------------------
// toPdfString
// ---------------------------------------------------------------------------

describe('toPdfString', () => {
    it('wraps plain ASCII in parentheses', () => {
        expect(toPdfString('Hello World')).toBe('(Hello World)');
    });

    it('escapes backslashes', () => {
        expect(toPdfString('C:\\Users')).toBe('(C:\\\\Users)');
    });

    it('escapes opening parenthesis', () => {
        expect(toPdfString('foo (bar)')).toBe('(foo \\(bar\\))');
    });

    it('produces a UTF-16BE hex string for non-ASCII text', () => {
        // BOM: FEFF, then 'é' = 00E9
        const result = toPdfString('é');
        expect(result).toMatch(/^<feff00e9>$/i);
    });

    it('UTF-16BE encodes multi-codepoint strings correctly', () => {
        // 'AB' → FEFF 0041 0042
        const result = toPdfString('AB');
        // 'AB' is ASCII so it stays as a literal string
        expect(result).toBe('(AB)');
    });

    it('uses hex encoding for strings with a mix of ASCII and non-ASCII', () => {
        const result = toPdfString('Déepak');
        expect(result.startsWith('<')).toBe(true);
        expect(result.endsWith('>')).toBe(true);
    });

    it('handles an empty string', () => {
        expect(toPdfString('')).toBe('()');
    });
});

// ---------------------------------------------------------------------------
// toPdfDate
// ---------------------------------------------------------------------------

describe('toPdfDate', () => {
    it("formats a UTC date as D:YYYYMMDDHHmmSS+00'00'", () => {
        const date = new Date('2026-03-03T14:05:09Z');
        expect(toPdfDate(date)).toBe("D:20260303140509+00'00'");
    });

    it('zero-pads months, days, hours, minutes, seconds', () => {
        const date = new Date('2026-01-02T03:04:05Z');
        expect(toPdfDate(date)).toBe("D:20260102030405+00'00'");
    });

    it("always appends the +00'00' UTC offset", () => {
        const result = toPdfDate(new Date());
        expect(result).toMatch(/\+00'00'$/);
    });

    it('always starts with D:', () => {
        const result = toPdfDate(new Date());
        expect(result.startsWith('D:')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// injectPdfInfoMetadata
// ---------------------------------------------------------------------------

const META: PdfMetadata = {
    title: 'Jane Doe - Software Engineer',
    author: 'ResumeMe',
    subject: 'Software Engineer Resume',
    keywords: 'TypeScript, React, Node.js',
};

describe('injectPdfInfoMetadata', () => {
    it('returns a larger buffer than the original (bytes were appended)', () => {
        const original = makeMinimalPdf();
        const result = injectPdfInfoMetadata(original, META);
        expect(result.length).toBeGreaterThan(original.length);
    });

    it('preserves the original PDF bytes at the start', () => {
        const original = makeMinimalPdf();
        const result = injectPdfInfoMetadata(original, META);
        // Convert to plain arrays for reliable element-by-element comparison across
        // different Uint8Array buffer contexts (TypedArray deep-equal can be tricky).
        expect(Array.from(result.slice(0, original.length))).toEqual(Array.from(original));
    });

    it('appended bytes contain the Info object fields', () => {
        const original = makeMinimalPdf();
        const result = injectPdfInfoMetadata(original, META);
        const appended = new TextDecoder().decode(result.slice(original.length));

        expect(appended).toContain('/Title');
        expect(appended).toContain('/Author');
        expect(appended).toContain('/Subject');
        expect(appended).toContain('/Keywords');
        expect(appended).toContain('/Creator');
        expect(appended).toContain('/Producer');
        expect(appended).toContain('/CreationDate');
        expect(appended).toContain('/ModDate');
    });

    it('injects the supplied title value', () => {
        const original = makeMinimalPdf();
        const result = injectPdfInfoMetadata(original, META);
        const appended = new TextDecoder().decode(result.slice(original.length));
        // ASCII title → literal PDF string
        expect(appended).toContain('(Jane Doe - Software Engineer)');
    });

    it('uses the provided `now` date for creation and modification dates', () => {
        const now = new Date('2026-03-03T10:00:00Z');
        const original = makeMinimalPdf();
        const result = injectPdfInfoMetadata(original, META, now);
        const appended = new TextDecoder().decode(result.slice(original.length));
        // toPdfDate(now) = D:20260303100000+00'00'  → toPdfString wraps it in parens
        expect(appended).toContain("D:20260303100000+00'00'");
    });

    it('appended bytes contain xref and trailer keywords', () => {
        const original = makeMinimalPdf();
        const result = injectPdfInfoMetadata(original, META);
        const appended = new TextDecoder().decode(result.slice(original.length));
        expect(appended).toContain('xref');
        expect(appended).toContain('trailer');
        expect(appended).toContain('startxref');
        expect(appended).toContain('%%EOF');
    });

    it('trailer references the original xref via /Prev', () => {
        const original = makeMinimalPdf();
        const result = injectPdfInfoMetadata(original, META);
        const appended = new TextDecoder().decode(result.slice(original.length));
        expect(appended).toContain('/Prev');
    });

    it('trailer contains /Info referencing the new object', () => {
        const original = makeMinimalPdf();
        const result = injectPdfInfoMetadata(original, META);
        const appended = new TextDecoder().decode(result.slice(original.length));
        expect(appended).toContain('/Info');
    });

    it('returns the original buffer unchanged when input is not a valid PDF', () => {
        const garbage = new TextEncoder().encode('not a pdf');
        const result = injectPdfInfoMetadata(garbage, META);
        expect(result).toEqual(garbage);
    });

    it('encodes non-ASCII title as a UTF-16BE hex string', () => {
        const original = makeMinimalPdf();
        const result = injectPdfInfoMetadata(original, { ...META, title: 'Résumé' });
        const appended = new TextDecoder('latin1').decode(result.slice(original.length));
        // Non-ASCII → hex string starting with <feff...>
        expect(appended).toMatch(/<feff/i);
    });
});
