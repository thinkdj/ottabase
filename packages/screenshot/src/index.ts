// ============================================================
// @ottabase/screenshot — runtime-agnostic entry (Workers, browsers, Node)
// ============================================================
// Local automation lives at `@ottabase/screenshot/node`.

export * from './core';
export { createScreenshotPackage, SCREENSHOT_BASE_PATH, SCREENSHOT_PACKAGE_KEY } from './manifest';
export {
    createScreenshotRouter,
    screenshotOrigin,
    type ScreenshotPuppeteer,
    type ScreenshotResponse,
    type ScreenshotRouterOptions,
} from './routes';
