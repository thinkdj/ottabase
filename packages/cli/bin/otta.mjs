#!/usr/bin/env node

import { existsSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// CI hands `otta deploy` its placeholder values as one JSON object (GitHub's whole secrets bag). Take
// it out of the environment first, before the CLI's dependencies load and before any child process
// (the build below, pnpm, turbo, vite, wrangler) starts: only `otta deploy` itself ever reads it.
const deployValues = process.env.OTTA_DEPLOY_VALUES;
delete process.env.OTTA_DEPLOY_VALUES;

const binDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(binDir, '..');
const sourceDir = resolve(packageDir, 'src');
const buildInputs = [resolve(packageDir, 'package.json'), resolve(packageDir, 'tsconfig.json')];
const distEntry = resolve(binDir, '../dist/cli.js');

function newestSourceMtime(directory) {
    let newest = 0;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name === '__tests__') continue;
        const entryPath = resolve(directory, entry.name);
        newest = Math.max(newest, entry.isDirectory() ? newestSourceMtime(entryPath) : statSync(entryPath).mtimeMs);
    }
    return newest;
}

function needsWorkspaceBuild() {
    if (!existsSync(sourceDir)) return false;
    if (!existsSync(distEntry)) return true;
    const newestInput = Math.max(
        newestSourceMtime(sourceDir),
        ...buildInputs.filter(existsSync).map((input) => statSync(input).mtimeMs),
    );
    return newestInput > statSync(distEntry).mtimeMs;
}

if (needsWorkspaceBuild()) {
    console.log('Building @ottabase/cli because its workspace sources changed...');
    const result =
        process.platform === 'win32'
            ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'pnpm run build'], {
                  cwd: packageDir,
                  stdio: 'inherit',
              })
            : spawnSync('pnpm', ['run', 'build'], { cwd: packageDir, stdio: 'inherit' });

    if (result.error || result.status !== 0) {
        console.error(`Could not build @ottabase/cli${result.error ? `: ${result.error.message}` : '.'}`);
        process.exit(result.status || 1);
    }
}

if (!existsSync(distEntry)) {
    console.error('Ottabase CLI has not been built and no workspace sources are available.');
    process.exit(1);
}

const { run } = await import(pathToFileURL(distEntry).href);

run(process.argv, { deployValues });
