/**
 * Resolves the "active app" for monorepo scripts (cf:setup, cf:validate, cf:login, ...).
 *
 * Resolution priority (highest → lowest):
 *   1. CLI flag: `--app=<name>` or `--app <name>` in argv
 *   2. Env var: `OTTABASE_APP`
 *   3. Root `ottabase.config.json` → `defaultApp` field
 *   4. Single-app auto-detect (when `apps/` contains exactly one app)
 */

import fs from 'fs';
import path from 'path';

export const CONFIG_FILENAME = 'ottabase.config.json';

export interface ResolvedApp {
    /** Directory name under `apps/`. */
    app: string;
    /** Workspace package name from package.json (e.g. `@ottabase/app1`). */
    packageName: string;
    /** Absolute path to the app directory. */
    appPath: string;
    /** Absolute monorepo root path. */
    root: string;
    /** argv with `--app` removed, for forwarding. */
    restArgv: string[];
    /** Where the resolution came from (debugging / logging). */
    source: 'cli' | 'env' | 'config' | 'auto';
}

let cachedRoot: string | null = null;
let cachedApps: { root: string; names: string[] } | null = null;
let cachedConfig: { root: string; data: Record<string, unknown> } | null = null;

export function findMonorepoRoot(startDir: string = process.cwd()): string {
    if (cachedRoot && startDir === process.cwd()) return cachedRoot;
    let current = path.resolve(startDir);
    while (true) {
        if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
            if (startDir === process.cwd()) cachedRoot = current;
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            const fallback = path.resolve(startDir);
            if (startDir === process.cwd()) cachedRoot = fallback;
            return fallback;
        }
        current = parent;
    }
}

export function listAppNames(root: string): string[] {
    if (cachedApps && cachedApps.root === root) return cachedApps.names;
    const appsDir = path.join(root, 'apps');
    const names = !fs.existsSync(appsDir)
        ? []
        : fs
              .readdirSync(appsDir, { withFileTypes: true })
              .filter((e) => e.isDirectory() && fs.existsSync(path.join(appsDir, e.name, 'package.json')))
              .map((e) => e.name);
    cachedApps = { root, names };
    return names;
}

export function readConfig(root: string): Record<string, unknown> {
    if (cachedConfig && cachedConfig.root === root) return cachedConfig.data;
    const configPath = path.join(root, CONFIG_FILENAME);
    let data: Record<string, unknown> = {};
    try {
        if (fs.existsSync(configPath)) {
            const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>;
        }
    } catch {
        // ignore malformed config — treat as empty
    }
    cachedConfig = { root, data };
    return data;
}

function readConfigDefaultApp(root: string): string | null {
    const data = readConfig(root);
    const v = data.defaultApp;
    return typeof v === 'string' && v ? v : null;
}

/**
 * Returns the curated list of apps to deploy in CI. Source priority:
 *   1. `ottabase.config.json` → `deployApps` array
 *   2. Auto-discover: every app under `apps/` with a `wrangler.jsonc`
 */
export function getDeployApps(options: { root?: string } = {}): string[] {
    const root = options.root ?? findMonorepoRoot();
    const data = readConfig(root);
    const fromConfig = data.deployApps;
    if (Array.isArray(fromConfig) && fromConfig.every((a) => typeof a === 'string')) {
        return fromConfig as string[];
    }
    return listAppNames(root).filter((name) => fs.existsSync(path.join(root, 'apps', name, 'wrangler.jsonc')));
}

function extractAppFlag(argv: string[]): { app: string | null; rest: string[] } {
    const out: string[] = [];
    let app: string | null = null;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--app' && i + 1 < argv.length) {
            app = argv[++i];
        } else if (a.startsWith('--app=')) {
            app = a.slice('--app='.length);
        } else {
            out.push(a);
        }
    }
    return { app, rest: out };
}

export function resolveActiveApp(options: { argv?: string[] } = {}): ResolvedApp {
    const argv = options.argv ?? process.argv.slice(2);
    const { app: cliApp, rest: restArgv } = extractAppFlag(argv);
    const root = findMonorepoRoot();
    const apps = listAppNames(root);

    let chosen: { name: string; source: ResolvedApp['source'] } | null = null;
    if (cliApp) chosen = { name: cliApp, source: 'cli' };
    else if (process.env.OTTABASE_APP) chosen = { name: process.env.OTTABASE_APP, source: 'env' };
    else {
        const fromConfig = readConfigDefaultApp(root);
        if (fromConfig) chosen = { name: fromConfig, source: 'config' };
        else if (apps.length === 1) chosen = { name: apps[0], source: 'auto' };
    }

    if (!chosen) {
        const list = apps.length ? apps.join(', ') : '(none found under apps/)';
        throw new Error(
            `Cannot determine active app. Set "defaultApp" in ${CONFIG_FILENAME} at the monorepo root, ` +
                `export OTTABASE_APP=<name>, or pass --app=<name>. Available apps: ${list}`,
        );
    }

    if (apps.length && !apps.includes(chosen.name)) {
        throw new Error(
            `App "${chosen.name}" (from ${chosen.source}) does not exist under apps/. ` +
                `Available: ${apps.join(', ')}`,
        );
    }

    const appPath = path.join(root, 'apps', chosen.name);
    let packageName = `@ottabase/${chosen.name}`;
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(appPath, 'package.json'), 'utf8')) as { name?: string };
        if (typeof pkg.name === 'string' && pkg.name) packageName = pkg.name;
    } catch {
        // package.json missing or malformed — fall through with conventional scoped name
    }

    return { app: chosen.name, packageName, appPath, root, restArgv, source: chosen.source };
}

/** Test-only: clear in-process caches (root/apps/config). */
export function _resetCachesForTests(): void {
    cachedRoot = null;
    cachedApps = null;
    cachedConfig = null;
}
