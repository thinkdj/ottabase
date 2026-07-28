/**
 * Shared implementation for the clean:* scripts.
 *
 * Scopes:
 *   d1    → local D1 state only          (.wrangler/state/<version>/d1)
 *   kv    → local KV state only          (.wrangler/state/<version>/kv)
 *   state → all local backing services   (.wrangler/state/<version>/{d1,kv,r2})
 *   all   → state + build caches + built package output
 *
 * Every scope confirms before deleting; pass --yes (or -y) to skip the prompt in CI.
 *
 * A path that exists but can't be removed (typically because a dev server, editor, or
 * antivirus scanner still has it open on Windows) does not abort the run - it's reported
 * at the end instead, and the process exits non-zero so a script relying on this can't
 * mistake a partial clean for a complete one.
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const NC = '\x1b[0m';

/** Wrangler has moved its state layout between versions; clear every known location. */
const STATE_VERSION_DIRS = ['v3', 'v2', ''];

/** Local Wrangler stores each scope owns. `all` wipes the whole .wrangler directory instead. */
const SCOPE_STORES = {
    d1: ['d1'],
    kv: ['kv'],
    state: ['d1', 'kv', 'r2'],
};

/** Prompt copy + follow-up steps per scope. */
const SCOPE_INFO = {
    d1: {
        title: 'clean:d1 - DESTRUCTIVE OPERATION',
        color: RED,
        targets: ['  • .wrangler/state/*/d1  → Local D1 database'],
        warning: 'Your local D1 database will be destroyed. You will need to re-bootstrap.',
        warningColor: RED,
        progress: 'Cleaning local D1 state...',
        next: ['  1. pnpm dev           → Start dev server', '  2. Visit /__bootstrap__ to re-initialize the database'],
    },
    kv: {
        title: 'clean:kv',
        color: YELLOW,
        targets: ['  • .wrangler/state/*/kv  → Local KV (platform cache, RBAC, queue, rate limits)'],
        warning: 'Your local KV cache will be cleared.',
        warningColor: YELLOW,
        progress: 'Cleaning local KV state...',
        next: ['  1. pnpm dev           → Start dev server'],
    },
    state: {
        title: 'clean:state - DESTRUCTIVE OPERATION',
        color: RED,
        targets: [
            '  • .wrangler/state/*/d1  → Local D1 database',
            '  • .wrangler/state/*/kv  → Local KV (platform cache, RBAC, queue, rate limits)',
            '  • .wrangler/state/*/r2  → Local R2 objects (uploaded media)',
        ],
        warning: 'This is local Wrangler state only - your Cloudflare account is not touched.',
        warningColor: RED,
        progress: 'Cleaning local Wrangler state...',
        next: ['  1. pnpm dev           → Start dev server', '  2. Visit /__bootstrap__ to re-initialize the database'],
    },
    all: {
        title: 'clean:all - DESTRUCTIVE OPERATION',
        color: RED,
        targets: [
            '  • .wrangler/           → All local state (D1, KV, R2)',
            '  • node_modules/.cache/ → Vite, Turbo, esbuild caches',
            '  • .turbo/              → Turborepo cache (root + workspaces)',
            '  • packages/*/dist/     → Built package output (apps excluded)',
        ],
        warning: 'Your local D1 database will be destroyed. You will need to re-bootstrap.',
        warningColor: RED,
        progress: 'Cleaning the whole local dev environment...',
        next: [
            '  1. pnpm build:pkg     → Rebuild all packages',
            '  2. pnpm dev           → Start dev server',
            '  3. Visit /__bootstrap__ to re-initialize the database',
        ],
    },
};

const SCOPES = Object.keys(SCOPE_INFO);

function log(msg, color = NC) {
    console.log(`${color}${msg}${NC}`);
}

/** Shared flag parsing so every clean:* script skips its prompt the same way. */
export function hasYesFlag(argv = process.argv) {
    return argv.includes('--yes') || argv.includes('-y');
}

/**
 * Removes `fullPath` if it exists. Returns true only on a successful removal; a path
 * that exists but fails to delete (e.g. Windows EBUSY/EPERM from a lock) is reported
 * to `failed` instead of throwing, so one locked directory doesn't abort the rest of
 * the run.
 */
function rmIfExists(fullPath, label, failed) {
    if (!fs.existsSync(fullPath)) return false;

    try {
        fs.rmSync(fullPath, { recursive: true, force: true });
        log(`  ✓ Removed ${label}`, GREEN);
        return true;
    } catch (error) {
        const reason = error && typeof error === 'object' && 'code' in error ? error.code : String(error);
        log(`  ✗ Could not remove ${label} (${reason})`, RED);
        failed.push(label);
        return false;
    }
}

/** Remove the given Wrangler stores across every known state-layout version. */
function rmWranglerStores(basePath, baseLabel, stores, failed) {
    let removed = 0;

    for (const store of stores) {
        for (const version of STATE_VERSION_DIRS) {
            const candidate = version
                ? path.join(basePath, '.wrangler', 'state', version, store)
                : path.join(basePath, '.wrangler', 'state', store);
            const rel = path.relative(basePath, candidate).replaceAll('\\', '/');
            if (rmIfExists(candidate, `${baseLabel}/${rel}`, failed)) removed++;
        }
    }

    return removed;
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

function findMonorepoRoot(startPath) {
    let current = path.resolve(startPath);
    while (true) {
        if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            return path.resolve(startPath);
        }
        current = parent;
    }
}

/**
 * @param {{ scope: 'd1' | 'kv' | 'state' | 'all', yes?: boolean }} options
 */
export async function runClean(options = {}) {
    const { scope, yes = false } = options;
    if (!SCOPES.includes(scope)) {
        // A caller bug should fail loudly here rather than silently escalate to the
        // broadest (most destructive) scope - there is no safe default to fall back to.
        throw new Error(`runClean: invalid scope "${scope}". Expected one of: ${SCOPES.join(', ')}`);
    }
    const info = SCOPE_INFO[scope];
    const root = findMonorepoRoot(process.cwd());
    const failed = [];

    log('');
    log(`${BOLD}${info.color}⚠ ${info.title}${NC}`);
    log('');
    log('This will delete the following from your local workspace:', YELLOW);
    for (const target of info.targets) log(target);
    log('');
    log(`${info.warningColor}${info.warning}${NC}`);
    log('');

    if (!yes) {
        const answer = await prompt(`${BOLD}Type YES to continue: ${NC}`);
        if (answer !== 'YES') {
            log('Aborted.', YELLOW);
            process.exit(0);
        }
    } else {
        log('--yes passed: skipping confirmation prompt.', YELLOW);
    }

    log('');
    log(info.progress, YELLOW);
    let removed = 0;

    // Root-level build caches only belong to the full clean.
    if (scope === 'all') {
        if (rmIfExists(path.join(root, 'node_modules', '.cache'), 'node_modules/.cache', failed)) removed++;
        if (rmIfExists(path.join(root, '.turbo'), '.turbo', failed)) removed++;
        if (rmIfExists(path.join(root, '.wrangler'), '.wrangler', failed)) removed++;
    } else {
        removed += rmWranglerStores(root, 'root', SCOPE_STORES[scope], failed);
    }

    for (const dir of ['apps', 'packages']) {
        const dirPath = path.join(root, dir);
        if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) continue;

        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const ent of entries) {
            if (!ent.isDirectory()) continue;
            const wsPath = path.join(dirPath, ent.name);
            const wsLabel = `${dir}/${ent.name}`;

            if (scope === 'all') {
                if (rmIfExists(path.join(wsPath, '.wrangler'), `${wsLabel}/.wrangler`, failed)) removed++;
                if (rmIfExists(path.join(wsPath, '.turbo'), `${wsLabel}/.turbo`, failed)) removed++;

                if (dir === 'packages') {
                    if (rmIfExists(path.join(wsPath, 'dist'), `${wsLabel}/dist`, failed)) removed++;
                }

                if (rmIfExists(path.join(wsPath, 'node_modules', '.cache'), `${wsLabel}/node_modules/.cache`, failed)) {
                    removed++;
                }
            } else {
                removed += rmWranglerStores(wsPath, wsLabel, SCOPE_STORES[scope], failed);
            }
        }
    }

    log('');
    log(`Done! Removed ${removed} director${removed === 1 ? 'y' : 'ies'}.`, GREEN);

    if (failed.length) {
        log('');
        log(`Could not remove ${failed.length} path(s) - still open by another process:`, RED);
        for (const label of failed) log(`  • ${label}`, RED);
        log('Stop any running dev server (pnpm dev / wrangler dev) and close editors or antivirus scanning', YELLOW);
        log('these paths, then re-run this command.', YELLOW);
        process.exitCode = 1;
        return;
    }

    log('');
    log('Next steps:', YELLOW);
    for (const step of info.next) log(step);
    log('');
}
