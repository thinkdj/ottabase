import type { Browser, BrowserWorker, PuppeteerLifeCycleEvent } from '@cloudflare/puppeteer';

/** PDF Info dictionary fields embedded in generated documents. */
export interface PdfMetadata {
    title: string;
    author: string;
    subject: string;
    keywords: string;
}

export const PDF_PAGE_FORMATS = ['Letter', 'A4', 'Legal', 'A3', 'Tabloid'] as const;
export type PdfPageFormat = (typeof PDF_PAGE_FORMATS)[number];

export interface PdfMargins {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
}

/**
 * The `@cloudflare/puppeteer` module must be imported by the consumer's Worker
 * source and passed in. Keeping this as a peer/type-only dependency preserves
 * Wrangler's built-in-module resolution behaviour.
 */
export interface PdfPuppeteerModule {
    launch(browserBinding: BrowserWorker): Promise<Browser>;
}

/** Secure, bounded Worker-side Browser Rendering options. */
export interface PdfGenerateOptions {
    puppeteer: PdfPuppeteerModule;
    format?: PdfPageFormat;
    viewportWidth?: number;
    viewportHeight?: number;
    printBackground?: boolean;
    margin?: PdfMargins;
    waitUntil?: Extract<PuppeteerLifeCycleEvent, 'load' | 'domcontentloaded'>;
    fontTimeoutMs?: number;
    renderTimeoutMs?: number;
    maxHtmlBytes?: number;
    maxPdfBytes?: number;
    /** Explicit HTTPS origins allowed for styles, fonts, and images. Defaults to none. */
    allowedResourceOrigins?: readonly string[];
}

/** Configuration for serialising a live DOM element into static PDF markup. */
export interface DomCaptureOptions {
    title?: string;
    pageSize?: 'letter' | 'a4' | 'legal' | 'a3' | 'tabloid';
    /** Force the first template wrapper to the full available width. */
    fitWidth?: boolean;
    stripPrintMedia?: boolean;
    /** Explicit HTTPS origins to retain as stylesheet/preconnect resources. */
    resourceOrigins?: readonly string[];
    cssVariablePatterns?: readonly string[];
    fitHeight?: boolean;
}

/** The request body accepted by the package's Worker route. */
export interface CfPdfRequest {
    html: string;
    fileName?: string;
    metadata?: PdfMetadata;
}
