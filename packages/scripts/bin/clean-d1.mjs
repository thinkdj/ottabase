#!/usr/bin/env node
/**
 * clean:d1 – Wipe local D1 state only.
 * This clears .wrangler/state/<version>/d1 without touching KV/R2 or build caches.
 */
import { hasYesFlag, runClean } from './clean-lib.mjs';

async function main() {
    await runClean({ scope: 'd1', yes: hasYesFlag() });
}

main().catch((err) => {
    console.error('clean:d1 failed:', err);
    process.exit(1);
});
