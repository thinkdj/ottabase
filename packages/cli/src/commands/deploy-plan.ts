import fs from 'fs-extra';
import path from 'path';

/**
 * What `otta deploy` reads to decide what to build, how, and whether to deploy at all: the app's
 * `cloudflare-config.json`, and the workspace dependency graph from `pnpm-workspace.yaml` and each
 * package.json. Pure file reads, no commands, so it is the same locally, in Workers Builds and in tests.
 */

/** `apps/<app>/cloudflare-config.json`, the app's deploy contract, with the defaults filled in. */
export interface AppDeployConfig {
    /** False keeps the app out of `otta deploy --all`. */
    deployable: boolean;
    appType: string;
    workerName?: string;
    /** The app's package.json script that builds it. */
    buildCommand: string;
    /** A second script that turns the build into a Worker bundle (OpenNext for Next.js), or null. */
    workerBuildCommand: string | null;
    /** Paths under the app that must exist before deploying. */
    verifyPaths: string[];
    wranglerConfig: string;
    /** The env block deployed when `--env` is not given. */
    wranglerEnv: string;
    /** Requested after the deploy; a non-2xx is reported, never fatal. */
    healthCheckPath: string;
    /** Whether the app has a cloudflare-config.json at all. */
    declared: boolean;
}

const DEFAULTS: Omit<AppDeployConfig, 'declared'> = {
    deployable: true,
    appType: 'vite',
    buildCommand: 'build',
    workerBuildCommand: null,
    // schemas/cloudflare-config.schema.json: the Vite app's output and entry.
    verifyPaths: ['dist', 'cloudflare-worker.ts'],
    wranglerConfig: 'wrangler.jsonc',
    wranglerEnv: 'production',
    healthCheckPath: '/',
};

export const DEPLOY_CONFIG_FILE = 'cloudflare-config.json';

/**
 * The app's deploy config, with the schema's defaults. An app without the file is built with `build` and
 * nothing is required of its output; its health path is the framework's `/api/health`.
 */
export function readDeployConfig(appDir: string): AppDeployConfig {
    const file = path.join(appDir, DEPLOY_CONFIG_FILE);
    if (!fs.existsSync(file)) {
        return { ...DEFAULTS, verifyPaths: [], healthCheckPath: '/api/health', declared: false };
    }
    const raw = fs.readJsonSync(file) as Partial<AppDeployConfig> & Record<string, unknown>;
    const config: AppDeployConfig = { ...DEFAULTS, declared: true };
    if (typeof raw.deployable === 'boolean') config.deployable = raw.deployable;
    if (typeof raw.appType === 'string') config.appType = raw.appType;
    if (typeof raw.workerName === 'string' && raw.workerName) config.workerName = raw.workerName;
    if (typeof raw.buildCommand === 'string' && raw.buildCommand) config.buildCommand = raw.buildCommand;
    // "" and null both mean: no worker build step.
    if (typeof raw.workerBuildCommand === 'string' && raw.workerBuildCommand) {
        config.workerBuildCommand = raw.workerBuildCommand;
    }
    if (Array.isArray(raw.verifyPaths)) config.verifyPaths = raw.verifyPaths.filter((p) => typeof p === 'string');
    if (typeof raw.wranglerConfig === 'string' && raw.wranglerConfig) config.wranglerConfig = raw.wranglerConfig;
    if (typeof raw.wranglerEnv === 'string' && raw.wranglerEnv) config.wranglerEnv = raw.wranglerEnv;
    if (typeof raw.healthCheckPath === 'string' && raw.healthCheckPath.startsWith('/')) {
        config.healthCheckPath = raw.healthCheckPath;
    }
    for (const script of [config.buildCommand, config.workerBuildCommand]) {
        if (script && !/^[a-zA-Z0-9:_.-]+$/.test(script)) {
            throw new Error(`${DEPLOY_CONFIG_FILE}: "${script}" is not a package.json script name.`);
        }
    }
    return config;
}

/** Apps whose cloudflare-config.json does not say `deployable: false`: what `otta deploy --all` deploys. */
export function listDeployableApps(root: string): string[] {
    const appsDir = path.join(root, 'apps');
    if (!fs.existsSync(appsDir)) return [];
    return fs
        .readdirSync(appsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => {
            const dir = path.join(appsDir, name);
            if (!fs.existsSync(path.join(dir, 'package.json'))) return false;
            if (!fs.existsSync(path.join(dir, DEPLOY_CONFIG_FILE))) return false;
            return readDeployConfig(dir).deployable;
        })
        .sort();
}

/** The `packages:` globs of pnpm-workspace.yaml. Only the forms a workspace uses: `dir`, `dir/*`. */
export function workspaceGlobs(root: string): string[] {
    const file = path.join(root, 'pnpm-workspace.yaml');
    if (!fs.existsSync(file)) return [];
    const globs: string[] = [];
    let inPackages = false;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        if (/^packages\s*:/.test(line)) {
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
export function workspaceDependencyDirs(root: string, appDir: string): string[] {
    const packages = workspacePackages(root);
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
 * What the app's deploy depends on, as watch-path globs: the app, every workspace package it reaches,
 * and the root build files. The include list for Workers Builds' build watch paths, and what
 * `--changed-since` compares a diff against.
 */
export function watchPaths(root: string, appName: string): string[] {
    const appDir = path.join(root, 'apps', appName);
    const rootFiles = fs.existsSync(root)
        ? fs
              .readdirSync(root)
              .filter((file) => ROOT_FILES.includes(file) || /^tsconfig(\..+)?\.json$/.test(file))
              .sort()
        : [];
    return [
        `apps/${appName}/**`,
        ...workspaceDependencyDirs(root, appDir).map((dir) => `${dir}/**`),
        ...(fs.existsSync(path.join(root, 'patches')) ? ['patches/**'] : []),
        ...rootFiles,
    ];
}

/** Whether any changed file (repository-relative, posix) falls under the globs `watchPaths` returns. */
export function isAffected(changedFiles: string[], globs: string[]): boolean {
    return changedFiles.some((file) =>
        globs.some((glob) => (glob.endsWith('/**') ? file.startsWith(glob.slice(0, -2)) : file === glob)),
    );
}

/**
 * Watched folders that are their own git checkout (a `.git` dir or file at or above them, below the
 * root): Pro cloned into packages/pro, or a submodule. A diff at the root cannot see their changes.
 */
export function nestedCheckouts(root: string, globs: string[]): string[] {
    const found = new Set<string>();
    for (const glob of globs) {
        if (!glob.endsWith('/**')) continue;
        const parts = glob.slice(0, -3).split('/');
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
