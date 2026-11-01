import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseJsonc } from 'jsonc-parser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    DEPLOY_CONFIG_DEFAULTS,
    isAffected,
    listDeployableApps,
    listPreviewApps,
    planDeploys,
    readDeployConfig,
    watchPaths,
    workspaceDependencyDirs,
    workspaceGlobs,
} from '../commands/deploy-plan.js';
import {
    changedFiles,
    ciCommit,
    customDomainUrl,
    deletePreview,
    deletePreviews,
    deployAll,
    deployApp,
    deployCommand,
    healthCheckTiming,
    parseDeployValues,
    findPlaceholders,
    previewWorkerName,
    writeStepOutputs,
    substitutePlaceholders,
    type Exec,
} from '../commands/deploy.js';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));

const WRANGLER = `{
    "name": "web",
    "env": {
        "production": {
            "vars": { "ENVIRONMENT": "production", "CLOUDFLARE_ACCOUNT_ID": "CLOUDFLARE_ACCOUNT_ID" },
            "d1_databases": [{ "binding": "OBCF_D1", "database_name": "web-db", "database_id": "D1_DATABASE_ID" }],
            "kv_namespaces": [{ "binding": "OBCF_KV", "id": "KV_NAMESPACE_ID" }],
        },
        "preview": {
            "vars": { "ENVIRONMENT": "preview" },
            "d1_databases": [{ "binding": "OBCF_D1", "database_name": "web-db-preview", "database_id": "D1_PREVIEW_ID" }],
        },
    },
}
`;

const roots: string[] = [];
beforeEach(() => {
    healthCheckTiming.delayMs = 0;
});
afterEach(() => {
    for (const root of roots.splice(0)) fs.removeSync(root);
    vi.unstubAllEnvs();
});

/**
 * A workspace: web depends on ui, ui on utils; landing is a Next app with a worker build and no
 * previews; tool is not deployable; nocfg has no cloudflare-config.json; unused is a package nobody uses.
 */
function workspace(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'otta-deploy-ci-'));
    roots.push(root);
    const json = (file: string, value: unknown) => fs.outputJsonSync(path.join(root, file), value);
    const text = (file: string, value: string) => fs.outputFileSync(path.join(root, file), value);

    text(
        'pnpm-workspace.yaml',
        'packages:\n    - apps/*\n    - "packages/*"\n    - "!packages/ignored"\n\ncatalog:\n    react: ^19\n',
    );
    json('package.json', { name: 'root', private: true });
    for (const file of ['pnpm-lock.yaml', 'turbo.json', 'tsconfig.json', 'tsconfig.base.json', '.nvmrc', 'README.md']) {
        text(file, '');
    }
    text('node_modules/turbo/bin/turbo', '// stub');

    json('packages/utils/package.json', { name: '@x/utils' });
    json('packages/ui/package.json', { name: '@x/ui', dependencies: { '@x/utils': 'workspace:*', react: 'catalog:' } });
    json('packages/unused/package.json', { name: '@x/unused' });

    json('apps/web/package.json', {
        name: '@x/web',
        scripts: { build: 'vite build' },
        dependencies: { '@x/ui': 'workspace:*', react: '^19' },
        devDependencies: { '@x/utils': 'workspace:*' },
    });
    text('apps/web/wrangler.jsonc', WRANGLER);
    json('apps/web/cloudflare-config.json', {
        appType: 'vite',
        verifyPaths: ['dist'],
        healthCheckPath: '/health',
        requiresSecrets: [],
    });
    text('apps/web/node_modules/wrangler/bin/wrangler.js', '// stub');

    json('apps/landing/package.json', {
        name: '@x/landing',
        scripts: { build: 'next build', 'build:worker': 'opennextjs-cloudflare build --skipBuild' },
        dependencies: { '@x/utils': 'workspace:*' },
    });
    text('apps/landing/wrangler.jsonc', WRANGLER.replace('"web"', '"landing"'));
    json('apps/landing/cloudflare-config.json', {
        appType: 'nextjs',
        buildCommand: 'build',
        workerBuildCommand: 'build:worker',
        verifyPaths: ['.open-next'],
        previewDeployable: false,
    });
    text('apps/landing/node_modules/wrangler/bin/wrangler.js', '// stub');

    json('apps/tool/package.json', { name: '@x/tool', scripts: { build: 'tsc' } });
    json('apps/tool/cloudflare-config.json', { deployable: false });
    json('apps/nocfg/package.json', { name: '@x/nocfg' });
    return root;
}

/**
 * Answers like git, turbo, pnpm and wrangler do; a build leaves its output so verifyPaths passes. `diff`
 * is written one file per line and answered NUL-separated, as `git diff -z` does. `envs` records the
 * environment each build command was given.
 */
function fakeExec(
    root: string,
    calls: string[],
    answers: {
        diff?: string | Error;
        message?: string;
        deleteFails?: boolean;
        envs?: { line: string; env?: NodeJS.ProcessEnv }[];
    } = {},
): Exec {
    return (command, args, options) => {
        const line = [path.basename(command), ...args].join(' ');
        calls.push(line);
        answers.envs?.push({ line, env: options.env });
        if (command === 'git') {
            if (args[0] === 'log') return answers.message ?? 'feat: a change\n';
            if (answers.diff instanceof Error) throw answers.diff;
            return (answers.diff ?? '').split('\n').filter(Boolean).join('\0');
        }
        const app = path.basename(options.cwd) === path.basename(root) ? null : path.basename(options.cwd);
        if (line.includes('run build:worker')) fs.ensureDirSync(path.join(root, 'apps/landing/.open-next'));
        else if (/--filter @x\/(\w+) run build$/.test(line)) {
            const name = /@x\/(\w+)/.exec(line)![1];
            fs.ensureDirSync(path.join(root, 'apps', name, 'dist'));
        }
        if (line.includes(' delete ') && answers.deleteFails) throw new Error('Worker not found');
        if (line.includes(' deploy ')) {
            const named = args.includes('--name') ? args[args.indexOf('--name') + 1] : `${app}-production`;
            return `Deployed\n  https://${named}.me.workers.dev\n`;
        }
        return '';
    };
}

function fakeFetch(requests: string[], status = 200): typeof fetch {
    return (async (input: string | URL | Request) => {
        requests.push(String(input));
        return new Response('ok', { status });
    }) as typeof fetch;
}

function ciEnv(): void {
    vi.stubEnv('CLOUDFLARE_API_TOKEN', 'token');
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '0123456789abcdef0123456789abcdef');
    vi.stubEnv('D1_DATABASE_ID', 'd1-from-build-vars');
    vi.stubEnv('KV_NAMESPACE_ID', 'kv-from-build-vars');
    vi.stubEnv('D1_PREVIEW_ID', 'd1-preview');
    vi.stubEnv('WORKERS_CI', '');
    vi.stubEnv('GITHUB_STEP_SUMMARY', '');
}

describe('the deploy manifest', () => {
    it('reads cloudflare-config.json with the defaults', () => {
        const root = workspace();
        expect(readDeployConfig(path.join(root, 'apps/landing'))).toMatchObject({
            buildCommand: 'build',
            workerBuildCommand: 'build:worker',
            verifyPaths: ['.open-next'],
            wranglerEnv: 'production',
            healthCheckPath: '/api/health',
            previewDeployable: false,
        });
    });

    it('is strict: a missing file, bad JSON, an unknown key or a wrong value stops and names itself', () => {
        const root = workspace();
        const dir = path.join(root, 'apps/nocfg');
        const file = path.join(dir, 'cloudflare-config.json');
        expect(() => readDeployConfig(dir)).toThrow(/apps\/nocfg\/cloudflare-config\.json is missing/);
        fs.outputFileSync(file, '{ nope');
        expect(() => readDeployConfig(dir)).toThrow(/not valid JSON/);
        const cases: [unknown, RegExp][] = [
            [
                { workerName: 'x' },
                /"workerName" is no longer a setting \(wrangler\.jsonc's name is the Worker name\): remove it/,
            ],
            [{ verifyPath: ['dist'] }, /unknown key "verifyPath"/],
            [{ deployable: 'yes' }, /"deployable" must be true or false/],
            [{ buildCommand: 'build && rm -rf /' }, /"buildCommand" must be a package\.json script name/],
            [{ verifyPaths: ['../../etc'] }, /"verifyPaths" must be a list of paths inside the app/],
            [{ wranglerConfig: '../wrangler.jsonc' }, /"wranglerConfig" must be/],
            [{ healthCheckPath: 'health' }, /"healthCheckPath" must be a path starting with \//],
            [{ requiresSecrets: ['lower'] }, /"requiresSecrets" must be a list of SECRET_NAMES/],
            [{ appType: 'remix' }, /"appType" must be one of vite, nextjs, custom/],
        ];
        for (const [value, error] of cases) {
            fs.outputJsonSync(file, value);
            expect(() => readDeployConfig(dir)).toThrow(error);
        }
        fs.outputJsonSync(file, { $schema: 'x', $comment: 'y', workerBuildCommand: '' });
        expect(readDeployConfig(dir).workerBuildCommand).toBeNull();
    });

    it('the schema and the defaults say the same thing', () => {
        const schema = fs.readJsonSync(path.join(REPO, 'schemas/cloudflare-config.schema.json')) as {
            additionalProperties: boolean;
            properties: Record<string, { default?: unknown }>;
        };
        expect(schema.additionalProperties).toBe(false);
        const settings = Object.keys(schema.properties).filter((key) => !key.startsWith('$'));
        expect(settings.sort()).toEqual(Object.keys(DEPLOY_CONFIG_DEFAULTS).sort());
        for (const key of settings) {
            expect([key, schema.properties[key].default]).toEqual([
                key,
                DEPLOY_CONFIG_DEFAULTS[key as keyof typeof DEPLOY_CONFIG_DEFAULTS],
            ]);
        }
    });

    it('every app in this repository has a manifest that reads, naming scripts it has', () => {
        const apps = fs.readdirSync(path.join(REPO, 'apps')).filter((app) => {
            return fs.existsSync(path.join(REPO, 'apps', app, 'wrangler.jsonc'));
        });
        expect(apps.length).toBeGreaterThan(0);
        for (const app of apps) {
            const dir = path.join(REPO, 'apps', app);
            const config = readDeployConfig(dir);
            const scripts = (fs.readJsonSync(path.join(dir, 'package.json')) as { scripts?: Record<string, string> })
                .scripts;
            for (const script of [config.buildCommand, config.workerBuildCommand].filter(Boolean) as string[]) {
                expect([app, script, Boolean(scripts?.[script])]).toEqual([app, script, true]);
            }
            expect([app, fs.existsSync(path.join(dir, config.wranglerConfig))]).toEqual([app, true]);
            // Preview URLs stay off unless an app turns them on: every template (and so every app
            // `otta new` makes) says so at the top level, which each env block inherits.
            const wrangler = parseJsonc(fs.readFileSync(path.join(dir, config.wranglerConfig), 'utf8')) as {
                preview_urls?: boolean;
            };
            expect([app, 'preview_urls', wrangler.preview_urls]).toEqual([app, 'preview_urls', false]);
        }
        // What CI ships from this repository: the two product apps, not the templates or the cache.
        expect(listDeployableApps(REPO)).toEqual(['otta-landing', 'otta-web']);
    });
});

describe('the deploy plan', () => {
    it('lists the deployable apps; a manifest that does not read is planned, so its own job fails', () => {
        const root = workspace();
        expect(listDeployableApps(root)).toEqual(['landing', 'web']);
        fs.outputFileSync(path.join(root, 'apps/web/cloudflare-config.json'), '{ broken');
        const plan = planDeploys(root, {});
        expect(plan.find((entry) => entry.app === 'web')).toMatchObject({ deploy: true });
        expect(plan.find((entry) => entry.app === 'web')!.reason).toMatch(/not valid JSON/);
        expect(plan.find((entry) => entry.app === 'tool')).toMatchObject({ deploy: false, skip: 'not-deployable' });
    });

    it('decides from the diff, #skipdeploy and previews', () => {
        const root = workspace();
        const changed = planDeploys(root, { changedSince: 'abc1234', changed: ['packages/ui/src/a.ts'] });
        expect(changed.map((e) => [e.app, e.deploy, e.skip])).toEqual([
            ['landing', false, 'unchanged'],
            ['tool', false, 'not-deployable'],
            ['web', true, undefined],
        ]);
        expect(changed.find((e) => e.app === 'web')!.reason).toBe('changed: packages/ui/src/a.ts');
        // git could not answer: deploy (a first push, a shallow clone).
        expect(planDeploys(root, { changedSince: 'abc1234', changed: null }).filter((e) => e.deploy)).toHaveLength(2);
        const skipped = planDeploys(root, { commitMessage: 'docs: typo #skipdeploy' });
        expect(skipped.filter((e) => e.deploy)).toEqual([]);
        expect(skipped.find((e) => e.app === 'web')).toMatchObject({ skip: 'skipdeploy' });
        expect(
            planDeploys(root, { preview: true })
                .filter((e) => e.deploy)
                .map((e) => e.app),
        ).toEqual(['web']);
    });

    it('follows workspace dependencies through each other, not external ones or negated globs', () => {
        const root = workspace();
        expect(workspaceGlobs(root)).toEqual(['apps/*', 'packages/*']);
        expect(workspaceDependencyDirs(root, path.join(root, 'apps/web'))).toEqual(['packages/ui', 'packages/utils']);
        expect(workspaceDependencyDirs(root, path.join(root, 'apps/landing'))).toEqual(['packages/utils']);
        fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n    - tools/**\n');
        expect(() => watchPaths(root, 'web')).toThrow(/"tools\/\*\*" is not a form/);
    });

    it('turns the graph into watch paths, and a diff into deploy or not', () => {
        const root = workspace();
        const web = watchPaths(root, 'web');
        // Workers Builds' syntax: one `*`, which matches nested paths too (its docs never mention `**`).
        expect(web).toEqual([
            'apps/web/*',
            'packages/ui/*',
            'packages/utils/*',
            '.nvmrc',
            'package.json',
            'pnpm-lock.yaml',
            'pnpm-workspace.yaml',
            'tsconfig.base.json',
            'tsconfig.json',
            'turbo.json',
        ]);
        expect(isAffected(['packages/utils/src/date.ts'], web)).toBe(true);
        expect(isAffected(['apps/web/src/deep/er/page.tsx'], web)).toBe(true);
        expect(isAffected(['pnpm-lock.yaml'], web)).toBe(true);
        expect(isAffected(['packages/unused/src/a.ts', 'README.md', 'docs/x.md'], web)).toBe(false);
        // A sibling whose name starts like a watched folder is not inside it.
        expect(isAffected(['packages/ui-extra/a.ts'], web)).toBe(false);
        expect(isAffected(['packages/ui/a.ts'], watchPaths(root, 'landing'))).toBe(false);
    });

    it('reads the commit CI builds when git cannot tell', () => {
        expect(ciCommit({ WORKERS_CI_COMMIT_SHA: 'abcdef0123456789abcdef0123456789abcdef01' })).toBe('abcdef0');
        expect(ciCommit({ WORKERS_CI_COMMIT_SHA: '', GITHUB_SHA: '1234567890abcdef' })).toBe('1234567');
        expect(ciCommit({ GITHUB_SHA: 'nonsense' })).toBeNull();
        expect(ciCommit({})).toBeNull();
    });
});

describe('small parts', () => {
    it('parses the values bag: an object of strings, nothing else', () => {
        expect(parseDeployValues(undefined)).toEqual({});
        expect(parseDeployValues('{"A_B":"x","N":1,"github_token":"t"}')).toEqual({ A_B: 'x', github_token: 't' });
        expect(() => parseDeployValues('[1]')).toThrow(/must be a JSON object/);
        expect(() => parseDeployValues('{nope')).toThrow(/is not JSON/);
    });

    it('names a preview Worker, or says why it cannot', () => {
        expect(previewWorkerName('otta-web', 'pr-12')).toBe('otta-web-pr-12');
        expect(() => previewWorkerName('otta-web', 'PR 12')).toThrow(/lowercase letters/);
        expect(() => previewWorkerName('w'.repeat(60), 'pr-12')).toThrow(/longer than 63/);
    });

    it('finds a custom domain route when there is no workers.dev', () => {
        const text = `{ "env": { "production": { "routes": [{ "pattern": "a.com/*" }, { "pattern": "app.example.com", "custom_domain": true }] } } }`;
        expect(customDomainUrl(text, 'production')).toBe('https://app.example.com');
        expect(customDomainUrl(text, 'preview')).toBeNull();
    });

    it('refuses flag combinations that mean nothing, before anything runs', async () => {
        await expect(deployCommand('web', { all: true })).rejects.toThrow(/an app or --all/);
        await expect(deployCommand(undefined, { all: true, url: 'https://x' })).rejects.toThrow(/take one app/);
        await expect(deployCommand('web', { preview: 'pr-1' })).rejects.toThrow(/--preview is for CI/);
        await expect(deployCommand('web', { preview: 'pr-1', ci: true, env: 'x' })).rejects.toThrow(/drop --env/);
        await expect(deployCommand('web', { buildOnly: true })).rejects.toThrow(/--build-only is for CI/);
    });
});

describe('otta deploy --ci', () => {
    beforeEach(ciEnv);

    it('builds the packages the app uses, builds, deploys; no login, no resources, no secrets', async () => {
        const root = workspace();
        const calls: string[] = [];
        const requests: string[] = [];
        const result = await deployApp(root, 'web', { ci: true }, fakeExec(root, calls), fakeFetch(requests));

        expect(calls.some((c) => c.includes('whoami') || c.includes('cf:setup') || c.includes('secret'))).toBe(false);
        expect(calls[0]).toBe('git log -1 --format=%B');
        expect(calls.find((c) => c.includes('turbo run'))).toMatch(/turbo run build --filter=@x\/web\^\.\.\.$/);
        expect(calls.some((c) => c.endsWith('--filter @x/web run build'))).toBe(true);
        expect(calls.some((c) => /deploy --env production --config wrangler\.production\.jsonc/.test(c))).toBe(true);

        const config = fs.readFileSync(path.join(root, 'apps/web/wrangler.production.jsonc'), 'utf8');
        expect(config).toContain('"database_id": "d1-from-build-vars"');
        expect(config).toContain('"id": "kv-from-build-vars"');
        expect(config).toContain('"CLOUDFLARE_ACCOUNT_ID": "0123456789abcdef0123456789abcdef"');
        expect(requests).toEqual(['https://web-production.me.workers.dev/health']);
        expect(result).toMatchObject({ healthy: true, skipped: null, secretsSet: [], bootstrapped: false });
    });

    it('takes values from the bag first, and names every missing name at once', async () => {
        vi.stubEnv('D1_DATABASE_ID', '');
        vi.stubEnv('KV_NAMESPACE_ID', '');
        const root = workspace();
        fs.outputJsonSync(path.join(root, 'apps/web/cloudflare-config.json'), {
            verifyPaths: ['dist'],
            requiresSecrets: ['SENTRY_AUTH_TOKEN'],
        });
        const calls: string[] = [];
        await expect(deployApp(root, 'web', { ci: true }, fakeExec(root, calls))).rejects.toThrow(
            /No value for D1_DATABASE_ID, KV_NAMESPACE_ID, SENTRY_AUTH_TOKEN \(env\.production of apps\/web\)/,
        );
        expect(calls).toEqual(['git log -1 --format=%B']);

        const values = { D1_DATABASE_ID: 'd1-bag', KV_NAMESPACE_ID: 'kv-bag', SENTRY_AUTH_TOKEN: 's', OTHER: 'unused' };
        await deployApp(root, 'web', { ci: true, values }, fakeExec(root, []), fakeFetch([]));
        const config = fs.readFileSync(path.join(root, 'apps/web/wrangler.production.jsonc'), 'utf8');
        expect(config).toContain('"database_id": "d1-bag"');
        expect(config).not.toContain('unused');
    });

    it('needs CLOUDFLARE_API_TOKEN, except in Workers Builds which brings its own', async () => {
        vi.stubEnv('CLOUDFLARE_API_TOKEN', '');
        const root = workspace();
        await expect(deployApp(root, 'web', { ci: true }, fakeExec(root, []))).rejects.toThrow(
            /No value for CLOUDFLARE_API_TOKEN/,
        );
        vi.stubEnv('WORKERS_CI', '1');
        const result = await deployApp(root, 'web', { ci: true }, fakeExec(root, []), fakeFetch([]));
        expect(result.skipped).toBeNull();
    });

    it('#skipdeploy in the commit message deploys nothing; --force deploys anyway', async () => {
        const root = workspace();
        const calls: string[] = [];
        const skipped = await deployApp(
            root,
            'web',
            { ci: true },
            fakeExec(root, calls, { message: 'docs: typo #skipdeploy' }),
        );
        expect(skipped.skipped).toBe('skipdeploy');
        expect(calls).toEqual(['git log -1 --format=%B']);
        const forced = await deployApp(
            root,
            'web',
            { ci: true, force: true },
            fakeExec(root, [], { message: '#skipdeploy' }),
            fakeFetch([]),
        );
        expect(forced.skipped).toBeNull();
    });

    it('runs the worker build a Next.js app names, and says what a missing output means', async () => {
        const root = workspace();
        const calls: string[] = [];
        await deployApp(root, 'landing', { ci: true, skipPackages: true }, fakeExec(root, calls), fakeFetch([]));
        const build = calls.findIndex((c) => c.endsWith('run build'));
        const worker = calls.findIndex((c) => c.endsWith('run build:worker'));
        expect(build).toBeGreaterThanOrEqual(0);
        expect(worker).toBeGreaterThan(build);

        // A build that leaves no .open-next never reaches wrangler, and the error says where to look.
        fs.removeSync(path.join(root, 'apps/landing/.open-next'));
        const silent: Exec = (command, args) =>
            [path.basename(command), ...args].join(' ').includes(' deploy ') ? 'x' : '';
        await expect(deployApp(root, 'landing', { ci: true, skipPackages: true }, silent)).rejects.toThrow(
            /left no \.open-next .*OpenNext.*apps\/landing has: .*package\.json/,
        );
    });

    it('--build-only stops before wrangler; --skip-build then deploys what it left, building nothing', async () => {
        const root = workspace();
        const calls: string[] = [];
        const built = await deployApp(root, 'web', { ci: true, buildOnly: true }, fakeExec(root, calls), fakeFetch([]));
        expect(built.skipped).toBe('built');
        expect(calls.some((c) => c.includes(' deploy '))).toBe(false);

        const deployCalls: string[] = [];
        await deployApp(root, 'web', { ci: true, skipBuild: true }, fakeExec(root, deployCalls), fakeFetch([]));
        expect(deployCalls.some((c) => c.includes('run build') || c.includes('turbo'))).toBe(false);
        expect(deployCalls.some((c) => c.includes(' deploy '))).toBe(true);
    });

    it('--changed-since skips an app nothing it uses changed for, and deploys when git cannot say', async () => {
        const root = workspace();
        const unrelated: string[] = [];
        const skipped = await deployApp(
            root,
            'web',
            { ci: true, changedSince: 'HEAD~1' },
            fakeExec(root, unrelated, { diff: 'packages/unused/src/a.ts\nREADME.md\n' }),
        );
        expect(skipped.skipped).toBe('unchanged');
        expect(unrelated).toEqual(['git diff --name-only --no-renames --relative -z HEAD~1', 'git log -1 --format=%B']);

        const deployed = await deployApp(
            root,
            'web',
            { ci: true, changedSince: 'HEAD~1' },
            fakeExec(root, [], { diff: 'packages/utils/src/date.ts\n' }),
            fakeFetch([]),
        );
        expect(deployed.skipped).toBeNull();

        const shallow = await deployApp(
            root,
            'web',
            { ci: true, changedSince: 'HEAD~1' },
            fakeExec(root, [], { diff: new Error('bad revision') }),
            fakeFetch([]),
        );
        expect(shallow.skipped).toBeNull();

        // A package that is its own checkout (Pro cloned into packages/pro): the diff is blind to it.
        fs.outputFileSync(path.join(root, 'packages/ui/.git'), 'gitdir: elsewhere\n');
        const nested = await deployApp(
            root,
            'web',
            { ci: true, changedSince: 'HEAD~1' },
            fakeExec(root, [], { diff: 'README.md\n' }),
            fakeFetch([]),
        );
        expect(nested.skipped).toBeNull();
        fs.removeSync(path.join(root, 'packages/ui/.git'));

        await expect(deployApp(root, 'web', { ci: true, changedSince: '--output=/tmp/x' })).rejects.toThrow(
            /not a git ref/,
        );
    });

    it('checks health three times, passes a redirect, and never fails the deploy over it', async () => {
        const root = workspace();
        const down: string[] = [];
        const result = await deployApp(root, 'web', { ci: true }, fakeExec(root, []), fakeFetch(down, 503));
        expect(down).toHaveLength(4);
        expect(result.healthy).toBe(false);
        const redirected = await deployApp(root, 'web', { ci: true }, fakeExec(root, []), fakeFetch([], 302));
        expect(redirected.healthy).toBe(true);
    });

    it('writes the GitHub step summary', async () => {
        const root = workspace();
        const summary = path.join(root, 'summary.md');
        vi.stubEnv('GITHUB_STEP_SUMMARY', summary);
        await deployAll(root, { ci: true, skipPackages: true }, fakeExec(root, []), fakeFetch([]));
        const text = fs.readFileSync(summary, 'utf8');
        expect(text).toContain('| web | deployed env.production | https://web-production.me.workers.dev |');
        expect(text).toContain('| tool | skipped: deployable: false |');
    });
});

describe('otta deploy --preview', () => {
    beforeEach(ciEnv);

    it('deploys env.preview as its own Worker <name>-<id>, and deletes it by that name', async () => {
        const root = workspace();
        const calls: string[] = [];
        const result = await deployApp(
            root,
            'web',
            { ci: true, preview: 'pr-12' },
            fakeExec(root, calls),
            fakeFetch([]),
        );
        expect(
            calls.some((c) => /deploy --env preview --name web-pr-12 --config wrangler\.preview\.jsonc/.test(c)),
        ).toBe(true);
        expect(fs.readFileSync(path.join(root, 'apps/web/wrangler.preview.jsonc'), 'utf8')).toContain('"d1-preview"');
        expect(result).toMatchObject({
            env: 'preview',
            workerName: 'web-pr-12',
            workerUrl: 'https://web-pr-12.me.workers.dev',
        });

        const deletes: string[] = [];
        expect(deletePreview(root, 'web', 'pr-12', fakeExec(root, deletes))).toBe(true);
        expect(deletes).toEqual([expect.stringMatching(/wrangler\.js delete --name web-pr-12$/)]);
        expect(deletePreview(root, 'web', 'pr-12', fakeExec(root, [], { deleteFails: true }))).toBe(false);
    });

    it('refuses an app that has no previews, and a preview outside CI', async () => {
        const root = workspace();
        await expect(deployApp(root, 'landing', { ci: true, preview: 'pr-1' }, fakeExec(root, []))).rejects.toThrow(
            /previewDeployable: false/,
        );
        await expect(deployApp(root, 'web', { preview: 'pr-1' }, fakeExec(root, []))).rejects.toThrow(/is for CI/);
    });
});

describe('otta deploy --all', () => {
    beforeEach(ciEnv);

    it('plans once, builds every app’s packages in one turbo run, deploys each that changed', async () => {
        const root = workspace();
        const calls: string[] = [];
        const results = await deployAll(
            root,
            { ci: true, changedSince: 'HEAD~1' },
            fakeExec(root, calls, { diff: 'packages/utils/x.ts\n' }),
            fakeFetch([]),
        );
        expect(results.map((r) => r.app)).toEqual(['landing', 'web']);
        expect(calls.filter((c) => c.startsWith('git'))).toEqual([
            'git diff --name-only --no-renames --relative -z HEAD~1',
            'git log -1 --format=%B',
        ]);
        expect(calls.filter((c) => c.includes('turbo run'))).toEqual([
            expect.stringMatching(/turbo run build --filter=@x\/landing\^\.\.\. --filter=@x\/web\^\.\.\.$/),
        ]);
    });

    it('skips what did not change, and fails at the end when one app failed', async () => {
        const root = workspace();
        const results = await deployAll(
            root,
            { ci: true, changedSince: 'HEAD~1', skipPackages: true },
            fakeExec(root, [], { diff: 'apps/landing/app/page.tsx\n' }),
            fakeFetch([]),
        );
        expect(results.map((r) => r.app)).toEqual(['landing']);

        // landing's build output check fails; web still deploys, then the run fails.
        const deployed: string[] = [];
        const breakLanding: Exec = (command, args, options) => {
            const line = [path.basename(command), ...args].join(' ');
            if (line.includes('build:worker')) return '';
            return fakeExec(root, deployed)(command, args, options);
        };
        fs.removeSync(path.join(root, 'apps/landing/.open-next'));
        await expect(deployAll(root, { ci: true, skipPackages: true }, breakLanding, fakeFetch([]))).rejects.toThrow(
            /1 of 2 app\(s\) failed: landing/,
        );
        expect(deployed.some((c) => c.includes(' deploy ') && c.includes('production'))).toBe(true);
    });
});

describe('edge cases a tester finds', () => {
    beforeEach(ciEnv);

    it('reads placeholders from the syntax tree: comments, braces and quotes in strings change nothing', () => {
        const text = `{
    "name": "web", // "x": "COMMENTED_ID" in a line comment
    /* "y": "BLOCK_COMMENT_ID", { a brace that must not count } */
    "env": {
        "production": {
            "vars": { "NOTE": "a } brace and a \\" quote", "CLOUDFLARE_ACCOUNT_ID": "CLOUDFLARE_ACCOUNT_ID" },
            // "database_id": "OLD_DB_ID",
            "d1_databases": [{ "binding": "OBCF_D1", "database_id": "D1_DATABASE_ID" }],
        },
    },
}`;
        expect(findPlaceholders(text)).toEqual(['CLOUDFLARE_ACCOUNT_ID', 'D1_DATABASE_ID']);
        // A value with a quote, a backslash or a $ pattern is written as a JSON string, verbatim.
        const tricky = 'id-"q"\\b-$&$1';
        expect(tricky).toContain('\\'); // a real backslash, not an escape
        const { content, missing } = substitutePlaceholders(text, 'production', {
            D1_DATABASE_ID: tricky,
            CLOUDFLARE_ACCOUNT_ID: 'acc',
        });
        expect(missing).toEqual([]);
        const parsed = parseJsonc(content) as {
            env: { production: { vars: Record<string, string>; d1_databases: { database_id: string }[] } };
        };
        expect(parsed.env.production.d1_databases[0].database_id).toBe(tricky);
        expect(parsed.env.production.vars).toEqual({ NOTE: 'a } brace and a " quote', CLOUDFLARE_ACCOUNT_ID: 'acc' });
        expect(content).toContain('// "database_id": "OLD_DB_ID",');
        expect(() => substitutePlaceholders('{ "env": { "production": { "a": } } }', 'production', {})).toThrow(
            /does not parse: ValueExpected/,
        );
    });

    it('reads a NUL-separated diff, so a path with a space or an accent still matches', () => {
        const exec: Exec = () => 'apps/web/my file.ts\0apps/web/café.ts\0';
        expect(changedFiles(exec, '/repo', 'HEAD~1')).toEqual(['apps/web/my file.ts', 'apps/web/café.ts']);
    });

    it('hands the build the names the manifest asks for, and no other value', async () => {
        const root = workspace();
        fs.outputJsonSync(path.join(root, 'apps/web/cloudflare-config.json'), {
            verifyPaths: ['dist'],
            requiresSecrets: ['BLACKBOX_UPLOAD_TOKEN'],
        });
        const envs: { line: string; env?: NodeJS.ProcessEnv }[] = [];
        const values = { BLACKBOX_UPLOAD_TOKEN: 'tok', UNRELATED_SECRET: 'nope' };
        await deployApp(root, 'web', { ci: true, values }, fakeExec(root, [], { envs }), fakeFetch([]));
        const build = envs.find((e) => e.line.endsWith('run build'))!;
        expect(build.env?.BLACKBOX_UPLOAD_TOKEN).toBe('tok');
        expect(build.env?.UNRELATED_SECRET).toBeUndefined();
        // Nothing else gets an environment of its own: wrangler and git inherit the scrubbed one.
        expect(envs.filter((e) => e.env && !e.line.includes(' run build'))).toEqual([]);
    });

    it('takes --set for a required name, and wants the API token where wrangler reads it', async () => {
        const root = workspace();
        fs.outputJsonSync(path.join(root, 'apps/web/cloudflare-config.json'), {
            verifyPaths: ['dist'],
            requiresSecrets: ['SENTRY_AUTH_TOKEN'],
        });
        const ok = await deployApp(
            root,
            'web',
            { ci: true, set: ['SENTRY_AUTH_TOKEN=s'] },
            fakeExec(root, []),
            fakeFetch([]),
        );
        expect(ok.skipped).toBeNull();
        vi.stubEnv('CLOUDFLARE_API_TOKEN', '');
        await expect(
            deployApp(
                root,
                'web',
                { ci: true, set: ['SENTRY_AUTH_TOKEN=s'], values: { CLOUDFLARE_API_TOKEN: 'only-in-the-bag' } },
                fakeExec(root, []),
            ),
        ).rejects.toThrow(/No value for CLOUDFLARE_API_TOKEN/);
    });

    it('gives each health check a timeout, so a hung Worker cannot hold the job', async () => {
        const root = workspace();
        const signals: unknown[] = [];
        const fetchFn = (async (_input: string | URL | Request, init?: RequestInit) => {
            signals.push(init?.signal);
            return new Response('ok');
        }) as typeof fetch;
        await deployApp(root, 'web', { ci: true }, fakeExec(root, []), fetchFn);
        expect(signals).toHaveLength(1);
        expect(signals[0]).toBeInstanceOf(AbortSignal);
    });

    it('keeps the defaults frozen: one read cannot change the next', () => {
        const root = workspace();
        const dir = path.join(root, 'apps/nocfg');
        fs.outputJsonSync(path.join(dir, 'cloudflare-config.json'), {});
        readDeployConfig(dir).verifyPaths.push('mutated');
        expect(readDeployConfig(dir).verifyPaths).toEqual(['dist', 'cloudflare-worker.ts']);
        expect(Object.isFrozen(DEPLOY_CONFIG_DEFAULTS)).toBe(true);
        expect(Object.isFrozen(DEPLOY_CONFIG_DEFAULTS.verifyPaths)).toBe(true);
    });

    it('refuses a workspace it cannot read for certain, instead of under-watching', () => {
        const root = workspace();
        fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages: [apps/*, packages/*]\n');
        expect(() => workspaceGlobs(root)).toThrow(/block list/);
        fs.removeSync(path.join(root, 'pnpm-workspace.yaml'));
        expect(() => workspaceGlobs(root)).toThrow(/No pnpm-workspace\.yaml/);
    });

    it('reads the workspace once per plan, however many apps it covers', () => {
        const root = workspace();
        const read = vi.spyOn(fs, 'readJsonSync');
        planDeploys(root, { changedSince: 'abc1234', changed: [] });
        const unusedReads = read.mock.calls.filter(([file]) => String(file).includes(`unused${path.sep}package.json`));
        read.mockRestore();
        expect(unusedReads).toHaveLength(1);
    });

    it('cleans up the previews of every app that allows them, one failure not stopping the rest', () => {
        const root = workspace();
        // landing allows none; tool has no wrangler config at all, so no env.preview to have made one from.
        expect(listPreviewApps(root)).toEqual(['web']);
        // Out of CI (deployable: false) but with an env.preview: its old previews are still cleaned up.
        fs.outputFileSync(path.join(root, 'apps/tool/wrangler.jsonc'), WRANGLER.replace('"web"', '"tool"'));
        expect(listPreviewApps(root)).toEqual(['tool', 'web']);
        fs.removeSync(path.join(root, 'apps/tool/wrangler.jsonc'));
        const rows = deletePreviews(root, ['tool', 'web'], 'pr-3', fakeExec(root, []));
        expect(rows[0]).toMatchObject({ app: 'tool' });
        expect(rows[0].outcome).toMatch(/^failed: /);
        expect(rows[1]).toEqual({ app: 'web', outcome: 'preview deleted' });
    });

    it('plans no preview for an app whose wrangler config has no env.preview block', () => {
        const root = workspace();
        fs.outputJsonSync(path.join(root, 'apps/noprev/package.json'), { name: '@x/noprev', scripts: { build: 'x' } });
        fs.outputJsonSync(path.join(root, 'apps/noprev/cloudflare-config.json'), {});
        fs.outputFileSync(
            path.join(root, 'apps/noprev/wrangler.jsonc'),
            '{ "name": "noprev", "env": { "production": {} } }',
        );
        const entry = planDeploys(root, { preview: true }).find((e) => e.app === 'noprev');
        expect(entry).toMatchObject({
            deploy: false,
            skip: 'no-preview',
            reason: 'wrangler.jsonc has no env.preview block',
        });
        expect(planDeploys(root, {}).find((e) => e.app === 'noprev')).toMatchObject({ deploy: true });
    });

    it('gives each planned app its appType, so CI caches by it', () => {
        const root = workspace();
        const plan = planDeploys(root, {});
        expect(plan.find((e) => e.app === 'landing')).toMatchObject({ deploy: true, appType: 'nextjs' });
        expect(plan.find((e) => e.app === 'web')).toMatchObject({ deploy: true, appType: 'vite' });
        // A manifest that does not read has no appType to give.
        fs.outputFileSync(path.join(root, 'apps/web/cloudflare-config.json'), '{ broken');
        expect(planDeploys(root, {}).find((e) => e.app === 'web')?.appType).toBeUndefined();
    });

    it('hands the deployed URL to the next GitHub step, and nothing that could break the file', () => {
        const root = workspace();
        const outputs = path.join(root, 'outputs.txt');
        vi.stubEnv('GITHUB_OUTPUT', outputs);
        writeStepOutputs({ url: 'https://web-pr-1.me.workers.dev', worker: 'web-pr-1', empty: '', none: null });
        writeStepOutputs({ forged: 'x\nurl=https://evil.example' });
        expect(fs.readFileSync(outputs, 'utf8')).toBe('url=https://web-pr-1.me.workers.dev\nworker=web-pr-1\n');
        vi.stubEnv('GITHUB_OUTPUT', '');
        writeStepOutputs({ url: 'https://x' }); // no file: nothing to do, nothing thrown
    });

    it('--config-only writes the filled config and stops, for a pipeline that builds its own way', async () => {
        const root = workspace();
        // The env a pipeline deploys by hand (the demo's env.demo), with a binding that is a name, not a value.
        const demo = WRANGLER.replace(
            '"preview": {',
            '"demo": { "d1_databases": [{ "binding": "OBCF_D1", "database_id": "DEMO_D1_ID" }, { "binding": "DEMO_DB", "database_id": "DEMO_DB_ID" }] },\n        "preview": {',
        );
        fs.outputFileSync(path.join(root, 'apps/web/wrangler.jsonc'), demo);
        vi.stubEnv('DEMO_D1_ID', 'd1-demo');
        vi.stubEnv('DEMO_DB_ID', 'db-demo');
        const calls: string[] = [];
        const result = await deployApp(
            root,
            'web',
            { ci: true, env: 'demo', configOnly: true, force: true },
            fakeExec(root, calls),
        );
        expect(result.skipped).toBe('configured');
        expect(calls).toEqual([]); // no git, no build, no wrangler
        const written = parseJsonc(fs.readFileSync(path.join(root, 'apps/web/wrangler.demo.jsonc'), 'utf8')) as {
            env: { demo: { d1_databases: { binding: string; database_id: string }[] } };
        };
        expect(written.env.demo.d1_databases).toEqual([
            { binding: 'OBCF_D1', database_id: 'd1-demo' },
            { binding: 'DEMO_DB', database_id: 'db-demo' },
        ]);
        vi.stubEnv('DEMO_DB_ID', '');
        await expect(
            deployApp(root, 'web', { ci: true, env: 'demo', configOnly: true, force: true }, fakeExec(root, [])),
        ).rejects.toThrow(/No value for DEMO_DB_ID/);
        await expect(deployCommand('web', { configOnly: true, buildOnly: true, ci: true })).rejects.toThrow(
            /takes no build, plan or cleanup flag/,
        );
    });

    it('refuses an id that is no DNS label, and flags that build nothing', async () => {
        expect(() => previewWorkerName('web', 'pr-')).toThrow(/inner dashes/);
        expect(() => previewWorkerName('web', '-pr')).toThrow(/inner dashes/);
        await expect(deployCommand('web', { ci: true, buildOnly: true, skipBuild: true })).rejects.toThrow(
            /would build nothing/,
        );
    });
});
