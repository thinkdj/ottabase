import { execFileSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { getMonorepoRoot, getPnpmInvocation, log, resolveApp } from '../utils/index.js';
import {
    isAffected,
    isSafeGitRef,
    listDeployableApps,
    nestedCheckouts,
    readDeployConfig,
    watchPaths,
} from './deploy-plan.js';

/**
 * `otta deploy [app]`: build and deploy an app to Cloudflare, from a terminal or from CI.
 *
 * From a terminal it is the whole first deploy: the Cloudflare resources the app's `wrangler.jsonc`
 * names are created when missing (`pnpm cf:setup`), the placeholders of the env block are filled with
 * their ids into `wrangler.<env>.jsonc` (gitignored), the app's workspace packages and the app are
 * built, the Worker is deployed, the secrets the app cannot run without are generated and set where
 * they are not set yet, and the fresh database is bootstrapped when an owner is given.
 *
 * With `--ci` it is the build and deploy only, for Workers Builds or any CI: nothing is created and no
 * secret is touched; placeholder values come from `--set` and the environment. How the app builds (and
 * which env it deploys) comes from its `cloudflare-config.json`; which packages build comes from its
 * workspace dependencies; `--changed-since` skips a deploy nothing it depends on has changed for.
 *
 *     otta deploy my-app                                   # env.production
 *     otta deploy my-app --env demo --set DEMO_URL=https://demo.example.com
 *     otta deploy my-app --owner-email me@example.com --owner-password '…'   # bootstraps too
 *     otta deploy my-app --ci                              # in Workers Builds or CI
 *     otta deploy --all --ci --changed-since origin/main~1 # every deployable app that changed
 *
 * Every step is idempotent: a second run finds the resources, keeps the secrets, and redeploys.
 */
export interface DeployOptions {
    /** The `env.<name>` block of wrangler.jsonc to deploy. Default: the app's `wranglerEnv`, else `production`. */
    env?: string;
    /** Values for placeholders the resources do not provide (`KEY=VALUE`); `process.env` is the fallback. */
    set?: string[];
    /** Reuse the app's build output. */
    skipBuild?: boolean;
    /** Do not rebuild the workspace packages first. */
    skipPackages?: boolean;
    /** The public URL (`AUTH_URL`), when the Worker is reached through a custom domain. Default: the workers.dev URL. */
    url?: string;
    /** With both, the empty database is bootstrapped: tables, roles, this owner, READY. */
    ownerEmail?: string;
    ownerPassword?: string;
    ownerName?: string;
    /** Print the plan and the generated config, deploy nothing. */
    dryRun?: boolean;
    /**
     * Non-interactive build and deploy (Workers Builds, any CI): no login check, no resource created, no
     * secret set, no bootstrap. Placeholders take their values from `--set` and the environment,
     * `CLOUDFLARE_ACCOUNT_ID` included; a missing one stops the run and names itself.
     */
    ci?: boolean;
    /** Stop after the build: Workers Builds' build command. Its deploy command then runs with `--skip-build`. */
    buildOnly?: boolean;
    /** Deploy only when a file the app depends on (`watchPaths`) changed since this git ref. */
    changedSince?: string;
}

/** A command runner, so the orchestration can be tested without Cloudflare. Returns stdout. */
export type Exec = (command: string, args: string[], options: { cwd: string; silent?: boolean }) => string;

export interface DeployResult {
    app: string;
    env: string;
    workerUrl: string | null;
    configFile: string;
    secretsSet: string[];
    bootstrapped: boolean;
    healthy: boolean | null;
    /** Why nothing was deployed: `unchanged` (--changed-since), `built` (--build-only). Null after a deploy. */
    skipped: 'unchanged' | 'built' | null;
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

/** A JSON string value in ALL_CAPS_SNAKE_CASE with at least one underscore, and its key: a placeholder candidate. */
const PLACEHOLDER = /"([^"\\]+)"\s*:\s*"([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)"/g;
/** Values that look like placeholders but are bindings, env names or protocol words. */
const NOT_PLACEHOLDER = ['OBCF_', 'NODE_', 'UTF', 'HTTP'];
/** Keys whose values are names the config gives things (a binding, a class), never ids to fill in. */
const NAME_KEYS = new Set(['binding', 'class_name', 'name', 'service', 'entrypoint', 'script_name']);

const defaultExec: Exec = (command, args, options) =>
    execFileSync(command, args, {
        cwd: options.cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', options.silent ? 'pipe' : 'inherit'],
        maxBuffer: 16 * 1024 * 1024,
    });

/** The character range of the `env.<name>` object in a wrangler.jsonc text, by brace matching. Null when absent. */
export function envSection(text: string, env: string): { start: number; end: number } | null {
    const envKey = text.search(/"env"\s*:\s*\{/);
    if (envKey < 0) return null;
    const target = new RegExp(`"${env}"\\s*:\\s*\\{`).exec(text.slice(envKey));
    if (!target) return null;
    const start = envKey + target.index + target[0].length - 1;
    let depth = 0;
    let inString = false;
    for (let i = start; i < text.length; i++) {
        const char = text[i];
        if (inString) {
            if (char === '\\') i++;
            else if (char === '"') inString = false;
            continue;
        }
        if (char === '"') inString = true;
        else if (char === '/' && text[i + 1] === '/') i = text.indexOf('\n', i);
        else if (char === '{') depth++;
        else if (char === '}' && --depth === 0) return { start, end: i + 1 };
    }
    return null;
}

/** The placeholder names in a text, in order of first appearance. */
export function findPlaceholders(text: string): string[] {
    const found: string[] = [];
    for (const match of text.matchAll(PLACEHOLDER)) {
        const [, key, name] = match;
        if (NAME_KEYS.has(key) || found.includes(name)) continue;
        if (!NOT_PLACEHOLDER.some((prefix) => name.startsWith(prefix))) found.push(name);
    }
    return found;
}

/**
 * Fill the placeholders of the `env.<name>` block with `values`, and only there: a placeholder shared
 * by two env blocks may stand for two different ids. Returns the new text and the names still missing.
 */
export function substitutePlaceholders(
    text: string,
    env: string,
    values: Record<string, string | undefined>,
): { content: string; placeholders: string[]; missing: string[] } {
    const section = envSection(text, env);
    if (!section) throw new Error(`wrangler.jsonc has no env.${env} block.`);
    let block = text.slice(section.start, section.end);
    const placeholders = findPlaceholders(block);
    const missing: string[] = [];
    for (const name of placeholders) {
        const value = values[name];
        if (!value) {
            missing.push(name);
            continue;
        }
        // The value position only: `"CLOUDFLARE_ACCOUNT_ID": "CLOUDFLARE_ACCOUNT_ID"` keeps its key.
        block = block.replace(new RegExp(`(:\\s*)"${name}"`, 'g'), `$1"${value.replace(/\$/g, '$$$$')}"`);
    }
    return { content: text.slice(0, section.start) + block + text.slice(section.end), placeholders, missing };
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
 * Null when git cannot answer (a shallow clone).
 */
export function changedFiles(exec: Exec, root: string, ref: string): string[] | null {
    if (!isSafeGitRef(ref)) throw new Error(`--changed-since: "${ref}" is not a git ref.`);
    try {
        return exec('git', ['diff', '--name-only', '--relative', ref], { cwd: root, silent: true })
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
    } catch {
        return null;
    }
}

/** The turbo launcher of the workspace, run with node so no shell sees the `^` of a filter. */
function turboBin(root: string): string | null {
    const bin = path.join(root, 'node_modules', 'turbo', 'bin', 'turbo');
    return fs.existsSync(bin) ? bin : null;
}

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
    const env = options.env ?? config.wranglerEnv;
    if (!/^[a-z][a-z0-9-]*$/.test(env)) throw new Error(`"${env}" is not a Wrangler env name.`);
    const wranglerFile = path.join(appDir, config.wranglerConfig);
    if (!fs.existsSync(wranglerFile)) throw new Error(`apps/${appName} has no ${config.wranglerConfig}.`);
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
    const pnpm = (args: string[], silent = false) => {
        const invocation = getPnpmInvocation(args);
        return exec(invocation.command, invocation.args, { cwd: root, silent });
    };
    const configName = `wrangler.${env}.jsonc`;
    const configFile = path.join(appDir, configName);
    const result: DeployResult = {
        app: appName,
        env,
        workerUrl: null,
        configFile,
        secretsSet: [],
        bootstrapped: false,
        healthy: null,
        skipped: null,
    };

    // 0. Anything to deploy? Only when a file the app depends on changed since the given ref.
    if (options.changedSince) {
        const globs = watchPaths(root, appName);
        const nested = nestedCheckouts(root, globs);
        const changed = nested.length ? null : changedFiles(exec, root, options.changedSince);
        if (nested.length) {
            log.warn(`${nested.join(', ')}: its own git checkout, which the diff cannot see: deploying ${appName}`);
        } else if (changed === null) {
            log.warn(`git cannot diff against ${options.changedSince} (a shallow clone?): deploying ${appName}`);
        } else if (!isAffected(changed, globs)) {
            log.step(`${appName}: nothing it depends on changed since ${options.changedSince}, not deployed`);
            result.skipped = 'unchanged';
            return result;
        }
    }

    // 1. Who am I. CI has no login: the account id comes from the environment, the token is wrangler's.
    let accountId: string | null = null;
    if (options.ci) {
        accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || null;
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
    //    CI creates nothing: the ids are build variables.
    let ids: Record<string, string> = {};
    if (!options.ci) {
        log.step(`Cloudflare resources for env.${env}`);
        const setupArgs = ['cf:setup', '--', '--force', '--json', `--app=${appName}`, `--env=${env}`];
        ids = options.dryRun ? {} : (JSON.parse(last(pnpm(setupArgs, true))) as Record<string, string>);
        for (const [name, id] of Object.entries(ids)) log.dim(`  ${name} = ${id}`);
    }

    // 3. The config for this deploy: the env block with its placeholders filled.
    const values = {
        ...ids,
        ...(accountId ? { CLOUDFLARE_ACCOUNT_ID: accountId } : {}),
        ...parseSetOptions(options.set),
    };
    const source = fs.readFileSync(wranglerFile, 'utf8');
    const { content, placeholders, missing } = substitutePlaceholders(source, env, {
        ...Object.fromEntries(placeholdersFromEnv(source, env)),
        ...values,
    });
    if (missing.length && !options.dryRun) {
        throw new Error(
            options.ci
                ? `No value for ${missing.join(', ')} in env.${env}. Set ${missing.length > 1 ? 'them' : 'it'} as build variables (or --set ${missing[0]}=<value>).`
                : `No value for ${missing.join(', ')} in env.${env}. Pass --set ${missing[0]}=<value> or set it in the environment.`,
        );
    }
    log.step(`${configName}: ${placeholders.length - missing.length} of ${placeholders.length} placeholder(s) filled`);
    const buildSteps = [
        ...(options.skipPackages ? [] : [`the workspace packages ${appName} uses`]),
        ...(options.skipBuild
            ? []
            : [`${appName} (${[config.buildCommand, config.workerBuildCommand].filter(Boolean).join(', then ')})`]),
    ];
    if (options.dryRun) {
        log.dim(
            `  would write apps/${appName}/${configName}${missing.length ? `; missing ${missing.join(', ')}` : ''}`,
        );
        if (buildSteps.length) log.dim(`  would build ${buildSteps.join(', then ')}`);
        if (!options.buildOnly) {
            log.dim(`  would deploy env.${env}${options.ci ? '' : ', set the missing secrets'}`);
        }
        return result;
    }
    fs.writeFileSync(configFile, content);

    // 4. Build: the app's workspace packages (only those), the app, its Worker bundle.
    if (!options.skipPackages) {
        log.step(`Building the workspace packages ${appName} uses`);
        const turbo = turboBin(root);
        if (turbo) exec(process.execPath, [turbo, 'run', 'build', `--filter=${packageName}^...`], { cwd: root });
        else pnpm(['build:pkg']);
    }
    if (!options.skipBuild) {
        log.step(`Building ${appName}`);
        pnpm(['--filter', packageName, 'run', config.buildCommand]);
        if (config.workerBuildCommand) {
            log.step(`Building the Worker (${config.workerBuildCommand})`);
            pnpm(['--filter', packageName, 'run', config.workerBuildCommand]);
        }
    }
    const notBuilt = config.verifyPaths.filter((p) => !fs.existsSync(path.join(appDir, p)));
    if (notBuilt.length) {
        throw new Error(
            `The build left no ${notBuilt.join(', ')} in apps/${appName} (cloudflare-config.json verifyPaths).`,
        );
    }
    if (options.buildOnly) {
        log.success(`${appName} built; deploy with --skip-build`);
        result.skipped = 'built';
        return result;
    }

    // 5. Deploy.
    log.step(`Deploying env.${env}`);
    // Tag the version with the short commit, which the Worker reads back through its version
    // metadata binding (readiness and the Fleet report show it). Outside a git checkout, CI's own
    // commit variable; with neither, no tag.
    const tag = shortCommit(appDir) ?? ciCommit();
    const deployed = wrangler(['deploy', '--env', env, '--config', configName, ...(tag ? ['--tag', tag] : [])], true);
    console.log(deployed.trim());
    result.workerUrl = options.url ?? parseDeployedUrl(deployed);
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
        fs.outputJsonSync(bulkFile, wanted);
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

/** GET the app's health path on the deployed URL; records the answer, never throws. */
async function healthCheck(fetchFn: typeof fetch, result: DeployResult, healthPath: string): Promise<void> {
    if (!result.workerUrl) return;
    try {
        const response = await fetchFn(`${result.workerUrl.replace(/\/+$/, '')}${healthPath}`);
        result.healthy = response.ok;
    } catch {
        result.healthy = false;
    }
}

/** The placeholder names of the env block as `[name, process.env value]`, the fallback for `--set`. */
function placeholdersFromEnv(source: string, env: string): [string, string | undefined][] {
    const section = envSection(source, env);
    if (!section) return [];
    return findPlaceholders(source.slice(section.start, section.end)).map((name) => [name, process.env[name]]);
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

export interface DeployCommandOptions extends DeployOptions {
    /** Every app whose cloudflare-config.json does not say `deployable: false`, one after another. */
    all?: boolean;
    /** Print the app's watch paths (what its deploy depends on), one per line, and deploy nothing. */
    watchPaths?: boolean;
}

/** `otta deploy --all`: each deployable app in turn; the first failure does not stop the others. */
export async function deployAll(
    root: string,
    options: DeployOptions,
    exec: Exec = defaultExec,
    fetchFn: typeof fetch = fetch,
): Promise<DeployResult[]> {
    const apps = listDeployableApps(root);
    if (!apps.length)
        throw new Error('No deployable app: none has a cloudflare-config.json without "deployable": false.');
    log.step(`Deployable apps: ${apps.join(', ')}`);
    const results: DeployResult[] = [];
    const failed: string[] = [];
    for (const app of apps) {
        console.log('');
        log.step(`── ${app}`);
        try {
            results.push(await deployApp(root, app, options, exec, fetchFn));
        } catch (error) {
            failed.push(app);
            log.error(`${app}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    console.log('');
    for (const result of results) {
        const what =
            result.skipped === 'unchanged'
                ? 'unchanged, skipped'
                : result.skipped === 'built'
                  ? 'built'
                  : options.dryRun
                    ? 'planned'
                    : `deployed to env.${result.env}`;
        log.dim(`  ${result.app}: ${what}${result.healthy === false ? ' (health check failed)' : ''}`);
    }
    if (failed.length) throw new Error(`${failed.length} of ${apps.length} app(s) failed: ${failed.join(', ')}.`);
    return results;
}

/** `otta deploy [app]`. */
export async function deployCommand(
    appName: string | undefined,
    options: DeployCommandOptions = {},
): Promise<DeployResult[]> {
    const root = getMonorepoRoot();
    if (options.all) {
        if (appName) throw new Error('Pass an app or --all, not both.');
        if (options.watchPaths) throw new Error('--watch-paths takes one app.');
        // One URL or one owner for every app would set the same AUTH_URL / owner on all of them.
        if (options.url || options.ownerEmail) throw new Error('--url and --owner-email take one app, not --all.');
        const results = await deployAll(root, options);
        log.done(`${results.length} app(s) done.`);
        return results;
    }
    const app = resolveApp(appName);
    if (options.watchPaths) {
        for (const glob of watchPaths(root, app.name)) console.log(glob);
        return [];
    }
    const result = await deployApp(root, app.name, options);
    console.log('');
    if (options.dryRun) {
        log.done(`dry run for ${app.name}, env.${result.env}; nothing deployed.`);
        return [result];
    }
    if (result.skipped === 'unchanged') {
        log.done(`${app.name} unchanged since ${options.changedSince}; nothing deployed.`);
        return [result];
    }
    if (result.skipped === 'built') {
        log.done(`${app.name} built for env.${result.env}.`);
        return [result];
    }
    log.done(`${app.name} deployed to env.${result.env}${result.workerUrl ? ` at ${result.workerUrl}` : ''}.`);
    if (result.healthy === false)
        log.failed('the health check did not answer 200; see the Worker logs (wrangler tail)');
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
