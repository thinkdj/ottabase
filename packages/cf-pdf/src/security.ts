/**
 * Shared security primitives for both the browser and Worker entrypoints.
 *
 * The package renders user-provided document markup, so resource origins and
 * response filenames must be normalized before they cross a browser or HTTP
 * boundary. These helpers deliberately use narrow allowlists rather than
 * trying to infer intent from arbitrary strings.
 */

export const DEFAULT_PDF_RESOURCE_ORIGINS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'] as const;

const MAX_RESOURCE_ORIGINS = 12;
const MAX_FILENAME_LENGTH = 120;

export type PdfRenderErrorCode =
    | 'INVALID_PDF_OPTION'
    | 'INVALID_RESOURCE_ORIGIN'
    | 'PDF_INPUT_TOO_LARGE'
    | 'PDF_OUTPUT_TOO_LARGE'
    | 'PDF_BROWSER_CLOSE_FAILED';

/** A safe, stable error for callers to map to an API response. */
export class PdfRenderError extends Error {
    readonly code: PdfRenderErrorCode;

    constructor(code: PdfRenderErrorCode, message: string) {
        super(message);
        this.name = 'PdfRenderError';
        this.code = code;
    }
}

export function isPdfRenderError(error: unknown): error is PdfRenderError {
    return error instanceof PdfRenderError;
}

/**
 * Normalize a small, explicit set of HTTPS origins. Paths, credentials, and
 * query strings are discarded deliberately: the browser policy works at the
 * origin boundary, never as a user-controlled URL filter.
 */
export function normalizePdfResourceOrigins(
    rawOrigins: readonly string[] | undefined,
    fallbackOrigins: readonly string[] = [],
): string[] {
    const origins = rawOrigins ?? fallbackOrigins;
    if (!Array.isArray(origins) || origins.length > MAX_RESOURCE_ORIGINS) {
        throw new PdfRenderError('INVALID_RESOURCE_ORIGIN', 'Too many PDF resource origins were supplied.');
    }

    const normalized = new Set<string>();
    for (const rawOrigin of origins) {
        if (typeof rawOrigin !== 'string' || rawOrigin.length === 0 || rawOrigin.length > 256) {
            throw new PdfRenderError('INVALID_RESOURCE_ORIGIN', 'A PDF resource origin is invalid.');
        }

        let parsed: URL;
        try {
            parsed = new URL(rawOrigin);
        } catch {
            throw new PdfRenderError('INVALID_RESOURCE_ORIGIN', 'A PDF resource origin is invalid.');
        }

        if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
            throw new PdfRenderError('INVALID_RESOURCE_ORIGIN', 'PDF resources must use HTTPS origins.');
        }

        normalized.add(parsed.origin);
    }

    return [...normalized];
}

/**
 * Produce a filesystem-safe filename while removing all HTTP header control
 * characters. This is safe for browser downloads; the server applies an
 * additional ASCII fallback for Content-Disposition.
 */
export function sanitizeFileName(value: string, fallback = 'document'): string {
    const normalized = (typeof value === 'string' ? value : '')
        .normalize('NFKC')
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[. ]+$/g, '')
        .slice(0, MAX_FILENAME_LENGTH);

    return normalized || fallback;
}

/** Build an RFC 5987-compatible, injection-safe Content-Disposition value. */
export function buildPdfContentDisposition(fileName: string): string {
    const baseName = sanitizeFileName(fileName.replace(/\.pdf$/i, ''));
    const fullName = `${baseName}.pdf`;
    const asciiFallback = sanitizeFileName(baseName.normalize('NFKD').replace(/[^\x20-\x7E]/g, '_'))
        .replace(/[^A-Za-z0-9._ -]/g, '_')
        .slice(0, MAX_FILENAME_LENGTH);
    const encoded = encodeURIComponent(fullName).replace(
        /[!'()*]/g,
        (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );

    return `attachment; filename="${asciiFallback}.pdf"; filename*=UTF-8''${encoded}`;
}
