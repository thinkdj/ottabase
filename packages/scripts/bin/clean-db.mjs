#!/usr/bin/env node
/**
 * clean:db – Wipe local D1 state only.
 * This clears .wrangler/state/<version>/d1 without touching KV/R2 or build caches.
 */
import { runCleanReset } from './clean-reset-lib.mjs';

async function main() {
    const force = process.argv.includes('--force');
    await runCleanReset({ scope: 'db', force });
}

main().catch((err) => {
    console.error('clean:db failed:', err);
    process.exit(1);
});
