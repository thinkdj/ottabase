/**
 * Resolves the "active app" for monorepo scripts (dev, build, cf:*, etc.).
 *
 * Resolution priority (highest → lowest):
 *   1. CLI flag: `--app=<name>` or `--app <name>` anywhere in argv
 *   2. Env var: `OTTABASE_APP`
 *   3. Root `ottabase.config.json` → `defaultApp` field
 *   4. Single-app auto-detect (when `apps/` contains exactly one app)
 *   5. Fall back to `otta-web` if it exists in `apps/`
 *
 * Throws a helpful error when no app can be resolved.
 *
 * Zero-dep CJS so it can be required from any bin script and `dev.js` without a build step.
 */

const fs = require('fs');
const path = require('path');

const FALLBACK_APP = 'otta-web';
const CONFIG_FILENAME = 'ottabase.config.json';

function findMonorepoRoot(startDir) {
    let current = path.resolve(startDir || process.cwd());
    while (true) {
        if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) return current;
        const parent = path.dirname(current);
        if (parent === current) return path.resolve(startDir || process.cwd());
        current = parent;
    }
}

function listAppNames(root) {
    const appsDir = path.join(root, 'apps');
    if (!fs.existsSync(appsDir)) return [];
    return fs
        .readdirSync(appsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && fs.existsSync(path.join(appsDir, e.name, 'package.json')))
        .map((e) => e.name);
}

function readConfigDefault(root) {
    const configPath = path.join(root, CONFIG_FILENAME);
    if (!fs.existsSync(configPath)) return null;
    try {
        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return typeof parsed.defaultApp === 'string' && parsed.defaultApp ? parsed.defaultApp : null;
    } catch {
        return null;
    }
}

/**
 * Extracts `--app=<name>` or `--app <name>` from argv.
 * Returns the name and the surviving argv (with the flag removed) so callers
 * can forward the rest to the underlying tool.
 */
function extractAppFlag(argv) {
    const out = [];
    let app = null;
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

/**
 * @param {{ argv?: string[], requireWrangler?: boolean }} options
 * @returns {{ app: string, packageName: string, appPath: string, root: string, restArgv: string[], source: string }}
 */
function resolveActiveApp(options = {}) {
    const argv = options.argv ?? process.argv.slice(2);
    const { app: cliApp, rest: restArgv } = extractAppFlag(argv);
    const root = findMonorepoRoot();
    const apps = listAppNames(root);

    const pickSource = (name, source) => ({ name, source });

    let chosen = null;
    if (cliApp) chosen = pickSource(cliApp, 'cli');
    else if (process.env.OTTABASE_APP) chosen = pickSource(process.env.OTTABASE_APP, 'env');
    else {
        const fromConfig = readConfigDefault(root);
        if (fromConfig) chosen = pickSource(fromConfig, 'config');
        else if (apps.length === 1) chosen = pickSource(apps[0], 'auto');
        else if (apps.includes(FALLBACK_APP)) chosen = pickSource(FALLBACK_APP, 'fallback');
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
        const pkg = JSON.parse(fs.readFileSync(path.join(appPath, 'package.json'), 'utf8'));
        if (typeof pkg.name === 'string' && pkg.name) packageName = pkg.name;
    } catch {
        // fall through with default scoped name
    }

    return { app: chosen.name, packageName, appPath, root, restArgv, source: chosen.source };
}

module.exports = { resolveActiveApp, findMonorepoRoot, listAppNames, FALLBACK_APP, CONFIG_FILENAME };
