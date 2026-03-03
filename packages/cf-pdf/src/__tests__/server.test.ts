/**
 * Unit tests for `@ottabase/cf-pdf/server`:
 *   - buildPdfResponse — wraps PDF bytes in a Response with correct headers
 *
 * `generatePdf` is not unit-testable without a real Puppeteer/browser binding,
 * but `buildPdfResponse` is a pure function.
 */

import { describe, expect, it } from 'vitest';
import { buildPdfResponse } from '../server';

describe('buildPdfResponse', () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF

    it('returns a 200 status', () => {
        const res = buildPdfResponse(pdf, 'test');
        expect(res.status).toBe(200);
    });

    it('sets Content-Type to application/pdf', () => {
        const res = buildPdfResponse(pdf, 'test');
        expect(res.headers.get('Content-Type')).toBe('application/pdf');
    });

    it('sets Content-Disposition with the sanitised filename', () => {
        const res = buildPdfResponse(pdf, 'my:report');
        expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="my_report.pdf"');
    });

    it('sets Content-Length matching buffer size', () => {
        const res = buildPdfResponse(pdf, 'test');
        expect(res.headers.get('Content-Length')).toBe(String(pdf.byteLength));
    });

    it('sets Cache-Control to no-store', () => {
        const res = buildPdfResponse(pdf, 'test');
        expect(res.headers.get('Cache-Control')).toBe('no-store');
    });

    it('defaults filename to "document" when empty', () => {
        const res = buildPdfResponse(pdf, '');
        expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="document.pdf"');
    });

    it('defaults filename to "document" when not provided', () => {
        const res = buildPdfResponse(pdf);
        expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="document.pdf"');
    });
});
