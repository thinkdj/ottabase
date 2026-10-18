// ============================================================
// Screenshots (@ottabase/screenshot): this app's pages as png, jpeg or webp
// ============================================================
// `POST /api/screenshot/capture` for any signed-in user, rate limited: every call is a Browser
// Rendering session. The optimization pass is the Images binding; without it shots are served
// as Chrome encodes them. For scripted runs use `pnpm gen:screenshots` (the package's `/node`).
// ============================================================

import { createScreenshotPackage, imagesOptimizer, type ScreenshotPuppeteer } from '@ottabase/screenshot';
import { resolvePackageCaller } from './caller';

export const screenshotPackage = createScreenshotPackage<CloudflareEnv>({
    resolveCaller: resolvePackageCaller,
    rateLimit: (request, env, caller) =>
        import('../../worker/lib/rate-limiting').then(({ enforceRateLimit }) =>
            enforceRateLimit(request, env, `screenshot:${caller.userId}`),
        ),
    getBrowserBinding: (env) => env.OBCF_BROWSER,
    loadPuppeteer: async () => (await import('@cloudflare/puppeteer')).default as unknown as ScreenshotPuppeteer,
    getOptimizer: (env) => (env.OBCF_IMAGES ? imagesOptimizer(env.OBCF_IMAGES) : null),
});
