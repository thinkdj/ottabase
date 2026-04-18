#!/usr/bin/env node

/**
 * Cross-platform script to run both frontend (Vite) and backend (Wrangler) in parallel
 * Works on Windows, macOS, and Linux
 */

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
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

// Determine the current platform
const isWindows = process.platform === 'win32';

// App directory
const appDir = path.join(__dirname, 'apps/otta-web');

function ensureDistDirectory() {
    const distDir = path.join(appDir, 'dist');
    const indexHtmlPath = path.join(distDir, 'index.html');

    try {
        if (!fs.existsSync(distDir)) {
            fs.mkdirSync(distDir, { recursive: true });
            log.info(`Created missing dist directory: ${distDir}`);
        }

        if (!fs.existsSync(indexHtmlPath)) {
            fs.writeFileSync(
                indexHtmlPath,
                '<html>created by dev.js as placeholder for wrangler in development mode</html>\n',
                'utf-8',
            );
            log.info('Created missing dist/index.html placeholder for Wrangler');
        }
    } catch (error) {
        log.error(`Failed to prepare dist directory: ${error.message}`);
        process.exit(1);
    }
}

// Default ports
const PORT_FE = process.env.PORT_FE || 3003;
const PORT_BE = process.env.PORT_BE || 3004;

// Check for --noopen flag
const noOpen = process.argv.includes('--noopen');

const FRONTEND_URL = `http://127.0.0.1:${PORT_FE}`;
const BACKEND_URL = `http://127.0.0.1:${PORT_BE}`;
const BACKEND_HEALTH_URL = `${BACKEND_URL}/api/health`;

function waitForHttpReady(url, label, { timeoutMs = 90000, intervalMs = 250, acceptStatuses = [200] } = {}) {
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
        let settled = false;
        let probeTimer = null;

        const settle = (callback, value) => {
            if (settled) {
                return;
            }

            settled = true;
            if (probeTimer) {
                clearTimeout(probeTimer);
                probeTimer = null;
            }
            callback(value);
        };

        const scheduleNextCheck = () => {
            if (settled) {
                return;
            }

            probeTimer = setTimeout(check, intervalMs);
        };

        const check = () => {
            if (settled) {
                return;
            }

            const request = http.get(url, (response) => {
                response.resume();

                if (acceptStatuses.includes(response.statusCode || 0)) {
                    settle(resolve);
                    return;
                }

                if (Date.now() - startedAt >= timeoutMs) {
                    settle(
                        reject,
                        new Error(
                            `${label} did not become ready within ${timeoutMs}ms (last status: ${response.statusCode})`,
                        ),
                    );
                    return;
                }

                scheduleNextCheck();
            });

            request.on('error', () => {
                if (Date.now() - startedAt >= timeoutMs) {
                    settle(reject, new Error(`${label} did not become ready within ${timeoutMs}ms`));
                    return;
                }

                scheduleNextCheck();
            });

            request.setTimeout(2000, () => {
                request.destroy(new Error(`${label} probe timed out`));
            });
        };

        check();
    });
}

function openBrowser(url) {
    if (noOpen) {
        return;
    }

    if (isWindows) {
        const child = spawn('cmd.exe', ['/c', 'start', '', url], {
            detached: true,
            stdio: 'ignore',
        });
        child.unref();
        return;
    }

    const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
    const child = spawn(command, [url], {
        detached: true,
        stdio: 'ignore',
    });
    child.unref();
}

function spawnPnpm(args) {
    if (isWindows) {
        return spawn('cmd.exe', ['/d', '/s', '/c', `pnpm ${args.join(' ')}`], {
            cwd: appDir,
            stdio: 'pipe',
            env: { ...process.env, PORT_FE, PORT_BE },
        });
    }

    return spawn('pnpm', args, {
        cwd: appDir,
        stdio: 'pipe',
        env: { ...process.env, PORT_FE, PORT_BE },
    });
}

ensureDistDirectory();

log.info('Starting Vite app in development mode...');
log.info(`Platform: ${process.platform}`);
log.info(`App directory: ${appDir}`);
log.info(`Frontend Port: ${PORT_FE}`);
log.info(`Backend Port: ${PORT_BE}`);
if (noOpen) {
    log.info('Browser auto-open disabled (--noopen flag)');
}

// Start frontend (Vite)
log.info('Starting frontend (Vite)...');
const frontendArgs = ['exec', 'vite'];
const frontend = spawnPnpm(frontendArgs);

// Start backend (Wrangler)
log.info('Starting backend (Wrangler)...');
const backend = spawnPnpm(['dev:worker', '--', '--port', PORT_BE]);

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

(async () => {
    try {
        log.info('Waiting for frontend and backend readiness...');
        await Promise.all([
            waitForHttpReady(FRONTEND_URL, 'Frontend', { acceptStatuses: [200] }),
            waitForHttpReady(BACKEND_HEALTH_URL, 'Backend', { acceptStatuses: [200] }),
        ]);
        log.success('Frontend and backend are ready.');
        log.info(`Frontend: ${FRONTEND_URL}`);
        log.info(`Backend: ${BACKEND_URL}`);
        log.info('Press Ctrl+C to stop both processes');
        openBrowser(FRONTEND_URL);
    } catch (error) {
        log.error(error instanceof Error ? error.message : String(error));
        log.info('Processes are still running. Inspect the logs above for the blocking startup issue.');
    }
})();
