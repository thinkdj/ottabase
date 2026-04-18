#!/usr/bin/env node
/**
 * clean:kv – Wipe local KV state only.
 * This clears .wrangler/state/<version>/kv without touching D1/R2 or build caches.
 */
import { runCleanReset } from './clean-reset-lib.mjs';

async function main() {
    const force = process.argv.includes('--force');
    await runCleanReset({ scope: 'kv', force });
}

main().catch((err) => {
    console.error('clean:kv failed:', err);
    process.exit(1);
});
