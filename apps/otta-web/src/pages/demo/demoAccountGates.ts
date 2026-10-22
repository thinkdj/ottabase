// Kept apart from demoItems.ts (and its icons): the router imports this into the entry chunk.

/**
 * A demo that needs a free account. Each runs on metered Cloudflare infrastructure, so an
 * anonymous visitor gets a teaser with a sign-up instead of the page; the worker routes behind
 * them require a session either way.
 */
export interface DemoAccountGate {
    /** What the visitor unlocks, as it reads in a sentence ("Realtime pub/sub"). */
    feature: string;
    /** What it runs on, shown in the teaser. */
    runsOn: string;
    /** A screenshot in DEMO_SCREENSHOT_BASE: `<name>.webp`, with `<name>.dark.webp` for dark mode. */
    preview?: string;
}

/**
 * The demo's screenshots, served by the app itself so they show on every host (local dev, a fork's
 * demo, demo.ottabase.com). Copies of `pnpm screenshots` output in ottabase.homepage
 * (`public/assets`); copy them again when those are regenerated.
 */
export const DEMO_SCREENSHOT_BASE = '/ottabase-demo/screenshots';

/** Keyed by route path. Drives the router's gate and the "Free account" mark in the gallery. */
export const DEMO_ACCOUNT_GATES: Record<string, DemoAccountGate> = {
    '/demo/cloudflare/realtime': {
        feature: 'Realtime pub/sub',
        runsOn: 'a Durable Object of your own',
        preview: 'realtime',
    },
    '/demo/cloudflare/screenshot': {
        feature: 'Screenshots',
        runsOn: 'Cloudflare Browser Rendering',
        preview: 'screenshot',
    },
    '/demo/cloudflare/ai': { feature: 'The OttaAI playground', runsOn: 'Cloudflare AI Gateway', preview: 'ai' },
    '/demo/cloudflare/pdf/playground': {
        feature: 'PDF rendering',
        runsOn: 'Cloudflare Browser Rendering',
        preview: 'pdf',
    },
    '/demo/cloudflare/file-upload': { feature: 'File uploads', runsOn: 'Cloudflare R2', preview: 'ottaupload' },
};
