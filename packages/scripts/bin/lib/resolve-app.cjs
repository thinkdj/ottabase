/**
 * Resolves the "active app" for monorepo scripts (dev, build, cf:*, etc.).
 *
 * Resolution priority (highest → lowest):
 *   1. CLI flag: `--app=<name>` (or `--app <name>`)
 *   2. Env var: `OTTABASE_APP`
 *   3. Config field — defaults to `ottabase.config.json` → `defaultApp`, or whichever
 *      field is requested via `--config-key=<field>` / `options.configKey`
 *      (e.g. `landingApp`)
 *   4. Single-app auto-detect (only when reading the default field)
 *
 * Throws a helpful error when no app can be resolved.
 *
 * Zero-dep CJS so it can be required from any bin script and `dev.js` without a build step.
 */

const fs = require('fs');
const path = require('path');

const CONFIG_FILENAME = 'ottabase.config.json';
const DEFAULT_CONFIG_KEY = 'defaultApp';

let cachedRoot = null;
let cachedApps = null;
let cachedConfig = null;

function findMonorepoRoot(startDir) {
    if (cachedRoot && !startDir) return cachedRoot;
    let current = path.resolve(startDir || process.cwd());
    while (true) {
        if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
            if (!startDir) cachedRoot = current;
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            const fallback = path.resolve(startDir || process.cwd());
            if (!startDir) cachedRoot = fallback;
            return fallback;
        }
        current = parent;
    }
}

function listAppNames(root) {
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

function readConfig(root) {
    if (cachedConfig && cachedConfig.root === root) return cachedConfig.data;
    const configPath = path.join(root, CONFIG_FILENAME);
    let data = {};
    try {
        if (fs.existsSync(configPath)) data = JSON.parse(fs.readFileSync(configPath, 'utf8')) || {};
    } catch {
        // ignore malformed config — treat as empty
    }
    cachedConfig = { root, data };
    return data;
}

function readConfigAppByKey(root, key) {
    const data = readConfig(root);
    return typeof data[key] === 'string' && data[key] ? data[key] : null;
}

/**
 * Returns the curated list of apps to deploy in CI. Source priority:
 *   1. `ottabase.config.json` → `deployApps` array
 *   2. Auto-discover: every app under `apps/` with a `wrangler.jsonc`
 */
function getDeployApps(options = {}) {
    const root = options.root || findMonorepoRoot();
    const data = readConfig(root);
    if (Array.isArray(data.deployApps) && data.deployApps.every((a) => typeof a === 'string')) {
        return data.deployApps;
    }
    return listAppNames(root).filter((name) => fs.existsSync(path.join(root, 'apps', name, 'wrangler.jsonc')));
}

/**
 * Extracts `--app=<name>` / `--app <name>` and `--config-key=<field>` / `--config-key <field>`
 * from argv. Returns the parsed values and the surviving argv (with flags removed) so callers
 * can forward the rest to the underlying tool.
 */
function extractFlags(argv) {
    const out = [];
    let app = null;
    let configKey = null;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--app' && i + 1 < argv.length) app = argv[++i];
        else if (a.startsWith('--app=')) app = a.slice('--app='.length);
        else if (a === '--config-key' && i + 1 < argv.length) configKey = argv[++i];
        else if (a.startsWith('--config-key=')) configKey = a.slice('--config-key='.length);
        else out.push(a);
    }
    return { app, configKey, rest: out };
}

/**
 * @param {{ argv?: string[], configKey?: string }} options
 * @returns {{ app: string, packageName: string, appPath: string, root: string, restArgv: string[], source: string, configKey: string }}
 */
function resolveActiveApp(options = {}) {
    const argv = options.argv ?? process.argv.slice(2);
    const { app: cliApp, configKey: cliConfigKey, rest: restArgv } = extractFlags(argv);
    const configKey = cliConfigKey || options.configKey || DEFAULT_CONFIG_KEY;
    const isDefaultKey = configKey === DEFAULT_CONFIG_KEY;
    const root = findMonorepoRoot();
    const apps = listAppNames(root);

    let chosen = null;
    if (cliApp) chosen = { name: cliApp, source: 'cli' };
    else if (isDefaultKey && process.env.OTTABASE_APP) chosen = { name: process.env.OTTABASE_APP, source: 'env' };
    else {
        const fromConfig = readConfigAppByKey(root, configKey);
        if (fromConfig) chosen = { name: fromConfig, source: 'config' };
        else if (isDefaultKey && apps.length === 1) chosen = { name: apps[0], source: 'auto' };
    }

    if (!chosen) {
        const list = apps.length ? apps.join(', ') : '(none found under apps/)';
        const hint = isDefaultKey
            ? `Set "${configKey}" in ${CONFIG_FILENAME}, export OTTABASE_APP, or pass --app=<name>.`
            : `Set "${configKey}" in ${CONFIG_FILENAME} or pass --app=<name>.`;
        throw new Error(`Cannot determine active app. ${hint} Available apps: ${list}`);
    }

    if (apps.length && !apps.includes(chosen.name)) {
        throw new Error(
            `App "${chosen.name}" (from ${chosen.source}${isDefaultKey ? '' : `, key=${configKey}`}) ` +
                `does not exist under apps/. Available: ${apps.join(', ')}`,
        );
    }

    const appPath = path.join(root, 'apps', chosen.name);
    let packageName = `@ottabase/${chosen.name}`;
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(appPath, 'package.json'), 'utf8'));
        if (typeof pkg.name === 'string' && pkg.name) packageName = pkg.name;
    } catch {
        // package.json is missing or malformed — fall through with the conventional scoped name
    }

    return { app: chosen.name, packageName, appPath, root, restArgv, source: chosen.source, configKey };
}

/** Test-only: clear in-process caches (root/apps/config). */
function _resetCachesForTests() {
    cachedRoot = null;
    cachedApps = null;
    cachedConfig = null;
}

module.exports = {
    resolveActiveApp,
    findMonorepoRoot,
    listAppNames,
    getDeployApps,
    readConfig,
    CONFIG_FILENAME,
    DEFAULT_CONFIG_KEY,
    _resetCachesForTests,
};
