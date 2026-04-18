import { spawn } from 'child_process';
import { getAppInfo, getMonorepoRoot, getPnpmBin, log } from '../utils/index.js';

// Resolve once at module load — avoids a process.platform call per spawn.
const PNPM = getPnpmBin();

/**
 * Sanitizes app name for safe use as an execFileSync arg.
 * Dots are intentionally excluded here: app/package names in this monorepo
 * never contain dots, so a dot is a signal of an unexpected/malformed input.
 */
function sanitizeAppName(name: string): string {
    // Only allow alphanumeric, hyphens, underscores, and @/ for scoped packages
    if (!/^[@a-zA-Z0-9/_-]+$/.test(name)) {
        throw new Error(`Invalid app name: ${name}`);
    }
    return name;
}

/**
 * Starts the dev server for an app
 */
export async function devApp(appName: string, options: { port?: number } = {}): Promise<void> {
    const root = getMonorepoRoot();
    const app = getAppInfo(appName);

    if (!app) {
        throw new Error(`App "${appName}" not found. Run "otta list" to see available apps.`);
    }

    // Check if app has a dev script
    if (!app.scripts.dev) {
        throw new Error(`App "${appName}" does not have a dev script defined.`);
    }

    log.info(`Starting dev server for ${app.name}...`);
    log.dim(`  Package: ${app.packageName}`);
    log.dim(`  Path: ${app.path}`);

    // Sanitize and build command args
    const safePackageName = sanitizeAppName(app.packageName);
    const args = ['--filter', safePackageName, 'dev'];
    if (options.port !== undefined) {
        const safePort = Math.floor(options.port);
        if (!Number.isFinite(safePort) || safePort <= 0 || safePort >= 65536) {
            throw new Error(`Invalid port: ${options.port}. Must be an integer between 1 and 65535.`);
        }
        args.push('--', '--port', safePort.toString());
    }

    // Use spawn for streaming output
    return new Promise((resolve, reject) => {
        const proc = spawn(PNPM, args, {
            cwd: root,
            stdio: 'inherit',
        });

        // Signal handlers
        const sigintHandler = () => {
            proc.kill('SIGINT');
        };

        const sigtermHandler = () => {
            proc.kill('SIGTERM');
        };

        // Cleanup function for signal handlers
        const cleanup = () => {
            process.off('SIGINT', sigintHandler);
            process.off('SIGTERM', sigtermHandler);
        };

        proc.on('error', (error) => {
            cleanup();
            reject(error);
        });

        proc.on('close', (code) => {
            cleanup();
            // code is null when the process was killed by a signal (e.g. Ctrl+C SIGINT).
            // Treat that as a clean exit for a dev server since the user intentionally stopped it.
            if (code === 0 || code === null) {
                resolve();
            } else {
                reject(new Error(`Dev server exited with code ${code}`));
            }
        });

        // Handle SIGINT/SIGTERM gracefully using once() to prevent listener stacking
        process.once('SIGINT', sigintHandler);
        process.once('SIGTERM', sigtermHandler);
    });
}

/**
 * Builds an app
 */
export async function buildApp(appName: string): Promise<void> {
    const root = getMonorepoRoot();
    const app = getAppInfo(appName);

    if (!app) {
        throw new Error(`App "${appName}" not found. Run "otta list" to see available apps.`);
    }

    if (!app.scripts.build) {
        throw new Error(`App "${appName}" does not have a build script defined.`);
    }

    log.info(`Building ${app.name}...`);
    log.dim(`  Package: ${app.packageName}`);

    const safePackageName = sanitizeAppName(app.packageName);
    return new Promise((resolve, reject) => {
        const proc = spawn(PNPM, ['--filter', safePackageName, 'build'], {
            cwd: root,
            stdio: 'inherit',
        });

        proc.on('error', reject);
        proc.on('close', (code) => {
            if (code === 0) {
                log.success(`Build completed for ${app.name}`);
                resolve();
            } else if (code === null) {
                reject(new Error(`Build for ${app.name} was interrupted by a signal`));
            } else {
                reject(new Error(`Build failed with code ${code}`));
            }
        });
    });
}

/**
 * Tests an app
 */
export async function testApp(appName: string, options: { watch?: boolean; coverage?: boolean } = {}): Promise<void> {
    const root = getMonorepoRoot();
    const app = getAppInfo(appName);

    if (!app) {
        throw new Error(`App "${appName}" not found. Run "otta list" to see available apps.`);
    }

    if (!app.scripts.test) {
        throw new Error(`App "${appName}" does not have a test script defined.`);
    }

    log.info(`Testing ${app.name}...`);
    log.dim(`  Package: ${app.packageName}`);

    const safePackageName = sanitizeAppName(app.packageName);
    const args = ['--filter', safePackageName, 'test'];
    if (options.watch) {
        args.push('--', '--watch');
    } else {
        args.push('--', '--run');
    }
    if (options.coverage) {
        args.push('--coverage');
    }

    return new Promise((resolve, reject) => {
        const proc = spawn(PNPM, args, {
            cwd: root,
            stdio: 'inherit',
        });

        proc.on('error', reject);
        proc.on('close', (code) => {
            if (code === 0) {
                log.success(`Tests passed for ${app.name}`);
                resolve();
            } else if (code === null) {
                reject(new Error(`Tests for ${app.name} were interrupted by a signal`));
            } else {
                reject(new Error(`Tests failed with code ${code}`));
            }
        });
    });
}

/**
 * Lints an app
 */
export async function lintApp(appName: string, options: { fix?: boolean } = {}): Promise<void> {
    const root = getMonorepoRoot();
    const app = getAppInfo(appName);

    if (!app) {
        throw new Error(`App "${appName}" not found. Run "otta list" to see available apps.`);
    }

    if (!app.scripts.lint) {
        throw new Error(`App "${appName}" does not have a lint script defined.`);
    }

    log.info(`Linting ${app.name}...`);
    log.dim(`  Package: ${app.packageName}`);

    const safePackageName = sanitizeAppName(app.packageName);
    const args = ['--filter', safePackageName, 'lint'];
    if (options.fix) {
        args.push('--', '--fix');
    }

    return new Promise((resolve, reject) => {
        const proc = spawn(PNPM, args, {
            cwd: root,
            stdio: 'inherit',
        });

        proc.on('error', reject);
        proc.on('close', (code) => {
            if (code === 0) {
                log.success(`Lint passed for ${app.name}`);
                resolve();
            } else if (code === null) {
                reject(new Error(`Lint for ${app.name} was interrupted by a signal`));
            } else {
                reject(new Error(`Lint failed with code ${code}`));
            }
        });
    });
}

/**
 * Cleans build artifacts for an app
 */
export async function cleanApp(appName: string): Promise<void> {
    const root = getMonorepoRoot();
    const app = getAppInfo(appName);

    if (!app) {
        throw new Error(`App "${appName}" not found. Run "otta list" to see available apps.`);
    }

    // Gracefully skip apps that don't define a clean script
    if (!app.scripts.clean) {
        log.warn(`App "${app.name}" does not have a clean script defined. Skipping.`);
        return;
    }

    log.info(`Cleaning ${app.name}...`);
    log.dim(`  Package: ${app.packageName}`);

    const safePackageName = sanitizeAppName(app.packageName);
    return new Promise((resolve, reject) => {
        const proc = spawn(PNPM, ['--filter', safePackageName, 'clean'], {
            cwd: root,
            stdio: 'inherit',
        });

        proc.on('error', reject);
        proc.on('close', (code) => {
            if (code === 0) {
                log.success(`Clean completed for ${app.name}`);
                resolve();
            } else if (code === null) {
                reject(new Error(`Clean for ${app.name} was interrupted by a signal`));
            } else {
                reject(new Error(`Clean failed with code ${code}`));
            }
        });
    });
}

/**
 * Type checks an app
 */
export async function typeCheckApp(appName: string): Promise<void> {
    const root = getMonorepoRoot();
    const app = getAppInfo(appName);

    if (!app) {
        throw new Error(`App "${appName}" not found. Run "otta list" to see available apps.`);
    }

    if (!app.scripts['type-check']) {
        throw new Error(`App "${appName}" does not have a type-check script defined.`);
    }

    log.info(`Type checking ${app.name}...`);
    log.dim(`  Package: ${app.packageName}`);

    const safePackageName = sanitizeAppName(app.packageName);
    return new Promise((resolve, reject) => {
        const proc = spawn(PNPM, ['--filter', safePackageName, 'type-check'], {
            cwd: root,
            stdio: 'inherit',
        });

        proc.on('error', reject);
        proc.on('close', (code) => {
            if (code === 0) {
                log.success(`Type check passed for ${app.name}`);
                resolve();
            } else if (code === null) {
                reject(new Error(`Type check for ${app.name} was interrupted by a signal`));
            } else {
                reject(new Error(`Type check failed with code ${code}`));
            }
        });
    });
}
