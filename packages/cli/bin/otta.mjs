#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const binDir = dirname(fileURLToPath(import.meta.url));
const distEntry = resolve(binDir, '../dist/cli.js');

if (!existsSync(distEntry)) {
	console.error('Ottabase CLI has not been built yet. Run "pnpm --filter @ottabase/cli build" and try again.');
	process.exit(1);
}

const { run } = await import(pathToFileURL(distEntry).href);

run();
