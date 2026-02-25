import type { MetadataGroup, MetadataSection, YouchHTMLOptions, ParsedError, StackFrame } from './types.js';
import { parseError } from './parser.js';
import { renderHTML } from './renderer.js';

/**
 * Youch — Pretty print JavaScript errors as self-contained HTML pages.
 *
 * Edge-runtime compatible (no Node.js `fs`). Inspired by poppinss/youch.
 *
 * @example
 * ```ts
 * import { Youch } from '@ottabase/youch';
 *
 * const youch = new Youch();
 *
 * // Add request metadata
 * youch.group('Request', {
 *     headers: [
 *         { key: 'host', value: request.headers.get('host') },
 *         { key: 'user-agent', value: request.headers.get('user-agent') },
 *     ],
 * });
 *
 * // Render error to HTML
 * const html = youch.toHTML(error);
 * return new Response(html, {
 *     status: 500,
 *     headers: { 'Content-Type': 'text/html' },
 * });
 * ```
 */
export class Youch {
    #metadata: MetadataGroup[] = [];

    /**
     * Add a metadata group (e.g., "Request", "Environment").
     * Calling with the same group name merges sections.
     *
     * @param name - Group name
     * @param sections - Record of section name → array of key/value rows
     */
    group(name: string, sections: Record<string, MetadataSection>): this {
        const existing = this.#metadata.find((g) => g.name === name);
        if (existing) {
            Object.assign(existing.sections, sections);
        } else {
            this.#metadata.push({ name, sections });
        }
        return this;
    }

    /**
     * Add request metadata from a standard Request object.
     * Extracts method, URL, and common headers.
     */
    addRequestMetadata(request: Request): this {
        const url = new URL(request.url);
        const headerRows: { key: string; value: unknown }[] = [];

        // Collect important headers
        const importantHeaders = [
            'host',
            'user-agent',
            'accept',
            'content-type',
            'authorization',
            'cookie',
            'referer',
            'x-forwarded-for',
            'x-real-ip',
            'cf-connecting-ip',
            'cf-ray',
        ];

        for (const name of importantHeaders) {
            const value = request.headers.get(name);
            if (value) {
                // Mask sensitive headers
                const masked = name === 'authorization' || name === 'cookie' ? maskValue(value) : value;
                headerRows.push({ key: name, value: masked });
            }
        }

        return this.group('Request', {
            info: [
                { key: 'Method', value: request.method },
                { key: 'URL', value: request.url },
                { key: 'Pathname', value: url.pathname },
                ...(url.search ? [{ key: 'Query', value: url.search }] : []),
            ],
            ...(headerRows.length > 0 ? { headers: headerRows } : {}),
        });
    }

    /**
     * Parse an error into a structured ParsedError object.
     *
     * @param error - The error to parse (Error instance, string, or any thrown value)
     * @param offset - Number of stack frames to skip
     */
    parse(error: unknown, offset: number = 0): ParsedError {
        return parseError(error, offset);
    }

    /**
     * Render an error as a self-contained HTML page.
     *
     * @param error - The error to render
     * @param options - HTML rendering options
     * @returns Complete HTML document string
     */
    toHTML(error: unknown, options?: YouchHTMLOptions): string {
        const parsed = parseError(error, options?.offset);
        return renderHTML(parsed, this.#metadata, {
            title: options?.title,
            ide: options?.ide,
            cspNonce: options?.cspNonce,
        });
    }
}

/**
 * Mask a sensitive string, showing only the first and last 4 characters.
 */
function maskValue(value: string): string {
    if (value.length <= 8) return '****';
    return value.slice(0, 4) + '****' + value.slice(-4);
}

// ─── Re-exports ──────────────────────────────────────────────────────────
export { parseError } from './parser.js';
export { renderHTML } from './renderer.js';
export type {
    ParsedError,
    StackFrame,
    MetadataGroup,
    MetadataSection,
    MetadataRow,
    YouchHTMLOptions,
} from './types.js';
