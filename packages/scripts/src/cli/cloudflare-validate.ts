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
    } catch (error) {
        return '';
    }
}

async function main() {
    const force = process.argv.includes('--force');
    const appName = getCliArgValue(process.argv.slice(2), 'app') || 'otta-web';
    const appConfig = getCloudflareAppConfig(appName);

    log('', NC);
    log(`${BOLD}cf:validate - Cloudflare Configuration Check${NC}`);
    log(`App: ${appConfig.appName}`, YELLOW);
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
    const wranglerPath = appConfig.wranglerPath;

    if (!fs.existsSync(wranglerPath)) {
        log(`Error: ${wranglerPath} not found.`, RED);
        process.exit(1);
    }

    const wranglerContent = appConfig.wranglerContent;
    const wranglerCmd = appConfig.wranglerCmd;

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
    if (appConfig.resources.d1.production || appConfig.resources.d1.preview) {
        const d1List = runCommand(`${wranglerCmd} d1 list --json`);

        if (appConfig.resources.d1.production) {
            if (d1List.includes(appConfig.resources.d1.production)) {
                log(`✓ D1 Database: ${appConfig.resources.d1.production}`, GREEN);
            } else {
                log(`✗ D1 Database: ${appConfig.resources.d1.production} not found`, RED);
                hasErrors = true;
            }
        }

        if (appConfig.resources.d1.preview) {
            if (d1List.includes(appConfig.resources.d1.preview)) {
                log(`✓ D1 Preview Database: ${appConfig.resources.d1.preview}`, GREEN);
            } else {
                log(`⚠ D1 Preview Database: ${appConfig.resources.d1.preview} not found`, YELLOW);
                hasWarnings = true;
            }
        }
    }

    // Verify KV
    if (appConfig.resources.kv.production || appConfig.resources.kv.preview) {
        const kvList = runCommand(`${wranglerCmd} kv namespace list`);

        if (appConfig.resources.kv.production) {
            if (kvList.includes(appConfig.resources.kv.production)) {
                log(`✓ KV Namespace: ${appConfig.resources.kv.production}`, GREEN);
            } else {
                log(`✗ KV Namespace: ${appConfig.resources.kv.production} not found`, RED);
                hasErrors = true;
            }
        }

        if (appConfig.resources.kv.preview) {
            if (kvList.includes(appConfig.resources.kv.preview)) {
                log(`✓ KV Preview Namespace: ${appConfig.resources.kv.preview}`, GREEN);
            } else {
                log(`⚠ KV Preview Namespace: ${appConfig.resources.kv.preview} not found`, YELLOW);
                hasWarnings = true;
            }
        }
    }

    // Verify R2
    if (appConfig.resources.r2.production || appConfig.resources.r2.preview) {
        const r2List = runCommand(`${wranglerCmd} r2 bucket list --json`);

        if (appConfig.resources.r2.production) {
            if (r2List.includes(appConfig.resources.r2.production)) {
                log(`✓ R2 Bucket: ${appConfig.resources.r2.production}`, GREEN);
            } else {
                log(`✗ R2 Bucket: ${appConfig.resources.r2.production} not found`, RED);
                hasErrors = true;
            }
        }

        if (appConfig.resources.r2.preview) {
            if (r2List.includes(appConfig.resources.r2.preview)) {
                log(`✓ R2 Preview Bucket: ${appConfig.resources.r2.preview}`, GREEN);
            } else {
                log(`⚠ R2 Preview Bucket: ${appConfig.resources.r2.preview} not found (optional)`, YELLOW);
                hasWarnings = true;
            }
        }
    }

    // Verify Queue
    if (appConfig.resources.queue.production || appConfig.resources.queue.preview) {
        const queueList = runCommand(`${wranglerCmd} queues list --json`);

        if (appConfig.resources.queue.production) {
            if (queueList.includes(appConfig.resources.queue.production)) {
                log(`✓ Queue: ${appConfig.resources.queue.production}`, GREEN);
            } else {
                log(`✗ Queue: ${appConfig.resources.queue.production} not found`, RED);
                hasErrors = true;
            }
        }

        if (appConfig.resources.queue.preview) {
            if (queueList.includes(appConfig.resources.queue.preview)) {
                log(`✓ Preview Queue: ${appConfig.resources.queue.preview}`, GREEN);
            } else {
                log(`⚠ Preview Queue: ${appConfig.resources.queue.preview} not found`, YELLOW);
                hasWarnings = true;
            }
        }
    }

    if (
        !appConfig.resources.d1.production &&
        !appConfig.resources.d1.preview &&
        !appConfig.resources.kv.production &&
        !appConfig.resources.kv.preview &&
        !appConfig.resources.r2.production &&
        !appConfig.resources.r2.preview &&
        !appConfig.resources.queue.production &&
        !appConfig.resources.queue.preview
    ) {
        log('No managed D1/KV/R2/Queue resources found in wrangler.jsonc.', YELLOW);
        hasWarnings = true;
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
