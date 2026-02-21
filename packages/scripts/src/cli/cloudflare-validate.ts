import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

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
    } catch (error) {
        return '';
    }
}

async function main() {
    const force = process.argv.includes('--force');

    log('', NC);
    log(`${BOLD}cf:validate - Cloudflare Configuration Check${NC}`);
    log('', NC);
    log('This will verify:', YELLOW);
    log('  • Cloudflare authentication');
    log('  • wrangler.jsonc (no placeholders)');
    log('  • D1, KV, R2, Queue resources exist');
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

    const wranglerPath = path.join(process.cwd(), 'apps', 'ottabase-template-app-tanstack', 'wrangler.jsonc');

    if (!fs.existsSync(wranglerPath)) {
        log(`Error: ${wranglerPath} not found.`, RED);
        process.exit(1);
    }

    const wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
    const wranglerCmd = 'pnpm --filter @ottabase/ottabase-template-app-tanstack exec wrangler';

    // Check wrangler login
    log('Checking Cloudflare authentication...', YELLOW);
    const whoamiResult = runCommand(`${wranglerCmd} whoami`);
    if (!whoamiResult || whoamiResult.includes('not authenticated')) {
        log('✗ Not logged in to Cloudflare. Run: pnpm cf:login', RED);
        hasErrors = true;
    } else {
        log(`✓ Authenticated as: ${whoamiResult.split('\n')[0]}`, GREEN);
    }

    // Check for top-level placeholders (these are expected in the template but indicate local dev isn't configured)
    log('', NC);
    log('Checking wrangler.jsonc configuration...', YELLOW);
    const hasPlaceholderD1 = wranglerContent.includes('YOUR_D1_DATABASE_ID');
    const hasPlaceholderKV = wranglerContent.includes('YOUR_KV_NAMESPACE_ID');
    const hasPlaceholderKVPreview = wranglerContent.includes('YOUR_KV_PREVIEW_ID');

    if (hasPlaceholderD1 || hasPlaceholderKV || hasPlaceholderKVPreview) {
        log(
            '⚠ wrangler.jsonc top-level contains YOUR_* placeholders (expected for template; local dev uses simulators)',
            YELLOW,
        );
        hasWarnings = true;
    } else {
        log('✓ wrangler.jsonc is configured', GREEN);
    }

    // Verify D1
    log('', NC);
    log('Checking Cloudflare resources...', YELLOW);
    const d1List = runCommand(`${wranglerCmd} d1 list --json`);
    if (d1List.includes('ottabase-db')) {
        log('✓ D1 Database: ottabase-db', GREEN);
    } else {
        log('✗ D1 Database: ottabase-db not found', RED);
        hasErrors = true;
    }

    // Verify KV
    const kvList = runCommand(`${wranglerCmd} kv namespace list`);
    if (kvList.includes('OBCF_KV')) {
        log('✓ KV Namespace: OBCF_KV', GREEN);
    } else {
        log('✗ KV Namespace: OBCF_KV not found', RED);
        hasErrors = true;
    }

    // Verify R2
    const r2List = runCommand(`${wranglerCmd} r2 bucket list --json`);
    if (r2List.includes('ottabase-bucket')) {
        log('✓ R2 Bucket: ottabase-bucket', GREEN);
    } else {
        log('✗ R2 Bucket: ottabase-bucket not found', RED);
        hasErrors = true;
    }

    // Verify R2 Preview
    if (r2List.includes('ottabase-bucket-preview')) {
        log('✓ R2 Preview Bucket: ottabase-bucket-preview', GREEN);
    } else {
        log('⚠ R2 Preview Bucket: ottabase-bucket-preview not found (optional)', YELLOW);
        hasWarnings = true;
    }

    // Verify Queue
    const queueList = runCommand(`${wranglerCmd} queues list --json`);
    if (queueList.includes('ottabase-queue')) {
        log('✓ Queue: ottabase-queue', GREEN);
    } else {
        log('✗ Queue: ottabase-queue not found', RED);
        hasErrors = true;
    }

    // Summary
    log('', NC);
    if (hasErrors) {
        log('Validation FAILED - Some resources are missing. Run: pnpm cf:setup', RED);
        process.exit(1);
    } else if (hasWarnings) {
        log('Validation PASSED with warnings', YELLOW);
        process.exit(0);
    } else {
        log('Validation PASSED - All resources configured!', GREEN);
        process.exit(0);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
