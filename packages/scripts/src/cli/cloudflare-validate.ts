import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const NC = '\x1b[0m';

function log(msg: string, color: string = NC) {
    console.log(`${color}${msg}${NC}`);
}

function runCommand(command: string): string {
    try {
        return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch (error) {
        return '';
    }
}

async function main() {
    log('Validating Cloudflare Setup...', GREEN);
    log('', NC);

    let hasErrors = false;
    let hasWarnings = false;

    const wranglerPath = path.join(process.cwd(), 'apps', 'ottabase-template-app', 'wrangler.jsonc');

    if (!fs.existsSync(wranglerPath)) {
        log(`Error: ${wranglerPath} not found.`, RED);
        process.exit(1);
    }

    const wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
    const wranglerCmd = 'pnpm --filter ottabase-template-app exec wrangler';

    // Check wrangler login
    log('Checking Cloudflare authentication...', YELLOW);
    const whoamiResult = runCommand(`${wranglerCmd} whoami`);
    if (!whoamiResult || whoamiResult.includes('not authenticated')) {
        log('✗ Not logged in to Cloudflare. Run: npx wrangler login', RED);
        hasErrors = true;
    } else {
        log(`✓ Authenticated as: ${whoamiResult.split('\n')[0]}`, GREEN);
    }

    // Check for placeholders
    log('', NC);
    log('Checking wrangler.jsonc configuration...', YELLOW);
    const hasPlaceholderD1 = wranglerContent.includes('YOUR_D1_DATABASE_ID');
    const hasPlaceholderKV = wranglerContent.includes('YOUR_KV_NAMESPACE_ID');
    const hasPlaceholderKVPreview = wranglerContent.includes('YOUR_KV_PREVIEW_ID');
    const hasPlaceholderAccountId = wranglerContent.includes('YOUR_CLOUDFLARE_ACCOUNT_ID');

    if (hasPlaceholderD1 || hasPlaceholderKV || hasPlaceholderKVPreview || hasPlaceholderAccountId) {
        log('⚠ wrangler.jsonc contains placeholders. Run: pnpm cloudflare:setup', YELLOW);
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
    const kvList = runCommand(`${wranglerCmd} kv:namespace list --json`);
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
    log('═══════════════════════════════════════════════════════════════', NC);
    if (hasErrors) {
        log('  Validation FAILED - Some resources are missing', RED);
        log('  Run: pnpm cloudflare:setup', YELLOW);
        log('═══════════════════════════════════════════════════════════════', NC);
        process.exit(1);
    } else if (hasWarnings) {
        log('  Validation PASSED with warnings', YELLOW);
        log('═══════════════════════════════════════════════════════════════', NC);
        process.exit(0);
    } else {
        log('  Validation PASSED - All resources configured!', GREEN);
        log('═══════════════════════════════════════════════════════════════', NC);
        process.exit(0);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
