#!/usr/bin/env node

/**
 * Cross-platform script to run both frontend (Vite) and backend (Wrangler) in parallel for ResumeMe app
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

// App directory (current directory for resumeme)
const appDir = __dirname;

// Default ports for ResumeMe
const PORT_FE = process.env.PORT_FE || 3005;
const PORT_BE = process.env.PORT_BE || 3006;

// Check for --noopen flag
const noOpen = process.argv.includes('--noopen');

log.info('Starting ResumeMe app in development mode...');
log.info(`Platform: ${process.platform}`);
log.info(`App directory: ${appDir}`);
log.info(`Frontend Port: ${PORT_FE}`);
log.info(`Backend Port: ${PORT_BE}`);
if (noOpen) {
    log.info('Browser auto-open disabled (--noopen flag)');
}

// Start frontend (Vite) — call vite directly to avoid recursive pnpm dev
log.info('Starting frontend (Vite)...');
const frontendArgs = noOpen
    ? ['exec', 'vite', '--', '--host', '127.0.0.1', '--port', String(PORT_FE)]
    : ['exec', 'vite', '--', '--host', '127.0.0.1', '--port', String(PORT_FE), '--open'];
const frontend = spawn(isWindows ? 'pnpm.cmd' : 'pnpm', frontendArgs, {
    cwd: appDir,
    stdio: 'pipe',
    shell: true,
    env: { ...process.env, PORT: PORT_FE, PORT_FE: String(PORT_FE), PORT_BE: String(PORT_BE) },
});

// Start backend (Wrangler)
log.info('Starting backend (Wrangler)...');
const backend = spawn(isWindows ? 'pnpm.cmd' : 'pnpm', ['dev:worker', '--', '--port', String(PORT_BE)], {
    cwd: appDir,
    stdio: 'pipe',
    shell: true,
    env: {
        ...process.env,
        PORT: PORT_BE,
        PORT_FE: String(PORT_FE),
        PORT_BE: String(PORT_BE),
        // Force polling-based file watching for wrangler on Windows (chokidar)
        CHOKIDAR_USEPOLLING: '1',
    },
});

// Handle frontend output
frontend.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => {
        if (line) log.frontend(line);
    });
});

frontend.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => {
        if (line) log.frontend(line);
    });
});

// Handle backend output
backend.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => {
        if (line) log.backend(line);
    });
});

backend.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => {
        if (line) log.backend(line);
    });
});

// Handle process exits
frontend.on('close', (code) => {
    if (code !== 0 && code !== null) {
        log.error(`Frontend exited with code ${code}`);
    }
    cleanup();
});

backend.on('close', (code) => {
    if (code !== 0 && code !== null) {
        log.error(`Backend exited with code ${code}`);
    }
    cleanup();
});

// Cleanup function
function cleanup() {
    try {
        if (frontend && !frontend.killed) {
            frontend.kill();
        }
        if (backend && !backend.killed) {
            backend.kill();
        }
    } catch (err) {
        // Ignore errors during cleanup
    }
    process.exit(0);
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    log.info('Shutting down...');
    cleanup();
});

process.on('SIGTERM', () => {
    log.info('Shutting down...');
    cleanup();
});

// Handle Windows-specific close events
if (isWindows) {
    process.on('SIGHUP', cleanup);
    process.on('SIGBREAK', cleanup);
}

log.success('Both processes started successfully!');
log.info(`Frontend: http://127.0.0.1:${PORT_FE}`);
log.info(`Backend: http://127.0.0.1:${PORT_BE}`);
log.info('Press Ctrl+C to stop both processes');
