#!/usr/bin/env node
/**
 * Cross-platform script to clear Turborepo cache directories.
 * Deletes node_modules/.cache/turbo, .turbo at root, and .turbo in each workspace.
 */
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

function rmIfExists(fullPath: string, label: string): void {
    if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true });
        log(`  Removed ${label}`, GREEN);
    }
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

async function main() {
    const root = process.cwd();

    log('');
    log(`${BOLD}${YELLOW}⚠ clean:cache confirmation${NC}`);
    log('This will remove Turborepo caches (.turbo and node_modules/.cache/turbo).', YELLOW);
    log('');

    const answer = await prompt(`${BOLD}Type YES to continue: ${NC}`);
    if (answer !== 'YES') {
        log('Aborted.', RED);
        process.exit(0);
    }

    log('');
    log('Clearing Turborepo cache...', YELLOW);

    // Root cache dirs
    rmIfExists(path.join(root, 'node_modules', '.cache', 'turbo'), 'node_modules/.cache/turbo');
    rmIfExists(path.join(root, '.turbo'), 'root .turbo');

    // Workspace .turbo dirs (apps/* and packages/*)
    for (const dir of ['apps', 'packages']) {
        const dirPath = path.join(root, dir);
        if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) continue;

        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const ent of entries) {
            if (ent.isDirectory()) {
                const turboPath = path.join(dirPath, ent.name, '.turbo');
                if (fs.existsSync(turboPath)) {
                    fs.rmSync(turboPath, { recursive: true });
                    log(`  Removed ${dir}/${ent.name}/.turbo`, GREEN);
                }
            }
        }
    }

    log('Cache clean complete.', GREEN);
}

main().catch((err) => {
    console.error('clean-cache failed:', err);
    process.exit(1);
});
