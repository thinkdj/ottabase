/**
 * Resolves the "active app" for monorepo scripts (cf:setup, cf:validate, cf:login, ...).
 *
 * Resolution priority (highest → lowest):
 *   1. CLI flag: `--app=<name>` or `--app <name>` in argv
 *   2. Env var: `OTTABASE_APP`
 *   3. Root `ottabase.config.json` → `defaultApp` field
 *   4. Single-app auto-detect (when `apps/` contains exactly one app)
 *   5. Fall back to `otta-web` if it exists
 */

import fs from 'fs';
import path from 'path';

export const FALLBACK_APP = 'otta-web';
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
    source: 'cli' | 'env' | 'config' | 'auto' | 'fallback';
}

export function findMonorepoRoot(startDir: string = process.cwd()): string {
    let current = path.resolve(startDir);
    while (true) {
        if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) return current;
        const parent = path.dirname(current);
        if (parent === current) return path.resolve(startDir);
        current = parent;
    }
}

export function listAppNames(root: string): string[] {
    const appsDir = path.join(root, 'apps');
    if (!fs.existsSync(appsDir)) return [];
    return fs
        .readdirSync(appsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && fs.existsSync(path.join(appsDir, e.name, 'package.json')))
        .map((e) => e.name);
}

function readConfigDefault(root: string): string | null {
    const configPath = path.join(root, CONFIG_FILENAME);
    if (!fs.existsSync(configPath)) return null;
    try {
        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { defaultApp?: unknown };
        return typeof parsed.defaultApp === 'string' && parsed.defaultApp ? parsed.defaultApp : null;
    } catch {
        return null;
    }
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
        const fromConfig = readConfigDefault(root);
        if (fromConfig) chosen = { name: fromConfig, source: 'config' };
        else if (apps.length === 1) chosen = { name: apps[0], source: 'auto' };
        else if (apps.includes(FALLBACK_APP)) chosen = { name: FALLBACK_APP, source: 'fallback' };
    }

    if (!chosen) {
        const list = apps.length ? apps.join(', ') : '(none found)';
        throw new Error(
            `Could not resolve active app. Set "defaultApp" in ${CONFIG_FILENAME}, ` +
                `export OTTABASE_APP, or pass --app=<name>. Available apps: ${list}`,
        );
    }

    if (apps.length && !apps.includes(chosen.name)) {
        throw new Error(
            `App "${chosen.name}" (from ${chosen.source}) not found in apps/. Available: ${apps.join(', ')}`,
        );
    }

    const appPath = path.join(root, 'apps', chosen.name);
    let packageName = `@ottabase/${chosen.name}`;
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(appPath, 'package.json'), 'utf8')) as { name?: string };
        if (typeof pkg.name === 'string' && pkg.name) packageName = pkg.name;
    } catch {
        // fall through with default scoped name
    }

    return { app: chosen.name, packageName, appPath, root, restArgv, source: chosen.source };
}
