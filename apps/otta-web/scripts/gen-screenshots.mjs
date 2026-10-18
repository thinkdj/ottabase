#!/usr/bin/env node
/**
 * Captures the shot list below into `tmp/screenshots/` (gitignored). Rerunnable: every run
 * overwrites the same files.
 *
 *   pnpm --filter @ottabase/otta-web gen:screenshots          # every shot
 *   pnpm --filter @ottabase/otta-web gen:screenshots blog     # only shots whose name contains "blog"
 *
 * Needs the app running (`otta start` / `pnpm dev`, port 3003; override with BASE_URL).
 * FORMAT=png|jpg|webp and QUALITY=1-100 override the defaults. Browser: CHROME_PATH, else
 * Playwright's cached Chromium, else a system Chrome. Runs @ottabase/screenshot/node from
 * source through Node's built-in type stripping (Node 24+).
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runShots } from '@ottabase/screenshot/node';

const SHOTS = [
    { name: 'home', path: '/' },
    { name: 'home-dark', path: '/', theme: 'dark' },
    { name: 'blog', path: '/blog' },
    { name: 'demos', path: '/demo', waitFor: 'Screenshots' },
    { name: 'login', path: '/login' },
];

const filter = process.argv[2];
const shots = filter ? SHOTS.filter((shot) => shot.name.includes(filter)) : SHOTS;
if (shots.length === 0) {
    console.error(`No shot matches "${filter}"`);
    process.exit(1);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'tmp', 'screenshots');
const results = await runShots({
    origin: (process.env.BASE_URL ?? 'http://127.0.0.1:3003').replace(/\/$/, ''),
    outDir,
    shots,
    chromePath: process.env.CHROME_PATH,
    defaults: {
        format: process.env.FORMAT ?? 'webp',
        quality: process.env.QUALITY ? Number(process.env.QUALITY) : undefined,
        scale: 1.5,
    },
});

for (const r of results) {
    if (r.error) console.error(`✗ ${r.name}: ${r.error}`);
    else console.log(`✓ ${r.name} ${Math.round(r.originalBytes / 1024)} KB → ${Math.round(r.bytes / 1024)} KB`);
}
const failed = results.filter((r) => r.error).length;
console.log(`\n${results.length - failed} of ${results.length} screenshots written to ${outDir}`);
if (failed) process.exitCode = 1;
