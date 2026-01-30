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

function runCommand(command: string, ignoreError = false): string {
    try {
        return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch (error) {
        if (ignoreError) return '';
        throw error;
    }
}

function main() {
    log('Starting Cloudflare Setup for Ottabase Template App...', GREEN);

    // Check wrangler
    const wranglerCmd = 'pnpm --filter ottabase-template-app exec wrangler';
    try {
        runCommand(`${wranglerCmd} --version`);
    } catch (e) {
        log('Error: wrangler is not installed in the app. Please run "pnpm install" first.', RED);
        process.exit(1);
    }

    // Check login
    log('Checking Cloudflare authentication...', YELLOW);
    const whoamiResult = runCommand(`${wranglerCmd} whoami`, true);
    if (!whoamiResult || whoamiResult.includes('not authenticated')) {
        log('', NC);
        log('═══════════════════════════════════════════════════════════════', RED);
        log('  ERROR: Not logged in to Cloudflare', RED);
        log('═══════════════════════════════════════════════════════════════', RED);
        log('', NC);
        log('Please run the following command to login:', YELLOW);
        log('', NC);
        log('  npx wrangler login', GREEN);
        log('', NC);
        log('This will open a browser window to authenticate with Cloudflare.', NC);
        log('After logging in, run this setup script again.', NC);
        log('', NC);
        process.exit(1);
    }
    log(`Authenticated as: ${whoamiResult.split('\n')[0]}`, GREEN);

    const wranglerFile = path.join(process.cwd(), 'apps', 'ottabase-template-app', 'wrangler.jsonc');
    if (!fs.existsSync(wranglerFile)) {
        log(`Error: ${wranglerFile} not found!`, RED);
        process.exit(1);
    }

    log('Creating Resources...', GREEN);

    // 1. D1 Database
    log("Setting up D1 Database 'ottabase-db'...", YELLOW);
    let d1Id = '';
    try {
        const d1Info = runCommand(`${wranglerCmd} d1 info ottabase-db --json`, true);
        if (d1Info) {
            d1Id = JSON.parse(d1Info).uuid;
            log(`Database already exists. ID: ${d1Id}`, GREEN);
        } else {
            const createOutput = runCommand(`${wranglerCmd} d1 create ottabase-db --json`);
            d1Id = JSON.parse(createOutput).uuid;
            log(`Created D1 Database. ID: ${d1Id}`, GREEN);
        }
    } catch (e) {
        log('Error setting up D1 Database', RED);
    }

    // 2. KV Namespace
    log("Setting up KV Namespace 'OBCF_KV'...", YELLOW);
    let kvId = '';
    try {
        const kvList = JSON.parse(runCommand(`${wranglerCmd} kv:namespace list --json`));
        const existingKv = kvList.find((ns: any) => ns.title === 'OBCF_KV');
        if (existingKv) {
            kvId = existingKv.id;
            log(`KV Namespace already exists. ID: ${kvId}`, GREEN);
        } else {
            const createOutput = JSON.parse(runCommand(`${wranglerCmd} kv:namespace create OBCF_KV --json`));
            kvId = createOutput.id;
            log(`Created KV Namespace. ID: ${kvId}`, GREEN);
        }
    } catch (e) {
        log('Error setting up KV Namespace', RED);
    }

    // 3. R2 Buckets (production and preview)
    log("Setting up R2 Bucket 'ottabase-bucket'...", YELLOW);
    try {
        runCommand(`${wranglerCmd} r2 bucket create ottabase-bucket`, true);
        log('R2 Bucket setup complete.', GREEN);
    } catch (e) {
        log('R2 Bucket setup checked.', GREEN);
    }

    log("Setting up R2 Preview Bucket 'ottabase-bucket-preview'...", YELLOW);
    try {
        runCommand(`${wranglerCmd} r2 bucket create ottabase-bucket-preview`, true);
        log('R2 Preview Bucket setup complete.', GREEN);
    } catch (e) {
        log('R2 Preview Bucket setup checked.', GREEN);
    }

    // 4. Queue
    log("Setting up Queue 'ottabase-queue'...", YELLOW);
    try {
        runCommand(`${wranglerCmd} queues create ottabase-queue`, true);
        log('Queue setup complete.', GREEN);
    } catch (e) {
        log('Queue setup checked.', GREEN);
    }

    // Update wrangler.jsonc
    log(`Updating ${wranglerFile}...`, YELLOW);
    let content = fs.readFileSync(wranglerFile, 'utf8');

    if (d1Id) {
        content = content.replace(/"database_id":\s*"YOUR_D1_DATABASE_ID"/, `"database_id": "${d1Id}"`);
    }
    if (kvId) {
        content = content.replace(/"id":\s*"YOUR_KV_NAMESPACE_ID"/, `"id": "${kvId}"`);

        // Preview KV
        log("Setting up KV Preview Namespace 'OBCF_KV_PREVIEW'...", YELLOW);
        let kvPreviewId = '';
        try {
            const kvList = JSON.parse(runCommand(`${wranglerCmd} kv:namespace list --json`));
            const existingKvPreview = kvList.find((ns: any) => ns.title === 'OBCF_KV_preview');
            if (existingKvPreview) {
                kvPreviewId = existingKvPreview.id;
            } else {
                const createOutput = JSON.parse(
                    runCommand(`${wranglerCmd} kv:namespace create OBCF_KV --preview --json`),
                );
                kvPreviewId = createOutput.id;
            }
            if (kvPreviewId) {
                content = content.replace(/"preview_id":\s*"YOUR_KV_PREVIEW_ID"/, `"preview_id": "${kvPreviewId}"`);
            }
        } catch (e) {
            log('Error setting up KV Preview', RED);
        }
    }

    fs.writeFileSync(wranglerFile, content);
    log('Setup Complete!', GREEN);
    log(`Please review ${wranglerFile} to ensure all IDs are correct.`, NC);
}

main();
