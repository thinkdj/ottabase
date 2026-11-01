import fs from 'fs-extra';
import { findNodeAtLocation, parseTree } from 'jsonc-parser';
import path from 'path';

/**
 * The deploy manifest and the deploy plan: what `otta deploy` reads to decide what to build, how,
 * and whether to deploy at all. The manifest is the app's `cloudflare-config.json` (its only deploy
 * file besides Cloudflare's own `wrangler.jsonc`); the plan adds the workspace dependency graph and,
 * when asked, a git diff. Pure reads, no commands: the same on a laptop, in GitHub Actions, in
 * Workers Builds and in tests. GitHub's workflows ask this module (`otta deploy --plan`) instead of
 * keeping their own copy of the rules.
 */

/** `apps/<app>/cloudflare-config.json` with the defaults filled in. Schema: schemas/cloudflare-config.schema.json. */
export interface AppDeployConfig {
    /** False keeps the app out of `--all` (and so out of CI); `otta deploy <app>` still deploys it. */
    deployable: boolean;
    /** False keeps the app out of PR previews (`--preview`). */
    previewDeployable: boolean;
    /** Only shapes the hints when a build leaves the wrong output. */
    appType: 'vite' | 'nextjs' | 'custom';
    /** The app's package.json script that builds it. */
    buildCommand: string;
    /** A second script that turns the build into a Worker bundle (OpenNext for Next.js), or null. */
    workerBuildCommand: string | null;
    /** Paths under the app that must exist before wrangler runs. */
    verifyPaths: string[];
    /** The wrangler config file in the app folder. */
    wranglerConfig: string;
    /** The env block deployed when `--env` is not given. */
    wranglerEnv: string;
    /** Requested after the deploy; a failure is reported, never fatal. */
    healthCheckPath: string;
    /** Names CI must provide beyond the wrangler placeholders (checked before the build). */
    requiresSecrets: string[];
    /** The same, for `--preview`. */
    requiresPreviewSecrets: string[];
}

/**
 * The defaults, the one copy of them: the schema's `default`s say the same and a test holds them together.
 * Frozen, lists included: every config read gets its own copy.
 */
export const DEPLOY_CONFIG_DEFAULTS: Readonly<AppDeployConfig> = Object.freeze({
    deployable: true,
    previewDeployable: true,
    appType: 'vite',
    buildCommand: 'build',
    workerBuildCommand: null,
    verifyPaths: Object.freeze(['dist', 'cloudflare-worker.ts']) as string[],
    wranglerConfig: 'wrangler.jsonc',
    wranglerEnv: 'production',
    healthCheckPath: '/api/health',
    requiresSecrets: Object.freeze([] as string[]) as string[],
    requiresPreviewSecrets: Object.freeze([] as string[]) as string[],
});

export const DEPLOY_CONFIG_FILE = 'cloudflare-config.json';

/** Keys the file may carry that are not settings. */
const ANNOTATION_KEYS = new Set(['$schema', '$comment']);
/** Keys the manifest no longer has, and what took their place: named in the error, so an old file is a quick fix. */
const REMOVED_KEYS: Record<string, string> = {
    workerName: "wrangler.jsonc's name is the Worker name",
    outputDirectory: 'verifyPaths says what the build must leave',
    assetsDirectory: "wrangler.jsonc's assets block says where the assets are",
    customBuildSteps: 'put the steps in the package.json script buildCommand names',
};
const APP_TYPES = new Set(['vite', 'nextjs', 'custom']);
const SCRIPT_NAME = /^[a-zA-Z0-9:_.-]+$/;
const SECRET_NAME = /^[A-Z][A-Z0-9_]*$/;
const ENV_NAME = /^[a-z][a-z0-9-]*$/;

/**
 * The app's deploy manifest, strictly: an unknown key or a value of the wrong shape is an error that
 * names itself, never a silent default, so a typo cannot change how an app ships.
 */
export function readDeployConfig(appDir: string): AppDeployConfig {
    const file = path.join(appDir, DEPLOY_CONFIG_FILE);
    const where = `apps/${path.basename(appDir)}/${DEPLOY_CONFIG_FILE}`;
    if (!fs.existsSync(file)) {
        throw new Error(
            `${where} is missing: every app Cloudflare deploys has one (schemas/cloudflare-config.schema.json).`,
        );
    }
    let raw: Record<string, unknown>;
    try {
        raw = fs.readJsonSync(file) as Record<string, unknown>;
    } catch (error) {
        throw new Error(`${where} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${where} must be a JSON object.`);
    const fail = (key: string, expected: string): never => {
        throw new Error(`${where}: "${key}" must be ${expected}, got ${JSON.stringify(raw[key])}.`);
    };
    const config: AppDeployConfig = structuredClone(DEPLOY_CONFIG_DEFAULTS) as AppDeployConfig;
    for (const [key, value] of Object.entries(raw)) {
        if (ANNOTATION_KEYS.has(key)) continue;
        switch (key) {
            case 'deployable':
            case 'previewDeployable':
                if (typeof value !== 'boolean') fail(key, 'true or false');
                config[key] = value as boolean;
                break;
            case 'appType':
                if (typeof value !== 'string' || !APP_TYPES.has(value))
                    fail(key, `one of ${[...APP_TYPES].join(', ')}`);
                config.appType = value as AppDeployConfig['appType'];
                break;
            case 'buildCommand':
                if (typeof value !== 'string' || !SCRIPT_NAME.test(value)) fail(key, 'a package.json script name');
                config.buildCommand = value as string;
                break;
            case 'workerBuildCommand':
                // "" and null both mean: no worker build step.
                if (value === null || value === '') config.workerBuildCommand = null;
                else if (typeof value === 'string' && SCRIPT_NAME.test(value)) config.workerBuildCommand = value;
                else fail(key, 'a package.json script name, "" or null');
                break;
            case 'verifyPaths':
                if (
                    !Array.isArray(value) ||
                    !value.every(
                        (p) => typeof p === 'string' && p && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..'),
                    )
                ) {
                    fail(key, 'a list of paths inside the app');
                }
                config.verifyPaths = value as string[];
                break;
            case 'wranglerConfig':
                if (typeof value !== 'string' || !/^[\w.-]+\.jsonc?$/.test(value)) {
                    fail(key, 'a .json or .jsonc file name in the app folder');
                }
                config.wranglerConfig = value as string;
                break;
            case 'wranglerEnv':
                if (typeof value !== 'string' || !ENV_NAME.test(value)) fail(key, 'a Wrangler env name');
                config.wranglerEnv = value as string;
                break;
            case 'healthCheckPath':
                if (typeof value !== 'string' || !value.startsWith('/')) fail(key, 'a path starting with /');
                config.healthCheckPath = value as string;
                break;
            case 'requiresSecrets':
            case 'requiresPreviewSecrets':
                if (
                    !Array.isArray(value) ||
                    !value.every((name) => typeof name === 'string' && SECRET_NAME.test(name))
                ) {
                    fail(key, 'a list of SECRET_NAMES');
                }
                config[key] = value as string[];
                break;
            default:
                throw new Error(
                    key in REMOVED_KEYS
                        ? `${where}: "${key}" is no longer a setting (${REMOVED_KEYS[key]}): remove it.`
                        : `${where}: unknown key "${key}" (schemas/cloudflare-config.schema.json lists them).`,
                );
        }
    }
    return config;
}

/** Apps that carry a cloudflare-config.json, deployable or not, sorted. Nothing is parsed here. */
export function listCloudflareApps(root: string): string[] {
    const appsDir = path.join(root, 'apps');
    if (!fs.existsSync(appsDir)) return [];
    return fs
        .readdirSync(appsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => fs.existsSync(path.join(appsDir, name, DEPLOY_CONFIG_FILE)))
        .sort();
}

/** Apps whose cloudflare-config.json does not say `deployable: false`: what `otta deploy --all` deploys. */
export function listDeployableApps(root: string): string[] {
    return planDeploys(root, {})
        .filter((entry) => entry.deploy)
        .map((entry) => entry.app);
}

/** Apps whose manifest allows PR previews, deployable or not: what `--all --delete-preview` cleans up. */
export function listPreviewApps(root: string): string[] {
    return listCloudflareApps(root).filter((app) => {
        const appDir = path.join(root, 'apps', app);
        try {
            const config = readDeployConfig(appDir);
            return config.previewDeployable && hasEnvBlock(appDir, config, 'preview');
        } catch {
            return false;
        }
    });
}

/** Whether the app's wrangler config has an `env.<name>` block: an app with no env.preview has no previews. */
export function hasEnvBlock(appDir: string, config: AppDeployConfig, env: string): boolean {
    const file = path.join(appDir, config.wranglerConfig);
    if (!fs.existsSync(file)) return false;
    const tree = parseTree(fs.readFileSync(file, 'utf8'), [], { allowTrailingComma: true });
    return tree ? findNodeAtLocation(tree, ['env', env])?.type === 'object' : false;
}

/** One app's line of a deploy plan. */
export interface PlanEntry {
    app: string;
    /** Whether this run deploys it. */
    deploy: boolean;
    /** Why, in a few words: shown in logs and in the GitHub matrix. */
    reason: string;
    /** When it does not deploy, the kind of reason. */
    skip?: SkipKind;
    /** The manifest's appType (absent when the manifest does not read): CI caches by it (Next.js's .next/cache). */
    appType?: AppDeployConfig['appType'];
}

export type SkipKind = 'unchanged' | 'skipdeploy' | 'no-preview' | 'not-deployable';

export interface PlanInput {
    /** PR previews: apps with `previewDeployable: false` are left out. */
    preview?: boolean;
    /** The `--changed-since` ref, and the files git says changed since it (null: git could not say). */
    changedSince?: string;
    changed?: string[] | null;
    /** HEAD's commit message: `#skipdeploy` in it deploys nothing. Null or absent: not checked (`--force`). */
    commitMessage?: string | null;
}

const SKIP_DEPLOY = /#skipdeploy\b/i;

/**
 * Whether one app deploys in this run, and why. `scope: 'all'` (the `--all` run) leaves out an app whose
 * manifest says `deployable: false`; one app asked for by name deploys either way. A manifest that does
 * not read is planned as a deploy, so that app's own job fails with the error and the other apps are not
 * held back by it. `packages` is the workspace's package map, read once per plan by `planDeploys`.
 */
export function planApp(
    root: string,
    app: string,
    input: PlanInput,
    scope: 'app' | 'all' = 'app',
    packages?: Map<string, string>,
): PlanEntry {
    let config: AppDeployConfig;
    try {
        config = readDeployConfig(path.join(root, 'apps', app));
    } catch (error) {
        return { app, deploy: true, reason: error instanceof Error ? error.message : String(error) };
    }
    const { appType } = config;
    const go = (reason: string): PlanEntry => ({ app, deploy: true, reason, appType });
    const skip = (kind: SkipKind, reason: string): PlanEntry => ({ app, deploy: false, reason, skip: kind, appType });
    if (scope === 'all' && !config.deployable) return skip('not-deployable', 'deployable: false');
    if (input.preview && !config.previewDeployable) return skip('no-preview', 'previewDeployable: false');
    if (input.preview && !hasEnvBlock(path.join(root, 'apps', app), config, 'preview')) {
        return skip('no-preview', `${config.wranglerConfig} has no env.preview block`);
    }
    if (input.commitMessage && SKIP_DEPLOY.test(input.commitMessage)) {
        return skip('skipdeploy', '#skipdeploy in the commit message');
    }
    if (!input.changedSince) return go('deploy');
    const globs = watchPaths(root, app, packages);
    const nested = nestedCheckouts(root, globs);
    if (nested.length) return go(`${nested.join(', ')} is its own git checkout, which the diff cannot see`);
    if (input.changed == null) return go(`git cannot diff against ${input.changedSince}`);
    const hits = input.changed.filter((file) => isAffected([file], globs));
    if (!hits.length) return skip('unchanged', `nothing it uses changed since ${input.changedSince}`);
    return go(`changed: ${hits[0]}${hits.length > 1 ? ` (+${hits.length - 1} more)` : ''}`);
}

/** The plan for `--all`: every app with a manifest; `deployable: false` ones are listed, never deployed. */
export function planDeploys(root: string, input: PlanInput): PlanEntry[] {
    // The dependency graph is read only when a diff needs it, and then once for every app.
    const packages = input.changedSince ? workspacePackages(root) : undefined;
    return listCloudflareApps(root).map((app) => planApp(root, app, input, 'all', packages));
}

/**
 * The `packages:` globs of pnpm-workspace.yaml, as a block list. Anything it cannot read for certain (no
 * file, an inline `[a, b]` list) is an error: a package left out of the graph would leave its changes
 * out of the watch paths, and --changed-since would skip a deploy they changed.
 */
export function workspaceGlobs(root: string): string[] {
    const file = path.join(root, 'pnpm-workspace.yaml');
    if (!fs.existsSync(file)) throw new Error('No pnpm-workspace.yaml at the root: the workspace graph is unknown.');
    const globs: string[] = [];
    let inPackages = false;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const key = /^packages\s*:\s*(.*)$/.exec(line);
        if (key) {
            if (key[1] && !key[1].startsWith('#')) {
                throw new Error('pnpm-workspace.yaml: write packages: as a block list (- apps/*), one glob per line.');
            }
            inPackages = true;
            continue;
        }
        if (!inPackages) continue;
        if (/^\S/.test(line)) break; // the next top-level key
        const item = /^\s*-\s*["']?([^"'#\s]+)["']?/.exec(line);
        if (item && !item[1].startsWith('!')) globs.push(item[1].replace(/\/+$/, ''));
    }
    return globs;
}

const toPosix = (p: string) => p.split(path.sep).join('/');

/** Every workspace package as name → directory relative to the root (posix separators). */
export function workspacePackages(root: string): Map<string, string> {
    const packages = new Map<string, string>();
    const add = (dir: string) => {
        const manifest = path.join(root, dir, 'package.json');
        if (!fs.existsSync(manifest)) return;
        const name = (fs.readJsonSync(manifest) as { name?: string }).name;
        if (name && !packages.has(name)) packages.set(name, toPosix(dir));
    };
    for (const glob of workspaceGlobs(root)) {
        if (glob.endsWith('/*')) {
            const parent = glob.slice(0, -2);
            const parentDir = path.join(root, parent);
            if (!fs.existsSync(parentDir)) continue;
            for (const entry of fs.readdirSync(parentDir, { withFileTypes: true })) {
                if (entry.isDirectory() && entry.name !== 'node_modules') add(path.join(parent, entry.name));
            }
        } else if (!glob.includes('*')) {
            add(glob);
        } else {
            // Dropping it would leave its packages out of the watch paths, and --changed-since would
            // skip a deploy they changed.
            throw new Error(`pnpm-workspace.yaml: "${glob}" is not a form otta deploy reads (dir, dir/*).`);
        }
    }
    return packages;
}

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const;

/**
 * The workspace packages `appDir` depends on, directly or through one another, as directories relative
 * to the root, sorted. External dependencies are not followed: they change only through the lockfile.
 */
export function workspaceDependencyDirs(
    root: string,
    appDir: string,
    packages: Map<string, string> = workspacePackages(root),
): string[] {
    const seen = new Set<string>();
    const queue = [path.relative(root, appDir)];
    const start = toPosix(queue[0]);
    while (queue.length) {
        const dir = queue.shift()!;
        const manifest = path.join(root, dir, 'package.json');
        if (!fs.existsSync(manifest)) continue;
        const pkg = fs.readJsonSync(manifest) as Partial<
            Record<(typeof DEPENDENCY_FIELDS)[number], Record<string, string>>
        >;
        for (const field of DEPENDENCY_FIELDS) {
            for (const name of Object.keys(pkg[field] ?? {})) {
                const depDir = packages.get(name);
                if (!depDir || depDir === start || seen.has(depDir)) continue;
                seen.add(depDir);
                queue.push(depDir);
            }
        }
    }
    return [...seen].sort();
}

/** Root files whose change can change any app's build. */
const ROOT_FILES = [
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'turbo.json',
    '.nvmrc',
    '.node-version',
    '.npmrc',
];

/**
 * What the app's deploy depends on, as watch paths: the app, every workspace package it reaches, and the
 * root build files. Written in Workers Builds' own syntax (a folder is `dir/*`, its `*` matching any
 * characters, nested paths included), so the list pastes as is into its build watch paths; it is also
 * what `--changed-since` compares a diff against.
 */
export function watchPaths(root: string, appName: string, packages?: Map<string, string>): string[] {
    const appDir = path.join(root, 'apps', appName);
    const rootFiles = fs.existsSync(root)
        ? fs
              .readdirSync(root)
              .filter((file) => ROOT_FILES.includes(file) || /^tsconfig(\..+)?\.json$/.test(file))
              .sort()
        : [];
    return [
        `apps/${appName}/*`,
        ...workspaceDependencyDirs(root, appDir, packages).map((dir) => `${dir}/*`),
        ...(fs.existsSync(path.join(root, 'patches')) ? ['patches/*'] : []),
        ...rootFiles,
    ];
}

/** Whether any changed file (repository-relative, posix) falls under the paths `watchPaths` returns. */
export function isAffected(changedFiles: string[], globs: string[]): boolean {
    return changedFiles.some((file) =>
        globs.some((glob) => (glob.endsWith('/*') ? file.startsWith(glob.slice(0, -1)) : file === glob)),
    );
}

/**
 * Watched folders that are their own git checkout (a `.git` dir or file at or above them, below the
 * root): Pro cloned into packages/pro, or a submodule. A diff at the root cannot see their changes.
 */
export function nestedCheckouts(root: string, globs: string[]): string[] {
    const found = new Set<string>();
    for (const glob of globs) {
        if (!glob.endsWith('/*')) continue;
        const parts = glob.slice(0, -2).split('/');
        for (let i = 1; i <= parts.length; i++) {
            const dir = parts.slice(0, i).join('/');
            if (fs.existsSync(path.join(root, dir, '.git'))) {
                found.add(dir);
                break;
            }
        }
    }
    return [...found].sort();
}

/** A git ref safe to pass as an argument: no leading dash, no whitespace, the usual ref characters. */
export function isSafeGitRef(ref: string): boolean {
    return /^[A-Za-z0-9_./~^@{}-]+$/.test(ref) && !ref.startsWith('-') && !ref.includes('..');
}
