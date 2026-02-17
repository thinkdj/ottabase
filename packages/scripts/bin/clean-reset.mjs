#!/usr/bin/env node
/**
 * clean:reset – Wipe local dev caches for a clean restart.
 *
 * Deletes:
 *   • .wrangler/          (local D1 database, Wrangler state)
 *   • node_modules/.cache (Vite, Turbo, esbuild caches)
 *   • .turbo/             (Turborepo cache at root + workspaces)
 *   • packages/<pkg>/dist/ (built package output, apps excluded)
 *
 * Does NOT delete node_modules (use `pnpm install` separately if needed).
 * Requires typing "YES" to confirm – this destroys your local D1 data.
 */
import { runCleanReset } from './clean-reset-lib.mjs';

async function main() {
    const force = process.argv.includes('--force');
    await runCleanReset({ scope: 'all', force });
}

main().catch((err) => {
    console.error('clean:reset failed:', err);
    process.exit(1);
});
