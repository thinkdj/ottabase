# @ottabase/screenshot

Automated screenshots of an Ottabase app. One runner drives a headless Chrome over the Chrome DevTools Protocol: a local
Chrome from a Node script, or Cloudflare Browser Rendering from a Worker. Choose png, jpg or webp and the quality. An
optimization pass then re-encodes the image and keeps the result only if it is smaller.

The package is source-exported: there is no build, and Node runs `./node` from source through its built-in type
stripping (Node 24+).

| Import                      | Runtime | Purpose                                                                |
| --------------------------- | ------- | ---------------------------------------------------------------------- |
| `@ottabase/screenshot`      | Any     | `normalizeShot`, `captureShot`, optimizers, the route and the manifest |
| `@ottabase/screenshot/node` | Node    | `runShots`, `openBrowser`, `sharpOptimizer`                            |

## A shot

```ts
{
    path: '/blog',            // same-origin path, never a URL
    format: 'webp',           // png (default) | jpg | jpeg | webp
    quality: 80,              // 1–100; jpeg/webp encoder quality, png palette quality under sharp
    width: 1280, height: 800, // CSS viewport (320–1920 × 240–1920)
    scale: 1.5,               // device pixel ratio 1–2: 1280×800 @1.5 = 1920×1200
    theme: 'dark',            // prefers-color-scheme + the `ottabase.theme` localStorage key
    waitFor: 'Latest posts',  // text that proves the page has its data
    ignoreSpinners: false,    // true skips the spinner wait, for a page that shows one on purpose
    steps: [{ click: 'Open menu' }, { scrollTo: 'Pricing' }, { type: 'hello' }, { key: '/' }, { wait: 500 }],
    selector: 'section',      // capture this element's region instead of the viewport
    selectorText: 'Pricing',  // the first match whose text starts with this (optional)
    padding: 16,              // CSS px of page kept around it (0 to 200)
    aspect: 16 / 9,           // width ÷ height: the region grows or shrinks down from the element's top
    optimize: true,           // run the optimization pass (default)
}
```

Before the shot the runner waits for the page to load, for `waitFor`, for fonts, for on-screen images, and for spinners
(`.animate-spin`, `[aria-busy]`) to clear. Motion is reduced. Steps match text exactly: a control's first line, its
`aria-label` or its `title`, with the last match winning, so an open dialog beats the nav. The runner hides devtools and
toasts, makes the caret transparent, and blurs focus unless a step typed into a field.

## From a script (automation)

```js
import { runShots } from '@ottabase/screenshot/node';

const results = await runShots({
    origin: 'http://127.0.0.1:3003',
    outDir: 'docs/images',
    defaults: { format: 'webp', quality: 80, scale: 1.5 },
    shots: [
        { name: 'home', path: '/' },
        { name: 'blog-dark', path: '/blog', theme: 'dark' },
    ],
    chromePath: process.env.CHROME_PATH, // optional: else Playwright's cached Chromium, else a system Chrome
});
```

Each shot is written to `<outDir>/<name>.<png|jpg|webp>`. A failed shot comes back with its `error` and does not stop
the run. otta-web's `pnpm gen:screenshots [filter]` is a working example (`apps/otta-web/scripts/gen-screenshots.mjs`).

The Node optimizer is `sharpOptimizer`, and `sharp` is an optional peer dependency:

| Format | Pass                                        | Typical saving on UI |
| ------ | ------------------------------------------- | -------------------- |
| png    | 256-colour dithered palette, zlib effort 10 | 60–75%               |
| jpeg   | mozjpeg at the same quality                 | ~20%                 |
| webp   | effort 6, smart subsampling                 | 2–5%                 |

Pass `optimizer: null` to keep Chrome's bytes, or your own `(bytes, { format, quality }) => Uint8Array`.

For custom flows such as signing in first, compose the parts yourself: `openBrowser()` gives you a CDP `send`, and you
call `captureShot(send, { origin, shot: normalizeShot(input) })` between your own steps.

## From a Worker (the route)

```ts
// apps/<app>/ottabase/packages/screenshot.ts — then list `screenshotPackage` in ottabase/packages.ts
import { createScreenshotPackage, imagesOptimizer, type ScreenshotPuppeteer } from '@ottabase/screenshot';

export const screenshotPackage = createScreenshotPackage<CloudflareEnv>({
    resolveCaller: resolvePackageCaller, // a verified session or null (401)
    rateLimit: (request, env, caller) => enforceRateLimit(request, env, `screenshot:${caller.userId}`),
    getBrowserBinding: (env) => env.OBCF_BROWSER,
    loadPuppeteer: async () => (await import('@cloudflare/puppeteer')).default as unknown as ScreenshotPuppeteer,
    getOptimizer: (env) => (env.OBCF_IMAGES ? imagesOptimizer(env.OBCF_IMAGES) : null),
});
```

`POST /api/screenshot/capture` takes a shot as JSON and returns
`{ data: { format, mimeType, dataUrl, originalBytes, bytes, optimization, width, height, scale } }`. The `optimization`
field is one of these values:

- `applied`: the optimizer made the file smaller.
- `no-gain`: the optimizer ran, but Chrome's encoding was smaller.
- `skipped`: the shot set `optimize: false`.
- `unavailable`: no optimizer is bound, or the optimizer failed.

| Status | When                                                                     |
| ------ | ------------------------------------------------------------------------ |
| 401    | No session                                                               |
| 400    | Invalid shot (a URL instead of a path, an unknown format, out of limits) |
| 503    | No Browser Rendering binding                                             |
| 422    | `CAPTURE_TIMEOUT` / `CAPTURE_STEP_FAILED`: the page never got there      |
| 502    | Anything else; the cause is logged redacted, never returned              |

**Security.** The route accepts a path, never a URL. The origin is the request's own: the route cannot be aimed at
another site. There is one exception, for local dev. When the Worker is on loopback, it follows the browser's loopback
`Origin`, because the Vite proxy rewrites `Host` to the Worker port. A deployed Worker never matches this branch. The
browser session is signed out: pages behind auth come out as the login page. Every call opens a billed Browser Rendering
session, so keep the rate limit.

**Edge optimization.** The edge pass uses the Cloudflare Images binding, which Wrangler runs through sharp in local dev.
It re-encodes jpeg and webp, but png output stays lossless, so the large palette savings happen only in Node.
Transformations count against Cloudflare Images (5,000 a month on the free tier). Leave out `getOptimizer` and shots are
served as Chrome encodes them.

## Limits

Viewport 320–1920 × 240–1920 at scale 1–2. At most 12 steps of up to 200 characters each, and waits of up to 5 s. Each
wait times out after 30 s (Node: 60 s, route: 20 s). A shot is the viewport, or with `selector` one element's region
(which may run past the viewport); full-page capture is not supported.
