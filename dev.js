#!/usr/bin/env node

/**
 * Cross-platform script to run both frontend (Vite) and backend (Wrangler) in parallel
 * Works on Windows, macOS, and Linux
 */

const { spawn } = require('child_process');
const path = require('path');

// ANSI color codes for better terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    red: '\x1b[31m',
};

const log = {
    info: (msg) => console.log(`${colors.cyan}[INFO]${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
    frontend: (msg) => console.log(`${colors.yellow}[FE]${colors.reset} ${msg}`),
    backend: (msg) => console.log(`${colors.cyan}[BE]${colors.reset} ${msg}`),
};

// Determine the correct shell based on OS
const isWindows = process.platform === 'win32';
const shell = isWindows ? 'powershell.exe' : '/bin/sh';
const shellArgs = isWindows ? ['-Command'] : ['-c'];

// App directory
const appDir = path.join(__dirname, 'apps/ottabase-template-app-tanstack');

// Default ports
const PORT_FE = process.env.PORT_FE || 3003;
const PORT_BE = process.env.PORT_BE || 3004;

// Check for --noopen flag
const noOpen = process.argv.includes('--noopen');

log.info('Starting TanStack app in development mode...');
log.info(`Platform: ${process.platform}`);
log.info(`App directory: ${appDir}`);
log.info(`Frontend Port: ${PORT_FE}`);
log.info(`Backend Port: ${PORT_BE}`);
if (noOpen) {
    log.info('Browser auto-open disabled (--noopen flag)');
}

// Start frontend (Vite)
log.info('Starting frontend (Vite)...');
const frontendArgs = noOpen ? ['exec', 'vite'] : ['dev'];
const frontend = spawn(isWindows ? 'pnpm.cmd' : 'pnpm', frontendArgs, {
    cwd: appDir,
    stdio: 'pipe',
    shell: true,
    env: { ...process.env, PORT_FE, PORT_BE },
});

// Start backend (Wrangler)
log.info('Starting backend (Wrangler)...');
const backend = spawn(isWindows ? 'pnpm.cmd' : 'pnpm', ['dev:worker', '--', '--port', PORT_BE], {
    cwd: appDir,
    stdio: 'pipe',
    shell: true,
    env: { ...process.env, PORT_FE, PORT_BE },
});

// Handle frontend output
frontend.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => log.frontend(line));
});

frontend.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => log.frontend(line));
});

// Handle backend output
backend.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => log.backend(line));
});

backend.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => log.backend(line));
});

// Handle process exits
frontend.on('close', (code) => {
    if (code !== 0 && code !== null) {
        log.error(`Frontend exited with code ${code}`);
    }
    process.exit(code || 0);
});

backend.on('close', (code) => {
    if (code !== 0 && code !== null) {
        log.error(`Backend exited with code ${code}`);
    }
    process.exit(code || 0);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    log.info('Shutting down...');
    frontend.kill('SIGINT');
    backend.kill('SIGINT');
    process.exit(0);
});

process.on('SIGTERM', () => {
    log.info('Shutting down...');
    frontend.kill('SIGTERM');
    backend.kill('SIGTERM');
    process.exit(0);
});

log.success('Both processes started successfully!');
log.info(`Frontend: http://127.0.0.1:${PORT_FE}`);
log.info(`Backend: http://127.0.0.1:${PORT_BE}`);
log.info('Press Ctrl+C to stop both processes');
