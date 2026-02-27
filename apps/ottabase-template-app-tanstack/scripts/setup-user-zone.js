#!/usr/bin/env node

/**
 * Ensures user-zone files exist before build/dev.
 * Copies from tracked templates only if the target doesn't already exist.
 *
 * Runs automatically via the "setup" npm script (called by predev / prebuild).
 */

import { cpSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(__dirname, '..');

const copies = [
    // Single user config file (app identity, package toggles, feature flags)
    { from: 'ottabase.config.example.ts', to: 'ottabase.config.ts', directory: false },
    // User-zone directory (models, schemas, migrations, queue, routes)
    { from: 'ottabase.template', to: 'ottabase', directory: true },
    // Wrangler config (local dev overrides)
    { from: 'wrangler.example.jsonc', to: 'wrangler.jsonc', directory: false },
];

/**
 * For directories: check that key files from the template are present in dest.
 * If the directory exists but is missing essential files, merge them in.
 */
function ensureDirectoryComplete(src, dest) {
    if (!existsSync(src) || !existsSync(dest)) return;

    const srcEntries = readdirSync(src, { withFileTypes: true });
    let copied = 0;
    for (const entry of srcEntries) {
        const destPath = resolve(dest, entry.name);
        if (!existsSync(destPath)) {
            const srcPath = resolve(src, entry.name);
            cpSync(srcPath, destPath, { recursive: entry.isDirectory() });
            copied++;
        }
    }
    if (copied > 0) {
        console.log(`[setup] Merged ${copied} missing entries from ${src} into existing ${dest}/`);
    }
}

for (const { from, to, directory } of copies) {
    const src = resolve(appDir, from);
    const dest = resolve(appDir, to);

    if (existsSync(dest)) {
        // For directories, verify they have all expected top-level entries
        if (directory) {
            ensureDirectoryComplete(src, dest);
        }
        continue;
    }

    if (!existsSync(src)) {
        console.warn(`[setup] Source "${from}" not found — skipping.`);
        continue;
    }

    cpSync(src, dest, { recursive: directory });
    console.log(`[setup] Copied ${from} → ${to}`);
}
