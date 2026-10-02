import createDOMPurify from 'dompurify';

type SanitizeConfig = Record<string, unknown>;
type ProcessLike = {
    versions?: {
        node?: unknown;
    };
};

const EMPTY_STRING = '';
const SCRIPT_TAG_PATTERN = /<script[\s\S]*?>[\s\S]*?<\/script>/gi;
const STYLE_TAG_PATTERN = /<style[\s\S]*?>[\s\S]*?<\/style>/gi;
const EVENT_HANDLER_ATTR_PATTERN = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const LINK_ATTR_PATTERN = /\s(href|src|xlink:href|formaction)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const HTML_TAG_PATTERN = /<\/?([a-z][a-z0-9:-]*)(\s[^>]*)?>/gi;
const ATTRIBUTE_PATTERN = /([^\s=/>]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gi;
const JSON_SCRIPT_ESCAPE_PATTERN = /[<>&\u2028\u2029]/g;
const CSS_DANGEROUS_CONTENT_PATTERN = /<script|<\/style|expression\s*\(|url\((\s*['"]?)\s*javascript:/i;
const CSS_STYLE_BREAKOUT_PATTERN = /<\/style/gi;
const CSS_EXPRESSION_PATTERN = /expression\s*\(/gi;
const CSS_JS_URL_PATTERN = /url\((\s*['"]?)\s*javascript:[^)]*\)/gi;
const JSON_SCRIPT_ESCAPE_MAP: Record<string, string> = {
    '<': '\\u003c',
    '>': '\\u003e',
    '&': '\\u0026',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029',
};
const NULL_JSON_LITERAL = 'null';
const SAFE_LINK_ATTR_NAMES = new Set(['href', 'src', 'xlink:href', 'formaction']);
const SAFE_URL_SCHEME_SET = new Set(['http:', 'https:', 'mailto:', 'tel:', 'sms:']);

const INLINE_SANITIZE_CONFIG: SanitizeConfig = {
    ALLOWED_TAGS: ['strong', 'em', 'u', 'b', 'i', 's', 'code', 'a', 'span', 'mark', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
};

const BLOCK_SANITIZE_CONFIG: SanitizeConfig = {
    USE_PROFILES: { html: true },
};

const SVG_SANITIZE_CONFIG: SanitizeConfig = {
    USE_PROFILES: { svg: true, svgFilters: true },
};

interface PurifyLike {
    sanitize: (dirty: string, cfg?: SanitizeConfig) => string;
}

type PurifyFactory = ((windowLike: Window) => PurifyLike) & Partial<PurifyLike>;

// DOMPurify export shape differs by runtime/bundler:
// - Browser builds often expose a ready instance with `.sanitize`.
// - Node builds expose a factory that needs a Window.
// We normalize both shapes here.
const rawDomPurifyExport = createDOMPurify as unknown as PurifyFactory | { default?: PurifyFactory };
const domPurifyExport =
    typeof rawDomPurifyExport === 'object' && rawDomPurifyExport && 'default' in rawDomPurifyExport
        ? ((rawDomPurifyExport.default ?? rawDomPurifyExport) as PurifyFactory)
        : (rawDomPurifyExport as PurifyFactory);
let cachedPurify: PurifyLike | null | undefined;

function isPurifyLike(value: unknown): value is PurifyLike {
    return Boolean(value && typeof value === 'object' && typeof (value as PurifyLike).sanitize === 'function');
}

function resolvePurify(): PurifyLike | null {
    if (cachedPurify !== undefined) {
        return cachedPurify;
    }

    // Browser / jsdom test env where the default export may already be an instance.
    if (isPurifyLike(domPurifyExport)) {
        cachedPurify = domPurifyExport;
        return cachedPurify;
    }

    // Browser-like env where we can initialize the factory with global window.
    if (typeof window !== 'undefined' && typeof domPurifyExport === 'function') {
        try {
            const browserPurify = domPurifyExport(window);
            if (isPurifyLike(browserPurify)) {
                cachedPurify = browserPurify;
                return cachedPurify;
            }
        } catch {
            // fall through to Node/fallback path
        }
    }

    // Node.js path: lazily require jsdom only when actually running in Node.
    // This avoids pulling jsdom into browser/Workers bundles.
    const runtimeProcess =
        typeof globalThis === 'object' && globalThis
            ? ((globalThis as { process?: ProcessLike }).process ?? null)
            : null;

    if (runtimeProcess?.versions?.node && typeof domPurifyExport === 'function') {
        try {
            // eslint-disable-next-line no-eval
            const dynamicRequire = (0, eval)('require') as (id: string) => unknown;
            const { JSDOM } = dynamicRequire('jsdom') as { JSDOM: new (html?: string) => { window: Window } };
            const { window: nodeWindow } = new JSDOM('');
            const nodePurify = domPurifyExport(nodeWindow);
            if (isPurifyLike(nodePurify)) {
                cachedPurify = nodePurify;
                return cachedPurify;
            }
        } catch {
            // Continue to fallback sanitizer below.
        }
    }

    cachedPurify = null;
    return cachedPurify;
}

function toStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function escapeHtmlAttribute(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function sanitizeFallbackOpeningTag(tagName: string, rawAttrs: string, allowedAttrSet: Set<string>): string {
    if (!rawAttrs || allowedAttrSet.size === 0) {
        return `<${tagName}>`;
    }

    const sanitizedAttrs: string[] = [];
    ATTRIBUTE_PATTERN.lastIndex = 0;
    let match = ATTRIBUTE_PATTERN.exec(rawAttrs);
    while (match) {
        const attrName = (match[1] ?? EMPTY_STRING).toLowerCase();
        if (!attrName || !allowedAttrSet.has(attrName)) {
            match = ATTRIBUTE_PATTERN.exec(rawAttrs);
            continue;
        }

        const attrValue = (match[3] ?? match[4] ?? match[5] ?? EMPTY_STRING).trim();
        if (!attrValue) {
            sanitizedAttrs.push(attrName);
            match = ATTRIBUTE_PATTERN.exec(rawAttrs);
            continue;
        }

        const safeValue = SAFE_LINK_ATTR_NAMES.has(attrName) ? sanitizeUrl(attrValue) : attrValue;
        sanitizedAttrs.push(`${attrName}="${escapeHtmlAttribute(safeValue)}"`);
        match = ATTRIBUTE_PATTERN.exec(rawAttrs);
    }

    return sanitizedAttrs.length > 0 ? `<${tagName} ${sanitizedAttrs.join(' ')}>` : `<${tagName}>`;
}

function basicFallbackSanitize(input: string, cfg: SanitizeConfig): string {
    if (!input) {
        return EMPTY_STRING;
    }

    const withoutScripts = input.replace(SCRIPT_TAG_PATTERN, EMPTY_STRING);
    const withoutStyles = withoutScripts.replace(STYLE_TAG_PATTERN, EMPTY_STRING);
    const withoutHandlers = withoutStyles.replace(EVENT_HANDLER_ATTR_PATTERN, EMPTY_STRING);

    // Rewrite link-like attributes through sanitizeUrl to neutralize unsafe schemes.
    const normalizedLinks = withoutHandlers.replace(
        LINK_ATTR_PATTERN,
        (_match, attr, _valueWithQuotes, dQuoted, sQuoted, bare) => {
            const rawValue = (dQuoted ?? sQuoted ?? bare ?? '').trim();
            return ` ${String(attr)}="${sanitizeUrl(rawValue)}"`;
        },
    );

    const allowedTags = toStringArray(cfg.ALLOWED_TAGS).map((tag) => tag.toLowerCase());
    if (allowedTags.length === 0) {
        return normalizedLinks;
    }

    const allowedTagSet = new Set(allowedTags);
    const allowedAttrSet = new Set(toStringArray(cfg.ALLOWED_ATTR).map((attr) => attr.toLowerCase()));

    return normalizedLinks.replace(HTML_TAG_PATTERN, (fullTag, tagName: string, rawAttrs: string | undefined) => {
        const normalizedTagName = tagName.toLowerCase();
        if (!allowedTagSet.has(normalizedTagName)) {
            return EMPTY_STRING;
        }

        if (fullTag.startsWith('</')) {
            return `</${normalizedTagName}>`;
        }

        return sanitizeFallbackOpeningTag(normalizedTagName, rawAttrs ?? EMPTY_STRING, allowedAttrSet);
    });
}

function sanitizeWithFallback(input: string, cfg: SanitizeConfig): string {
    if (!input) {
        return EMPTY_STRING;
    }

    const purify = resolvePurify();
    if (purify) {
        return purify.sanitize(input, cfg);
    }

    // Last resort for runtimes without a DOM implementation (e.g. Workers startup).
    return basicFallbackSanitize(input, cfg);
}

/**
 * Allowed URL schemes for anchor href and similar link attributes.
 * `javascript:`, `data:`, `vbscript:` and any unknown scheme are blocked.
 */
/**
 * Sanitize a URL for use in an anchor href or similar attribute.
 * Returns '#' for any URL whose scheme is not in the safe allowlist.
 * Relative URLs (starting with /, ./, ../, ?, #) are allowed as-is.
 *
 * @example
 * <a href={sanitizeUrl(url)}>link</a>
 */
export function sanitizeUrl(url: string | null | undefined): string {
    if (!url) return '#';

    const trimmed = url.trim();
    if (!trimmed) return '#';

    // Block protocol-relative URLs (`//evil.com`). Browsers drop tab/CR/LF inside URLs and read `\` as `/`,
    // so `/\evil.com` and `/<TAB>/evil.com` are protocol-relative too.
    if (/^[/\\]{2}/.test(trimmed.replace(/[\t\n\r]/g, ''))) return '#';

    // Allow relative URLs
    if (
        trimmed.startsWith('/') ||
        trimmed.startsWith('./') ||
        trimmed.startsWith('../') ||
        trimmed.startsWith('?') ||
        trimmed.startsWith('#')
    ) {
        return trimmed;
    }

    // Parse protocol — must be in the allowlist
    try {
        const parsed = new URL(trimmed);
        if (!SAFE_URL_SCHEME_SET.has(parsed.protocol.toLowerCase())) {
            return '#';
        }
    } catch {
        // Unparseable URL (e.g. bare hostname) — block it
        return '#';
    }

    return trimmed;
}

/**
 * Allowed inline tags for EditorJS block content (list items, paragraph spans, step text, etc.).
 * Covers the subset EditorJS tools actually emit: bold, italic, underline, inline code, links, marks.
 */
/**
 * Sanitize untrusted inline HTML produced by EditorJS tools.
 * Strips any tag or attribute not in the inline allowlist.
 * Safe for use with React's `dangerouslySetInnerHTML`.
 *
 * @example
 * <span dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(item.content) }} />
 */
export function sanitizeInlineHtml(html: string): string {
    return sanitizeWithFallback(html, INLINE_SANITIZE_CONFIG);
}

/**
 * Sanitize block-level HTML (e.g. HtmlRenderer, raw article HTML).
 * Allows a broader set of tags while still stripping scripts and event handlers.
 * Safe for use with React's `dangerouslySetInnerHTML`.
 *
 * @example
 * <div dangerouslySetInnerHTML={{ __html: sanitizeBlockHtml(content) }} />
 */
export function sanitizeBlockHtml(html: string): string {
    return sanitizeWithFallback(html, BLOCK_SANITIZE_CONFIG);
}

/**
 * Sanitize an SVG string (e.g. an inline icon from editor config).
 * Allows SVG and SVG filter elements, strips scripts and foreign objects.
 * Safe for use with React's `dangerouslySetInnerHTML`.
 *
 * @example
 * <span dangerouslySetInnerHTML={{ __html: sanitizeSvgHtml(icon) }} />
 */
export function sanitizeSvgHtml(svg: string): string {
    return sanitizeWithFallback(svg, SVG_SANITIZE_CONFIG);
}

/**
 * Serialize unknown data for safe embedding inside a `<script>` tag.
 * Escapes characters that can break out of script context.
 *
 * @example
 * <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: sanitizeJsonForScript(schema) }} />
 */
export function sanitizeJsonForScript(data: unknown): string {
    let serialized = NULL_JSON_LITERAL;

    try {
        serialized = JSON.stringify(data) ?? NULL_JSON_LITERAL;
    } catch {
        serialized = NULL_JSON_LITERAL;
    }

    return serialized.replace(
        JSON_SCRIPT_ESCAPE_PATTERN,
        (character) => JSON_SCRIPT_ESCAPE_MAP[character] ?? character,
    );
}

/**
 * Sanitize CSS before embedding in a `<style>` tag.
 * Neutralizes break-out sequences and strips obvious script vectors.
 */
export function sanitizeCssForStyleTag(css: string): string {
    if (!css) return '';

    if (!CSS_DANGEROUS_CONTENT_PATTERN.test(css)) {
        return css;
    }

    return css
        .replace(SCRIPT_TAG_PATTERN, EMPTY_STRING)
        .replace(CSS_STYLE_BREAKOUT_PATTERN, '<\\/style')
        .replace(CSS_EXPRESSION_PATTERN, EMPTY_STRING)
        .replace(CSS_JS_URL_PATTERN, 'url($1#)');
}
