// ============================================================
// @ottabase/screenshot — the manifest
// ============================================================

import { definePackage, type OttaPackage } from '@ottabase/kernel';
import { createScreenshotRouter, type ScreenshotRouterOptions } from './routes';

export const SCREENSHOT_PACKAGE_KEY = 'screenshot';
export const SCREENSHOT_BASE_PATH = '/api/screenshot';

/** `POST /api/screenshot/capture`, and a health line saying whether Browser Rendering is bound. */
export function createScreenshotPackage<Env = unknown>(
    options: ScreenshotRouterOptions<Env> & { basePath?: string },
): OttaPackage<Env> {
    const { basePath = SCREENSHOT_BASE_PATH, ...routerOptions } = options;
    return definePackage<Env>({
        key: SCREENSHOT_PACKAGE_KEY,
        name: 'Screenshots',
        version: '0.1.0',
        description:
            'Screenshots this app’s pages as png, jpeg or webp through Browser Rendering, with an optimization pass.',
        docsUrl: 'https://github.com/thinkdj/ottabase/tree/main/packages/screenshot#readme',
        routes: { basePath, build: () => createScreenshotRouter<Env>(routerOptions) },
        health: (env) => {
            const bound = Boolean(options.getBrowserBinding(env));
            const optimizer = Boolean(options.getOptimizer?.(env));
            return {
                name: 'screenshot:browser',
                ok: bound,
                detail: `${bound ? 'Browser Rendering bound' : 'no Browser Rendering binding'}; ${
                    optimizer ? 'optimizer ready' : 'no optimizer (shots are served as Chrome encodes them)'
                }`,
            };
        },
    });
}
