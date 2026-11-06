import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { planAdd, readPackageDescriptor } from '../commands/add.js';
import { readFootprints, stripClosure } from '../commands/footprints.js';
import { scaffoldApp } from '../commands/new.js';
import { keysToStrip, PRESETS } from '../commands/presets.js';
import { applyStrip, planStrip, stripMarkers } from '../commands/strip.js';

const roots: string[] = [];

/** A monorepo with three packages and an otta-web that carries a blog, comments, vault and the demo. */
function fixture(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'otta-strip-'));
    roots.push(root);
    const write = (file: string, content: string) => fs.outputFileSync(path.join(root, file), content);
    write('pnpm-workspace.yaml', 'packages:\n  - apps/*\n  - packages/*\n');
    write(
        'packages/ottablog/package.json',
        JSON.stringify({
            name: '@ottabase/ottablog',
            ottabase: {
                key: 'ottablog',
                factory: 'createOttablogPackage',
                tables: { import: '@ottabase/ottablog', names: ['postsTable', 'seriesTable'] },
            },
        }),
    );
    write(
        'packages/comments/package.json',
        JSON.stringify({
            name: '@ottabase/comments',
            ottabase: {
                key: 'comments',
                factory: 'createCommentsPackage',
                tables: { import: '@ottabase/comments/schema', names: ['commentsTable'] },
            },
        }),
    );
    write(
        'packages/vault/package.json',
        JSON.stringify({
            name: '@ottabase/vault',
            ottabase: {
                key: 'vault',
                factory: 'createVaultPackage',
                adminPages: [
                    {
                        path: '/admin/infrastructure/vault',
                        title: 'Vault',
                        icon: 'Archive',
                        group: 'infrastructure',
                        page: 'admin/infrastructure/VaultPage',
                        export: 'VaultPage',
                    },
                ],
            },
        }),
    );
    const app = 'apps/otta-web';
    write(
        `${app}/package.json`,
        JSON.stringify(
            {
                name: '@ottabase/otta-web',
                ottabase: {
                    start: {
                        development: {
                            processes: [
                                { name: 'web', url: 'http://127.0.0.1:3003' },
                                { name: 'worker', url: 'http://127.0.0.1:3004' },
                            ],
                        },
                    },
                },
                dependencies: {
                    '@ottabase/comments': 'workspace:*',
                    '@ottabase/kernel': 'workspace:*',
                    '@ottabase/ottablog': 'workspace:*',
                    '@ottabase/vault': 'workspace:*',
                    three: '^0.170.0',
                },
            },
            null,
            4,
        ) + '\n',
    );
    write(
        `${app}/ottabase/footprints.json`,
        JSON.stringify(
            {
                demo: { paths: ['src/pages/demo', 'public/ottabase-demo'], dependencies: ['three'] },
                ottablog: { paths: ['src/pages/blog', 'worker/routes/blog.ts'] },
                comments: { needs: ['ottablog'], paths: ['src/hooks/commentHooks.ts'] },
                vault: { paths: ['src/pages/admin/infrastructure/VaultPage.tsx'] },
            },
            null,
            4,
        ) + '\n',
    );
    write(
        `${app}/ottabase/packages.ts`,
        [
            "import { definePackageList } from './registry';",
            "import { corePackage } from './packages/core';",
            "import { commentsPackage } from './packages/comments';",
            "import { ottablogPackage } from './packages/ottablog';",
            "import { vaultPackage } from './packages/vault';",
            '',
            'definePackageList(() => [',
            '    corePackage,',
            '    ottablogPackage,',
            '    commentsPackage,',
            '    // Premium: collected like the rest.',
            '    vaultPackage,',
            ']);',
            '',
        ].join('\n'),
    );
    write(`${app}/ottabase/packages/core.ts`, 'export const corePackage = 1;\n');
    write(`${app}/ottabase/packages/ottablog.ts`, 'export const ottablogPackage = 1;\n');
    write(`${app}/ottabase/packages/comments.ts`, 'export const commentsPackage = 1;\n');
    write(`${app}/ottabase/packages/vault.ts`, 'export const vaultPackage = 1;\n');
    write(
        `${app}/src/ottabase/config/packages.ts`,
        [
            "import { definePackageClient } from '@ottabase/kernel/client';",
            "import { Archive, FileText } from 'lucide-react';",
            '',
            'export const CLIENT_PACKAGES = [',
            "    definePackageClient({ key: 'core' }),",
            "    definePackageClient({ key: 'ottablog' }),",
            "    definePackageClient({ key: 'comments' }),",
            '    definePackageClient({',
            "        key: 'vault',",
            '        adminPages: [',
            '            {',
            "                path: '/admin/infrastructure/vault',",
            "                title: 'Vault',",
            '                icon: Archive,',
            "                group: 'infrastructure',",
            "                load: () => import('@/pages/admin/infrastructure/VaultPage'),",
            "                exportName: 'VaultPage',",
            '            },',
            '        ],',
            '    }),',
            '];',
            'export const OTHER_ICON = FileText;',
            '',
        ].join('\n'),
    );
    write(
        `${app}/ottabase/db/schema.ts`,
        [
            "export { usersTable } from '@ottabase/ottaorm';",
            "export { commentsTable } from '@ottabase/comments/schema';",
            'export {',
            '    postsTable,',
            '    seriesTable,',
            "} from '@ottabase/ottablog';",
            '',
        ].join('\n'),
    );
    write(
        `${app}/src/router.tsx`,
        [
            "import { DemoBanner } from '@/components/DemoBanner'; // otta:only demo",
            "import { BrandScope } from '@ottabase/ui'; // otta:only ottablog",
            "import { Route } from '@tanstack/react-router';",
            '',
            '// otta:begin ottablog',
            "const blogRoute = new Route({ path: '/blog' });",
            '// otta:end ottablog',
            '// otta:begin demo',
            "const demoRoute = new Route({ path: '/demo' });",
            '// otta:end demo',
            'const routes = [',
            '    indexRoute,',
            '    demoRoute, // otta:only demo',
            '    blogRoute, // otta:only ottablog',
            '];',
            '',
        ].join('\n'),
    );
    write(
        `${app}/src/pages/home/HomePage.tsx`,
        [
            '// otta:begin demo',
            'export function HomePage() {',
            '    return <Marketing />;',
            '}',
            '// otta:end demo',
            '/* otta:unless demo',
            'export function HomePage() {',
            '    return <h1>Welcome</h1>;',
            '}',
            'otta:end demo */',
            '',
        ].join('\n'),
    );
    write(`${app}/src/pages/blog/BlogListPage.tsx`, 'export const BlogListPage = 1;\n');
    write(`${app}/src/pages/demo/DemoIndexPage.tsx`, 'export const DemoIndexPage = 1;\n');
    write(`${app}/src/pages/admin/infrastructure/VaultPage.tsx`, 'export const VaultPage = 1;\n');
    write(`${app}/src/hooks/commentHooks.ts`, 'export const useComments = 1;\n');
    write(`${app}/worker/routes/blog.ts`, 'export const blog = 1;\n');
    write(`${app}/public/ottabase-demo/shot.png`, 'png');
    write(
        `${app}/wrangler.jsonc`,
        JSON.stringify(
            {
                name: 'otta-web',
                d1_databases: [
                    {
                        binding: 'OBCF_D1',
                        database_name: 'ottabase-db',
                        database_id: 'YOUR_D1_DATABASE_ID',
                        preview_database_id: 'preview',
                    },
                ],
                r2_buckets: [
                    {
                        binding: 'OBCF_R2',
                        bucket_name: 'ottabase-bucket',
                        preview_bucket_name: 'ottabase-bucket-preview',
                    },
                    { binding: 'OBCF_R2_PRIVATE', bucket_name: 'ottabase-files-private-preview' },
                    { binding: 'OBCF_R2_VAULT', bucket_name: 'ottabase-vault' },
                ],
                queues: { producers: [{ binding: 'OBCF_QUEUE', queue: 'ottabase-queue-demo' }] },
                // Local dev and production share their ids, as in the real template.
                unsafe: { bindings: [{ namespace_id: '1001' }, { namespace_id: '2001' }] },
                dev: { port: 3004 },
                env: {
                    production: {
                        d1_databases: [
                            { binding: 'OBCF_D1', database_name: 'ottabase-db', database_id: 'D1_DATABASE_ID' },
                        ],
                        r2_buckets: [{ binding: 'OBCF_R2', bucket_name: 'ottabase-bucket' }],
                        kv_namespaces: [{ binding: 'OBCF_KV', id: 'KV_NAMESPACE_ID' }],
                        unsafe: { bindings: [{ namespace_id: '1001' }, { namespace_id: '2001' }] },
                        vars: { CLOUDFLARE_ACCOUNT_ID: 'CLOUDFLARE_ACCOUNT_ID' },
                    },
                    preview: {
                        d1_databases: [
                            {
                                binding: 'OBCF_D1',
                                database_name: 'ottabase-db-preview',
                                database_id: 'D1_PREVIEW_DATABASE_ID',
                            },
                        ],
                        r2_buckets: [{ binding: 'OBCF_R2', bucket_name: 'ottabase-bucket-preview' }],
                        unsafe: { bindings: [{ namespace_id: '1002' }] },
                    },
                },
            },
            null,
            4,
        ) + '\n',
    );
    write(`${app}/cloudflare-config.json`, '{ "deployable": false, "healthCheckPath": "/api/health" }\n');
    write(`${app}/.env.example`, 'AUTH_SECRET=\nAPP_ID=otta-web\n');
    write(`${app}/.env.local`, 'AUTH_SECRET=secret\n');
    write(`${app}/README.md`, '# otta-web\n');
    write(
        `${app}/ottabase/ottabase.config.ts`,
        [
            'export default defineOttabaseConfig({',
            "    appId: 'otta-web',",
            "    appName: 'Ottabase Template App',",
            "    meta: { description: 'A template app', author: '@thinkdj', companyName: 'Ottabase' },",
            '});',
            '',
        ].join('\n'),
    );
    // Ports where the template writes them; a size in pixels is not a port.
    write(
        `${app}/vite.config.ts`,
        [
            "export default { server: { port: parseInt(process.env.PORT_FE || '3003'),",
            '    proxy: { target: `http://127.0.0.1:${process.env.PORT_BE || 3004}` } }, maxHeight: 3004 };',
            '',
        ].join('\n'),
    );

    // The landing template: it reads otta-web's database and public bucket.
    const landing = 'apps/otta-landing';
    write(
        `${landing}/package.json`,
        JSON.stringify({
            name: '@ottabase/otta-landing',
            ottabase: { start: { development: { processes: [{ name: 'web', url: 'http://127.0.0.1:3000' }] } } },
        }),
    );
    write(
        `${landing}/README.md`,
        "# otta-landing\n\nShows what otta-web's admin writes: edit it at http://localhost:3003/admin.\nThe site runs on :3000, at 10:30 or any time.\n",
    );
    write(
        `${landing}/next.config.js`,
        "initOpenNextCloudflareForDev({ persist: { path: path.resolve(__dirname, '../otta-web/.wrangler/state/v3') } });\n",
    );
    write(
        `${landing}/wrangler.jsonc`,
        [
            '{',
            '    "name": "otta-landing",',
            '    // The SAME D1 database as apps/otta-web.',
            '    "d1_databases": [',
            '        { "binding": "OBCF_D1", "database_name": "ottabase-db", "database_id": "YOUR_D1_DATABASE_ID", "preview_database_id": "preview" },',
            '    ],',
            '    "r2_buckets": [',
            '        { "binding": "OBCF_R2", "bucket_name": "ottabase-bucket", "preview_bucket_name": "ottabase-bucket-preview" },',
            '    ],',
            '    "vars": { "APP_ID": "otta-web" },',
            '    "dev": { "port": 8788 },',
            '    "env": {',
            '        "production": {',
            '            "d1_databases": [{ "binding": "OBCF_D1", "database_name": "ottabase-db", "database_id": "D1_DATABASE_ID" }],',
            '            "r2_buckets": [{ "binding": "OBCF_R2", "bucket_name": "ottabase-bucket" }],',
            '            "vars": { "ENVIRONMENT": "production", "APP_ID": "otta-web" },',
            '        },',
            '        "preview": {',
            '            "d1_databases": [{ "binding": "OBCF_D1", "database_name": "ottabase-db-preview", "database_id": "D1_PREVIEW_DATABASE_ID" }],',
            '            "r2_buckets": [{ "binding": "OBCF_R2", "bucket_name": "ottabase-bucket-preview" }],',
            '            "vars": { "APP_ID": "otta-web" },',
            '        },',
            '    },',
            '}',
            '',
        ].join('\n'),
    );

    // The worker template names its resources after itself.
    write('apps/otta-worker/package.json', JSON.stringify({ name: '@ottabase/otta-worker' }));
    write(
        'apps/otta-worker/wrangler.jsonc',
        JSON.stringify({
            name: 'otta-worker',
            d1_databases: [{ binding: 'OBCF_D1', database_name: 'otta-worker', database_id: 'D1_DATABASE_ID' }],
            r2_buckets: [{ binding: 'OBCF_R2', bucket_name: 'otta-worker' }],
            vars: { APP_ID: 'otta-worker' },
        }),
    );

    // Another app in the account, holding a rate limiter id of its own.
    write('apps/otta-cache/wrangler.jsonc', '{ "unsafe": { "bindings": [{ "namespace_id": "3000" }] } }\n');
    return root;
}

afterEach(() => {
    for (const root of roots.splice(0)) fs.removeSync(root);
});

const read = (root: string, file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('stripMarkers', () => {
    const source = [
        'keep',
        'a // otta:only x',
        'b // otta:only y, z',
        '// otta:begin x',
        'in x',
        '// otta:end x',
        '// otta:begin y',
        'in y',
        '// otta:begin x',
        'nested x in y',
        '// otta:end x',
        '// otta:end y',
        '/* otta:unless x',
        'live when x goes',
        'otta:end x */',
    ].join('\n');

    it('removes only lines and blocks of the stripped keys, uncovers unless blocks, keeps the rest', () => {
        const { content, errors } = stripMarkers(source, new Set(['x']));
        expect(errors).toEqual([]);
        expect(content.split('\n')).toEqual([
            'keep',
            'b // otta:only y, z',
            '// otta:begin y',
            'in y',
            '// otta:end y',
            'live when x goes',
        ]);
    });

    it('a line shared by several keys goes when the last of them goes', () => {
        expect(stripMarkers(source, new Set(['z'])).content).toContain('b // otta:only y, z');
        const { content } = stripMarkers(source, new Set(['y', 'z']));
        expect(content).not.toContain('b // otta:only');
        expect(content).toContain('a // otta:only x');
        expect(content).toContain('/* otta:unless x');
    });

    it('reports an unterminated block and an end without a begin, whichever key is stripped', () => {
        expect(stripMarkers('// otta:begin x\nq\n', new Set(['x'])).errors[0]).toMatch(/no matching otta:end x/);
        expect(stripMarkers('// otta:begin x\nq\n', new Set(['y'])).errors[0]).toMatch(/no matching otta:end x/);
        expect(stripMarkers('q\n// otta:end x\n', new Set(['x'])).errors[0]).toMatch(/without a begin/);
        expect(stripMarkers('q\n// otta:end x\n', new Set(['y'])).errors[0]).toMatch(/without a begin/);
    });

    it('keeps CRLF line endings', () => {
        expect(stripMarkers('a\r\nb // otta:only x\r\nc\r\n', new Set(['x'])).content).toBe('a\r\nc\r\n');
    });
});

describe('footprints', () => {
    it('reads the map and refuses paths that leave the app', () => {
        const root = fixture();
        expect(Object.keys(readFootprints(path.join(root, 'apps', 'otta-web'))).sort()).toEqual([
            'comments',
            'demo',
            'ottablog',
            'vault',
        ]);
        fs.outputJsonSync(path.join(root, 'apps', 'otta-web', 'ottabase', 'footprints.json'), {
            $comment: 'ignored',
            x: { paths: ['x.ts'] },
        });
        expect(Object.keys(readFootprints(path.join(root, 'apps', 'otta-web')))).toEqual(['x']);
        fs.outputJsonSync(path.join(root, 'apps', 'otta-web', 'ottabase', 'footprints.json'), {
            x: { paths: ['../escape'] },
        });
        expect(() => readFootprints(path.join(root, 'apps', 'otta-web'))).toThrow(/must stay inside the app/);
    });

    it('closes over needs transitively', () => {
        const footprints = { a: {}, b: { needs: ['a'] }, c: { needs: ['b'] }, d: {} };
        expect(stripClosure(footprints, ['a']).sort()).toEqual(['a', 'b', 'c']);
        expect(stripClosure(footprints, ['d'])).toEqual(['d']);
    });
});

describe('planStrip', () => {
    it('strips a package: wiring, files, markers, dependency, and what needs it', () => {
        const root = fixture();
        const plan = planStrip(root, 'otta-web', ['ottablog']);
        expect(plan.keys.sort()).toEqual(['comments', 'ottablog']);
        const byFile = Object.fromEntries(plan.steps.map((step) => [step.file, step]));
        expect(byFile['apps/otta-web/ottabase/packages/ottablog.ts'].action).toBe('delete');
        expect(byFile['apps/otta-web/ottabase/packages/comments.ts'].action).toBe('delete');
        expect(byFile['apps/otta-web/src/pages/blog'].action).toBe('delete');
        expect(byFile['apps/otta-web/worker/routes/blog.ts'].action).toBe('delete');
        expect(byFile['apps/otta-web/src/hooks/commentHooks.ts'].action).toBe('delete');
        expect(byFile['apps/otta-web/src/pages/demo']).toBeUndefined();

        applyStrip(root, plan);
        const list = read(root, 'apps/otta-web/ottabase/packages.ts');
        expect(list).not.toContain('ottablog');
        expect(list).not.toContain('comments');
        expect(list).toContain('    vaultPackage,');
        expect(list).toContain('// Premium');
        const client = read(root, 'apps/otta-web/src/ottabase/config/packages.ts');
        expect(client).not.toContain("'ottablog'");
        expect(client).not.toContain("'comments'");
        expect(client).toContain("key: 'vault'");
        expect(client).toContain("import { Archive, FileText } from 'lucide-react';");
        const schema = read(root, 'apps/otta-web/ottabase/db/schema.ts');
        expect(schema).toBe("export { usersTable } from '@ottabase/ottaorm';\n");
        const pkg = fs.readJsonSync(path.join(root, 'apps/otta-web/package.json'));
        expect(Object.keys(pkg.dependencies)).toEqual(['@ottabase/kernel', '@ottabase/vault', 'three']);
        const router = read(root, 'apps/otta-web/src/router.tsx');
        expect(router).not.toContain('BrandScope');
        expect(router).not.toContain('blogRoute');
        expect(router).toContain('demoRoute, // otta:only demo');
        expect(router).toContain('// otta:begin demo');
        expect(fs.existsSync(path.join(root, 'apps/otta-web/src/pages/blog'))).toBe(false);
        expect(fs.existsSync(path.join(root, 'apps/otta-web/src/pages/demo/DemoIndexPage.tsx'))).toBe(true);
        expect(Object.keys(readFootprints(path.join(root, 'apps/otta-web'))).sort()).toEqual(['demo', 'vault']);

        // A second strip finds nothing left to do.
        const again = planStrip(root, 'otta-web', ['ottablog']);
        expect(again.steps.every((step) => step.action === 'skip')).toBe(true);
    });

    it('strips the demo: a footprint-only key with its own dependency and an unless block', () => {
        const root = fixture();
        applyStrip(root, planStrip(root, 'otta-web', ['demo']));
        expect(fs.existsSync(path.join(root, 'apps/otta-web/src/pages/demo'))).toBe(false);
        expect(fs.existsSync(path.join(root, 'apps/otta-web/public/ottabase-demo'))).toBe(false);
        expect(fs.readJsonSync(path.join(root, 'apps/otta-web/package.json')).dependencies.three).toBeUndefined();
        const home = read(root, 'apps/otta-web/src/pages/home/HomePage.tsx');
        expect(home).toBe('export function HomePage() {\n    return <h1>Welcome</h1>;\n}\n');
        const router = read(root, 'apps/otta-web/src/router.tsx');
        expect(router).not.toContain('DemoBanner');
        expect(router).not.toContain('demoRoute');
        expect(router).toContain('blogRoute, // otta:only ottablog');
    });

    it('strips a package with an admin page and prunes its icon from the lucide import', () => {
        const root = fixture();
        applyStrip(root, planStrip(root, 'otta-web', ['vault']));
        const client = read(root, 'apps/otta-web/src/ottabase/config/packages.ts');
        expect(client).not.toContain('vault');
        expect(client).toContain("import { FileText } from 'lucide-react';");
        expect(fs.existsSync(path.join(root, 'apps/otta-web/src/pages/admin/infrastructure/VaultPage.tsx'))).toBe(
            false,
        );
    });

    it('refuses a key that is neither a package nor a footprint, and a marker it cannot pair', () => {
        const root = fixture();
        expect(() => planStrip(root, 'otta-web', ['nothing'])).toThrow(/neither a workspace package nor a key/);
        fs.appendFileSync(path.join(root, 'apps/otta-web/src/router.tsx'), '// otta:begin vault\n');
        expect(() => planStrip(root, 'otta-web', ['vault'])).toThrow(/no matching otta:end vault/);
    });
});

describe('otta add after a strip', () => {
    it('copies the pages the reference app lists in its footprint for the package', () => {
        const root = fixture();
        scaffoldApp(root, 'web', 'lean', { preset: 'minimal' });
        const plan = planAdd(root, 'lean', readPackageDescriptor(root, 'vault'));
        const page = plan.steps.find((step) => step.file === 'apps/lean/src/pages/admin/infrastructure/VaultPage.tsx');
        expect(page?.action).toBe('create');
        expect(page?.detail).toBe('copied from apps/otta-web');
        expect(plan.steps.some((step) => step.detail.includes('otta:only vault'))).toBe(true);
    });
});

describe('scaffoldApp', () => {
    it('copies the template, keeps .env.example, and names the Cloudflare resources after the app', () => {
        const root = fixture();
        const result = scaffoldApp(root, 'web', 'shop');
        expect(result.stripped).toEqual([]);
        expect(fs.existsSync(path.join(root, 'apps/shop/.env.example'))).toBe(true);
        expect(fs.existsSync(path.join(root, 'apps/shop/.env.local'))).toBe(false);
        expect(fs.readJsonSync(path.join(root, 'apps/shop/package.json')).name).toBe('@ottabase/shop');
        expect(read(root, 'apps/shop/wrangler.jsonc')).toContain('"name": "shop"');
        // Every resource the template names after the framework becomes ottabase-<app>-…: a second app in the
        // account shares no database, no bucket (private files and backups included) and no queue.
        const wrangler = read(root, 'apps/shop/wrangler.jsonc');
        for (const name of ['db', 'bucket', 'files-private-preview', 'vault', 'queue-demo']) {
            expect(wrangler).toContain(`"ottabase-shop-${name}"`);
        }
        expect(wrangler).not.toMatch(/"ottabase-(db|bucket|files|vault|queue)/);
        // The template stays out of CI; the app made from it ships.
        expect(fs.readJsonSync(path.join(root, 'apps/shop/cloudflare-config.json'))).toEqual({
            deployable: true,
            healthCheckPath: '/api/health',
        });
        expect(read(root, 'apps/shop/README.md')).toBe('# shop\n');
        // Its identity is its own too: appId scopes rows in a database apps may share, and the auth cookies.
        const config = read(root, 'apps/shop/ottabase/ottabase.config.ts');
        expect(config).toContain("appId: 'shop',");
        expect(config).toContain("appName: 'Shop',");
        expect(config).toContain("meta: { description: 'Shop', author: '', companyName: 'Shop' }");
        // .env.example's APP_ID outranks the file in dev (pnpm env:secrets copies it to .env.local).
        expect(read(root, 'apps/shop/.env.example')).toBe('AUTH_SECRET=\nAPP_ID=shop\n');
    });

    it("prefixes every placeholder but the account's, so CI's one bag of values never crosses two apps", () => {
        const root = fixture();
        const result = scaffoldApp(root, 'web', 'my-shop');
        const config = JSON.parse(read(root, 'apps/my-shop/wrangler.jsonc'));
        expect(config.d1_databases[0].database_id).toBe('OTTABASE_MY_SHOP_YOUR_D1_DATABASE_ID');
        expect(config.env.production.d1_databases[0].database_id).toBe('OTTABASE_MY_SHOP_D1_DATABASE_ID');
        expect(config.env.production.kv_namespaces[0].id).toBe('OTTABASE_MY_SHOP_KV_NAMESPACE_ID');
        expect(config.env.production.vars.CLOUDFLARE_ACCOUNT_ID).toBe('CLOUDFLARE_ACCOUNT_ID');
        expect(result.ciValues).toEqual({
            production: [
                'OTTABASE_MY_SHOP_D1_DATABASE_ID',
                'OTTABASE_MY_SHOP_KV_NAMESPACE_ID',
                'CLOUDFLARE_ACCOUNT_ID',
            ],
            preview: ['OTTABASE_MY_SHOP_D1_PREVIEW_DATABASE_ID'],
        });
        // The template keeps its own names.
        expect(read(root, 'apps/otta-web/wrangler.jsonc')).toContain('"database_id": "D1_DATABASE_ID"');
    });

    it('moves the dev ports off every other app, wherever the template writes them', () => {
        const root = fixture();
        // otta-web holds 3003/3004, otta-landing 3000/8788: the first free ones at or above each.
        expect(scaffoldApp(root, 'web', 'shop').ports).toEqual([3005, 3006]);
        const pkg = fs.readJsonSync(path.join(root, 'apps/shop/package.json'));
        expect(pkg.ottabase.start.development.processes.map((p: { url: string }) => p.url)).toEqual([
            'http://127.0.0.1:3005',
            'http://127.0.0.1:3006',
        ]);
        expect(JSON.parse(read(root, 'apps/shop/wrangler.jsonc')).dev.port).toBe(3006);
        const vite = read(root, 'apps/shop/vite.config.ts');
        expect(vite).toContain("PORT_FE || '3005'");
        expect(vite).toContain('PORT_BE || 3006}');
        expect(vite).toContain('maxHeight: 3004'); // a number, not a port
        expect(scaffoldApp(root, 'web', 'shop-two').ports).toEqual([3007, 3008]);
    });

    it("names a worker app's resources ottabase-<app>-… where the template named them after itself", () => {
        const root = fixture();
        scaffoldApp(root, 'worker', 'tool');
        const config = JSON.parse(read(root, 'apps/tool/wrangler.jsonc'));
        expect(config.name).toBe('tool');
        expect(config.d1_databases[0].database_name).toBe('ottabase-tool-db');
        expect(config.d1_databases[0].database_id).toBe('OTTABASE_TOOL_D1_DATABASE_ID');
        expect(config.r2_buckets[0].bucket_name).toBe('ottabase-tool-bucket');
        expect(config.vars.APP_ID).toBe('tool');
    });

    it('refuses an app name that makes a bucket name longer than Cloudflare allows', () => {
        const root = fixture();
        expect(() => scaffoldApp(root, 'web', 'a'.repeat(40))).toThrow(/63 characters in a bucket or queue name/);
        expect(fs.existsSync(path.join(root, 'apps', 'a'.repeat(40)))).toBe(false);
    });

    it('gives each app rate limiter ids no other app holds, keeping the ids the template keeps equal', () => {
        const root = fixture();
        const ids = (app: string) => {
            const config = JSON.parse(read(root, `apps/${app}/wrangler.jsonc`));
            const of = (block: { unsafe: { bindings: { namespace_id: string }[] } }) =>
                block.unsafe.bindings.map((binding) => binding.namespace_id);
            return { top: of(config), production: of(config.env.production), preview: of(config.env.preview) };
        };
        scaffoldApp(root, 'web', 'shop');
        // After 3000, the highest id in apps/: one fresh id per distinct template id.
        expect(ids('shop')).toEqual({ top: ['3001', '3002'], production: ['3001', '3002'], preview: ['3003'] });
        scaffoldApp(root, 'web', 'my-shop');
        expect(ids('my-shop')).toEqual({ top: ['3004', '3005'], production: ['3004', '3005'], preview: ['3006'] });
        expect(read(root, 'apps/my-shop/ottabase/ottabase.config.ts')).toContain("appName: 'My Shop',");
        // The template keeps its own.
        expect(ids('otta-web').top).toEqual(['1001', '2001']);
    });

    it('pairs a landing app with the only web app: its database, public bucket, appId and dev state', () => {
        const root = fixture();
        const result = scaffoldApp(root, 'landing', 'site');
        expect(result.pairedWith).toBe('otta-web');
        const wrangler = read(root, 'apps/site/wrangler.jsonc');
        expect(wrangler).toContain('"name": "site"');
        // Not ottabase-site-db: otta deploy would create that, and it would be empty.
        expect(wrangler).not.toMatch(/site-|SITE/);
        expect(wrangler).toContain('"database_name": "ottabase-db-preview"');
        expect(wrangler).toContain('"database_id": "D1_PREVIEW_DATABASE_ID"');
        expect(wrangler).toContain('"APP_ID": "otta-web"');
        expect(read(root, 'apps/site/next.config.js')).toContain("'../otta-web/.wrangler/state/v3'");
        // Its own ports move; the ones it names for otta-web stay otta-web's.
        expect(result.ports).toEqual([3001, 8789]);
        expect(read(root, 'apps/site/README.md')).toContain('http://localhost:3003/admin');
        // A port in prose moves too; a time of day is not a port.
        expect(read(root, 'apps/site/README.md')).toContain('The site runs on :3001, at 10:30 or any time.');
        expect(result.ciValues).toEqual({ production: ['D1_DATABASE_ID'], preview: ['D1_PREVIEW_DATABASE_ID'] });
    });

    it('pairs a landing app with the web app --web names, by the names that app gives its resources', () => {
        const root = fixture();
        scaffoldApp(root, 'web', 'shop');
        expect(() => scaffoldApp(root, 'landing', 'site')).toThrow(/pass --web with one of: otta-web, shop/);
        expect(() => scaffoldApp(root, 'landing', 'site', { web: 'nope' })).toThrow(/no web app by that name/);
        expect(() => scaffoldApp(root, 'web', 'other', { web: 'shop' })).toThrow(/landing template only/);

        expect(scaffoldApp(root, 'landing', 'site', { web: 'shop' }).pairedWith).toBe('shop');
        const wrangler = read(root, 'apps/site/wrangler.jsonc');
        const config = JSON.parse(wrangler.replace(/\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1'));
        expect(config.d1_databases[0]).toEqual({
            binding: 'OBCF_D1',
            database_name: 'ottabase-shop-db',
            database_id: 'OTTABASE_SHOP_YOUR_D1_DATABASE_ID',
            preview_database_id: 'preview',
        });
        expect(config.r2_buckets[0]).toEqual({
            binding: 'OBCF_R2',
            bucket_name: 'ottabase-shop-bucket',
            preview_bucket_name: 'ottabase-shop-bucket-preview',
        });
        expect(config.env.production.d1_databases[0].database_name).toBe('ottabase-shop-db');
        // The placeholder CI fills for shop's database: the same value, so the same database.
        expect(config.env.production.d1_databases[0].database_id).toBe('OTTABASE_SHOP_D1_DATABASE_ID');
        expect(config.env.preview.d1_databases[0].database_id).toBe('OTTABASE_SHOP_D1_PREVIEW_DATABASE_ID');
        expect(config.env.preview.r2_buckets[0].bucket_name).toBe('ottabase-shop-bucket-preview');
        for (const vars of [config.vars, config.env.production.vars, config.env.preview.vars]) {
            expect(vars.APP_ID).toBe('shop');
        }
        expect(config.env.production.vars.ENVIRONMENT).toBe('production');
        expect(wrangler).toContain('// The SAME D1 database as apps/shop.');
        expect(read(root, 'apps/site/next.config.js')).toContain("'../shop/.wrangler/state/v3'");
        // shop's admin is on shop's port, not otta-web's.
        expect(read(root, 'apps/site/README.md')).toContain(
            "Shows what shop's admin writes: edit it at http://localhost:3005/admin.",
        );
        expect(fs.existsSync(path.join(root, 'apps/site'))).toBe(true);
    });

    it('refuses a landing app with no web app to read', () => {
        const root = fixture();
        fs.removeSync(path.join(root, 'apps/otta-web/ottabase/ottabase.config.ts'));
        expect(() => scaffoldApp(root, 'landing', 'site')).toThrow(/there is no web app/);
        expect(fs.existsSync(path.join(root, 'apps/site'))).toBe(false);
    });

    it('applies a preset: strips the demo and every package it does not keep, writes a starter README', () => {
        const root = fixture();
        const result = scaffoldApp(root, 'web', 'lean', { preset: 'blog' });
        expect(result.stripped.sort()).toEqual(['demo', 'vault']);
        expect(result.dependenciesDropped.sort()).toEqual(['@ottabase/vault', 'three']);
        expect(read(root, 'apps/lean/ottabase/packages.ts')).toContain('ottablogPackage');
        expect(read(root, 'apps/lean/ottabase/packages.ts')).not.toContain('vault');
        expect(fs.existsSync(path.join(root, 'apps/lean/src/pages/demo'))).toBe(false);
        expect(fs.existsSync(path.join(root, 'apps/lean/src/pages/blog'))).toBe(true);
        expect(read(root, 'apps/lean/README.md')).toContain('preset `blog`');
        expect(Object.keys(readFootprints(path.join(root, 'apps/lean')))).toEqual(['ottablog', 'comments']);
        // The template itself is untouched.
        expect(fs.existsSync(path.join(root, 'apps/otta-web/src/pages/demo'))).toBe(true);
    });

    it('refuses an unknown preset, a taken name, and removes a half-made app', () => {
        const root = fixture();
        expect(() => scaffoldApp(root, 'web', 'lean', { preset: 'nope' })).toThrow(/Unknown preset/);
        expect(() => scaffoldApp(root, 'web', 'otta-web')).toThrow(/already exists/);
        fs.outputJsonSync(path.join(root, 'apps/otta-web/ottabase/footprints.json'), { demo: { paths: ['../x'] } });
        expect(() => scaffoldApp(root, 'web', 'broken', { preset: 'minimal' })).toThrow(/must stay inside/);
        expect(fs.existsSync(path.join(root, 'apps/broken'))).toBe(false);
    });
});

describe('presets', () => {
    it('strip everything the preset does not keep, demo included, core never', () => {
        const root = fixture();
        const app = path.join(root, 'apps', 'otta-web');
        expect(keysToStrip(app, PRESETS.minimal)).toEqual(['comments', 'demo', 'ottablog', 'vault']);
        expect(keysToStrip(app, PRESETS.blog)).toEqual(['demo', 'vault']);
        expect(keysToStrip(app, { description: '', keep: ['vault', 'core'] })).toEqual([
            'comments',
            'demo',
            'ottablog',
        ]);
    });
});
