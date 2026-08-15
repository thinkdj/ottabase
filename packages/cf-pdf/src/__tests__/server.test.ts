import { describe, expect, it, vi } from 'vitest';
import type { PdfGenerateOptions } from '../index';
import { buildPdfResponse, generatePdf } from '../server';

function createRenderer(pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46])) {
    let requestListener:
        | ((request: {
              url: () => string;
              resourceType: () => string;
              continue: () => Promise<void>;
              abort: () => Promise<void>;
          }) => void)
        | undefined;
    const page = {
        setViewport: vi.fn().mockResolvedValue(undefined),
        setJavaScriptEnabled: vi.fn().mockResolvedValue(undefined),
        on: vi.fn((event: string, listener: typeof requestListener) => {
            if (event === 'request') requestListener = listener;
        }),
        setRequestInterception: vi.fn().mockResolvedValue(undefined),
        setContent: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockResolvedValue(undefined),
        pdf: vi.fn().mockResolvedValue(pdf),
    };
    const browser = {
        newPage: vi.fn().mockResolvedValue(page),
        close: vi.fn().mockResolvedValue(undefined),
    };
    const puppeteer = { launch: vi.fn().mockResolvedValue(browser) };

    return { page, browser, puppeteer, getRequestListener: () => requestListener };
}

function options(puppeteer: PdfGenerateOptions['puppeteer']): PdfGenerateOptions {
    return {
        puppeteer,
        allowedResourceOrigins: ['https://fonts.googleapis.com'],
        waitUntil: 'load',
    };
}

describe('buildPdfResponse', () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

    it('creates a strict no-store PDF attachment response', () => {
        const response = buildPdfResponse(pdf, 'my:report');

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/pdf');
        expect(response.headers.get('Content-Disposition')).toBe(
            'attachment; filename="my_report.pdf"; filename*=UTF-8\'\'my_report.pdf',
        );
        expect(response.headers.get('Content-Length')).toBe('4');
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(response.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
        expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('copies only the supplied byte view rather than its entire backing buffer', async () => {
        const backing = new Uint8Array([0x00, 0x25, 0x50, 0x44, 0x46, 0xff]);
        const response = buildPdfResponse(backing.subarray(1, 5), 'resume');

        expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([0x25, 0x50, 0x44, 0x46]);
    });

    it('normalizes control characters before constructing Content-Disposition', () => {
        const response = buildPdfResponse(pdf, 'resume\r\nX-Test: injected');

        expect(response.headers.get('Content-Disposition')).not.toContain('\r');
        expect(response.headers.get('Content-Disposition')).not.toContain('\n');
        expect(response.headers.get('X-Test')).toBeNull();
    });
});

describe('generatePdf', () => {
    it('uses a static document policy and closes the browser session', async () => {
        const renderer = createRenderer();
        const result = await generatePdf(
            '<head><base href="https://evil.test"><script>alert(1)</script></head><main>Hi</main>',
            {} as never,
            options(renderer.puppeteer as never),
        );

        expect(Array.from(result)).toEqual([0x25, 0x50, 0x44, 0x46]);
        expect(renderer.page.setJavaScriptEnabled).toHaveBeenCalledWith(false);
        expect(renderer.page.setRequestInterception).toHaveBeenCalledWith(true);
        expect(renderer.page.setContent.mock.calls[0]?.[0]).toContain("script-src 'none'");
        expect(renderer.page.setContent.mock.calls[0]?.[0]).not.toContain('<script>');
        expect(renderer.page.setContent.mock.calls[0]?.[0]).not.toContain('<base');
        expect(renderer.browser.close).toHaveBeenCalledTimes(1);
    });

    it('allows only explicit HTTPS resource origins during rendering', async () => {
        const renderer = createRenderer();
        await generatePdf('<main>Hi</main>', {} as never, options(renderer.puppeteer as never));
        const listener = renderer.getRequestListener();
        if (!listener) throw new Error('Expected request interceptor');

        const permitted = {
            url: () => 'https://fonts.googleapis.com/css2',
            resourceType: () => 'stylesheet',
            continue: vi.fn().mockResolvedValue(undefined),
            abort: vi.fn().mockResolvedValue(undefined),
        };
        const blocked = {
            url: () => 'https://evil.test/tracker',
            resourceType: () => 'image',
            continue: vi.fn().mockResolvedValue(undefined),
            abort: vi.fn().mockResolvedValue(undefined),
        };
        listener(permitted);
        listener(blocked);

        await Promise.resolve();
        expect(permitted.continue).toHaveBeenCalledTimes(1);
        expect(blocked.abort).toHaveBeenCalledTimes(1);
    });

    it('rejects oversized HTML before launching a browser session', async () => {
        const renderer = createRenderer();

        await expect(
            generatePdf('x'.repeat(1_025), {} as never, {
                ...options(renderer.puppeteer as never),
                maxHtmlBytes: 1_024,
            }),
        ).rejects.toMatchObject({ code: 'PDF_INPUT_TOO_LARGE' });
        expect(renderer.puppeteer.launch).not.toHaveBeenCalled();
    });

    it('closes the browser when page rendering fails', async () => {
        const renderer = createRenderer();
        renderer.page.setContent.mockRejectedValueOnce(new Error('render failure'));

        await expect(generatePdf('<main>Hi</main>', {} as never, options(renderer.puppeteer as never))).rejects.toThrow(
            'render failure',
        );
        expect(renderer.browser.close).toHaveBeenCalledTimes(1);
    });
});
