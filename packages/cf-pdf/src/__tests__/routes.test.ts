import { Router } from '@ottabase/ottarouter';
import type { Browser, BrowserWorker, Page } from '@cloudflare/puppeteer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CF_PDF_BASE_PATH } from '../constants';
import { createCfPdfRouter } from '../routes';
import type { PdfPuppeteerModule } from '../types';

type Env = Record<string, unknown>;

const PDF_BYTES = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10]);
const browserBinding = {} as BrowserWorker;

let caller: { userId: string } | null;
let browserAvailable: boolean;
let rateLimitResponse: Response | null;
let launchMock: ReturnType<typeof vi.fn>;

function build() {
    const page = {
        setViewport: vi.fn(),
        setJavaScriptEnabled: vi.fn(),
        on: vi.fn(),
        setRequestInterception: vi.fn(),
        setContent: vi.fn(),
        evaluate: vi.fn(),
        pdf: vi.fn().mockResolvedValue(PDF_BYTES),
    } as unknown as Page;
    const browser = {
        newPage: vi.fn().mockResolvedValue(page),
        close: vi.fn().mockResolvedValue(undefined),
    } as unknown as Browser;
    launchMock = vi.fn().mockResolvedValue(browser);
    const puppeteer: PdfPuppeteerModule = {
        launch: launchMock as unknown as PdfPuppeteerModule['launch'],
    };

    const pdfRouter = createCfPdfRouter<Env>({
        resolveCaller: async () => caller,
        getBrowserBinding: () => (browserAvailable ? browserBinding : undefined),
        loadPuppeteer: async () => puppeteer,
        rateLimit: async () => rateLimitResponse,
    });
    const app = new Router<Env>();
    app.mount(CF_PDF_BASE_PATH, pdfRouter);
    return app;
}

function post(body: unknown) {
    return build().handle(
        new Request('https://app.test/api/cf-pdf/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }),
        {},
    );
}

beforeEach(() => {
    caller = { userId: 'user-1' };
    browserAvailable = true;
    rateLimitResponse = null;
});

describe('the PDF route', () => {
    it('requires a verified caller before revealing the route contract', async () => {
        caller = null;
        const response = await post({ html: '<p>private</p>' });

        expect(response?.status).toBe(401);
    });

    it('fails closed when Browser Rendering is unavailable', async () => {
        browserAvailable = false;
        const response = await post({ html: '<p>private</p>' });

        expect(response?.status).toBe(503);
        expect(launchMock).not.toHaveBeenCalled();
    });

    it('honors the host rate limiter before opening Browser Rendering', async () => {
        rateLimitResponse = new Response(null, { status: 429 });
        const response = await post({ html: '<p>private</p>' });

        expect(response?.status).toBe(429);
        expect(launchMock).not.toHaveBeenCalled();
    });

    it('renders an authorized request and returns a safe PDF attachment', async () => {
        const response = await post({ html: '<p>private</p>', fileName: 'quarterly report' });

        expect(response?.status).toBe(200);
        expect(response?.headers.get('content-type')).toBe('application/pdf');
        expect(response?.headers.get('cache-control')).toBe('no-store');
        expect(response?.headers.get('content-disposition')).toContain('quarterly%20report.pdf');
        expect(new Uint8Array(await response!.arrayBuffer())).toEqual(PDF_BYTES);
        expect(launchMock).toHaveBeenCalledTimes(1);
    });

    it('rejects unknown request fields before invoking the renderer', async () => {
        const response = await post({ html: '<p>private</p>', unexpected: true });

        expect(response?.status).toBe(400);
        expect(launchMock).not.toHaveBeenCalled();
    });
});
