import { describe, expect, it } from 'vitest';
import type { PdfMetadata } from '../index';
import { injectPdfInfoMetadata, toPdfDate, toPdfString, type PdfMetadataInjectionResult } from '../metadata';

function makeMinimalPdf(options: { id?: boolean; encrypted?: boolean; trailingNewline?: boolean } = {}): Uint8Array {
    const encoder = new TextEncoder();
    const header = '%PDF-1.4\n';
    const object = '1 0 obj\n<< /Type /Catalog >>\nendobj\n';
    const xrefOffset = encoder.encode(header + object).byteLength;
    const xref = `xref\n0 2\n0000000000 65535 f\r\n${String(encoder.encode(header).byteLength).padStart(10, '0')} 00000 n\r\n`;
    const id = options.id ? ' /ID [<0123ABCD> <4567EFAB>]' : '';
    const encrypt = options.encrypted ? ' /Encrypt 9 0 R' : '';
    const trailer = `trailer\n<< /Size 2 /Root 1 0 R${id}${encrypt} >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return encoder.encode(`${header}${object}${xref}${trailer}${options.trailingNewline ? '\n' : ''}`);
}

function injected(result: PdfMetadataInjectionResult): Uint8Array {
    expect(result.injected).toBe(true);
    if (!result.injected) throw new Error(`Expected metadata injection, received ${result.reason}`);
    return result.pdf;
}

const META: PdfMetadata = {
    title: 'Jane Doe - Software Engineer',
    author: 'Ottabase',
    subject: 'Software Engineer Resume',
    keywords: 'TypeScript, React, Cloudflare',
};

describe('toPdfString', () => {
    it('wraps ordinary ASCII strings in PDF literal strings', () => {
        expect(toPdfString('Hello World')).toBe('(Hello World)');
    });

    it('escapes literal-string delimiters and controls', () => {
        expect(toPdfString('C:\\temp\n(foo)\u0001')).toBe('(C:\\\\temp\\n\\(foo\\)\\001)');
    });

    it('uses UTF-16BE for non-ASCII values', () => {
        expect(toPdfString('R\u00e9sum\u00e9')).toMatch(/^<feff/i);
    });

    it('handles supplementary-plane characters', () => {
        expect(toPdfString('\ud83d\udcc4')).toMatch(/^<feff/i);
    });
});

describe('toPdfDate', () => {
    it("formats a UTC date as D:YYYYMMDDHHmmSS+00'00'", () => {
        expect(toPdfDate(new Date('2026-03-03T14:05:09Z'))).toBe("D:20260303140509+00'00'");
    });

    it('rejects invalid timestamps instead of writing NaN into a PDF', () => {
        expect(() => toPdfDate(new Date('invalid'))).toThrow(RangeError);
    });
});

describe('injectPdfInfoMetadata', () => {
    it('appends a classic incremental update without modifying source bytes', () => {
        const original = makeMinimalPdf();
        const result = injected(injectPdfInfoMetadata(original, META));

        expect(result.byteLength).toBeGreaterThan(original.byteLength);
        expect(Array.from(result.slice(0, original.byteLength))).toEqual(Array.from(original));
        const appended = new TextDecoder('latin1').decode(result.slice(original.byteLength));
        expect(appended).toContain('/Title (Jane Doe - Software Engineer)');
        expect(appended).toContain('/Author (Ottabase)');
        expect(appended).toContain('/Info 2 0 R');
        expect(appended).toContain('/Prev');
        expect(appended).toContain('xref');
        expect(appended).toContain('%%EOF');
    });

    it('uses supplied creator, producer, and timestamp values', () => {
        const original = makeMinimalPdf();
        const result = injected(
            injectPdfInfoMetadata(original, META, {
                creator: 'Ottabase',
                producer: 'Ottabase PDF',
                now: new Date('2026-03-03T10:00:00Z'),
            }),
        );
        const appended = new TextDecoder().decode(result.slice(original.byteLength));

        expect(appended).toContain('/Creator (Ottabase)');
        expect(appended).toContain('/Producer (Ottabase PDF)');
        expect(appended).toContain("D:20260303100000+00'00'");
    });

    it('preserves a classic trailer document identifier', () => {
        const original = makeMinimalPdf({ id: true });
        const result = injected(injectPdfInfoMetadata(original, META));
        const appended = new TextDecoder().decode(result.slice(original.byteLength));

        expect(appended).toContain('/ID [<0123ABCD> <4567EFAB>]');
    });

    it('inserts a separator when the source does not end with a newline', () => {
        const original = makeMinimalPdf({ trailingNewline: false });
        const result = injected(injectPdfInfoMetadata(original, META));
        const appended = new TextDecoder().decode(result.slice(original.byteLength));

        expect(appended.startsWith('\n2 0 obj')).toBe(true);
    });

    it('returns an explicit unchanged result for invalid PDF input', () => {
        const original = new TextEncoder().encode('not a PDF');
        const result = injectPdfInfoMetadata(original, META);

        expect(result).toEqual({ pdf: original, injected: false, reason: 'INVALID_PDF' });
    });

    it('does not claim support for cross-reference streams', () => {
        const original = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<< /Type /XRef >>\nendobj\nstartxref\n9\n%%EOF');
        const result = injectPdfInfoMetadata(original, META);

        expect(result.injected).toBe(false);
        if (!result.injected) expect(result.reason).toBe('UNSUPPORTED_XREF');
    });

    it('does not mutate encrypted PDFs', () => {
        const original = makeMinimalPdf({ encrypted: true });
        const result = injectPdfInfoMetadata(original, META);

        expect(result.injected).toBe(false);
        if (!result.injected) expect(result.reason).toBe('ENCRYPTED_PDF');
    });

    it('rejects invalid metadata before appending bytes', () => {
        const original = makeMinimalPdf();
        const result = injectPdfInfoMetadata(original, { ...META, title: 'x'.repeat(4_097) });

        expect(result).toEqual({ pdf: original, injected: false, reason: 'INVALID_METADATA' });
    });
});
