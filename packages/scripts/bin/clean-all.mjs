#!/usr/bin/env node
/**
 * clean:all – Wipe the whole local dev environment for a clean restart.
 *
 * Deletes:
 *   • .wrangler/          (local D1, KV and R2 state)
 *   • node_modules/.cache (Vite, Turbo, esbuild caches)
 *   • .turbo/             (Turborepo cache at root + workspaces)
 *   • packages/<pkg>/dist/ (built package output, apps excluded)
 *
 * Does NOT delete node_modules (run `pnpm install` separately if needed).
 * Requires typing "YES" to confirm – this destroys your local D1 data.
 */
import { hasYesFlag, runClean } from './clean-lib.mjs';

async function main() {
    await runClean({ scope: 'all', yes: hasYesFlag() });
}

main().catch((err) => {
    console.error('clean:all failed:', err);
    process.exit(1);
});
