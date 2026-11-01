import { execFileSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs-extra';
import {
    findNodeAtLocation,
    getNodeValue,
    parseTree,
    printParseErrorCode,
    type Node,
    type ParseError,
} from 'jsonc-parser';
import path from 'path';
import { getMonorepoRoot, getPnpmInvocation, log, resolveApp } from '../utils/index.js';
import {
    isSafeGitRef,
    listPreviewApps,
    planApp,
    planDeploys,
    readDeployConfig,
    watchPaths,
    type AppDeployConfig,
    type PlanEntry,
    type PlanInput,
} from './deploy-plan.js';

/**
 * `otta deploy [app]`: build and deploy an app to Cloudflare. The one deploy there is: a terminal,
 * GitHub Actions and Workers Builds all run this, and differ only in where values come from.
 *
 * From a terminal it is the whole first deploy: the Cloudflare resources the app's `wrangler.jsonc`
 * names are created when missing (`pnpm cf:setup`), the placeholders of the env block are filled with
 * their ids into `wrangler.<env>.jsonc` (gitignored), the app's workspace packages and the app are
 * built, the Worker is deployed, the secrets the app cannot run without are generated and set where
 * they are not set yet, and the fresh database is bootstrapped when an owner is given.
 *
 * With `--ci` it is the build and deploy only: nothing is created and no secret is touched;
 * placeholder values come from `--set`, the environment, and `OTTA_DEPLOY_VALUES` (one JSON object,
 * e.g. GitHub's whole secrets bag, of which only the placeholder names are taken). `#skipdeploy` in
 * the commit message deploys nothing (`--force` overrides). `--preview <id>` deploys env.preview as
 * its own Worker `<name>-<id>`; `--delete-preview <id>` removes it. `--plan` prints, as JSON, what a
 * run would deploy and why: GitHub's matrix.
 *
 *     otta deploy my-app                                   # env.production, from a terminal
 *     otta deploy my-app --env demo --set DEMO_URL=https://demo.example.com
 *     otta deploy my-app --owner-email me@example.com --owner-password '…'   # bootstraps too
 *     otta deploy my-app --ci                            # Workers Builds, GitHub Actions, any CI
 *     otta deploy --all --ci --changed-since <before-sha>  # every deployable app that changed
 *     otta deploy --all --plan --changed-since <sha>       # the same decision, as JSON
 *     otta deploy my-app --ci --preview pr-12              # a PR preview Worker
 *
 * Every step is idempotent: a second run finds the resources, keeps the secrets, and redeploys.
 */
export interface DeployOptions {
    /** The `env.<name>` block of wrangler.jsonc to deploy. Default: the app's `wranglerEnv`, else `production`. */
    env?: string;
    /** Values for placeholders the resources do not provide (`KEY=VALUE`); the environment is the fallback. */
    set?: string[];
    /** The public URL (AUTH_URL), when a custom domain fronts the Worker. Default: the workers.dev URL. */
    url?: string;
    /** Skip the app build (and so its packages): deploy what the last build left. */
    skipBuild?: boolean;
    /** Skip the workspace packages' build only. */
    skipPackages?: boolean;
    /** Bootstrap the empty database with this owner (needs `ownerPassword`). */
    ownerEmail?: string;
    ownerPassword?: string;
    ownerName?: string;
    /** Print the plan and the generated config, deploy nothing. */
    dryRun?: boolean;
    /**
     * Non-interactive build and deploy (Workers Builds, GitHub Actions, any CI): no login check, no
     * resource created, no secret set, no bootstrap. A missing value stops the run and names itself.
     */
    ci?: boolean;
    /** Stop after the build: Workers Builds' build command. Its deploy command then runs with `--skip-build`. */
    buildOnly?: boolean;
    /** Deploy only when a file the app depends on (`watchPaths`) changed since this git ref. */
    changedSince?: string;
    /** Deploy even when `#skipdeploy` is in the commit message or nothing changed. */
    force?: boolean;
    /** Deploy env.preview as the Worker `<name>-<id>` (PR previews). CI only. */
    preview?: string;
    /** Placeholder values handed over as one object (`OTTA_DEPLOY_VALUES`), before the environment. */
    values?: Record<string, string>;
}

/**
 * A command runner, so the orchestration can be tested without Cloudflare. Returns stdout. `env`, when
 * given, is the child's whole environment (the build gets the manifest's `requiresSecrets` this way).
 */
export type Exec = (
    command: string,
    args: string[],
    options: { cwd: string; silent?: boolean; env?: NodeJS.ProcessEnv },
) => string;

export interface DeployResult {
    app: string;
    env: string;
    /** The Worker deployed: `<name>-<id>` for a preview, else wrangler's name for the env. Null before a deploy. */
    workerName: string | null;
    workerUrl: string | null;
    configFile: string;
    secretsSet: string[];
    bootstrapped: boolean;
    healthy: boolean | null;
    /** Why nothing was deployed (`built`: --build-only). Null after a deploy. */
    skipped: 'unchanged' | 'skipdeploy' | 'built' | null;
}

/** The secrets the framework generates for a deployment, when the app's `.env.example` declares them. */
export const GENERATED_SECRETS = [
    'AUTH_SECRET',
    'MIGRATION_SECRET',
    'BOOTSTRAP_OWNER_SECRET',
    'CRON_SECRET',
    'AI_CREDENTIAL_SECRET',
    'BLOG_PREVIEW_SECRET',
];

/** A placeholder: a string value in ALL_CAPS_SNAKE_CASE with at least one underscore. */
const PLACEHOLDER_VALUE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;
/** Values that look like placeholders but are bindings, env names or protocol words. */
const NOT_PLACEHOLDER = ['OBCF_', 'NODE_', 'UTF', 'HTTP'];
/** Keys whose values are names the config gives things (a binding, a class), never ids to fill in. */
const NAME_KEYS = new Set(['binding', 'class_name', 'name', 'service', 'entrypoint', 'script_name']);
/** A Worker name is a DNS label on workers.dev. */
const MAX_WORKER_NAME = 63;

/**
 * How the health check waits for a fresh deploy to answer: four tries over fifteen seconds, each given
 * ten seconds, so a hung Worker cannot hold a CI job. Tests set the delay to 0.
 */
export const healthCheckTiming = { attempts: 4, delayMs: 5000, timeoutMs: 10_000 };

const defaultExec: Exec = (command, args, options) =>
    execFileSync(command, args, {
        cwd: options.cwd,
        env: options.env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', options.silent ? 'pipe' : 'inherit'],
        maxBuffer: 16 * 1024 * 1024,
    });

/** A wrangler config's syntax tree; a config that does not parse is an error naming where. */
function parseWrangler(text: string): Node {
    const errors: ParseError[] = [];
    const tree = parseTree(text, errors, { allowTrailingComma: true });
    if (!tree || errors.length) {
        const first = errors[0];
        throw new Error(
            `The wrangler config does not parse: ${first ? `${printParseErrorCode(first.error)} at character ${first.offset}` : 'it is empty'}.`,
        );
    }
    return tree;
}

/**
 * The placeholder value nodes under `node`, in document order: property values that are placeholders
 * and not names. Read from the syntax tree, so a comment is never a value and a brace or a quote inside
 * a string never shifts anything.
 */
function placeholderNodes(node: Node, found: Node[] = []): Node[] {
    if (node.type === 'property') {
        const [key, value] = node.children ?? [];
        if (!value) return found;
        if (value.type === 'string') {
            const name = String(value.value);
            if (
                PLACEHOLDER_VALUE.test(name) &&
                !NAME_KEYS.has(String(key?.value)) &&
                !NOT_PLACEHOLDER.some((prefix) => name.startsWith(prefix))
            ) {
                found.push(value);
            }
        } else {
            placeholderNodes(value, found);
        }
        return found;
    }
    for (const child of node.children ?? []) placeholderNodes(child, found);
    return found;
}

const uniqueNames = (nodes: Node[]) => [...new Set(nodes.map((node) => String(node.value)))];

/** The character range of the `env.<name>` object in a wrangler config. Null when there is no such block. */
export function envSection(text: string, env: string): { start: number; end: number } | null {
    const node = findNodeAtLocation(parseWrangler(text), ['env', env]);
    return node?.type === 'object' ? { start: node.offset, end: node.offset + node.length } : null;
}

/** The placeholder names in a wrangler config (or one block of it), in order of first appearance. */
export function findPlaceholders(text: string): string[] {
    return uniqueNames(placeholderNodes(parseWrangler(text)));
}

/**
 * Fill the placeholders of the `env.<name>` block, and only there: a placeholder shared by two env
 * blocks may stand for two different ids. `values` is a record or a lookup; each value is written as a
 * JSON string (a quote or a backslash in it cannot break the file). Returns the new text, the block's
 * placeholders and the names still without a value.
 */
export function substitutePlaceholders(
    text: string,
    env: string,
    values: Record<string, string | undefined> | ((name: string) => string | undefined),
): { content: string; placeholders: string[]; missing: string[] } {
    const block = findNodeAtLocation(parseWrangler(text), ['env', env]);
    if (block?.type !== 'object') throw new Error(`wrangler.jsonc has no env.${env} block.`);
    const valueOf = typeof values === 'function' ? values : (name: string) => values[name];
    const nodes = placeholderNodes(block);
    const placeholders = uniqueNames(nodes);
    const missing = placeholders.filter((name) => !valueOf(name));
    let content = text;
    // From the end backwards, so every earlier node's offset still holds.
    for (const node of [...nodes].sort((a, b) => b.offset - a.offset)) {
        const value = valueOf(String(node.value));
        if (value)
            content = content.slice(0, node.offset) + JSON.stringify(value) + content.slice(node.offset + node.length);
    }
    return { content, placeholders, missing };
}

/** The account id from `wrangler whoami` (a 32-hex id in its account table). */
export function parseAccountId(whoami: string): string | null {
    return /\b([0-9a-f]{32})\b/.exec(whoami)?.[1] ?? null;
}

/** The short commit of the checkout at `cwd`, or null outside git (a tarball, no git installed). */
export function shortCommit(cwd: string): string | null {
    try {
        const out = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
            cwd,
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        const sha = out.toString().trim();
        return /^[0-9a-f]{7,40}$/.test(sha) ? sha : null;
    } catch {
        return null;
    }
}

/** The first deployed URL `wrangler deploy` prints. */
export function parseDeployedUrl(output: string): string | null {
    return /https:\/\/[a-z0-9.-]+\.workers\.dev\b/i.exec(output)?.[0] ?? null;
}

/** The first custom domain route of the env block (`custom_domain: true`), as a URL: where a Worker without workers.dev answers. */
export function customDomainUrl(wranglerText: string, env: string): string | null {
    const node = findNodeAtLocation(parseWrangler(wranglerText), ['env', env, 'routes']);
    const routes = node ? (getNodeValue(node) as unknown) : null;
    if (!Array.isArray(routes)) return null;
    for (const route of routes) {
        const { pattern, custom_domain } = (route ?? {}) as { pattern?: unknown; custom_domain?: unknown };
        if (custom_domain === true && typeof pattern === 'string' && /^[a-z0-9.-]+$/i.test(pattern)) {
            return `https://${pattern}`;
        }
    }
    return null;
}

/** The top-level `name` of a wrangler config: the base of every Worker name it deploys. */
export function wranglerName(wranglerText: string): string | null {
    const node = findNodeAtLocation(parseWrangler(wranglerText), ['name']);
    return node?.type === 'string' && node.value ? String(node.value) : null;
}

/** The Worker a preview deploys to: `<name>-<id>`, a valid Worker name or an error that says why not. */
export function previewWorkerName(baseName: string, id: string): string {
    // A DNS label: lowercase letters, digits and dashes, never a dash at either end.
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(id)) {
        throw new Error(`--preview "${id}": use lowercase letters, digits and inner dashes (pr-12).`);
    }
    const name = `${baseName}-${id}`;
    if (name.length > MAX_WORKER_NAME) {
        throw new Error(`--preview "${id}": the Worker name ${name} is longer than ${MAX_WORKER_NAME} characters.`);
    }
    return name;
}

/** The generated secrets this app declares in its `.env.example`, in the order the framework lists them. */
export function generatedSecretNames(envExample: string): string[] {
    const declared = new Set([...envExample.matchAll(/^([A-Z][A-Z0-9_]*)\s*=/gm)].map((m) => m[1]));
    return GENERATED_SECRETS.filter((name) => declared.has(name));
}

/** 32 random url-safe characters: the same shape `pnpm env:secrets` writes. */
export function randomSecret(): string {
    return crypto.randomBytes(24).toString('base64url');
}

/** `KEY=VALUE` pairs into a record; refuses a pair without a key. */
export function parseSetOptions(pairs: string[] = []): Record<string, string> {
    const values: Record<string, string> = {};
    for (const pair of pairs) {
        const at = pair.indexOf('=');
        if (at <= 0) throw new Error(`--set expects KEY=VALUE, got "${pair}".`);
        values[pair.slice(0, at)] = pair.slice(at + 1);
    }
    return values;
}

/**
 * `OTTA_DEPLOY_VALUES`: placeholder values CI hands over as one JSON object (GitHub's `toJson(secrets)`).
 * Only string values are kept; which of them are used is decided by the env block's placeholders.
 */
export function parseDeployValues(json: string | undefined): Record<string, string> {
    if (!json) return {};
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        throw new Error('OTTA_DEPLOY_VALUES is not JSON (expected an object of NAME: value).');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('OTTA_DEPLOY_VALUES must be a JSON object of NAME: value.');
    }
    return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).filter(
            (pair): pair is [string, string] => typeof pair[1] === 'string',
        ),
    );
}

const last = (output: string) => output.trim().split('\n').at(-1) ?? '';

/** The commit CI says it is building, when git cannot tell (Workers Builds, GitHub Actions, GitLab). */
export function ciCommit(env: NodeJS.ProcessEnv = process.env): string | null {
    // `||`, not `??`: a CI that sets one variable empty must not hide the next.
    const sha = env.WORKERS_CI_COMMIT_SHA || env.GITHUB_SHA || env.CI_COMMIT_SHA || '';
    return /^[0-9a-f]{7,40}$/.test(sha) ? sha.slice(0, 7) : null;
}

/**
 * Files changed since `ref`, relative to `root` (which need not be the git top level). Compared with
 * the working tree, which is what gets built, so an uncommitted edit counts locally; CI has none.
 * Null when git cannot answer (a shallow clone, the all-zero "before" of a first push).
 *
 * `-z`: NUL-separated and never quoted, so a path with a space or a non-ASCII letter still matches its
 * watch path. `--no-renames`: a file moved out of an app shows as deleted there, not only as added
 * elsewhere, so the app it left counts as changed.
 */
export function changedFiles(exec: Exec, root: string, ref: string): string[] | null {
    if (!isSafeGitRef(ref)) throw new Error(`--changed-since: "${ref}" is not a git ref.`);
    try {
        return exec('git', ['diff', '--name-only', '--no-renames', '--relative', '-z', ref], {
            cwd: root,
            silent: true,
        })
            .split('\0')
            .filter(Boolean);
    } catch {
        return null;
    }
}

/** HEAD's commit message, for `#skipdeploy`. Null when git cannot say. */
export function headCommitMessage(exec: Exec, root: string): string | null {
    try {
        return exec('git', ['log', '-1', '--format=%B'], { cwd: root, silent: true });
    } catch {
        return null;
    }
}

/**
 * What the plan needs from git, asked once per run however many apps it covers: the changed files
 * (with `--changed-since`) and, in CI unless forced, the commit message.
 */
function planInput(root: string, options: DeployOptions, exec: Exec, checkSkipDeploy: boolean): PlanInput {
    return {
        preview: Boolean(options.preview),
        changedSince: options.force ? undefined : options.changedSince,
        changed: options.changedSince && !options.force ? changedFiles(exec, root, options.changedSince) : undefined,
        commitMessage: checkSkipDeploy && !options.force ? headCommitMessage(exec, root) : null,
    };
}

/** The turbo launcher of the workspace, run with node so no shell sees the `^` of a filter. */
function turboBin(root: string): string | null {
    const bin = path.join(root, 'node_modules', 'turbo', 'bin', 'turbo');
    return fs.existsSync(bin) ? bin : null;
}

function runPnpm(exec: Exec, root: string, args: string[], silent = false, env?: NodeJS.ProcessEnv): string {
    const invocation = getPnpmInvocation(args);
    return exec(invocation.command, invocation.args, { cwd: root, silent, env });
}

/** Build the workspace packages these apps use, and only those, in one turbo run. */
function buildWorkspacePackages(root: string, packageNames: string[], exec: Exec): void {
    const turbo = turboBin(root);
    if (turbo) {
        exec(process.execPath, [turbo, 'run', 'build', ...packageNames.map((name) => `--filter=${name}^...`)], {
            cwd: root,
        });
    } else {
        runPnpm(exec, root, ['build:pkg']);
    }
}

function appPackageName(root: string, appName: string): string {
    const pkg = fs.readJsonSync(path.join(root, 'apps', appName, 'package.json')) as { name?: string };
    return pkg.name ?? `@ottabase/${appName}`;
}

/** What a missing build output usually means, by app type. */
const BUILD_HINTS: Record<AppDeployConfig['appType'], string> = {
    vite: 'a Vite app builds dist/ and keeps cloudflare-worker.ts as its entry: check vite.config.ts and the build script',
    nextjs: 'an OpenNext app needs next build (.next/) and then its worker build (.open-next/): check open-next.config.ts and @opennextjs/cloudflare',
    custom: 'check the scripts cloudflare-config.json names (buildCommand, workerBuildCommand)',
};

/** Deploy `appName` to Cloudflare. `exec` and `fetchFn` are injectable for tests. */
export async function deployApp(
    root: string,
    appName: string,
    options: DeployOptions = {},
    exec: Exec = defaultExec,
    fetchFn: typeof fetch = fetch,
): Promise<DeployResult> {
    const appDir = path.join(root, 'apps', appName);
    if (!fs.existsSync(path.join(appDir, 'package.json'))) throw new Error(`apps/${appName} has no package.json.`);
    const config = readDeployConfig(appDir);
    if (options.preview && !options.ci) throw new Error('--preview is for CI: add --ci.');
    if (options.buildOnly && !options.ci) {
        throw new Error("--build-only is for CI (Workers Builds' build command): add --ci, or run otta deploy alone.");
    }
    if (options.preview && !config.previewDeployable) {
        throw new Error(`apps/${appName}: cloudflare-config.json says previewDeployable: false.`);
    }
    const env = options.preview ? 'preview' : (options.env ?? config.wranglerEnv);
    if (!/^[a-z][a-z0-9-]*$/.test(env)) throw new Error(`"${env}" is not a Wrangler env name.`);
    const wranglerFile = path.join(appDir, config.wranglerConfig);
    if (!fs.existsSync(wranglerFile)) throw new Error(`apps/${appName} has no ${config.wranglerConfig}.`);
    const source = fs.readFileSync(wranglerFile, 'utf8');
    const previewName = options.preview ? previewWorkerName(wranglerName(source) ?? appName, options.preview) : null;
    const pkg = fs.readJsonSync(path.join(appDir, 'package.json')) as {
        name?: string;
        scripts?: Record<string, string>;
    };
    const packageName = pkg.name ?? `@ottabase/${appName}`;
    for (const script of [config.buildCommand, config.workerBuildCommand]) {
        if (script && !options.skipBuild && !pkg.scripts?.[script]) {
            throw new Error(
                `apps/${appName}/package.json has no "${script}" script (cloudflare-config.json names it).`,
            );
        }
    }
    const wranglerBin = path.join(appDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
    if (!fs.existsSync(wranglerBin)) throw new Error(`wrangler is not installed in apps/${appName}: run pnpm install.`);
    const wrangler = (args: string[], silent = false) =>
        exec(process.execPath, [wranglerBin, ...args], { cwd: appDir, silent });
    const pnpm = (args: string[], silent = false) => runPnpm(exec, root, args, silent);
    const configName = `wrangler.${env}.jsonc`;
    const configFile = path.join(appDir, configName);
    const result: DeployResult = {
        app: appName,
        env,
        workerName: previewName,
        workerUrl: null,
        configFile,
        secretsSet: [],
        bootstrapped: false,
        healthy: null,
        skipped: null,
    };

    // 0. Anything to deploy? `#skipdeploy` (CI), and with --changed-since a file the app depends on.
    if (!options.force && (options.ci || options.changedSince)) {
        const entry = planApp(root, appName, planInput(root, options, exec, Boolean(options.ci)));
        if (!entry.deploy) {
            log.step(`${appName}: not deployed (${entry.reason})`);
            result.skipped = entry.skip === 'skipdeploy' ? 'skipdeploy' : 'unchanged';
            return result;
        }
    }

    // 1. Who am I. CI has no login: the account id comes with the values, the token is wrangler's.
    //    A value is looked up in --set, then the values bag, then the environment; empty is no value.
    const setValues = parseSetOptions(options.set);
    const lookup = (name: string) => setValues[name] || options.values?.[name] || process.env[name] || undefined;
    let accountId: string | null = null;
    if (options.ci) {
        accountId = lookup('CLOUDFLARE_ACCOUNT_ID')?.trim() || null;
    } else {
        // The account id fills CLOUDFLARE_ACCOUNT_ID, and a failure here means "log in first".
        log.step('Cloudflare account');
        let whoami = '';
        try {
            whoami = wrangler(['whoami'], true);
        } catch {
            throw new Error('Not logged in to Cloudflare. Run: pnpm cf:login');
        }
        accountId = parseAccountId(whoami);
        if (!accountId)
            throw new Error('Not logged in to Cloudflare (wrangler whoami shows no account). Run: pnpm cf:login');
        log.dim(`  account ${accountId}`);
    }

    // 2. The resources the env block names, created when missing; their ids keyed by placeholder name.
    //    CI creates nothing: the ids are values it is given.
    let ids: Record<string, string> = {};
    if (!options.ci) {
        log.step(`Cloudflare resources for env.${env}`);
        const setupArgs = ['cf:setup', '--', '--force', '--json', `--app=${appName}`, `--env=${env}`];
        if (!options.dryRun) {
            const answer = last(pnpm(setupArgs, true));
            try {
                ids = JSON.parse(answer) as Record<string, string>;
            } catch {
                throw new Error(
                    `pnpm cf:setup did not end with the resource ids as JSON (its last line: ${answer.slice(0, 200)}).`,
                );
            }
        }
        for (const [name, id] of Object.entries(ids)) log.dim(`  ${name} = ${id}`);
    }

    // 3. The config for this deploy: the env block with its placeholders filled (--set first, then the
    //    ids the resources have, the account, the values). In CI every name the run needs is checked
    //    here, before any build, and all the missing ones are named at once.
    const { content, placeholders, missing } = substitutePlaceholders(
        source,
        env,
        (name) => setValues[name] || ids[name] || (name === 'CLOUDFLARE_ACCOUNT_ID' ? accountId : null) || lookup(name),
    );
    const buildSecretNames = options.preview ? config.requiresPreviewSecrets : config.requiresSecrets;
    const required = options.ci
        ? [
              // Wrangler reads its token from the environment only, so that is where it must be.
              ...(process.env.WORKERS_CI || options.dryRun || process.env.CLOUDFLARE_API_TOKEN
                  ? []
                  : ['CLOUDFLARE_API_TOKEN']),
              ...buildSecretNames.filter((name) => !lookup(name) && !missing.includes(name)),
          ]
        : [];
    const absent = [...missing, ...required];
    if (absent.length && !options.dryRun) {
        throw new Error(
            options.ci
                ? `No value for ${absent.join(', ')} (env.${env} of apps/${appName}). Set ${absent.length > 1 ? 'them' : 'it'} in the CI's variables or secrets (or --set ${absent[0]}=<value>).`
                : `No value for ${absent.join(', ')} in env.${env}. Pass --set ${absent[0]}=<value> or set it in the environment.`,
        );
    }
    log.step(`${configName}: ${placeholders.length - missing.length} of ${placeholders.length} placeholder(s) filled`);
    const buildPackages = !options.skipPackages && !options.skipBuild;
    const buildSteps = [
        ...(buildPackages ? [`the workspace packages ${appName} uses`] : []),
        ...(options.skipBuild
            ? []
            : [`${appName} (${[config.buildCommand, config.workerBuildCommand].filter(Boolean).join(', then ')})`]),
    ];
    if (options.dryRun) {
        log.dim(`  would write apps/${appName}/${configName}${absent.length ? `; missing ${absent.join(', ')}` : ''}`);
        if (buildSteps.length) log.dim(`  would build ${buildSteps.join(', then ')}`);
        if (!options.buildOnly) {
            log.dim(
                `  would deploy env.${env}${previewName ? ` as ${previewName}` : ''}${options.ci ? '' : ', set the missing secrets'}`,
            );
        }
        return result;
    }
    fs.writeFileSync(configFile, content);

    // 4. Build: the app's workspace packages (only those), the app, its Worker bundle.
    if (buildPackages) {
        log.step(`Building the workspace packages ${appName} uses`);
        buildWorkspacePackages(root, [packageName], exec);
    }
    if (!options.skipBuild) {
        // The build sees the names the manifest asks for (a source map upload token, …) and no other
        // value: the rest of a values bag never reaches a build script.
        const handed = Object.fromEntries(
            buildSecretNames.map((name) => [name, lookup(name)]).filter((pair): pair is [string, string] => !!pair[1]),
        );
        const buildEnv = Object.keys(handed).length ? { ...process.env, ...handed } : undefined;
        log.step(`Building ${appName}`);
        runPnpm(exec, root, ['--filter', packageName, 'run', config.buildCommand], false, buildEnv);
        if (config.workerBuildCommand) {
            log.step(`Building the Worker (${config.workerBuildCommand})`);
            runPnpm(exec, root, ['--filter', packageName, 'run', config.workerBuildCommand], false, buildEnv);
        }
    }
    const notBuilt = config.verifyPaths.filter((p) => !fs.existsSync(path.join(appDir, p)));
    if (notBuilt.length) {
        const present = fs
            .readdirSync(appDir)
            .filter((entry) => entry !== 'node_modules')
            .sort();
        throw new Error(
            `The build left no ${notBuilt.join(', ')} in apps/${appName} (cloudflare-config.json verifyPaths): ` +
                `${BUILD_HINTS[config.appType]}. apps/${appName} has: ${present.join(', ')}.`,
        );
    }
    if (options.buildOnly) {
        log.success(`${appName} built; deploy with --skip-build`);
        result.skipped = 'built';
        return result;
    }

    // 5. Deploy. A preview is its own Worker (`--name`): wrangler would otherwise deploy `<name>-preview`,
    //    and --delete-preview removes exactly this name.
    log.step(`Deploying env.${env}${previewName ? ` as ${previewName}` : ''}`);
    // Tag the version with the short commit, which the Worker reads back through its version
    // metadata binding (readiness and the Fleet report show it). Outside a git checkout, CI's own
    // commit variable; with neither, no tag.
    const tag = shortCommit(appDir) ?? ciCommit();
    const deployed = wrangler(
        [
            'deploy',
            '--env',
            env,
            ...(previewName ? ['--name', previewName] : []),
            '--config',
            configName,
            ...(tag ? ['--tag', tag] : []),
        ],
        true,
    );
    console.log(deployed.trim());
    result.workerUrl = options.url ?? parseDeployedUrl(deployed) ?? customDomainUrl(content, env);
    if (result.workerUrl) log.success(result.workerUrl);

    // 6. Secrets: generated once, kept afterwards. AUTH_URL is the Worker's public URL. CI never
    //    touches them: they are set once, by a first `otta deploy` or by hand.
    if (options.ci) {
        await healthCheck(fetchFn, result, config.healthCheckPath);
        return result;
    }
    log.step('Secrets');
    let existing = new Set<string>();
    try {
        const listed = JSON.parse(wrangler(['secret', 'list', '--env', env, '--config', configName], true)) as {
            name: string;
        }[];
        existing = new Set(listed.map((secret) => secret.name));
    } catch {
        // A brand-new Worker may answer with nothing listable yet: every secret is then missing, which is right.
    }
    const envExample = fs.existsSync(path.join(appDir, '.env.example'))
        ? fs.readFileSync(path.join(appDir, '.env.example'), 'utf8')
        : '';
    const wanted: Record<string, string> = {};
    for (const name of generatedSecretNames(envExample)) if (!existing.has(name)) wanted[name] = randomSecret();
    if (result.workerUrl && !existing.has('AUTH_URL')) wanted.AUTH_URL = result.workerUrl;
    const bootstrapSecret = wanted.BOOTSTRAP_OWNER_SECRET;
    if (Object.keys(wanted).length) {
        const bulkFile = path.join(appDir, '.wrangler', `otta-secrets-${process.pid}.json`);
        // Owner-only while it exists: it holds the secrets in clear for the length of one wrangler call.
        fs.outputJsonSync(bulkFile, wanted, { mode: 0o600 });
        try {
            wrangler(['secret', 'bulk', bulkFile, '--env', env, '--config', configName], true);
        } finally {
            fs.removeSync(bulkFile);
        }
        result.secretsSet = Object.keys(wanted);
        log.dim(`  set ${result.secretsSet.join(', ')}`);
    } else {
        log.dim('  every generated secret is already set');
    }

    // 7. Bootstrap the empty database, when the owner is given and the secret is ours to use.
    if (options.ownerEmail && options.ownerPassword && result.workerUrl) {
        if (!bootstrapSecret) {
            log.warn(
                'BOOTSTRAP_OWNER_SECRET was set before this run, so its value is not known here: bootstrap at /__bootstrap__ with it.',
            );
        } else {
            log.step('Bootstrapping');
            result.bootstrapped = await bootstrap(fetchFn, result.workerUrl, bootstrapSecret, {
                email: options.ownerEmail,
                password: options.ownerPassword,
                name: options.ownerName ?? options.ownerEmail.split('@')[0],
            });
        }
    }

    // 8. Health.
    await healthCheck(fetchFn, result, config.healthCheckPath);

    if (bootstrapSecret && !result.bootstrapped && result.workerUrl) {
        log.next(`open ${result.workerUrl}/__bootstrap__?secret=${bootstrapSecret} to create the tables and the owner`);
        log.dim('  (the secret is BOOTSTRAP_OWNER_SECRET, shown once; it is stored only as the Worker secret)');
    }
    return result;
}

/**
 * GET the app's health path on the deployed URL, retrying while a fresh deploy propagates. Any answer
 * below 400 passes (a redirect to a sign-in page is a live Worker). Records the answer, never throws.
 */
async function healthCheck(fetchFn: typeof fetch, result: DeployResult, healthPath: string): Promise<void> {
    if (!result.workerUrl) {
        log.warn('health check skipped: wrangler printed no workers.dev URL and no custom domain route: pass --url');
        return;
    }
    const url = `${result.workerUrl.replace(/\/+$/, '')}${healthPath}`;
    let answer = '';
    for (let attempt = 1; attempt <= healthCheckTiming.attempts; attempt++) {
        try {
            const response = await fetchFn(url, {
                redirect: 'manual',
                signal: AbortSignal.timeout(healthCheckTiming.timeoutMs),
            });
            if (response.status < 400) {
                result.healthy = true;
                log.success(`health ${response.status}: ${url}`);
                return;
            }
            answer = `HTTP ${response.status}`;
        } catch (error) {
            answer = error instanceof Error ? error.message : String(error);
        }
        if (attempt < healthCheckTiming.attempts) {
            await new Promise((resolve) => setTimeout(resolve, healthCheckTiming.delayMs));
        }
    }
    result.healthy = false;
    log.warn(`health check: ${url} answered ${answer} after ${healthCheckTiming.attempts} attempt(s)`);
}

/** The four bootstrap calls in order, each idempotent on the Worker side. False when one refused. */
export async function bootstrap(
    fetchFn: typeof fetch,
    baseUrl: string,
    secret: string,
    owner: { email: string; password: string; name: string },
): Promise<boolean> {
    const headers = { 'X-Bootstrap-Secret': secret, 'Content-Type': 'application/json' };
    const call = async (route: string, body?: unknown) => {
        const response = await fetchFn(`${baseUrl}/__bootstrap__/api/${route}`, {
            method: 'POST',
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });
        const text = await response.text();
        // 409 ALREADY_READY on init, or an owner that already exists: the platform is past that step.
        if (response.ok || response.status === 409) {
            log.dim(`  ${route}: ${response.status}`);
            return true;
        }
        log.error(`${route}: ${response.status} ${text.slice(0, 200)}`);
        return false;
    };
    const status = await fetchFn(`${baseUrl}/__bootstrap__/api/status`, { headers });
    if (status.ok) {
        const state = (await status.json()) as { state?: string };
        if (state.state === 'READY') {
            log.dim('  already READY');
            return true;
        }
    }
    for (const step of [
        () => call('init'),
        () => call('seed'),
        () => call('create-owner', owner),
        () => call('finalize'),
    ]) {
        if (!(await step())) return false;
    }
    return true;
}

/** Remove the preview Worker `<name>-<id>` of an app. An absent Worker is not an error: false, warned. */
export function deletePreview(root: string, appName: string, id: string, exec: Exec = defaultExec): boolean {
    const appDir = path.join(root, 'apps', appName);
    const config = readDeployConfig(appDir);
    const source = fs.readFileSync(path.join(appDir, config.wranglerConfig), 'utf8');
    const name = previewWorkerName(wranglerName(source) ?? appName, id);
    const wranglerBin = path.join(appDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
    if (!fs.existsSync(wranglerBin)) throw new Error(`wrangler is not installed in apps/${appName}: run pnpm install.`);
    log.step(`Deleting the preview Worker ${name}`);
    try {
        // --name, never --env: a preview is deployed under its own name, not as an env of the app.
        exec(process.execPath, [wranglerBin, 'delete', '--name', name], { cwd: appDir, silent: true });
        log.success(`${name} deleted`);
        return true;
    } catch (error) {
        log.warn(`${name}: not deleted (${error instanceof Error ? error.message.split('\n')[0] : String(error)})`);
        return false;
    }
}

/**
 * `--delete-preview <id>` for several apps (`--all`: every app whose manifest allows previews, deployable
 * or not, so a preview made before an app left CI is still cleaned up). One app's error is reported
 * on its line; the others are still cleaned up.
 */
export function deletePreviews(root: string, apps: string[], id: string, exec: Exec = defaultExec): ReportRow[] {
    return apps.map((app) => {
        try {
            return { app, outcome: deletePreview(root, app, id, exec) ? 'preview deleted' : 'no preview to delete' };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log.error(`${app}: ${message}`);
            return { app, outcome: `failed: ${message.split('\n')[0]}` };
        }
    });
}

export interface DeployCommandOptions extends DeployOptions {
    /** Every app whose cloudflare-config.json does not say `deployable: false`. */
    all?: boolean;
    /** Print the app's watch paths (what its deploy depends on), one per line, and deploy nothing. */
    watchPaths?: boolean;
    /** Print what this run would deploy and why, as JSON (`{ "include": [{ app, reason }] }`), and deploy nothing. */
    plan?: boolean;
    /** Delete the preview Worker `<name>-<id>` (of the app, or with --all of every app). */
    deletePreview?: string;
}

/** One line of the run's report: the terminal's last lines and GitHub's step summary. */
export interface ReportRow {
    app: string;
    outcome: string;
    url?: string | null;
}

/** `otta deploy --all`: plan once, build the packages once, then each app in turn; one failure does not stop the others. */
export async function deployAll(
    root: string,
    options: DeployOptions,
    exec: Exec = defaultExec,
    fetchFn: typeof fetch = fetch,
): Promise<DeployResult[]> {
    const plan = planDeploys(root, planInput(root, options, exec, Boolean(options.ci)));
    if (!plan.length) throw new Error('No app has a cloudflare-config.json: there is nothing to deploy.');
    for (const entry of plan) log.dim(`  ${entry.app}: ${entry.deploy ? 'deploy' : 'skip'} (${entry.reason})`);
    const apps = plan.filter((entry) => entry.deploy).map((entry) => entry.app);
    const rows: ReportRow[] = plan
        .filter((entry) => !entry.deploy)
        .map((entry) => ({ app: entry.app, outcome: `skipped: ${entry.reason}` }));
    const results: DeployResult[] = [];
    const failed: string[] = [];
    if (apps.length && !options.skipPackages && !options.skipBuild && !options.dryRun) {
        log.step(`Building the workspace packages ${apps.join(', ')} use`);
        try {
            buildWorkspacePackages(
                root,
                apps.map((app) => appPackageName(root, app)),
                exec,
            );
        } catch (error) {
            // A package that does not build fails every app that uses it: say so once, deploy nothing.
            throw new Error(
                `The workspace packages did not build: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }
    for (const app of apps) {
        console.log('');
        log.step(`── ${app}`);
        try {
            // Planned above: the plan's decision stands, and the packages are built.
            const result = await deployApp(
                root,
                app,
                { ...options, force: true, changedSince: undefined, skipPackages: true },
                exec,
                fetchFn,
            );
            results.push(result);
            rows.push(reportRow(result, options));
        } catch (error) {
            failed.push(app);
            const message = error instanceof Error ? error.message : String(error);
            log.error(`${app}: ${message}`);
            rows.push({ app, outcome: `failed: ${message.split('\n')[0]}` });
        }
    }
    console.log('');
    for (const row of rows.sort((a, b) => a.app.localeCompare(b.app))) {
        log.dim(`  ${row.app}: ${row.outcome}${row.url ? ` ${row.url}` : ''}`);
    }
    writeStepSummary(rows);
    if (failed.length) throw new Error(`${failed.length} of ${apps.length} app(s) failed: ${failed.join(', ')}.`);
    return results;
}

function reportRow(result: DeployResult, options: DeployOptions): ReportRow {
    const outcome =
        result.skipped === 'built'
            ? 'built'
            : result.skipped
              ? `skipped: ${result.skipped}`
              : options.dryRun
                ? 'planned (dry run)'
                : `deployed env.${result.env}${result.workerName ? ` as ${result.workerName}` : ''}${result.healthy === false ? ', health check failed' : ''}`;
    return { app: result.app, outcome, url: result.workerUrl };
}

/** Append the run's report to GitHub's job summary when there is one. Never fails the run. */
function writeStepSummary(rows: ReportRow[]): void {
    const file = process.env.GITHUB_STEP_SUMMARY;
    if (!file || !rows.length) return;
    const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const lines = [
        '| App | Outcome | URL |',
        '| --- | --- | --- |',
        ...rows.map((row) => `| ${cell(row.app)} | ${cell(row.outcome)} | ${row.url ? cell(row.url) : ''} |`),
    ];
    try {
        fs.appendFileSync(file, `${lines.join('\n')}\n`);
    } catch {
        // A summary is a convenience.
    }
}

/** The flag combinations that mean nothing, refused before anything runs. */
function checkCombination(appName: string | undefined, options: DeployCommandOptions): void {
    const refuse = (message: string) => {
        throw new Error(message);
    };
    if (options.all && appName) refuse('Pass an app or --all, not both.');
    if (options.watchPaths && options.all) refuse('--watch-paths takes one app.');
    // One URL or one owner for every app would set the same AUTH_URL / owner on all of them.
    if (options.all && (options.url || options.ownerEmail)) refuse('--url and --owner-email take one app, not --all.');
    if (options.preview && options.env) refuse('--preview deploys env.preview: drop --env.');
    if (options.preview && options.deletePreview) refuse('Pass --preview or --delete-preview, not both.');
    if (options.preview && !options.ci && !options.plan) refuse('--preview is for CI: add --ci.');
    if (options.buildOnly && !options.ci) {
        refuse("--build-only is for CI (Workers Builds' build command): add --ci, or run otta deploy alone.");
    }
    if (options.buildOnly && options.skipBuild) refuse('--build-only with --skip-build would build nothing.');
}

/** `otta deploy [app]`. */
export async function deployCommand(
    appName: string | undefined,
    options: DeployCommandOptions = {},
    exec: Exec = defaultExec,
    fetchFn: typeof fetch = fetch,
): Promise<DeployResult[]> {
    checkCombination(appName, options);
    const root = getMonorepoRoot();

    if (options.plan) {
        // Machine output: the JSON alone on stdout, the reasons on stderr.
        const input = planInput(root, options, exec, true);
        const entries: PlanEntry[] = options.all
            ? planDeploys(root, input)
            : [planApp(root, resolveApp(appName).name, input)];
        for (const entry of entries)
            console.error(`${entry.app}: ${entry.deploy ? 'deploy' : 'skip'} (${entry.reason})`);
        const include = entries.filter((entry) => entry.deploy).map(({ app, reason }) => ({ app, reason }));
        process.stdout.write(`${JSON.stringify({ include })}\n`);
        return [];
    }

    if (options.deletePreview) {
        const apps = options.all ? listPreviewApps(root) : [resolveApp(appName).name];
        const rows = deletePreviews(root, apps, options.deletePreview, exec);
        writeStepSummary(rows);
        log.done(
            `preview ${options.deletePreview}: ${rows.filter((r) => r.outcome === 'preview deleted').length} of ${rows.length} deleted.`,
        );
        const failed = rows.filter((row) => row.outcome.startsWith('failed'));
        if (failed.length) throw new Error(`Cleanup failed for ${failed.map((row) => row.app).join(', ')}.`);
        return [];
    }

    if (options.all) {
        const results = await deployAll(root, options, exec, fetchFn);
        log.done(`${results.length} app(s) done.`);
        return results;
    }

    const app = resolveApp(appName);
    if (options.watchPaths) {
        for (const glob of watchPaths(root, app.name)) console.log(glob);
        return [];
    }
    let result: DeployResult;
    try {
        result = await deployApp(root, app.name, options, exec, fetchFn);
    } catch (error) {
        // The job summary says why too, not only the log.
        const message = error instanceof Error ? error.message : String(error);
        writeStepSummary([{ app: app.name, outcome: `failed: ${message.split('\n')[0]}` }]);
        throw error;
    }
    writeStepSummary([reportRow(result, options)]);
    console.log('');
    if (options.dryRun) {
        log.done(`dry run for ${app.name}, env.${result.env}; nothing deployed.`);
        return [result];
    }
    if (result.skipped === 'unchanged' || result.skipped === 'skipdeploy') {
        log.done(`${app.name}: nothing deployed.`);
        return [result];
    }
    if (result.skipped === 'built') {
        log.done(`${app.name} built for env.${result.env}.`);
        return [result];
    }
    log.done(
        `${app.name} deployed to env.${result.env}${result.workerName ? ` as ${result.workerName}` : ''}${result.workerUrl ? ` at ${result.workerUrl}` : ''}.`,
    );
    if (result.healthy === false)
        log.failed('the health check did not answer below 400; see the Worker logs (wrangler tail)');
    if (options.ci) return [result];
    log.next('');
    const next = [];
    if (!result.bootstrapped)
        next.push(
            `Bootstrap at ${result.workerUrl ?? '<worker url>'}/__bootstrap__ (or rerun with --owner-email and --owner-password)`,
        );
    next.push(
        'Set the secrets that are yours: OAuth client ids, EMAIL_* (wrangler secret put <NAME> --env ' +
            result.env +
            ')',
    );
    next.push(
        'Point a custom domain at the Worker (Cloudflare → Workers → Domains), then rerun with --url https://your.domain',
    );
    next.forEach((step, index) => log.dim(`  ${index + 1}. ${step}`));
    return [result];
}
