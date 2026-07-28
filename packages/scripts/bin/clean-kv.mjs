#!/usr/bin/env node
/**
 * clean:kv – Wipe local KV state only.
 * This clears .wrangler/state/<version>/kv without touching D1/R2 or build caches.
 */
import { hasYesFlag, runClean } from './clean-lib.mjs';

async function main() {
    await runClean({ scope: 'kv', yes: hasYesFlag() });
}

main().catch((err) => {
    console.error('clean:kv failed:', err);
    process.exit(1);
});
