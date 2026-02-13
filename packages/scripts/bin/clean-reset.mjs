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
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const NC = '\x1b[0m';

function log(msg, color = NC) {
    console.log(`${color}${msg}${NC}`);
}

function rmIfExists(fullPath, label) {
    if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        log(`  ✓ Removed ${label}`, GREEN);
        return true;
    }
    return false;
}

function prompt(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function main() {
    const root = process.cwd();

    log('');
    log(`${BOLD}${RED}⚠ clean:reset - DESTRUCTIVE OPERATION${NC}`);
    log('');
    log('This will delete the following from your local workspace:', YELLOW);
    log('  • .wrangler/           → Local D1 database, KV, R2 data');
    log('  • node_modules/.cache/ → Vite, Turbo, esbuild caches');
    log('  • .turbo/              → Turborepo cache (root + workspaces)');
    log('  • packages/*/dist/     → Built package output (apps excluded)');
    log('');
    log(`${RED}Your local D1 database will be destroyed. You will need to re-bootstrap.${NC}`);
    log('');

    const answer = await prompt(`${BOLD}Type YES to continue: ${NC}`);
    if (answer !== 'YES') {
        log('Aborted.', YELLOW);
        process.exit(0);
    }

    log('');
    log('Resetting local dev environment...', YELLOW);
    let removed = 0;

    // 1. Root-level caches
    if (rmIfExists(path.join(root, 'node_modules', '.cache'), 'node_modules/.cache')) removed++;
    if (rmIfExists(path.join(root, '.turbo'), '.turbo')) removed++;

    // 2. Workspace dirs (apps/* and packages/*)
    for (const dir of ['apps', 'packages']) {
        const dirPath = path.join(root, dir);
        if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) continue;

        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const ent of entries) {
            if (!ent.isDirectory()) continue;
            const wsPath = path.join(dirPath, ent.name);
            const wsLabel = `${dir}/${ent.name}`;

            // .wrangler (local D1, KV, R2 state)
            if (rmIfExists(path.join(wsPath, '.wrangler'), `${wsLabel}/.wrangler`)) removed++;

            // .turbo (workspace turbo cache)
            if (rmIfExists(path.join(wsPath, '.turbo'), `${wsLabel}/.turbo`)) removed++;

            // dist (built output) – only for packages, not apps (Wrangler needs app dist for assets)
            if (dir === 'packages') {
                if (rmIfExists(path.join(wsPath, 'dist'), `${wsLabel}/dist`)) removed++;
            }

            // node_modules/.cache (workspace-level caches)
            if (rmIfExists(path.join(wsPath, 'node_modules', '.cache'), `${wsLabel}/node_modules/.cache`)) removed++;
        }
    }

    log('');
    log(`Done! Removed ${removed} directories.`, GREEN);
    log('');
    log('Next steps:', YELLOW);
    log('  1. pnpm build:pkg     → Rebuild all packages');
    log('  2. pnpm dev           → Start dev server');
    log('  3. Visit /__bootstrap__ to re-initialize the database');
    log('');
}

main().catch((err) => {
    console.error('clean:reset failed:', err);
    process.exit(1);
});
