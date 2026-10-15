/**
 * Browser Rendering wrapper (the `browser` binding's quick actions)
 * PDF, screenshot, markdown, text, links, structured extraction: one call each, no puppeteer.
 * For scripted sessions use `@cloudflare/puppeteer` with the same binding (`@ottabase/cf-pdf` does).
 *
 * @see https://developers.cloudflare.com/browser-rendering/
 */

import { CloudflareError, type Result } from './types';

/** What a quick action answers with; structural so the Workers and DOM `Response` types both fit. */
export interface BrowserResponseLike {
    ok: boolean;
    status: number;
    headers: { get(name: string): string | null };
    text(): Promise<string>;
    json(): Promise<unknown>;
    arrayBuffer(): Promise<ArrayBuffer>;
}

/** The slice of the `BrowserRun` binding used here; method syntax keeps the binding's overloads assignable. */
export interface BrowserRunLike {
    quickAction(action: string, options: unknown): Promise<BrowserResponseLike>;
}

export interface BrowserConfig {
    browser: BrowserRunLike;
}

/** Either a page to load or HTML to render. */
export type BrowserTarget = { url: string; html?: never } | { html: string; url?: never };

export interface BrowserBaseOptions {
    /** Viewport, e.g. `{ width: 1280, height: 720 }`. */
    viewport?: { width: number; height: number; deviceScaleFactor?: number };
    /** Wait for the page's network to settle before acting. */
    gotoOptions?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'; timeout?: number };
    /** Block these resource types (`image`, `font`, `script`…) to render faster. */
    rejectResourceTypes?: string[];
    /** Extra headers for the page request. */
    setExtraHTTPHeaders?: Record<string, string>;
    /** Wait for a selector before acting. */
    waitForSelector?: { selector: string; timeout?: number };
    /** Extra fields pass straight through to the action. */
    [key: string]: unknown;
}

export interface BrowserPdfOptions extends BrowserBaseOptions {
    pdfOptions?: {
        format?: 'letter' | 'legal' | 'tabloid' | 'ledger' | 'a0' | 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'a6';
        landscape?: boolean;
        printBackground?: boolean;
        scale?: number;
        margin?: { top?: string; right?: string; bottom?: string; left?: string };
        displayHeaderFooter?: boolean;
        headerTemplate?: string;
        footerTemplate?: string;
        pageRanges?: string;
    };
}

export interface BrowserScreenshotOptions extends BrowserBaseOptions {
    selector?: string;
    scrollPage?: boolean;
    screenshotOptions?: {
        type?: 'png' | 'jpeg' | 'webp';
        quality?: number;
        fullPage?: boolean;
        omitBackground?: boolean;
    };
}

export interface BrowserRendered<T> {
    data: T;
    contentType: string | null;
    /** Browser time billed for the call, from `X-Browser-Ms-Used`. */
    msUsed: number | null;
}

/** Browser Rendering quick actions. */
export class BrowserClient {
    private browser: BrowserRunLike;

    constructor(config: BrowserConfig) {
        if (!config.browser) {
            throw new CloudflareError('Browser Rendering binding is required', 'BROWSER_MISSING_BINDING');
        }
        this.browser = config.browser;
    }

    private async act<T>(
        action: string,
        options: unknown,
        read: (response: BrowserResponseLike) => Promise<T>,
    ): Promise<Result<BrowserRendered<T>, Error>> {
        try {
            const response = await this.browser.quickAction(action, options);
            const msUsedHeader = response.headers.get('X-Browser-Ms-Used');
            const msUsed = msUsedHeader === null ? null : Number(msUsedHeader);
            if (!response.ok) {
                const body = await response.text().catch(() => '');
                return {
                    success: false,
                    error: new CloudflareError(
                        `Browser ${action} failed with ${response.status}`,
                        'BROWSER_ACTION_FAILED',
                        {
                            status: response.status,
                            body: body.slice(0, 2_000),
                            msUsed,
                        },
                    ),
                };
            }
            return {
                success: true,
                data: { data: await read(response), contentType: response.headers.get('content-type'), msUsed },
            };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
        }
    }

    /** A PDF of a URL or of HTML. */
    pdf(target: BrowserTarget, options: BrowserPdfOptions = {}): Promise<Result<BrowserRendered<ArrayBuffer>, Error>> {
        return this.act('pdf', { ...target, ...options }, (response) => response.arrayBuffer());
    }

    /** A PNG/JPEG/WebP of a page or an element. */
    screenshot(
        target: BrowserTarget,
        options: BrowserScreenshotOptions = {},
    ): Promise<Result<BrowserRendered<ArrayBuffer>, Error>> {
        return this.act('screenshot', { ...target, ...options }, (response) => response.arrayBuffer());
    }

    /** The page as Markdown (what you feed a model). */
    markdown(target: BrowserTarget, options: BrowserBaseOptions = {}): Promise<Result<BrowserRendered<string>, Error>> {
        return this.act('markdown', { ...target, ...options }, (response) => response.text());
    }

    /** The rendered HTML, after scripts ran. */
    content(target: BrowserTarget, options: BrowserBaseOptions = {}): Promise<Result<BrowserRendered<string>, Error>> {
        return this.act('content', { ...target, ...options }, (response) => response.text());
    }

    /** Every link on the page. */
    links(
        target: BrowserTarget,
        options: BrowserBaseOptions & { visibleLinksOnly?: boolean } = {},
    ): Promise<Result<BrowserRendered<string[]>, Error>> {
        return this.act('links', { ...target, ...options }, async (response) => {
            const body = (await response.json()) as { result?: string[] } | string[];
            return Array.isArray(body) ? body : (body.result ?? []);
        });
    }

    /** Elements matched by CSS selectors, with text and attributes. */
    scrape(
        target: BrowserTarget,
        elements: Array<{ selector: string }>,
        options: BrowserBaseOptions = {},
    ): Promise<Result<BrowserRendered<unknown>, Error>> {
        return this.act('scrape', { ...target, ...options, elements }, (response) => response.json());
    }

    /** Structured data extracted by a model against a JSON schema or a prompt. */
    json(
        target: BrowserTarget,
        extraction: { prompt?: string; response_format?: { type: 'json_schema'; json_schema: unknown } },
        options: BrowserBaseOptions = {},
    ): Promise<Result<BrowserRendered<unknown>, Error>> {
        return this.act('json', { ...target, ...options, ...extraction }, (response) => response.json());
    }
}

export function createBrowserClient(config: BrowserConfig): BrowserClient {
    return new BrowserClient(config);
}
