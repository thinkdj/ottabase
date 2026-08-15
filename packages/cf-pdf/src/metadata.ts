/**
 * Safe PDF Info-dictionary injection for Chromium/Puppeteer PDFs.
 *
 * The implementation intentionally supports the classic `xref` table format
 * emitted by Chromium. It does not attempt to mutate cross-reference streams
 * or encrypted PDFs: a failed capability check returns the untouched bytes
 * with an explicit reason instead of producing a structurally dubious file.
 */

import type { PdfMetadata } from './types';

const MAX_METADATA_VALUE_LENGTH = 4_096;
const MAX_PDF_BYTES = 25 * 1024 * 1024;

export type PdfMetadataInjectionFailure =
    | 'INVALID_PDF'
    | 'UNSUPPORTED_XREF'
    | 'ENCRYPTED_PDF'
    | 'INVALID_METADATA'
    | 'INVALID_DATE'
    | 'PDF_TOO_LARGE';

export type PdfMetadataInjectionResult =
    | { pdf: Uint8Array; injected: true }
    | { pdf: Uint8Array; injected: false; reason: PdfMetadataInjectionFailure };

interface ParsedTrailer {
    rootRef: string;
    size: number;
    id?: string;
}

function unchanged(pdf: Uint8Array, reason: PdfMetadataInjectionFailure): PdfMetadataInjectionResult {
    return { pdf, injected: false, reason };
}

/** Encodes a JavaScript string as a safe PDF literal or UTF-16BE hex string. */
export function toPdfString(text: string): string {
    const hasNonAscii = Array.from(text).some((character) => character.codePointAt(0)! > 0x7e);

    if (!hasNonAscii) {
        const escaped = Array.from(text)
            .map((character) => {
                switch (character) {
                    case '\\':
                        return '\\\\';
                    case '(':
                        return '\\(';
                    case ')':
                        return '\\)';
                    case '\n':
                        return '\\n';
                    case '\r':
                        return '\\r';
                    case '\t':
                        return '\\t';
                    case '\b':
                        return '\\b';
                    case '\f':
                        return '\\f';
                    default: {
                        const code = character.charCodeAt(0);
                        return code < 0x20 || code === 0x7f ? `\\${code.toString(8).padStart(3, '0')}` : character;
                    }
                }
            })
            .join('');
        return `(${escaped})`;
    }

    const bytes: number[] = [0xfe, 0xff];
    for (const character of Array.from(text)) {
        const code = character.codePointAt(0)!;
        if (code <= 0xffff) {
            bytes.push((code >> 8) & 0xff, code & 0xff);
            continue;
        }

        const highSurrogate = 0xd800 + ((code - 0x10000) >> 10);
        const lowSurrogate = 0xdc00 + ((code - 0x10000) & 0x3ff);
        bytes.push((highSurrogate >> 8) & 0xff, highSurrogate & 0xff, (lowSurrogate >> 8) & 0xff, lowSurrogate & 0xff);
    }
    return `<${bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')}>`;
}

/** Formats a valid Date as a UTC PDF date string. */
export function toPdfDate(date: Date): string {
    if (!Number.isFinite(date.getTime())) {
        throw new RangeError('A valid Date is required for PDF metadata.');
    }

    const pad = (value: number, width = 2) => String(value).padStart(width, '0');
    return (
        `D:${date.getUTCFullYear()}` +
        `${pad(date.getUTCMonth() + 1)}` +
        `${pad(date.getUTCDate())}` +
        `${pad(date.getUTCHours())}` +
        `${pad(date.getUTCMinutes())}` +
        `${pad(date.getUTCSeconds())}` +
        `+00'00'`
    );
}

function findDictionaryEnd(pdf: string, start: number): number | undefined {
    let depth = 0;
    let literalString = false;
    let escaped = false;
    let hexString = false;

    for (let index = start; index < pdf.length; index += 1) {
        const character = pdf[index];

        if (literalString) {
            if (escaped) {
                escaped = false;
            } else if (character === '\\') {
                escaped = true;
            } else if (character === ')') {
                literalString = false;
            }
            continue;
        }

        if (hexString) {
            if (character === '>') hexString = false;
            continue;
        }

        if (character === '(') {
            literalString = true;
            continue;
        }
        if (character === '<' && pdf[index + 1] !== '<') {
            hexString = true;
            continue;
        }
        if (character === '<' && pdf[index + 1] === '<') {
            depth += 1;
            index += 1;
            continue;
        }
        if (character === '>' && pdf[index + 1] === '>') {
            depth -= 1;
            index += 1;
            if (depth === 0) return index + 1;
        }
    }

    return undefined;
}

function parseClassicTrailer(
    pdf: string,
    xrefOffset: number,
    startxrefIndex: number,
): ParsedTrailer | PdfMetadataInjectionFailure {
    if (!pdf.startsWith('xref', xrefOffset) || !/[\t\n\f\r ]/.test(pdf[xrefOffset + 4] ?? '')) {
        return 'UNSUPPORTED_XREF';
    }

    const trailerIndex = pdf.indexOf('trailer', xrefOffset + 4);
    if (trailerIndex === -1 || trailerIndex >= startxrefIndex) return 'UNSUPPORTED_XREF';

    const dictionaryStart = pdf.indexOf('<<', trailerIndex + 'trailer'.length);
    if (dictionaryStart === -1 || dictionaryStart >= startxrefIndex) return 'INVALID_PDF';

    const dictionaryEnd = findDictionaryEnd(pdf, dictionaryStart);
    if (!dictionaryEnd || dictionaryEnd > startxrefIndex) return 'INVALID_PDF';

    const dictionary = pdf.slice(dictionaryStart, dictionaryEnd);
    if (/\/Encrypt\b/.test(dictionary)) return 'ENCRYPTED_PDF';

    const root = /\/Root\s+(\d+)\s+(\d+)\s+R\b/.exec(dictionary);
    const size = /\/Size\s+(\d+)\b/.exec(dictionary);
    if (!root || !size) return 'INVALID_PDF';

    const parsedSize = Number(size[1]);
    if (!Number.isSafeInteger(parsedSize) || parsedSize < 1) return 'INVALID_PDF';

    const id = /\/ID\s*(\[\s*<[\dA-Fa-f\s]*>\s*<[\dA-Fa-f\s]*>\s*\])/.exec(dictionary)?.[1];
    return { rootRef: `${root[1]} ${root[2]} R`, size: parsedSize, id };
}

function maxObjectNumber(pdf: string): number | undefined {
    let maximum = 0;
    for (const match of pdf.matchAll(/\b(\d+)\s+\d+\s+obj\b/g)) {
        const objectNumber = Number(match[1]);
        if (!Number.isSafeInteger(objectNumber)) return undefined;
        maximum = Math.max(maximum, objectNumber);
    }
    return maximum;
}

function hasUsableMetadata(meta: PdfMetadata, creator: string, producer: string, now: Date): boolean {
    const values = [meta.title, meta.author, meta.subject, meta.keywords, creator, producer];
    return (
        values.every((value) => typeof value === 'string' && value.length <= MAX_METADATA_VALUE_LENGTH) &&
        Number.isFinite(now.getTime())
    );
}

/**
 * Append an Info-dictionary incremental update to a classic-xref PDF.
 *
 * The original byte view is returned untouched whenever the source falls
 * outside this deliberately narrow capability (for example encrypted PDFs or
 * xref streams). Consumers can safely return the PDF without metadata in that
 * case and optionally record the `reason` for observability.
 */
export function injectPdfInfoMetadata(
    pdfBytes: Uint8Array,
    meta: PdfMetadata,
    options: { creator?: string; producer?: string; now?: Date } = {},
): PdfMetadataInjectionResult {
    if (pdfBytes.byteLength === 0 || pdfBytes.byteLength > MAX_PDF_BYTES) {
        return unchanged(pdfBytes, pdfBytes.byteLength > MAX_PDF_BYTES ? 'PDF_TOO_LARGE' : 'INVALID_PDF');
    }

    const { creator = 'cf-pdf', producer = 'cf-pdf', now = new Date() } = options;
    if (!hasUsableMetadata(meta, creator, producer, now)) {
        return unchanged(pdfBytes, Number.isFinite(now.getTime()) ? 'INVALID_METADATA' : 'INVALID_DATE');
    }

    const pdf = new TextDecoder('latin1').decode(pdfBytes);
    if (!pdf.startsWith('%PDF-')) return unchanged(pdfBytes, 'INVALID_PDF');

    const startxrefIndex = pdf.lastIndexOf('startxref');
    if (startxrefIndex === -1) return unchanged(pdfBytes, 'INVALID_PDF');

    const startxref = /^startxref[\t\n\f\r ]+(\d+)[\t\n\f\r ]+%%EOF/.exec(pdf.slice(startxrefIndex));
    if (!startxref) return unchanged(pdfBytes, 'INVALID_PDF');

    const previousXrefOffset = Number(startxref[1]);
    if (!Number.isSafeInteger(previousXrefOffset) || previousXrefOffset < 0 || previousXrefOffset >= pdf.length) {
        return unchanged(pdfBytes, 'INVALID_PDF');
    }

    const trailer = parseClassicTrailer(pdf, previousXrefOffset, startxrefIndex);
    if (typeof trailer === 'string') return unchanged(pdfBytes, trailer);

    const maximumObject = maxObjectNumber(pdf);
    if (maximumObject === undefined) return unchanged(pdfBytes, 'INVALID_PDF');

    const infoObjectNumber = Math.max(trailer.size, maximumObject + 1);
    if (!Number.isSafeInteger(infoObjectNumber) || infoObjectNumber > 9_999_999) {
        return unchanged(pdfBytes, 'INVALID_PDF');
    }

    const encoder = new TextEncoder();
    const needsSeparator = ![0x0a, 0x0d].includes(pdfBytes[pdfBytes.byteLength - 1]);
    const separator = needsSeparator ? '\n' : '';
    const infoObjectOffset = pdfBytes.byteLength + encoder.encode(separator).byteLength;
    const date = toPdfString(toPdfDate(now));
    const infoObject = encoder.encode(
        [
            `${separator}${infoObjectNumber} 0 obj`,
            '<<',
            `  /Title ${toPdfString(meta.title)}`,
            `  /Author ${toPdfString(meta.author)}`,
            `  /Subject ${toPdfString(meta.subject)}`,
            `  /Keywords ${toPdfString(meta.keywords)}`,
            `  /Creator ${toPdfString(creator)}`,
            `  /Producer ${toPdfString(producer)}`,
            `  /CreationDate ${date}`,
            `  /ModDate ${date}`,
            '>>',
            'endobj',
            '',
        ].join('\n'),
    );

    if (infoObjectOffset > 9_999_999_999) return unchanged(pdfBytes, 'INVALID_PDF');

    const xrefOffset = infoObjectOffset + infoObject.byteLength;
    if (xrefOffset > 9_999_999_999) return unchanged(pdfBytes, 'INVALID_PDF');

    const xref = encoder.encode(
        `xref\n${infoObjectNumber} 1\n${String(infoObjectOffset).padStart(10, '0')} 00000 n\r\n`,
    );
    const nextSize = Math.max(trailer.size, infoObjectNumber + 1);
    const trailerId = trailer.id ? `\n  /ID ${trailer.id}` : '';
    const updateTrailer = encoder.encode(
        [
            'trailer',
            '<<',
            `  /Size ${nextSize}`,
            `  /Root ${trailer.rootRef}`,
            `  /Info ${infoObjectNumber} 0 R`,
            `  /Prev ${previousXrefOffset}${trailerId}`,
            '>>',
            'startxref',
            String(xrefOffset),
            '%%EOF',
            '',
        ].join('\n'),
    );

    const result = new Uint8Array(
        pdfBytes.byteLength + infoObject.byteLength + xref.byteLength + updateTrailer.byteLength,
    );
    result.set(pdfBytes, 0);
    result.set(infoObject, pdfBytes.byteLength);
    result.set(xref, pdfBytes.byteLength + infoObject.byteLength);
    result.set(updateTrailer, pdfBytes.byteLength + infoObject.byteLength + xref.byteLength);
    return { pdf: result, injected: true };
}
