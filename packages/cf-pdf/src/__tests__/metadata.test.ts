/**
 * Unit tests for `@ottabase/cf-pdf/metadata`:
 *   - toPdfString  — encodes a JS string as a PDF string object
 *   - toPdfDate    — formats a Date as a PDF date string
 *   - injectPdfInfoMetadata — appends an incremental update to a PDF buffer
 */

import { describe, expect, it } from 'vitest';
import type { PdfMetadata } from '../index';
import { injectPdfInfoMetadata, toPdfDate, toPdfString } from '../metadata';

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
 */
function makeMinimalPdf(): Uint8Array {
    const enc = new TextEncoder();
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

    it('escapes parentheses', () => {
        expect(toPdfString('foo (bar)')).toBe('(foo \\(bar\\))');
    });

    it('produces a UTF-16BE hex string for non-ASCII text', () => {
        const result = toPdfString('é');
        expect(result).toMatch(/^<feff00e9>$/i);
    });

    it('keeps pure-ASCII strings as literal strings', () => {
        expect(toPdfString('AB')).toBe('(AB)');
    });

    it('uses hex encoding for mixed ASCII/non-ASCII', () => {
        const result = toPdfString('Déepak');
        expect(result.startsWith('<')).toBe(true);
        expect(result.endsWith('>')).toBe(true);
    });

    it('handles an empty string', () => {
        expect(toPdfString('')).toBe('()');
    });

    it('handles supplementary plane characters (emoji)', () => {
        const result = toPdfString('📄');
        // Should be hex-encoded, starts with BOM
        expect(result.startsWith('<feff')).toBe(true);
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
        expect(toPdfDate(new Date())).toMatch(/\+00'00'$/);
    });

    it('always starts with D:', () => {
        expect(toPdfDate(new Date()).startsWith('D:')).toBe(true);
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
    it('returns a larger buffer than the original', () => {
        const original = makeMinimalPdf();
        const result = injectPdfInfoMetadata(original, META);
        expect(result.length).toBeGreaterThan(original.length);
    });

    it('preserves the original PDF bytes at the start', () => {
        const original = makeMinimalPdf();
        const result = injectPdfInfoMetadata(original, META);
        expect(Array.from(result.slice(0, original.length))).toEqual(Array.from(original));
    });

    it('appended bytes contain all Info dictionary fields', () => {
        const original = makeMinimalPdf();
        const result = injectPdfInfoMetadata(original, META);
        const appended = new TextDecoder().decode(result.slice(original.length));

        for (const key of [
            '/Title',
            '/Author',
            '/Subject',
            '/Keywords',
            '/Creator',
            '/Producer',
            '/CreationDate',
            '/ModDate',
        ]) {
            expect(appended).toContain(key);
        }
    });

    it('injects the supplied title value', () => {
        const original = makeMinimalPdf();
        const result = injectPdfInfoMetadata(original, META);
        const appended = new TextDecoder().decode(result.slice(original.length));
        expect(appended).toContain('(Jane Doe - Software Engineer)');
    });

    it('uses custom creator and producer strings', () => {
        const original = makeMinimalPdf();
        const result = injectPdfInfoMetadata(original, META, { creator: 'MyApp', producer: 'MyApp PDF' });
        const appended = new TextDecoder().decode(result.slice(original.length));
        expect(appended).toContain('(MyApp)');
        expect(appended).toContain('(MyApp PDF)');
    });

    it('uses the provided `now` date for creation and modification dates', () => {
        const now = new Date('2026-03-03T10:00:00Z');
        const original = makeMinimalPdf();
        const result = injectPdfInfoMetadata(original, META, { now });
        const appended = new TextDecoder().decode(result.slice(original.length));
        expect(appended).toContain("D:20260303100000+00'00'");
    });

    it('contains xref, trailer, startxref, and %%EOF', () => {
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

    it('returns the original buffer when input is not a valid PDF', () => {
        const garbage = new TextEncoder().encode('not a pdf');
        const result = injectPdfInfoMetadata(garbage, META);
        expect(result).toEqual(garbage);
    });

    it('encodes non-ASCII title as a UTF-16BE hex string', () => {
        const original = makeMinimalPdf();
        const result = injectPdfInfoMetadata(original, { ...META, title: 'Résumé' });
        const appended = new TextDecoder('latin1').decode(result.slice(original.length));
        expect(appended).toMatch(/<feff/i);
    });

    it('defaults creator and producer to "cf-pdf"', () => {
        const original = makeMinimalPdf();
        const result = injectPdfInfoMetadata(original, META);
        const appended = new TextDecoder().decode(result.slice(original.length));
        expect(appended).toContain('(cf-pdf)');
    });
});
