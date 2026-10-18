// ============================================================
// @ottabase/screenshot/node — automate screenshots from a script
// ============================================================
// A local headless Chrome over the DevTools Protocol (Node's built-in WebSocket, no
// puppeteer), plus a sharp optimization pass. Node runs this file from source with its
// built-in type stripping, hence the `.ts` import below.
//
//   import { runShots } from '@ottabase/screenshot/node';
//   await runShots({ origin: 'http://127.0.0.1:3003', outDir: 'docs/images', shots: [{ name: 'home', path: '/' }] });
// ============================================================

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    captureShot,
    normalizeShot,
    optimizeShot,
    SCREENSHOT_EXTENSION,
    type CdpSend,
    type ImageOptimizer,
    type ScreenshotInput,
} from './core.ts';

/** `chromePath` (pass your CHROME_PATH), else Playwright's newest cached Chromium, else a system Chrome. */
export function findChrome(chromePath?: string): string {
    if (chromePath) return chromePath;
    const caches = [
        join(homedir(), 'AppData', 'Local', 'ms-playwright'),
        join(homedir(), '.cache', 'ms-playwright'),
        join(homedir(), 'Library', 'Caches', 'ms-playwright'),
    ];
    const inCache = ['chrome-win64/chrome.exe', 'chrome-linux/chrome', 'chrome-linux64/chrome'];
    for (const cache of caches) {
        if (!existsSync(cache)) continue;
        const builds = readdirSync(cache)
            .filter((d) => /^chromium-\d+$/.test(d))
            .sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)));
        for (const build of builds) {
            for (const rel of inCache) {
                const exe = join(cache, build, rel);
                if (existsSync(exe)) return exe;
            }
        }
    }
    const system = [
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
    ];
    const found = system.find((p) => existsSync(p));
    if (!found) throw new Error('No Chrome found. Set CHROME_PATH or run `npx playwright install chromium`.');
    return found;
}

function launchChrome(profileDir: string, chromePath?: string): Promise<{ proc: ChildProcess; wsUrl: string }> {
    const proc = spawn(
        findChrome(chromePath),
        [
            '--headless=new',
            '--remote-debugging-port=0',
            `--user-data-dir=${profileDir}`,
            '--hide-scrollbars',
            '--force-color-profile=srgb',
            '--no-first-run',
            '--no-default-browser-check',
        ],
        { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    return new Promise((resolve, reject) => {
        let log = '';
        proc.stderr?.on('data', (chunk) => {
            log += chunk;
            const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
            if (match) resolve({ proc, wsUrl: match[1] });
        });
        proc.on('exit', (code) => reject(new Error(`Chrome exited (${code}):\n${log}`)));
    });
}

/** Minimal CDP client bound to one new page. */
async function connect(wsUrl: string): Promise<{ send: CdpSend; close: () => void }> {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
    });
    let nextId = 1;
    const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; method: string }>();
    ws.onmessage = (event) => {
        const msg = JSON.parse(String(event.data));
        const call = pending.get(msg.id);
        if (!call) return;
        pending.delete(msg.id);
        if (msg.error) call.reject(new Error(`${call.method}: ${msg.error.message}`));
        else call.resolve(msg.result);
    };
    const raw = (method: string, params: Record<string, unknown> = {}, sessionId?: string) =>
        new Promise<unknown>((resolve, reject) => {
            const id = nextId++;
            pending.set(id, { resolve, reject, method });
            ws.send(JSON.stringify({ id, method, params, sessionId }));
        });

    const { targetId } = (await raw('Target.createTarget', { url: 'about:blank' })) as { targetId: string };
    const { sessionId } = (await raw('Target.attachToTarget', { targetId, flatten: true })) as { sessionId: string };
    return { send: (method, params) => raw(method, params, sessionId), close: () => ws.close() };
}

/** A local headless Chrome page. Always `close()` it: it kills Chrome and removes the temp profile. */
export async function openBrowser(chromePath?: string): Promise<{ send: CdpSend; close: () => void }> {
    const profileDir = mkdtempSync(join(tmpdir(), 'otta-shots-'));
    const { proc, wsUrl } = await launchChrome(profileDir, chromePath);
    const cdp = await connect(wsUrl);
    return {
        send: cdp.send,
        close: () => {
            cdp.close();
            proc.kill();
            // Chrome holds the profile for a moment after exit on Windows.
            setTimeout(() => rmSync(profileDir, { recursive: true, force: true }), 1000);
        },
    };
}

/**
 * Chrome's encoders favour speed. sharp re-encodes: png to a dithered 256-colour palette at max
 * zlib effort (35–45% smaller, invisible on UI), jpeg through mozjpeg, webp at max effort.
 * sharp is an optional peer dependency, loaded on first use.
 */
export const sharpOptimizer: ImageOptimizer = async (bytes, { format, quality }) => {
    const { default: sharp } = await import('sharp');
    const image = sharp(bytes);
    const encoded =
        format === 'png'
            ? image.png({ palette: true, quality, effort: 10, compressionLevel: 9 })
            : format === 'jpeg'
              ? image.jpeg({ quality, mozjpeg: true })
              : image.webp({ quality, effort: 6, smartSubsample: true });
    return new Uint8Array(await encoded.toBuffer());
};

export interface RunShotsOptions {
    /** Where the app is served, e.g. `http://127.0.0.1:3003`. */
    origin: string;
    outDir: string;
    /** Each written to `<outDir>/<name>.<png|jpg|webp>`. */
    shots: Array<ScreenshotInput & { name: string }>;
    /** Defaults applied under every shot (format, quality, scale, ...). */
    defaults?: Omit<ScreenshotInput, 'path'>;
    css?: string;
    themeStorageKey?: string;
    /** Default `sharpOptimizer`; `null` writes Chrome's bytes as they are. */
    optimizer?: ImageOptimizer | null;
    timeoutMs?: number;
    /** Chrome or Chromium executable; found automatically when omitted. */
    chromePath?: string;
}

export interface RunShotsResult {
    name: string;
    file?: string;
    originalBytes?: number;
    bytes?: number;
    error?: string;
}

/** Captures every shot in one Chrome, writing files as it goes. A failed shot is reported, not thrown. */
export async function runShots(options: RunShotsOptions): Promise<RunShotsResult[]> {
    const reachable = await fetch(options.origin).then(
        (r) => r.ok,
        () => false,
    );
    if (!reachable) throw new Error(`${options.origin} is not reachable. Start the app first.`);

    mkdirSync(options.outDir, { recursive: true });
    const optimizer = options.optimizer === undefined ? sharpOptimizer : options.optimizer;
    const browser = await openBrowser(options.chromePath);
    const results: RunShotsResult[] = [];
    try {
        for (const { name, ...input } of options.shots) {
            try {
                const shot = normalizeShot({ ...options.defaults, ...input });
                const raw = await captureShot(browser.send, {
                    origin: options.origin,
                    shot,
                    css: options.css,
                    themeStorageKey: options.themeStorageKey,
                    timeoutMs: options.timeoutMs ?? 60_000,
                });
                const { bytes } = await optimizeShot(raw, shot, optimizer);
                const file = join(options.outDir, `${name}.${SCREENSHOT_EXTENSION[shot.format]}`);
                writeFileSync(file, bytes);
                results.push({ name, file, originalBytes: raw.byteLength, bytes: bytes.byteLength });
            } catch (error) {
                results.push({ name, error: error instanceof Error ? error.message : String(error) });
            }
        }
    } finally {
        browser.close();
    }
    return results;
}
