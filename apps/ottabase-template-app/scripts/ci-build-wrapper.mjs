#!/usr/bin/env node

/**
 * CI Build Wrapper
 * Automatically detects CI environment and runs appropriate build
 */

import { spawn } from 'child_process';

const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const buildScript = isCI ? 'build:ci' : 'build:prod';

console.log(`[Build] Environment: ${isCI ? 'CI' : 'Local'}`);
console.log(`[Build] Running: pnpm ${buildScript}`);

const child = spawn('pnpm', [buildScript], {
  stdio: 'inherit',
  shell: true,
});

child.on('error', (error) => {
  console.error(`[Build] Error spawning process:`, error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
