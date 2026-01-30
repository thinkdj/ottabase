import type { OpenNextConfig } from '@opennextjs/cloudflare';

const config: OpenNextConfig = {
    default: {
        // Use Cloudflare Workers runtime
        override: {
            wrapper: 'cloudflare-node',
            converter: 'edge',
            proxyExternalRequest: 'fetch',
            incrementalCache: 'dummy',
            tagCache: 'dummy',
            // NOTE: "direct" is convenient, but consider a Durable Object based queue for production.
            queue: 'direct',
        },
    },
    // Required for Cloudflare wrapper compatibility (validated by OpenNext).
    edgeExternals: ['node:crypto'],

    // External middleware bundle (runs in the edge runtime).
    middleware: {
        external: true,
        override: {
            wrapper: 'cloudflare-edge',
            converter: 'edge',
            proxyExternalRequest: 'fetch',
            incrementalCache: 'dummy',
            tagCache: 'dummy',
            queue: 'direct',
        },
    },
};

// Note: Durable Object classes must be exported from the Wrangler `main` entry.
// We do that in `cloudflare-worker.ts` so OpenNext's build step doesn't try to bundle
// `@cloudflare/actors` (which imports `cloudflare:workers`, only available at runtime).

export default config;
