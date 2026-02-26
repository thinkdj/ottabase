#!/usr/bin/env node

/**
 * Ensures user-zone files exist before build/dev.
 * Copies from tracked templates only if the target doesn't already exist.
 *
 * Runs automatically via the "setup" npm script (called by predev / prebuild).
 */

import { cpSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(__dirname, '..');

const copies = [
    // User-zone directory (models, schemas, migrations, queue, routes)
    { from: 'ottabase.template', to: 'ottabase', directory: true },
    // Wrangler config (local dev overrides)
    { from: 'wrangler.example.jsonc', to: 'wrangler.jsonc', directory: false },
];

for (const { from, to, directory } of copies) {
    const src = resolve(appDir, from);
    const dest = resolve(appDir, to);

    if (existsSync(dest)) continue;

    if (!existsSync(src)) {
        console.warn(`[setup] Source "${from}" not found — skipping.`);
        continue;
    }

    cpSync(src, dest, { recursive: directory });
    console.log(`[setup] Copied ${from} → ${to}`);
}
