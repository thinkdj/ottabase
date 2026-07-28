#!/usr/bin/env node
/**
 * clean:state – Wipe all local Wrangler state (D1 + KV + R2).
 *
 * This is local emulator state under .wrangler/state/<version>/ only; the remote
 * Cloudflare account is never touched (that is what the cf:* scripts are for).
 * Build caches and package output survive – use clean:all for those.
 */
import { hasYesFlag, runClean } from './clean-lib.mjs';

async function main() {
    await runClean({ scope: 'state', yes: hasYesFlag() });
}

main().catch((err) => {
    console.error('clean:state failed:', err);
    process.exit(1);
});
