import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    bootstrap,
    deployApp,
    envSection,
    findPlaceholders,
    generatedSecretNames,
    parseAccountId,
    parseDeployedUrl,
    parseSetOptions,
    substitutePlaceholders,
    type Exec,
} from '../commands/deploy.js';

const WRANGLER = `{
    // the dev defaults
    "name": "shop",
    "d1_databases": [{ "binding": "OBCF_D1", "database_name": "shop-db", "database_id": "YOUR_D1_DATABASE_ID" }],
    "vars": { "NODE_ENV": "production", "HTTP_MODE": "HTTP_MODE" },
    "env": {
        "production": {
            "vars": { "ENVIRONMENT": "production", "CLOUDFLARE_ACCOUNT_ID": "CLOUDFLARE_ACCOUNT_ID" },
            "d1_databases": [{ "binding": "OBCF_D1", "database_name": "shop-db", "database_id": "D1_DATABASE_ID" }],
            "kv_namespaces": [{ "binding": "OBCF_KV", "id": "KV_NAMESPACE_ID" }], // a "}" in a comment
            "r2_buckets": [{ "binding": "OBCF_R2", "bucket_name": "shop-bucket" }],
        },
        "demo": {
            "d1_databases": [{ "binding": "OBCF_D1", "database_name": "shop-db-demo", "database_id": "D1_DATABASE_ID" }],
            "kv_namespaces": [{ "binding": "OBCF_KV", "id": "DEMO_KV_NAMESPACE_ID" }],
        },
    },
}
`;

describe('wrangler.jsonc placeholders', () => {
    it('finds the env block by brace matching, through comments and strings', () => {
        const section = envSection(WRANGLER, 'production')!;
        const block = WRANGLER.slice(section.start, section.end);
        expect(block.startsWith('{')).toBe(true);
        expect(block.endsWith('}')).toBe(true);
        expect(block).toContain('shop-bucket');
        expect(block).not.toContain('shop-db-demo');
        expect(envSection(WRANGLER, 'staging')).toBeNull();
    });

    it('lists ALL_CAPS placeholders once, skipping bindings and protocol words', () => {
        const section = envSection(WRANGLER, 'production')!;
        expect(findPlaceholders(WRANGLER.slice(section.start, section.end))).toEqual([
            'CLOUDFLARE_ACCOUNT_ID',
            'D1_DATABASE_ID',
            'KV_NAMESPACE_ID',
        ]);
        // The dev default YOUR_* values sit outside every env block and are never substituted.
        expect(findPlaceholders(WRANGLER)[0]).toBe('YOUR_D1_DATABASE_ID');
    });

    it('substitutes inside the chosen env block only and reports what is missing', () => {
        const { content, placeholders, missing } = substitutePlaceholders(WRANGLER, 'production', {
            D1_DATABASE_ID: 'd1-prod',
            CLOUDFLARE_ACCOUNT_ID: 'acct',
        });
        expect(placeholders).toEqual(['CLOUDFLARE_ACCOUNT_ID', 'D1_DATABASE_ID', 'KV_NAMESPACE_ID']);
        expect(missing).toEqual(['KV_NAMESPACE_ID']);
        expect(content).toContain('"database_id": "d1-prod"');
        expect(content).toContain('"CLOUDFLARE_ACCOUNT_ID": "acct"');
        // The demo block shares the placeholder name and keeps it; so does the dev default.
        expect(content).toContain('"database_name": "shop-db-demo", "database_id": "D1_DATABASE_ID"');
        expect(content).toContain('YOUR_D1_DATABASE_ID');
        expect(() => substitutePlaceholders(WRANGLER, 'staging', {})).toThrow(/no env\.staging block/);
    });

    it('reads the account id, the deployed URL, the declared secrets and the --set pairs', () => {
        expect(parseAccountId('Account Name │ Account ID\n Me │ 0123456789abcdef0123456789abcdef │')).toBe(
            '0123456789abcdef0123456789abcdef',
        );
        expect(parseAccountId('not logged in')).toBeNull();
        expect(
            parseDeployedUrl('Deployed shop-production triggers (1.2s)\n  https://shop-production.me.workers.dev\n'),
        ).toBe('https://shop-production.me.workers.dev');
        expect(generatedSecretNames('AUTH_SECRET=\nAPP_ID=shop\nMIGRATION_SECRET=\nBOOTSTRAP_OWNER_SECRET=\n')).toEqual(
            ['AUTH_SECRET', 'MIGRATION_SECRET', 'BOOTSTRAP_OWNER_SECRET'],
        );
        expect(parseSetOptions(['A=1', 'B=x=y'])).toEqual({ A: '1', B: 'x=y' });
        expect(() => parseSetOptions(['=1'])).toThrow(/KEY=VALUE/);
    });
});

const roots: string[] = [];
afterEach(() => {
    for (const root of roots.splice(0)) fs.removeSync(root);
});

function fixture(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'otta-deploy-'));
    roots.push(root);
    const write = (file: string, content: string) => fs.outputFileSync(path.join(root, file), content);
    write('pnpm-workspace.yaml', 'packages:\n  - apps/*\n');
    write('apps/shop/package.json', JSON.stringify({ name: '@ottabase/shop' }));
    write('apps/shop/wrangler.jsonc', WRANGLER);
    write(
        'apps/shop/.env.example',
        'AUTH_SECRET=\nAUTH_URL=\nMIGRATION_SECRET=\nBOOTSTRAP_OWNER_SECRET=\nCRON_SECRET=\n',
    );
    write('apps/shop/node_modules/wrangler/bin/wrangler.js', '// stub');
    return root;
}

/** A runner that answers like wrangler and pnpm do, and records every call. */
function fakeExec(calls: string[][], overrides: { existingSecrets?: string[] } = {}): Exec {
    return (command, args) => {
        const line = [path.basename(command), ...args].join(' ');
        calls.push([command, ...args]);
        if (line.includes('whoami')) return 'Me │ 0123456789abcdef0123456789abcdef │';
        if (line.includes('cf:setup')) return 'Setup Complete!\n{"D1_DATABASE_ID":"d1-id","KV_NAMESPACE_ID":"kv-id"}';
        if (line.includes(' deploy ')) return 'Deployed\n  https://shop-production.me.workers.dev\n';
        if (line.includes('secret list'))
            return JSON.stringify((overrides.existingSecrets ?? []).map((name) => ({ name })));
        if (line.includes('secret bulk')) {
            // The bulk file holds what is set; keep its content for the assertions, then it is removed.
            const file = args[args.indexOf('bulk') + 1];
            calls.push(['bulk-file', fs.readFileSync(file, 'utf8')]);
            return 'ok';
        }
        return '';
    };
}

function fakeFetch(log: string[], state: { ready: boolean } = { ready: false }): typeof fetch {
    return (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        log.push(`${init?.method ?? 'GET'} ${url}`);
        if (url.endsWith('/api/status'))
            return new Response(JSON.stringify({ state: state.ready ? 'READY' : 'UNINITIALIZED' }));
        if (url.endsWith('/api/health')) return new Response('{"ok":true}');
        if (url.includes('/__bootstrap__/api/')) return new Response('{}', { status: 200 });
        return new Response('nope', { status: 404 });
    }) as typeof fetch;
}

describe('deployApp', () => {
    it('creates the resources, fills the config, builds, deploys, sets the missing secrets and bootstraps', async () => {
        const root = fixture();
        const calls: string[][] = [];
        const requests: string[] = [];
        const result = await deployApp(
            root,
            'shop',
            { ownerEmail: 'me@example.com', ownerPassword: 'pw', skipPackages: true },
            fakeExec(calls),
            fakeFetch(requests),
        );
        const flat = calls.map((call) => call.join(' '));
        expect(flat.some((call) => call.includes('cf:setup -- --force --json --app=shop --env=production'))).toBe(true);
        expect(flat.some((call) => call.includes('run build'))).toBe(true);
        expect(
            flat.some((call) => /wrangler\.js deploy --env production --config wrangler\.production\.jsonc/.test(call)),
        ).toBe(true);

        const config = fs.readFileSync(path.join(root, 'apps/shop/wrangler.production.jsonc'), 'utf8');
        expect(config).toContain('"database_id": "d1-id"');
        expect(config).toContain('"id": "kv-id"');
        expect(config).toContain('"CLOUDFLARE_ACCOUNT_ID": "0123456789abcdef0123456789abcdef"');

        const bulk = JSON.parse(calls.find((call) => call[0] === 'bulk-file')![1]) as Record<string, string>;
        expect(Object.keys(bulk).sort()).toEqual([
            'AUTH_SECRET',
            'AUTH_URL',
            'BOOTSTRAP_OWNER_SECRET',
            'CRON_SECRET',
            'MIGRATION_SECRET',
        ]);
        expect(bulk.AUTH_URL).toBe('https://shop-production.me.workers.dev');
        expect(bulk.AUTH_SECRET).toHaveLength(32);
        expect(fs.existsSync(path.join(root, 'apps/shop/.wrangler'))).toBe(true);
        expect(fs.readdirSync(path.join(root, 'apps/shop/.wrangler'))).toEqual([]);

        expect(requests).toEqual([
            'GET https://shop-production.me.workers.dev/__bootstrap__/api/status',
            'POST https://shop-production.me.workers.dev/__bootstrap__/api/init',
            'POST https://shop-production.me.workers.dev/__bootstrap__/api/seed',
            'POST https://shop-production.me.workers.dev/__bootstrap__/api/create-owner',
            'POST https://shop-production.me.workers.dev/__bootstrap__/api/finalize',
            'GET https://shop-production.me.workers.dev/api/health',
        ]);
        expect(result).toMatchObject({
            bootstrapped: true,
            healthy: true,
            workerUrl: 'https://shop-production.me.workers.dev',
        });
    });

    it('keeps the secrets that exist, skips the bootstrap it cannot do, and honours --url', async () => {
        const root = fixture();
        const calls: string[][] = [];
        const requests: string[] = [];
        const result = await deployApp(
            root,
            'shop',
            {
                skipPackages: true,
                skipBuild: true,
                url: 'https://shop.example.com',
                ownerEmail: 'me@example.com',
                ownerPassword: 'pw',
            },
            fakeExec(calls, {
                existingSecrets: [
                    'AUTH_SECRET',
                    'AUTH_URL',
                    'MIGRATION_SECRET',
                    'BOOTSTRAP_OWNER_SECRET',
                    'CRON_SECRET',
                ],
            }),
            fakeFetch(requests),
        );
        expect(calls.some((call) => call[0] === 'bulk-file')).toBe(false);
        expect(calls.map((call) => call.join(' ')).some((call) => call.includes('run build'))).toBe(false);
        expect(result.secretsSet).toEqual([]);
        // The owner was given, but the bootstrap secret is not ours to know: nothing was bootstrapped.
        expect(result.bootstrapped).toBe(false);
        expect(requests).toEqual(['GET https://shop.example.com/api/health']);
    });

    it('refuses a missing placeholder value, a missing env block, and a missing login', async () => {
        const root = fixture();
        const calls: string[][] = [];
        await expect(deployApp(root, 'shop', { env: 'demo', skipPackages: true }, fakeExec(calls))).rejects.toThrow(
            /No value for/,
        );
        await expect(deployApp(root, 'shop', { env: 'staging' }, fakeExec(calls))).rejects.toThrow(/no env\.staging/);
        const loggedOut: Exec = () => {
            throw new Error('not authenticated');
        };
        await expect(deployApp(root, 'shop', {}, loggedOut)).rejects.toThrow(/pnpm cf:login/);
        await expect(deployApp(root, 'nope', {})).rejects.toThrow(/no wrangler\.jsonc/);
    });

    it('a dry run writes nothing and runs nothing but whoami', async () => {
        const root = fixture();
        const calls: string[][] = [];
        const result = await deployApp(root, 'shop', { dryRun: true }, fakeExec(calls));
        expect(calls).toHaveLength(1);
        expect(fs.existsSync(path.join(root, 'apps/shop/wrangler.production.jsonc'))).toBe(false);
        expect(result.workerUrl).toBeNull();
    });
});

describe('bootstrap', () => {
    it('stops at the first refusal and skips a platform that is READY', async () => {
        const requests: string[] = [];
        const refusing: typeof fetch = (async (input: string | URL | Request) => {
            const url = String(input);
            requests.push(url);
            if (url.endsWith('/api/status')) return new Response('{"state":"BOOTSTRAPPING"}');
            if (url.endsWith('/api/seed')) return new Response('{"error":"nope"}', { status: 403 });
            return new Response('{}');
        }) as typeof fetch;
        expect(await bootstrap(refusing, 'https://x', 's', { email: 'a@b.c', password: 'p', name: 'a' })).toBe(false);
        expect(requests.map((url) => url.split('/api/')[1])).toEqual(['status', 'init', 'seed']);

        const ready: string[] = [];
        expect(
            await bootstrap(fakeFetch(ready, { ready: true }), 'https://x', 's', {
                email: 'a@b.c',
                password: 'p',
                name: 'a',
            }),
        ).toBe(true);
        expect(ready).toEqual(['GET https://x/__bootstrap__/api/status']);
    });
});
