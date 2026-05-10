import { execSync } from 'child_process';
import fs from 'fs';
import readline from 'readline';
import { getCliArgValue, getCloudflareAppConfig } from './cloudflare-app-config';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BOLD = '\x1b[1m';
const NC = '\x1b[0m';

function log(msg: string, color: string = NC) {
    console.log(`${color}${msg}${NC}`);
}

function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

function runCommand(command: string): string {
    try {
        return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
        return '';
    }
}

/**
 * Extracts a JSON array from wrangler output. Wrangler 4+ may prefix output
 * with warning text before the JSON; we find the first `[` and let JSON.parse
 * handle everything including brackets inside string values.
 * Returns an empty array on any parse failure so callers can always iterate safely.
 */
function parseWranglerJsonArray<T>(output: string): T[] {
    const start = output.indexOf('[');
    if (start === -1) return [];
    try {
        return JSON.parse(output.slice(start)) as T[];
    } catch {
        return [];
    }
}

async function main() {
    const force = process.argv.includes('--force');
    const appName = getCliArgValue(process.argv.slice(2), 'app') || 'otta-web';
    const appConfig = getCloudflareAppConfig(appName);

    const { resources, wranglerContent, wranglerCmd, wranglerPath } = appConfig;

    // Build list of resource types this app actually uses for the header
    const activeTypes = (['d1', 'kv', 'r2', 'queue'] as const).filter(
        (type) => resources[type].production || resources[type].preview,
    );

    log('', NC);
    log(`${BOLD}cf:validate - Cloudflare Configuration Check${NC}`);
    log(`App: ${appConfig.appName}`, YELLOW);
    log('', NC);
    log('This will verify:', YELLOW);
    log('  • Cloudflare authentication');
    log('  • wrangler.jsonc (no YOUR_* placeholders)');
    if (activeTypes.length) log(`  • ${activeTypes.map((t) => t.toUpperCase()).join(', ')} resources exist`);
    log('', NC);

    if (!force) {
        const answer = await prompt(`${BOLD}Type YES to continue: ${NC}`);
        if (answer !== 'YES') {
            log('Aborted.', YELLOW);
            process.exit(0);
        }
        log('', NC);
    } else {
        log('Force mode enabled: skipping confirmation prompt.', YELLOW);
        log('', NC);
    }

    log('Validating Cloudflare Setup...', GREEN);
    log('', NC);

    let hasErrors = false;
    let hasWarnings = false;

    if (!fs.existsSync(wranglerPath)) {
        log(`Error: ${wranglerPath} not found.`, RED);
        process.exit(1);
    }

    // ── Auth check ──────────────────────────────────────────────────────────
    log('Checking Cloudflare authentication...', YELLOW);
    const whoamiResult = runCommand(`${wranglerCmd} whoami`);
    if (!whoamiResult || whoamiResult.includes('not authenticated')) {
        log('✗ Not logged in to Cloudflare. Run: pnpm cf:login', RED);
        hasErrors = true;
    } else {
        log(`✓ Authenticated as: ${whoamiResult.split('\n')[0]}`, GREEN);
    }

    // ── Placeholder check ────────────────────────────────────────────────────
    // Generic: warn if wrangler.jsonc still contains any YOUR_* placeholder value
    log('', NC);
    log('Checking wrangler.jsonc configuration...', YELLOW);
    if (/\bYOUR_[A-Z0-9_]+\b/.test(wranglerContent)) {
        log('⚠ wrangler.jsonc contains YOUR_* placeholders (expected for local dev; CI substitutes real IDs)', YELLOW);
        hasWarnings = true;
    } else {
        log('✓ wrangler.jsonc is configured', GREEN);
    }

    // ── Resource checks ──────────────────────────────────────────────────────
    if (activeTypes.length === 0) {
        log('', NC);
        log('No managed D1/KV/R2/Queue resources declared in wrangler.jsonc.', YELLOW);
        hasWarnings = true;
    } else {
        log('', NC);
        log('Checking Cloudflare resources...', YELLOW);
    }

    // D1
    if (resources.d1.production || resources.d1.preview) {
        const d1Records = parseWranglerJsonArray<{ name: string; uuid: string }>(
            runCommand(`${wranglerCmd} d1 list --json`),
        );
        const d1Names = new Set(d1Records.map((r) => r.name));

        if (resources.d1.production) {
            if (d1Names.has(resources.d1.production)) {
                log(`✓ D1 Database: ${resources.d1.production}`, GREEN);
            } else {
                log(`✗ D1 Database: ${resources.d1.production} not found — run: pnpm cf:setup`, RED);
                hasErrors = true;
            }
        }
        if (resources.d1.preview) {
            if (d1Names.has(resources.d1.preview)) {
                log(`✓ D1 Preview Database: ${resources.d1.preview}`, GREEN);
            } else {
                log(`⚠ D1 Preview Database: ${resources.d1.preview} not found (optional)`, YELLOW);
                hasWarnings = true;
            }
        }
    }

    // KV — wrangler returns JSON even without --json flag
    if (resources.kv.production || resources.kv.preview) {
        const kvRecords = parseWranglerJsonArray<{ id: string; title: string }>(
            runCommand(`${wranglerCmd} kv namespace list`),
        );
        const kvTitles = new Set(kvRecords.map((r) => r.title));

        const kvBindingNote = resources.kv.binding ? ` (binding ${resources.kv.binding})` : '';

        if (resources.kv.production) {
            if (kvTitles.has(resources.kv.production)) {
                log(`✓ KV Namespace: ${resources.kv.production}${kvBindingNote}`, GREEN);
            } else {
                log(`✗ KV Namespace: ${resources.kv.production}${kvBindingNote} not found — run: pnpm cf:setup`, RED);
                hasErrors = true;
            }
        }
        if (resources.kv.preview) {
            if (kvTitles.has(resources.kv.preview)) {
                log(`✓ KV Preview Namespace: ${resources.kv.preview}`, GREEN);
            } else {
                log(`⚠ KV Preview Namespace: ${resources.kv.preview} not found (optional)`, YELLOW);
                hasWarnings = true;
            }
        }
    }

    // R2
    if (resources.r2.production || resources.r2.preview) {
        const r2Records = parseWranglerJsonArray<{ name: string }>(runCommand(`${wranglerCmd} r2 bucket list --json`));
        const r2Names = new Set(r2Records.map((r) => r.name));

        if (resources.r2.production) {
            if (r2Names.has(resources.r2.production)) {
                log(`✓ R2 Bucket: ${resources.r2.production}`, GREEN);
            } else {
                log(`✗ R2 Bucket: ${resources.r2.production} not found — run: pnpm cf:setup`, RED);
                hasErrors = true;
            }
        }
        if (resources.r2.preview) {
            if (r2Names.has(resources.r2.preview)) {
                log(`✓ R2 Preview Bucket: ${resources.r2.preview}`, GREEN);
            } else {
                log(`⚠ R2 Preview Bucket: ${resources.r2.preview} not found (optional)`, YELLOW);
                hasWarnings = true;
            }
        }
    }

    // Queue
    if (resources.queue.production || resources.queue.preview) {
        const queueRecords = parseWranglerJsonArray<{ queue_name: string }>(
            runCommand(`${wranglerCmd} queues list --json`),
        );
        const queueNames = new Set(queueRecords.map((r) => r.queue_name));

        if (resources.queue.production) {
            if (queueNames.has(resources.queue.production)) {
                log(`✓ Queue: ${resources.queue.production}`, GREEN);
            } else {
                log(`✗ Queue: ${resources.queue.production} not found — run: pnpm cf:setup`, RED);
                hasErrors = true;
            }
        }
        if (resources.queue.preview) {
            if (queueNames.has(resources.queue.preview)) {
                log(`✓ Preview Queue: ${resources.queue.preview}`, GREEN);
            } else {
                log(`⚠ Preview Queue: ${resources.queue.preview} not found (optional)`, YELLOW);
                hasWarnings = true;
            }
        }
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    log('', NC);
    if (hasErrors) {
        log('Validation FAILED — some resources are missing.', RED);
        process.exit(1);
    } else if (hasWarnings) {
        log('Validation PASSED with warnings', YELLOW);
    } else {
        log('Validation PASSED — all resources configured!', GREEN);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
