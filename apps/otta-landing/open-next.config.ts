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

// Note: wrangler.jsonc `main` is OpenNext's generated `.open-next/worker.js`; this app
// has no custom worker entry and exports no Durable Objects. Built-in brand themes are
// registered where they are used (app/providers.tsx, lib/brand-server.ts).

export default config;
