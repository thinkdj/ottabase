// ============================================================
// @ottabase/screenshot — Worker route
// ============================================================
// `POST /capture` screenshots a path of THIS app through Cloudflare Browser Rendering. The
// caller picks a path, never a URL: the origin comes from the host, so the route cannot be
// pointed at someone else's site. Sessions, the binding and the rate limit are the host's.
// ============================================================

import { Router } from '@ottabase/ottarouter';
import { errorResponse, redactErrorForLog } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import {
    captureShot,
    normalizeShot,
    optimizeShot,
    ScreenshotCaptureError,
    ScreenshotInputError,
    SCREENSHOT_MIME,
    type CdpSend,
    type ImageOptimizer,
    type OptimizationResult,
    type ScreenshotFormat,
} from './core';

/** The slice of `@cloudflare/puppeteer` the route uses. */
export interface ScreenshotPuppeteer {
    launch(binding: never): Promise<{
        newPage(): Promise<{ createCDPSession(): Promise<{ send: (...args: never[]) => Promise<unknown> }> }>;
        close(): Promise<void>;
    }>;
}

export interface ScreenshotRouterOptions<Env> {
    /** A verified session, or null for 401. */
    resolveCaller: (request: Request, env: Env) => Promise<{ userId: string } | null>;
    /** Browser sessions cost money: return a Response to refuse. */
    rateLimit?: (request: Request, env: Env, caller: { userId: string }) => Promise<Response | null>;
    getBrowserBinding: (env: Env) => unknown;
    loadPuppeteer: () => Promise<ScreenshotPuppeteer>;
    /** Usually `imagesOptimizer(env.IMAGES)`. Without one, `optimize` reports `unavailable`. */
    getOptimizer?: (env: Env) => ImageOptimizer | null | undefined;
    /** Origin shot paths resolve against. Default `screenshotOrigin(request)`. */
    getOrigin?: (request: Request, env: Env) => string;
    css?: string;
    themeStorageKey?: string;
    /** Per wait inside a capture. Default 20s. */
    timeoutMs?: number;
}

export interface ScreenshotResponse {
    format: ScreenshotFormat;
    mimeType: string;
    dataUrl: string;
    /** As Chrome encoded it. */
    originalBytes: number;
    bytes: number;
    optimization: OptimizationResult;
    width: number;
    height: number;
    scale: number;
}

const MAX_BODY_BYTES = 16 * 1024;
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * The request's own origin, except in local dev: the Vite proxy rewrites Host to the Worker's
 * port, so when both ends are loopback the page lives at the browser's `Origin`. A deployed
 * Worker is never loopback, so a forged Origin cannot redirect it.
 */
export function screenshotOrigin(request: Request): string {
    const self = new URL(request.url);
    const origin = request.headers.get('Origin');
    if (origin && LOOPBACK.has(self.hostname)) {
        try {
            const browser = new URL(origin);
            if (LOOPBACK.has(browser.hostname)) return browser.origin;
        } catch {
            // Not a URL: fall through to the request's own origin.
        }
    }
    return self.origin;
}

function toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
}

export function createScreenshotRouter<Env>(options: ScreenshotRouterOptions<Env>): Router<Env> {
    const router = new Router<Env>();

    router.post('/capture', async (c) => {
        const request = c.req;
        const caller = await options.resolveCaller(request, c.env);
        if (!caller) return errorResponse('Sign in to take screenshots', 401, { code: 'UNAUTHORIZED' });
        const limited = await options.rateLimit?.(request, c.env, caller);
        if (limited) return limited;

        const body = await request.text();
        if (body.length > MAX_BODY_BYTES) return errorResponse('Request too large', 413, { code: 'TOO_LARGE' });
        let shot;
        try {
            shot = normalizeShot(JSON.parse(body));
        } catch (error) {
            const message = error instanceof ScreenshotInputError ? error.message : 'Body must be a JSON shot';
            return errorResponse(message, 400, { code: 'VALIDATION_ERROR' });
        }

        const binding = options.getBrowserBinding(c.env);
        if (!binding) {
            return errorResponse('Browser Rendering is not configured', 503, { code: 'BROWSER_UNAVAILABLE' });
        }

        const origin = options.getOrigin?.(request, c.env) ?? screenshotOrigin(request);
        let original: Uint8Array;
        try {
            const puppeteer = await options.loadPuppeteer();
            const browser = await puppeteer.launch(binding as never);
            try {
                const page = await browser.newPage();
                const session = await page.createCDPSession();
                original = await captureShot(session.send.bind(session) as unknown as CdpSend, {
                    origin,
                    shot,
                    css: options.css,
                    themeStorageKey: options.themeStorageKey,
                    timeoutMs: options.timeoutMs ?? 20_000,
                });
            } finally {
                await browser.close().catch(() => undefined);
            }
        } catch (error) {
            if (error instanceof ScreenshotCaptureError) {
                return errorResponse(error.message, 422, { code: `CAPTURE_${error.code}` });
            }
            console.error(JSON.stringify({ event: 'screenshot_capture_failed', error: redactErrorForLog(error) }));
            return errorResponse('Screenshot failed', 502, { code: 'CAPTURE_FAILED' });
        }

        let result: { bytes: Uint8Array; optimization: OptimizationResult };
        try {
            result = await optimizeShot(original, shot, options.getOptimizer?.(c.env));
        } catch (error) {
            // The capture is good; a failed optimizer only costs the saving.
            console.warn(JSON.stringify({ event: 'screenshot_optimize_failed', error: redactErrorForLog(error) }));
            result = { bytes: original, optimization: 'unavailable' };
        }

        const mimeType = SCREENSHOT_MIME[shot.format];
        const data: ScreenshotResponse = {
            format: shot.format,
            mimeType,
            dataUrl: `data:${mimeType};base64,${toBase64(result.bytes)}`,
            originalBytes: original.byteLength,
            bytes: result.bytes.byteLength,
            optimization: result.optimization,
            width: Math.round(shot.width * shot.scale),
            height: Math.round(shot.height * shot.scale),
            scale: shot.scale,
        };
        return jsonResponse({ data }, 200, { headers: { 'Cache-Control': 'no-store' } });
    });

    return router;
}
