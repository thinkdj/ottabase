// ============================================================
// @ottabase/screenshot — the capture runner (any runtime)
// ============================================================
// Drives one page over the Chrome DevTools Protocol: a local Chrome from Node
// (`./node`), or a Cloudflare Browser Rendering session in a Worker (the route).
// Both hand this file a `send(method, params)`; nothing here knows which.
//
// Node runs `./node` straight from source with built-in type stripping, so this file has
// no relative value imports and no TS-only syntax (enums, parameter properties).
// ============================================================

export type ScreenshotFormat = 'png' | 'jpeg' | 'webp';

/** One interaction before the shot, run in order. Text matches exactly (a button's first line, aria-label or title). */
export type ScreenshotStep =
    | { click: string }
    | { scrollTo: string }
    | { type: string }
    | { key: string }
    | { wait: number };

/** A shot as callers describe it; every field but `path` has a default. */
export interface ScreenshotInput {
    /** Same-origin path, e.g. `/blog?page=2`. */
    path: string;
    /** `jpg` is accepted for `jpeg`. Default `png`. */
    format?: ScreenshotFormat | 'jpg';
    /** 1–100. Encoder quality for jpeg/webp; palette quality for png in the sharp optimizer. */
    quality?: number;
    /** CSS viewport, default 1280×800. */
    width?: number;
    height?: number;
    /** Device pixel ratio, default 1. 1.5 turns 1280×800 into a 1920×1200 image. */
    scale?: number;
    theme?: 'light' | 'dark';
    /** Text that proves the page has its data. Without it the shot waits for load, fonts and spinners only. */
    waitFor?: string;
    /** Skip the wait for spinners to clear, for a page that shows one on purpose (a component showcase). */
    ignoreSpinners?: boolean;
    steps?: ScreenshotStep[];
    /** CSS selector: capture the region of the first visible match instead of the viewport. */
    selector?: string;
    /** With `selector`: the first match whose text starts with this (a card's title), not just the first match. */
    selectorText?: string;
    /** CSS px of page kept around `selector` on every side. Default 0. */
    padding?: number;
    /** Width ÷ height of the `selector` region: the height follows the width, down from the element's top. */
    aspect?: number;
    /** Run the optimization pass (when the caller has an optimizer). Default true. */
    optimize?: boolean;
}

export interface ScreenshotShot {
    path: string;
    format: ScreenshotFormat;
    quality: number;
    width: number;
    height: number;
    scale: number;
    theme: 'light' | 'dark';
    waitFor: string | null;
    ignoreSpinners: boolean;
    steps: ScreenshotStep[];
    selector: string | null;
    selectorText: string | null;
    padding: number;
    aspect: number | null;
    optimize: boolean;
}

export const SCREENSHOT_LIMITS = {
    width: [320, 1920],
    height: [240, 1920],
    scale: [1, 2],
    quality: [1, 100],
    maxSteps: 12,
    maxText: 200,
    maxWaitMs: 5_000,
    maxPath: 2_048,
    padding: [0, 200],
    aspect: [0.25, 4],
} as const;

export const SCREENSHOT_MIME: Record<ScreenshotFormat, string> = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
};

export const SCREENSHOT_EXTENSION: Record<ScreenshotFormat, string> = { png: 'png', jpeg: 'jpg', webp: 'webp' };

/** Dev tooling and toasts are not the app; caret blink makes every shot differ. */
export const DEFAULT_SCREENSHOT_CSS = `
    .tsqd-parent-container, [data-sonner-toaster] { display: none !important; }
    * { caret-color: transparent !important; }
`;

export class ScreenshotInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ScreenshotInputError';
    }
}

/** The page did not reach the state the shot asked for. Messages are safe to show the caller. */
export class ScreenshotCaptureError extends Error {
    code: 'TIMEOUT' | 'STEP_FAILED';
    constructor(message: string, code: 'TIMEOUT' | 'STEP_FAILED') {
        super(message);
        this.name = 'ScreenshotCaptureError';
        this.code = code;
    }
}

function fail(message: string): never {
    throw new ScreenshotInputError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function number(value: unknown, field: string, [min, max]: readonly [number, number], fallback: number): number {
    if (value === undefined || value === null) return fallback;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
        fail(`${field} must be a number from ${min} to ${max}`);
    }
    return value;
}

function text(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.length === 0 || value.length > SCREENSHOT_LIMITS.maxText) {
        fail(`${field} must be 1–${SCREENSHOT_LIMITS.maxText} characters`);
    }
    return value;
}

function step(value: unknown, index: number): ScreenshotStep {
    const field = `steps[${index}]`;
    if (!isRecord(value) || Object.keys(value).length !== 1) fail(`${field} must have exactly one action`);
    if ('click' in value) return { click: text(value.click, `${field}.click`) };
    if ('scrollTo' in value) return { scrollTo: text(value.scrollTo, `${field}.scrollTo`) };
    if ('type' in value) return { type: text(value.type, `${field}.type`) };
    if ('key' in value) return { key: text(value.key, `${field}.key`) };
    if ('wait' in value) return { wait: number(value.wait, `${field}.wait`, [0, SCREENSHOT_LIMITS.maxWaitMs], 0) };
    return fail(`${field} must be one of click, scrollTo, type, key, wait`);
}

/** Validates untrusted input (a route body, a JSON shot list) into a complete shot. Throws `ScreenshotInputError`. */
export function normalizeShot(input: unknown): ScreenshotShot {
    if (!isRecord(input)) fail('A shot must be an object');
    const { path } = input;
    // A path, never a URL: the caller picks the page, the host picks the origin.
    if (
        typeof path !== 'string' ||
        !path.startsWith('/') ||
        path.startsWith('//') ||
        path.includes('\\') ||
        path.length > SCREENSHOT_LIMITS.maxPath
    ) {
        fail('path must be a same-origin path starting with /');
    }

    const rawFormat = input.format ?? 'png';
    const format = rawFormat === 'jpg' ? 'jpeg' : rawFormat;
    if (format !== 'png' && format !== 'jpeg' && format !== 'webp') fail('format must be png, jpg, jpeg or webp');

    const theme = input.theme ?? 'light';
    if (theme !== 'light' && theme !== 'dark') fail('theme must be light or dark');

    if (input.optimize !== undefined && typeof input.optimize !== 'boolean') fail('optimize must be a boolean');
    if (input.ignoreSpinners !== undefined && typeof input.ignoreSpinners !== 'boolean') {
        fail('ignoreSpinners must be a boolean');
    }

    const steps = input.steps ?? [];
    if (!Array.isArray(steps) || steps.length > SCREENSHOT_LIMITS.maxSteps) {
        fail(`steps must be a list of at most ${SCREENSHOT_LIMITS.maxSteps}`);
    }

    return {
        path,
        format,
        // png has no encoder quality; 90 is the sharp palette quality that stays invisible on UI.
        quality: Math.round(number(input.quality, 'quality', SCREENSHOT_LIMITS.quality, format === 'png' ? 90 : 80)),
        width: Math.round(number(input.width, 'width', SCREENSHOT_LIMITS.width, 1280)),
        height: Math.round(number(input.height, 'height', SCREENSHOT_LIMITS.height, 800)),
        scale: number(input.scale, 'scale', SCREENSHOT_LIMITS.scale, 1),
        theme,
        waitFor: input.waitFor === undefined || input.waitFor === null ? null : text(input.waitFor, 'waitFor'),
        ignoreSpinners: input.ignoreSpinners ?? false,
        steps: steps.map(step),
        selector: input.selector === undefined || input.selector === null ? null : text(input.selector, 'selector'),
        selectorText:
            input.selectorText === undefined || input.selectorText === null
                ? null
                : text(input.selectorText, 'selectorText'),
        padding: number(input.padding, 'padding', SCREENSHOT_LIMITS.padding, 0),
        aspect:
            input.aspect === undefined || input.aspect === null
                ? null
                : number(input.aspect, 'aspect', SCREENSHOT_LIMITS.aspect, 1),
        optimize: input.optimize ?? true,
    };
}

// ─── Optimization ───────────────────────────────────────────────────────────

/** Re-encodes an image. Node uses sharp (`./node`); a Worker uses the Images binding (`imagesOptimizer`). */
export type ImageOptimizer = (
    bytes: Uint8Array,
    options: { format: ScreenshotFormat; quality: number },
) => Promise<Uint8Array>;

export type OptimizationResult = 'applied' | 'no-gain' | 'skipped' | 'unavailable';

/** Runs the optimizer and keeps whichever encoding is smaller: an optimization pass never grows a file. */
export async function optimizeShot(
    bytes: Uint8Array,
    shot: ScreenshotShot,
    optimizer: ImageOptimizer | null | undefined,
): Promise<{ bytes: Uint8Array; optimization: OptimizationResult }> {
    if (!shot.optimize) return { bytes, optimization: 'skipped' };
    if (!optimizer) return { bytes, optimization: 'unavailable' };
    const optimized = await optimizer(bytes, { format: shot.format, quality: shot.quality });
    return optimized.byteLength < bytes.byteLength
        ? { bytes: optimized, optimization: 'applied' }
        : { bytes, optimization: 'no-gain' };
}

/** The slice of Cloudflare's `ImagesBinding` the optimizer uses. */
export interface ImagesBindingLike {
    input(stream: ReadableStream<Uint8Array>): {
        output(options: { format: string; quality?: number }): Promise<{ response(): Response }>;
    };
}

/** Optimizer backed by the Cloudflare Images binding (local dev runs it through sharp). */
export function imagesOptimizer(images: ImagesBindingLike): ImageOptimizer {
    return async (bytes, { format, quality }) => {
        const stream = new Response(bytes as BodyInit).body as ReadableStream<Uint8Array>;
        const result = await images.input(stream).output({ format: SCREENSHOT_MIME[format], quality });
        return new Uint8Array(await result.response().arrayBuffer());
    };
}

// ─── Capture ────────────────────────────────────────────────────────────────

/** One CDP command on the page's session. */
export type CdpSend = (method: string, params?: Record<string, unknown>) => Promise<unknown>;

export interface CaptureOptions {
    /** Origin the shot's path resolves against, e.g. `http://127.0.0.1:3003`. */
    origin: string;
    shot: ScreenshotShot;
    /** Extra CSS injected into every page (appended to `DEFAULT_SCREENSHOT_CSS`). */
    css?: string;
    /** localStorage key the app's theme provider reads. Default `ottabase.theme` (next-themes). */
    themeStorageKey?: string;
    /** Per wait. Default 30s. */
    timeoutMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function evaluate(send: CdpSend, expression: string): Promise<unknown> {
    const { result, exceptionDetails } = (await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
    })) as { result?: { value?: unknown }; exceptionDetails?: { text?: string; exception?: { description?: string } } };
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result?.value;
}

async function waitUntil(send: CdpSend, expression: string, what: string, timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        // The context is torn down mid-navigation; that is "not yet", not an error.
        if (await evaluate(send, expression).catch(() => false)) return;
        await sleep(250);
    }
    throw new ScreenshotCaptureError(`Timed out waiting for ${what}`, 'TIMEOUT');
}

/** Text is on screen, nothing is loading, fonts and on-screen images are in, entrance animations done. */
async function waitForSettled(
    send: CdpSend,
    { waitFor, ignoreSpinners }: ScreenshotShot,
    timeoutMs: number,
): Promise<void> {
    if (waitFor) {
        await waitUntil(
            send,
            `document.body && document.body.innerText.includes(${JSON.stringify(waitFor)})`,
            `"${waitFor}"`,
            timeoutMs,
        );
    }
    await waitUntil(
        send,
        `document.readyState === 'complete' &&
         ${ignoreSpinners ? '' : `!document.querySelector('.animate-spin, [aria-busy="true"]') &&`}
         document.fonts.status === 'loaded' &&
         [...document.images].every((img) => img.complete || img.getBoundingClientRect().top > innerHeight)`,
        'the page to finish loading',
        timeoutMs,
    );
    await sleep(800);
}

/**
 * Clicks the visible control whose first line of text, aria-label or title is exactly `want`, with a
 * real mouse press (Radix reacts to pointer-down, not element.click()). The last match wins: open
 * sheets and dialogs come last in the DOM. Falls back to any element with that text.
 */
async function clickText(send: CdpSend, want: string): Promise<void> {
    const point = (await evaluate(
        send,
        `(() => {
            const want = ${JSON.stringify(want)};
            const visible = (node) => node.getClientRects().length > 0;
            const firstLine = (node) => node.innerText.trim().split('\\n')[0].trim();
            const controls = [...document.querySelectorAll('button, a, input, textarea, [role="button"], [role="tab"]')].filter(
                (node) => visible(node) &&
                    (firstLine(node) === want || node.getAttribute('aria-label') === want || node.getAttribute('title') === want ||
                        node.getAttribute('placeholder') === want),
            );
            const anyText = () => [...document.querySelectorAll('body *')].filter((node) => visible(node) && node.innerText?.trim() === want);
            const el = controls.pop() ?? anyText().pop();
            if (!el) return null;
            el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        })()`,
    )) as { x: number; y: number } | null;
    if (!point) throw new ScreenshotCaptureError(`Nothing to click reading "${want}"`, 'STEP_FAILED');
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
        await send('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 });
    }
    await sleep(900);
}

/** Scrolls the element reading exactly `want` (a section heading) to the top, inside sheets too. */
async function scrollToText(send: CdpSend, want: string): Promise<void> {
    const found = await evaluate(
        send,
        `(() => {
            const el = [...document.querySelectorAll('body *')].filter((node) => node.innerText?.trim() === ${JSON.stringify(want)}).pop();
            if (!el) return false;
            el.scrollIntoView({ block: 'start', behavior: 'instant' });
            return true;
        })()`,
    );
    if (!found) throw new ScreenshotCaptureError(`No element reading "${want}"`, 'STEP_FAILED');
    await sleep(400);
}

async function runStep(send: CdpSend, s: ScreenshotStep): Promise<void> {
    if ('click' in s) return clickText(send, s.click);
    if ('scrollTo' in s) return scrollToText(send, s.scrollTo);
    if ('type' in s) {
        await send('Input.insertText', { text: s.type });
        await sleep(600);
    } else if ('key' in s) {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: s.key, text: s.key });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: s.key });
        await sleep(900);
    } else {
        await sleep(s.wait);
    }
}

/**
 * The page region of `shot.selector`, in CSS px from the document's top-left, widened by `padding` and,
 * with `aspect`, reshaped downward from the element's top. A region on screen and clear of the top
 * quarter of the viewport is left where it is; any other (off screen, or scrolled up under a sticky
 * header by an earlier step) is scrolled a quarter of the way down, below any header that would
 * otherwise be painted over it. `fits` says whether it is now wholly on screen; when it is not (taller
 * than the viewport), Chrome renders the rest.
 */
async function regionOf(send: CdpSend, shot: ScreenshotShot): Promise<{ clip: Record<string, number>; fits: boolean }> {
    const box = (await evaluate(
        send,
        `(() => {
            const want = ${JSON.stringify(shot.selectorText)};
            const el = [...document.querySelectorAll(${JSON.stringify(shot.selector)})].find(
                (node) => node.getClientRects().length > 0 && (want === null || node.innerText.trim().startsWith(want)),
            );
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { left: r.left + scrollX, top: r.top + scrollY, width: r.width, height: r.height, scrollY, viewport: innerHeight };
        })()`,
    )) as { left: number; top: number; width: number; height: number; scrollY: number; viewport: number } | null;
    if (!box) {
        const what = shot.selectorText ? `"${shot.selector}" reading "${shot.selectorText}"` : `"${shot.selector}"`;
        throw new ScreenshotCaptureError(`Nothing matches ${what}`, 'STEP_FAILED');
    }
    const width = box.width + shot.padding * 2;
    const height = shot.aspect ? width / shot.aspect : box.height + shot.padding * 2;
    const y = Math.max(0, box.top - shot.padding);
    const onScreen = (scrollY: number) => y >= scrollY && y + height <= scrollY + box.viewport;
    let { scrollY } = box;
    if (!onScreen(scrollY) || (scrollY > 0 && y < scrollY + box.viewport / 4)) {
        // Document coordinates do not move with the scroll, so only scrollY needs reading back.
        scrollY = (await evaluate(
            send,
            `(window.scrollTo(0, ${Math.max(0, y - box.viewport / 4)}), scrollY)`,
        )) as number;
        await sleep(300);
    }
    return {
        clip: { x: Math.max(0, box.left - shot.padding), y, width, height, scale: 1 },
        fits: onScreen(scrollY),
    };
}

function decodeBase64(data: string): Uint8Array {
    return Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
}

/** Navigates, waits, runs the steps and returns the encoded image as Chrome produced it. */
export async function captureShot(send: CdpSend, options: CaptureOptions): Promise<Uint8Array> {
    const { shot } = options;
    const timeoutMs = options.timeoutMs ?? 30_000;
    const url = new URL(shot.path, options.origin);
    if (url.origin !== new URL(options.origin).origin) throw new ScreenshotInputError('path must stay on the origin');

    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
        width: shot.width,
        height: shot.height,
        deviceScaleFactor: shot.scale,
        mobile: false,
    });
    await send('Emulation.setEmulatedMedia', {
        features: [
            { name: 'prefers-color-scheme', value: shot.theme },
            { name: 'prefers-reduced-motion', value: 'reduce' },
        ],
    });
    // The theme before the app's provider reads it, the CSS on every document this shot loads.
    const css = DEFAULT_SCREENSHOT_CSS + (options.css ?? '');
    const { identifier } = (await send('Page.addScriptToEvaluateOnNewDocument', {
        source: `
            try { localStorage.setItem(${JSON.stringify(options.themeStorageKey ?? 'ottabase.theme')}, ${JSON.stringify(shot.theme)}); } catch {}
            document.addEventListener('DOMContentLoaded', () => {
                const style = document.createElement('style');
                style.textContent = ${JSON.stringify(css)};
                document.head.appendChild(style);
            });
        `,
    })) as { identifier: string };

    try {
        // Marks the current document so the waits below cannot pass on it before the new one loads.
        await evaluate(send, 'window.__ottaShotStale = true').catch(() => undefined);
        await send('Page.navigate', { url: url.href });
        await waitUntil(send, '!window.__ottaShotStale', 'the page to load', timeoutMs);
        await waitForSettled(send, shot, timeoutMs);

        for (const s of shot.steps) await runStep(send, s);

        // No focus rings or hover states, unless the shot is about typing into a field.
        if (!shot.steps.some((s) => 'type' in s || 'key' in s)) {
            await evaluate(send, 'document.activeElement?.blur()');
        }
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: shot.height - 1 });

        // Beyond-viewport capture resizes the viewport (re-centring fixed dialogs), so only when it must.
        const region = shot.selector ? await regionOf(send, shot) : null;
        const { data } = (await send('Page.captureScreenshot', {
            format: shot.format,
            ...(shot.format === 'png' ? {} : { quality: shot.quality }),
            ...(region ? { clip: region.clip, captureBeyondViewport: !region.fits } : {}),
        })) as { data: string };
        return decodeBase64(data);
    } finally {
        await send('Page.removeScriptToEvaluateOnNewDocument', { identifier }).catch(() => undefined);
    }
}
