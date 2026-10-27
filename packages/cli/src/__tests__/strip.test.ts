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
    write(`${app}/wrangler.jsonc`, '{ "name": "otta-web", "d1_databases": [{ "database_name": "ottabase-db" }] }\n');
    write(`${app}/cloudflare-config.json`, '{ "workerName": "otta-web" }\n');
    write(`${app}/.env.example`, 'AUTH_SECRET=\n');
    write(`${app}/.env.local`, 'AUTH_SECRET=secret\n');
    write(`${app}/README.md`, '# otta-web\n');
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
        expect(read(root, 'apps/shop/wrangler.jsonc')).toContain('"database_name": "shop-db"');
        expect(read(root, 'apps/shop/cloudflare-config.json')).toContain('"workerName": "shop"');
        expect(read(root, 'apps/shop/README.md')).toBe('# shop\n');
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
