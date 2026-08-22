import { execFileSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

/**
 * ANSI color codes for terminal output
 */
export const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
};

/**
 * Logger utility with colored output
 */
export const log = {
    info: (msg: string) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
    success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
    warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
    error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
    step: (msg: string) => console.log(`${colors.blue}→${colors.reset} ${msg}`),
    dim: (msg: string) => console.log(`${colors.dim}${msg}${colors.reset}`),
};

/**
 * Finds the monorepo root by traversing up to find pnpm-workspace.yaml
 */
export function findMonorepoRoot(startDir: string = process.cwd()): string | null {
    let currentDir = path.resolve(startDir);

    while (currentDir !== path.dirname(currentDir)) {
        const workspaceFile = path.join(currentDir, 'pnpm-workspace.yaml');
        if (fs.existsSync(workspaceFile)) {
            return currentDir;
        }
        currentDir = path.dirname(currentDir);
    }

    return null;
}

/**
 * Gets the monorepo root or throws an error
 */
export function getMonorepoRoot(): string {
    const root = findMonorepoRoot();
    if (!root) {
        throw new Error('Could not find monorepo root. Make sure you are inside the ottabase repository.');
    }
    return root;
}

/**
 * App metadata
 */
export interface AppInfo {
    name: string;
    packageName: string;
    path: string;
    type: 'web' | 'landing' | 'unknown';
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    ottabase: OttabaseAppMetadata;
}

/** A process participating in an app's local hot-reload topology. */
export interface AppDevelopmentProcess {
    /** Stable CLI selector used by `otta start --process <name>`. */
    name: string;
    /** package.json script to execute from the app workspace. */
    script: string;
    /** Local URL used for readiness checks and optional browser opening. */
    url?: string;
    /** Override `url` when readiness lives on a dedicated endpoint. */
    readyUrl?: string;
    /** Environment variable the process reads for its listen port. */
    portEnv?: string;
    /** CLI flag carrying the port, for processes that ignore `portEnv` (Wrangler reads neither). */
    portArg?: string;
    /** The one process selected by the shorthand `--port` option and opened in the browser. */
    primary?: boolean;
}

/** Declarative app lifecycle metadata stored under package.json `ottabase`. */
export interface OttabaseAppMetadata {
    start?: {
        development?: {
            processes?: AppDevelopmentProcess[];
        };
        worker?: {
            url?: string;
            readyUrl?: string;
            unsupportedPlatforms?: Partial<Record<NodeJS.Platform, string>>;
        };
        readyTimeoutMs?: number;
    };
}

/**
 * Detects app type based on dependencies and structure
 */
function detectAppType(packageJson: Record<string, unknown>, appPath: string): 'web' | 'landing' | 'unknown' {
    const deps = (packageJson.dependencies as Record<string, string>) || {};
    const devDeps = (packageJson.devDependencies as Record<string, string>) || {};

    // Check for Next.js (landing page style) — may appear in either deps or devDeps
    if (deps['next'] || devDeps['next']) {
        return 'landing';
    }

    // Check for Vite + Cloudflare Workers (web app style)
    if (
        deps['@tanstack/react-router'] ||
        devDeps['@tanstack/react-router'] ||
        fs.existsSync(path.join(appPath, 'worker'))
    ) {
        return 'web';
    }

    return 'unknown';
}

/**
 * In-process cache for listApps(). Avoids repeated synchronous disk reads
 * when multiple commands call getAppInfo() in the same CLI invocation.
 * Reset by calling clearAppsCache() (useful in tests).
 */
let appsCache: AppInfo[] | null = null;

/** Clears the in-process app list cache. Primarily for use in tests. */
export function clearAppsCache(): void {
    appsCache = null;
}

/**
 * Lists all apps in the monorepo. Result is cached for the process lifetime.
 */
export function listApps(): AppInfo[] {
    if (appsCache) return appsCache;
    const root = getMonorepoRoot();
    const appsDir = path.join(root, 'apps');

    if (!fs.existsSync(appsDir)) {
        appsCache = [];
        return appsCache;
    }

    const apps: AppInfo[] = [];
    const entries = fs.readdirSync(appsDir, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const appPath = path.join(appsDir, entry.name);
        const packageJsonPath = path.join(appPath, 'package.json');

        if (!fs.existsSync(packageJsonPath)) continue;

        try {
            const packageJson = fs.readJsonSync(packageJsonPath);
            apps.push({
                name: entry.name,
                packageName: packageJson.name || entry.name,
                path: appPath,
                type: detectAppType(packageJson, appPath),
                scripts: packageJson.scripts || {},
                dependencies: packageJson.dependencies || {},
                devDependencies: packageJson.devDependencies || {},
                ottabase: packageJson.ottabase || {},
            });
        } catch {
            // Skip invalid package.json files
        }
    }

    appsCache = apps;
    return apps;
}

/**
 * Gets info about a specific app
 */
export function getAppInfo(appName: string): AppInfo | null {
    const apps = listApps();
    return apps.find((app) => app.name === appName || app.packageName === appName) || null;
}

/**
 * Resolves an optional app selector without baking a product app into the CLI.
 *
 * Selection order: explicit argument, OTTABASE_APP, root `ottabase.defaultApp`,
 * then the only app. The cf:* scripts read the same key and env var.
 */
export function resolveApp(appName?: string): AppInfo {
    const apps = listApps();
    if (apps.length === 0) {
        throw new Error('No apps with a package.json were found under apps/.');
    }

    let requested = appName || process.env.OTTABASE_APP;

    if (!requested) {
        try {
            const rootPackage = fs.readJsonSync(path.join(getMonorepoRoot(), 'package.json')) as {
                ottabase?: { defaultApp?: unknown };
            };
            const configured = rootPackage.ottabase?.defaultApp;
            if (typeof configured === 'string' && configured) requested = configured;
        } catch {
            // A malformed root package is reported below as an unresolved multi-app selection.
        }
    }

    if (requested) {
        const app = apps.find((candidate) => candidate.name === requested || candidate.packageName === requested);
        if (app) return app;
        throw new Error(
            `App "${requested}" not found. Available: ${apps.map((candidate) => candidate.name).join(', ')}`,
        );
    }

    if (apps.length === 1) return apps[0] as AppInfo;

    throw new Error(
        `Multiple apps found (${apps.map((app) => app.name).join(', ')}). Pass an app or set OTTABASE_APP.`,
    );
}

/**
 * Available app templates
 */
export const APP_TEMPLATES = {
    web: {
        name: 'web',
        description: 'Full-featured Vite + TanStack Router + Cloudflare Workers app',
        source: 'otta-web',
    },
    landing: {
        name: 'landing',
        description: 'Next.js landing page with Cloudflare Workers deployment',
        source: 'otta-landing',
    },
} as const;

export type AppTemplate = keyof typeof APP_TEMPLATES;

/**
 * Returns the conventional pnpm binary name for the current platform.
 * Use `getPnpmInvocation()` when executing it so Node 24 handles Windows shims safely.
 */
export function getPnpmBin(): string {
    return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

/**
 * Builds a shell-injection-safe pnpm process invocation.
 *
 * Node 24 does not execute `.cmd` shims directly on Windows. Invoking cmd.exe
 * explicitly avoids `spawn EINVAL`; strict argument validation keeps the
 * generated command line limited to pnpm/package/script/path tokens.
 */
export function getPnpmInvocation(args: string[]): { command: string; args: string[] } {
    for (const arg of args) {
        if (!/^[a-zA-Z0-9@_./\\:=,+-]+$/.test(arg)) {
            throw new Error(`Unsafe pnpm argument: ${arg}`);
        }
    }

    if (process.platform !== 'win32') return { command: 'pnpm', args };

    return {
        command: process.env.ComSpec || 'cmd.exe',
        args: ['/d', '/s', '/c', `pnpm ${args.join(' ')}`],
    };
}

/**
 * Validates an app name: checks format (regex) and existence (disk I/O via getAppInfo).
 * Returns an error if the name is malformed or an app with that name already exists.
 */
export function validateAppName(name: string): { valid: true } | { valid: false; error: string } {
    if (!name) {
        return { valid: false, error: 'App name is required' };
    }

    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) {
        return {
            valid: false,
            error: 'App name must start with a lowercase letter, use only lowercase letters, numbers, and hyphens, with no consecutive or trailing hyphens',
        };
    }

    if (name.length > 50) {
        return { valid: false, error: 'App name must be 50 characters or less' };
    }

    // Check if app already exists (disk I/O — documented side effect)
    const app = getAppInfo(name);
    if (app) {
        return { valid: false, error: `App "${name}" already exists at ${app.path}` };
    }

    return { valid: true };
}

/**
 * Runs a command and returns the output.
 *
 * @remarks
 * This is a **programmatic utility** — it is not used by any CLI command
 * handler (those use `spawn` for streaming output). Exposed for consumers
 * of `@ottabase/cli` who need synchronous command execution.
 */
export function runCommand(program: string, args: string[], options: { cwd?: string; silent?: boolean } = {}): string {
    try {
        if (options.silent) {
            // When silent, capture output and return as string
            const result = execFileSync(program, args, {
                cwd: options.cwd || process.cwd(),
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            return result || '';
        } else {
            // When not silent, inherit stdio and return empty string
            execFileSync(program, args, {
                cwd: options.cwd || process.cwd(),
                stdio: 'inherit',
            });
            return '';
        }
    } catch (error) {
        if (options.silent) {
            const err = error as { stdout?: string; stderr?: string; message?: string };
            throw new Error(err.stderr || err.message || 'Command failed');
        }
        throw error;
    }
}

/**
 * Sanitizes a string argument for safe use as an execFileSync arg.
 * Allows dots in addition to alphanumeric/@/_ /- because pnpm filter expressions
 * and semver ranges can include them (e.g. "--filter=@scope/pkg@1.0.0").
 */
function sanitizeArg(arg: string): string {
    // Only allow alphanumeric, hyphens, underscores, dots, @, and /
    if (!/^[@a-zA-Z0-9/_.-]+$/.test(arg)) {
        throw new Error(`Invalid argument: ${arg}`);
    }
    return arg;
}

/**
 * Runs a pnpm command with the specified filter.
 *
 * @remarks
 * This is a **programmatic utility** — it is not used by any CLI command
 * handler (those use `spawn` for streaming output). Exposed for consumers
 * of `@ottabase/cli` who need synchronous pnpm execution.
 */
export function runPnpmCommand(script: string, filter?: string, args: string[] = []): void {
    const root = getMonorepoRoot();

    // Sanitize all inputs before passing to execFileSync (avoids shell string building)
    const safeScript = sanitizeArg(script);
    const safeArgs = args.map(sanitizeArg);

    const pnpmArgs: string[] = [];
    if (filter) {
        pnpmArgs.push(`--filter=${sanitizeArg(filter)}`);
    }
    pnpmArgs.push(safeScript, ...safeArgs);

    log.step(`Running: pnpm ${pnpmArgs.join(' ')}`);
    const invocation = getPnpmInvocation(pnpmArgs);
    execFileSync(invocation.command, invocation.args, { cwd: root, stdio: 'inherit' });
}
