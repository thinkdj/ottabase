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

function rmWranglerD1State(basePath, baseLabel) {
    let removed = 0;
    const candidates = [
        path.join(basePath, '.wrangler', 'state', 'v3', 'd1'),
        path.join(basePath, '.wrangler', 'state', 'v2', 'd1'),
        path.join(basePath, '.wrangler', 'state', 'd1'),
    ];

    for (const candidate of candidates) {
        const rel = path.relative(basePath, candidate).replaceAll('\\', '/');
        if (rmIfExists(candidate, `${baseLabel}/${rel}`)) removed++;
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

/**
 * @param {{ scope: 'all' | 'db', force?: boolean }} options
 */
export async function runCleanReset(options = { scope: 'all', force: false }) {
    const scope = options.scope === 'db' ? 'db' : 'all';
    const force = options.force === true;
    const root = process.cwd();

    log('');
    if (scope === 'db') {
        log(`${BOLD}${RED}⚠ clean:db - DESTRUCTIVE OPERATION${NC}`);
        log('');
        log('This will delete local D1 state under .wrangler/state/*/d1 from root/apps/packages workspaces.', YELLOW);
        log(`${RED}Your local D1 database will be destroyed. You will need to re-bootstrap.${NC}`);
    } else {
        log(`${BOLD}${RED}⚠ clean:reset - DESTRUCTIVE OPERATION${NC}`);
        log('');
        log('This will delete the following from your local workspace:', YELLOW);
        log('  • .wrangler/           → Local D1 database, KV, R2 data');
        log('  • node_modules/.cache/ → Vite, Turbo, esbuild caches');
        log('  • .turbo/              → Turborepo cache (root + workspaces)');
        log('  • packages/*/dist/     → Built package output (apps excluded)');
        log('');
        log(`${RED}Your local D1 database will be destroyed. You will need to re-bootstrap.${NC}`);
    }
    log('');

    if (!force) {
        const answer = await prompt(`${BOLD}Type YES to continue: ${NC}`);
        if (answer !== 'YES') {
            log('Aborted.', YELLOW);
            process.exit(0);
        }
    } else {
        log('Force mode enabled: skipping confirmation prompt.', YELLOW);
    }

    log('');
    log(scope === 'db' ? 'Cleaning local D1 state...' : 'Resetting local dev environment...', YELLOW);
    let removed = 0;

    if (scope === 'all') {
        if (rmIfExists(path.join(root, 'node_modules', '.cache'), 'node_modules/.cache')) removed++;
        if (rmIfExists(path.join(root, '.turbo'), '.turbo')) removed++;
    }

    if (scope === 'all') {
        if (rmIfExists(path.join(root, '.wrangler'), '.wrangler')) removed++;
    } else {
        removed += rmWranglerD1State(root, 'root');
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
                if (rmIfExists(path.join(wsPath, '.wrangler'), `${wsLabel}/.wrangler`)) removed++;
            } else {
                removed += rmWranglerD1State(wsPath, wsLabel);
            }

            if (scope === 'all') {
                if (rmIfExists(path.join(wsPath, '.turbo'), `${wsLabel}/.turbo`)) removed++;

                if (dir === 'packages') {
                    if (rmIfExists(path.join(wsPath, 'dist'), `${wsLabel}/dist`)) removed++;
                }

                if (rmIfExists(path.join(wsPath, 'node_modules', '.cache'), `${wsLabel}/node_modules/.cache`)) {
                    removed++;
                }
            }
        }
    }

    log('');
    log(`Done! Removed ${removed} directories.`, GREEN);
    log('');
    log('Next steps:', YELLOW);
    if (scope === 'db') {
        log('  1. pnpm dev           → Start dev server');
        log('  2. Visit /__bootstrap__ to re-initialize the database');
    } else {
        log('  1. pnpm build:pkg     → Rebuild all packages');
        log('  2. pnpm dev           → Start dev server');
        log('  3. Visit /__bootstrap__ to re-initialize the database');
    }
    log('');
}
