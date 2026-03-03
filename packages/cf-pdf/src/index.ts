/**
 * @ottabase/cf-pdf — Zero-dependency PDF generation toolkit for Cloudflare Workers.
 *
 * Sub-path exports:
 *  - `@ottabase/cf-pdf`          — shared types (PdfMetadata, options interfaces)
 *  - `@ottabase/cf-pdf/metadata` — binary PDF Info dictionary injection
 *  - `@ottabase/cf-pdf/server`   — Puppeteer rendering + Response builder
 *  - `@ottabase/cf-pdf/client`   — DOM capture, zoom fix, download helpers
 *
 * ## IMPORTANT for AI agents and developers
 *
 * `generatePdf()` requires `options.puppeteer` — you MUST import
 * `@cloudflare/puppeteer` in your **worker source file** and pass it through.
 * The package cannot import it internally because Wrangler only resolves
 * built-in modules when the import is directly in the worker bundle.
 *
 * ```ts
 * import puppeteer from '@cloudflare/puppeteer';
 * await generatePdf(html, env.OBCF_BROWSER, { puppeteer });
 * ```
 */

// ---------------------------------------------------------------------------
// PDF document metadata
// ---------------------------------------------------------------------------

/** PDF Info dictionary fields embedded in the file's binary structure. */
export interface PdfMetadata {
    /** Document title — appears in PDF reader title bar / Properties dialog. */
    title: string;
    /** Author name — e.g. your app's brand name. */
    author: string;
    /** Short document description / subject line. */
    subject: string;
    /** Comma-separated keywords for search and categorisation. */
    keywords: string;
}

// ---------------------------------------------------------------------------
// Server-side options
// ---------------------------------------------------------------------------

/**
 * Options for `generatePdf()` — controls Puppeteer's page setup and PDF output.
 *
 * Every field has a sensible default; pass only what you need to override.
 */
export interface PdfGenerateOptions {
    /**
     * The `@cloudflare/puppeteer` module — **required**.
     *
     * Wrangler only resolves `@cloudflare/puppeteer` when it's imported directly
     * in your worker source. Pass it here so the package doesn't need its own
     * dynamic import (which fails at runtime inside pre-built dist files).
     *
     * ```ts
     * import puppeteer from '@cloudflare/puppeteer';
     * await generatePdf(html, env.OBCF_BROWSER, { puppeteer });
     * ```
     */
    puppeteer: { default: { launch: (binding: unknown) => Promise<any> } } | any;
    /** CSS page format string (default: `'Letter'`). */
    format?: string;
    /** Viewport width in px (default: `816` — US Letter at 96 dpi). */
    viewportWidth?: number;
    /** Viewport height in px (default: `1056`). */
    viewportHeight?: number;
    /** Print background colours and images (default: `true`). */
    printBackground?: boolean;
    /** Page margins passed to Puppeteer (default: all `'0'`). */
    margin?: { top?: string; right?: string; bottom?: string; left?: string };
    /** Puppeteer `waitUntil` strategy (default: `'networkidle0'`). */
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
    /** Maximum time (ms) to wait for web fonts before giving up (default: `5000`). */
    fontTimeout?: number;
}

// ---------------------------------------------------------------------------
// Client-side options
// ---------------------------------------------------------------------------

/**
 * Configuration for `captureDomAsHtml()` — controls how the live DOM is
 * serialised into a self-contained HTML string for server-side rendering.
 */
export interface DomCaptureOptions {
    /** Document `<title>` text (default: `'Document'`). */
    title?: string;

    /**
     * CSS `@page size` value (default: `'letter'`).
     * Common values: `'letter'`, `'a4'`, `'legal'`.
     */
    pageSize?: string;

    /**
     * CSS selector whose matched elements should have `max-width` and `width`
     * forced to `100%` for edge-to-edge PDF rendering.
     *
     * Example: `'#resume-capture > div'`
     */
    containerSelector?: string;

    /** Strip `@media print` CSS rules from collected styles (default: `true`). */
    stripPrintMedia?: boolean;

    /**
     * Domains for `<link rel="preconnect">` hints injected into the captured HTML.
     * Default: Google Fonts CDN (`fonts.googleapis.com`, `fonts.gstatic.com`).
     */
    preconnectDomains?: string[];

    /**
     * Prefix patterns for CSS custom properties to capture from `:root` inline style.
     * Any `document.documentElement.style` property whose name starts with one of
     * these prefixes is included in the captured HTML.
     *
     * Default: `['--font-', '--typography-']`
     */
    cssVariablePatterns?: string[];
}
