import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    isAffected,
    listDeployableApps,
    readDeployConfig,
    watchPaths,
    workspaceDependencyDirs,
    workspaceGlobs,
} from '../commands/deploy-plan.js';
import { ciCommit, deployAll, deployApp, type Exec } from '../commands/deploy.js';

const WRANGLER = `{
    "name": "web",
    "env": {
        "production": {
            "vars": { "ENVIRONMENT": "production", "CLOUDFLARE_ACCOUNT_ID": "CLOUDFLARE_ACCOUNT_ID" },
            "d1_databases": [{ "binding": "OBCF_D1", "database_name": "web-db", "database_id": "D1_DATABASE_ID" }],
            "kv_namespaces": [{ "binding": "OBCF_KV", "id": "KV_NAMESPACE_ID" }],
        },
    },
}
`;

const roots: string[] = [];
afterEach(() => {
    for (const root of roots.splice(0)) fs.removeSync(root);
    vi.unstubAllEnvs();
});

/**
 * A workspace: web depends on ui, ui on utils; landing is a Next app with a worker build; tool is not
 * deployable; nocfg has no cloudflare-config.json; unused is a package nobody depends on.
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
    json('apps/web/cloudflare-config.json', { appType: 'vite', verifyPaths: ['dist'], healthCheckPath: '/health' });
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
    });
    text('apps/landing/node_modules/wrangler/bin/wrangler.js', '// stub');

    json('apps/tool/package.json', { name: '@x/tool', scripts: { build: 'tsc' } });
    json('apps/tool/cloudflare-config.json', { deployable: false });
    json('apps/nocfg/package.json', { name: '@x/nocfg' });
    return root;
}

/** Answers like git, turbo, pnpm and wrangler do; a build leaves its output so verifyPaths passes. */
function fakeExec(root: string, calls: string[], answers: { diff?: string | Error } = {}): Exec {
    return (command, args, options) => {
        const line = [path.basename(command), ...args].join(' ');
        calls.push(line);
        if (command === 'git') {
            if (answers.diff instanceof Error) throw answers.diff;
            return answers.diff ?? '';
        }
        const app = path.basename(options.cwd) === root ? null : path.basename(options.cwd);
        if (line.includes('run build:worker')) fs.ensureDirSync(path.join(root, 'apps/landing/.open-next'));
        else if (/--filter @x\/(\w+) run build$/.test(line)) {
            const name = /@x\/(\w+)/.exec(line)![1];
            fs.ensureDirSync(path.join(root, 'apps', name, 'dist'));
        }
        if (line.includes(' deploy ')) return `Deployed\n  https://${app}-production.me.workers.dev\n`;
        return '';
    };
}

function fakeFetch(requests: string[]): typeof fetch {
    return (async (input: string | URL | Request) => {
        requests.push(String(input));
        return new Response('ok');
    }) as typeof fetch;
}

function ciEnv(): void {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '0123456789abcdef0123456789abcdef');
    vi.stubEnv('D1_DATABASE_ID', 'd1-from-build-vars');
    vi.stubEnv('KV_NAMESPACE_ID', 'kv-from-build-vars');
}

describe('the deploy plan', () => {
    it('reads cloudflare-config.json with defaults, and the framework health path without one', () => {
        const root = workspace();
        expect(readDeployConfig(path.join(root, 'apps/landing'))).toMatchObject({
            declared: true,
            buildCommand: 'build',
            workerBuildCommand: 'build:worker',
            verifyPaths: ['.open-next'],
            wranglerEnv: 'production',
            healthCheckPath: '/',
        });
        expect(readDeployConfig(path.join(root, 'apps/nocfg'))).toMatchObject({
            declared: false,
            workerBuildCommand: null,
            verifyPaths: [],
            healthCheckPath: '/api/health',
        });
        fs.outputJsonSync(path.join(root, 'apps/nocfg/cloudflare-config.json'), { buildCommand: 'build && rm -rf /' });
        expect(() => readDeployConfig(path.join(root, 'apps/nocfg'))).toThrow(/not a package\.json script name/);
    });

    it('lists the deployable apps: a config, and not deployable:false', () => {
        expect(listDeployableApps(workspace())).toEqual(['landing', 'web']);
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
        expect(web).toEqual([
            'apps/web/**',
            'packages/ui/**',
            'packages/utils/**',
            '.nvmrc',
            'package.json',
            'pnpm-lock.yaml',
            'pnpm-workspace.yaml',
            'tsconfig.base.json',
            'tsconfig.json',
            'turbo.json',
        ]);
        expect(isAffected(['packages/utils/src/date.ts'], web)).toBe(true);
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

describe('otta deploy --ci', () => {
    beforeEach(ciEnv);

    it('builds the packages the app uses, builds, deploys; no login, no resources, no secrets', async () => {
        const root = workspace();
        const calls: string[] = [];
        const requests: string[] = [];
        const result = await deployApp(root, 'web', { ci: true }, fakeExec(root, calls), fakeFetch(requests));

        expect(calls.some((c) => c.includes('whoami') || c.includes('cf:setup') || c.includes('secret'))).toBe(false);
        expect(calls[0]).toMatch(/turbo run build --filter=@x\/web\^\.\.\.$/);
        expect(calls.some((c) => c.endsWith('--filter @x/web run build'))).toBe(true);
        expect(calls.some((c) => /deploy --env production --config wrangler\.production\.jsonc/.test(c))).toBe(true);

        const config = fs.readFileSync(path.join(root, 'apps/web/wrangler.production.jsonc'), 'utf8');
        expect(config).toContain('"database_id": "d1-from-build-vars"');
        expect(config).toContain('"id": "kv-from-build-vars"');
        expect(config).toContain('"CLOUDFLARE_ACCOUNT_ID": "0123456789abcdef0123456789abcdef"');
        expect(requests).toEqual(['https://web-production.me.workers.dev/health']);
        expect(result).toMatchObject({ healthy: true, skipped: null, secretsSet: [], bootstrapped: false });
    });

    it('runs the worker build a Next.js app names, and checks what it must leave', async () => {
        const root = workspace();
        const calls: string[] = [];
        await deployApp(root, 'landing', { ci: true, skipPackages: true }, fakeExec(root, calls), fakeFetch([]));
        const build = calls.findIndex((c) => c.endsWith('run build'));
        const worker = calls.findIndex((c) => c.endsWith('run build:worker'));
        expect(build).toBeGreaterThanOrEqual(0);
        expect(worker).toBeGreaterThan(build);

        // A build that leaves no .open-next never reaches wrangler.
        fs.removeSync(path.join(root, 'apps/landing/.open-next'));
        const silent: Exec = (command, args) =>
            [path.basename(command), ...args].join(' ').includes(' deploy ') ? 'x' : '';
        await expect(deployApp(root, 'landing', { ci: true, skipPackages: true }, silent)).rejects.toThrow(
            /left no \.open-next/,
        );
    });

    it('names a missing build variable instead of deploying', async () => {
        vi.stubEnv('KV_NAMESPACE_ID', '');
        const root = workspace();
        const calls: string[] = [];
        await expect(deployApp(root, 'web', { ci: true }, fakeExec(root, calls))).rejects.toThrow(
            /No value for KV_NAMESPACE_ID in env\.production\. Set it as build variables/,
        );
        expect(calls).toEqual([]);
    });

    it('--build-only stops before wrangler; --skip-build then deploys what it left', async () => {
        const root = workspace();
        const calls: string[] = [];
        const built = await deployApp(root, 'web', { ci: true, buildOnly: true }, fakeExec(root, calls), fakeFetch([]));
        expect(built.skipped).toBe('built');
        expect(calls.some((c) => c.includes(' deploy '))).toBe(false);

        const deployCalls: string[] = [];
        await deployApp(
            root,
            'web',
            { ci: true, skipBuild: true, skipPackages: true },
            fakeExec(root, deployCalls),
            fakeFetch([]),
        );
        expect(deployCalls.some((c) => c.includes('run build'))).toBe(false);
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
        expect(unrelated).toEqual(['git diff --name-only --relative HEAD~1']);

        const related: string[] = [];
        const deployed = await deployApp(
            root,
            'web',
            { ci: true, changedSince: 'HEAD~1' },
            fakeExec(root, related, { diff: 'packages/utils/src/date.ts\n' }),
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
        const nestedCalls: string[] = [];
        const nested = await deployApp(
            root,
            'web',
            { ci: true, changedSince: 'HEAD~1' },
            fakeExec(root, nestedCalls, { diff: 'README.md\n' }),
            fakeFetch([]),
        );
        expect(nested.skipped).toBeNull();
        expect(nestedCalls.some((c) => c.startsWith('git diff'))).toBe(false);
        fs.removeSync(path.join(root, 'packages/ui/.git'));
        await expect(deployApp(root, 'web', { ci: true, changedSince: '--output=/tmp/x' })).rejects.toThrow(
            /not a git ref/,
        );
    });
});

describe('otta deploy --all', () => {
    beforeEach(ciEnv);

    it('deploys each deployable app that changed, and fails at the end when one failed', async () => {
        const root = workspace();
        const calls: string[] = [];
        // Only landing's own folder changed: web is skipped, landing deploys.
        const results = await deployAll(
            root,
            { ci: true, changedSince: 'HEAD~1', skipPackages: true },
            fakeExec(root, calls, { diff: 'apps/landing/app/page.tsx\n' }),
            fakeFetch([]),
        );
        expect(results.map((r) => [r.app, r.skipped])).toEqual([
            ['landing', null],
            ['web', 'unchanged'],
        ]);

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
