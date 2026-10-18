import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyAdd, formatAddPlan, listBundle, planAdd, readPackageDescriptor } from '../commands/add.js';

const roots: string[] = [];

function fixture(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'otta-add-'));
    roots.push(root);
    const write = (file: string, content: string) => fs.outputFileSync(path.join(root, file), content);
    write('pnpm-workspace.yaml', 'packages:\n  - apps/*\n  - packages/*\n  - packages/pro/*\n');
    write(
        'packages/vault/package.json',
        JSON.stringify({
            name: '@ottabase/vault',
            ottabase: { key: 'vault', factory: 'createVaultPackage' },
        }),
    );
    write(
        'packages/postmaster/package.json',
        JSON.stringify({
            name: '@ottabase/postmaster',
            ottabase: {
                key: 'postmaster',
                factory: 'createPostmasterPackage',
                tables: { names: ['emailSuppressionsTable'] },
            },
        }),
    );
    write('packages/plain/package.json', JSON.stringify({ name: '@ottabase/plain' }));
    // A bundle: packages/pro has no package.json of its own, two packages inside.
    write(
        'packages/pro/tower/package.json',
        JSON.stringify({
            name: '@ottabase/tower',
            ottabase: {
                key: 'tower',
                factory: 'createTowerPackage',
                tables: { names: ['towerAppsTable'] },
                adminPages: [
                    {
                        path: '/admin/infrastructure/tower',
                        title: 'Tower',
                        description: "Every app you run, on one board. It's live.",
                        icon: 'Radar',
                        group: 'infrastructure',
                        scope: 'platform',
                        page: 'admin/infrastructure/TowerPage',
                        export: 'TowerPage',
                    },
                ],
            },
        }),
    );
    write(
        'packages/pro/tower/app/ottabase/packages/tower.ts',
        '// shipped composition\nexport const towerPackage = 1;\n',
    );
    write(
        'packages/pro/tower/app/src/pages/admin/infrastructure/TowerPage.tsx',
        'export function TowerPage() {\n    return null;\n}\n',
    );
    write(
        'packages/pro/payport/package.json',
        JSON.stringify({ name: '@ottabase/payport', ottabase: { key: 'payport', factory: 'createPayportPackage' } }),
    );
    write('apps/otta-web/ottabase/packages/vault.ts', '// reference composition\nexport const vaultPackage = 1;\n');
    write(
        'apps/bar/package.json',
        JSON.stringify({ name: '@ottabase/bar', dependencies: { '@ottabase/kernel': 'workspace:*' } }, null, 4) + '\n',
    );
    write(
        'apps/bar/ottabase/packages.ts',
        [
            "import { definePackageList } from './registry';",
            "import { appPackage } from './packages/app';",
            "import { corePackage } from './packages/core';",
            '',
            'definePackageList(() => [',
            '    corePackage,',
            '    appPackage,',
            '    // Premium: collected like the rest.',
            '    webhooksPackage,',
            ']);',
            '',
        ].join('\n'),
    );
    write(
        'apps/bar/src/ottabase/config/packages.ts',
        [
            'export const CLIENT_PACKAGES = [',
            "    definePackageClient({ key: 'core' }),",
            "    definePackageClient({ key: 'app' }),",
            '    definePackageClient({',
            '        key: WEBHOOKS_PACKAGE_KEY,',
            '    }),',
            '];',
            '',
        ].join('\n'),
    );
    write(
        'apps/bar/ottabase/db/schema.ts',
        [
            '// Statically re-exported so drizzle-kit sees them without evaluating config.',
            "export { apiKeysTable } from '@ottabase/apikeys/schema';",
            "export { brandKitsTable } from '@ottabase/brand-engine/persistence';",
            '',
        ].join('\n'),
    );
    return root;
}

afterEach(() => {
    for (const root of roots.splice(0)) fs.removeSync(root);
});

const text = (root: string, file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('readPackageDescriptor', () => {
    it('fills the defaults and accepts the scoped name', () => {
        const root = fixture();
        expect(readPackageDescriptor(root, '@ottabase/vault')).toEqual({
            name: '@ottabase/vault',
            key: 'vault',
            factory: 'createVaultPackage',
            export: 'vaultPackage',
            manifestImport: '@ottabase/vault',
            dir: 'packages/vault',
        });
        expect(readPackageDescriptor(root, 'postmaster').tables).toEqual({
            import: '@ottabase/postmaster/schema',
            names: ['emailSuppressionsTable'],
        });
        expect(() => readPackageDescriptor(root, 'plain')).toThrow(/no "ottabase" descriptor/);
        expect(() => readPackageDescriptor(root, 'nope')).toThrow(/No workspace package/);
        expect(() => readPackageDescriptor(root, '../etc')).toThrow(/Invalid package name/);
    });

    it('finds a package inside the pro bundle, by bare or explicit name, and validates its admin pages', () => {
        const root = fixture();
        const tower = readPackageDescriptor(root, 'tower');
        expect(tower.dir).toBe('packages/pro/tower');
        expect(tower.adminPages).toEqual([
            {
                path: '/admin/infrastructure/tower',
                title: 'Tower',
                description: "Every app you run, on one board. It's live.",
                icon: 'Radar',
                group: 'infrastructure',
                scope: 'platform',
                page: 'admin/infrastructure/TowerPage',
                export: 'TowerPage',
            },
        ]);
        expect(readPackageDescriptor(root, 'pro/tower').name).toBe('@ottabase/tower');
        expect(readPackageDescriptor(root, 'pro/payport').adminPages).toBeUndefined();
        expect(() => readPackageDescriptor(root, 'pro/nope')).toThrow(/No workspace package/);
        expect(() => readPackageDescriptor(root, 'a/b/c')).toThrow(/Invalid package name/);

        const file = path.join(root, 'packages/pro/tower/package.json');
        const pkg = fs.readJsonSync(file);
        pkg.ottabase.adminPages[0].icon = 'alert("x")';
        fs.writeJsonSync(file, pkg);
        expect(() => readPackageDescriptor(root, 'tower')).toThrow(/not a lucide-react export name/);
        delete pkg.ottabase.adminPages[0].group;
        pkg.ottabase.adminPages[0].icon = 'Radar';
        fs.writeJsonSync(file, pkg);
        expect(() => readPackageDescriptor(root, 'tower')).toThrow(/needs path, title, group, page and export/);
    });
});

describe('listBundle', () => {
    it('lists the packages of a folder that has none of its own, and nothing for a package or a stranger', () => {
        const root = fixture();
        expect(listBundle(root, 'pro')).toEqual(['pro/payport', 'pro/tower']);
        expect(listBundle(root, 'vault')).toBeNull();
        expect(listBundle(root, 'nope')).toBeNull();
        expect(listBundle(root, '../etc')).toBeNull();
    });
});

describe('planAdd and applyAdd', () => {
    it('touches every wiring point once, copying the reference composition, and is idempotent', () => {
        const root = fixture();
        const plan = planAdd(root, 'bar', readPackageDescriptor(root, 'vault'));
        expect(plan.steps.map((step) => [step.action, step.file])).toEqual([
            ['edit', 'apps/bar/package.json'],
            ['create', 'apps/bar/ottabase/packages/vault.ts'],
            ['edit', 'apps/bar/ottabase/packages.ts'],
            ['edit', 'apps/bar/src/ottabase/config/packages.ts'],
        ]);
        expect(formatAddPlan(plan)).toContain('create apps/bar/ottabase/packages/vault.ts  copied from apps/otta-web');

        // Nothing is written until applied.
        expect(fs.existsSync(path.join(root, 'apps/bar/ottabase/packages/vault.ts'))).toBe(false);
        applyAdd(root, plan);

        expect(JSON.parse(text(root, 'apps/bar/package.json')).dependencies['@ottabase/vault']).toBe('workspace:*');
        expect(text(root, 'apps/bar/ottabase/packages/vault.ts')).toContain('// reference composition');
        const list = text(root, 'apps/bar/ottabase/packages.ts');
        expect(list).toContain(
            "import { corePackage } from './packages/core';\nimport { vaultPackage } from './packages/vault';",
        );
        expect(list).toContain('    appPackage,\n    vaultPackage,\n    // Premium');
        expect(text(root, 'apps/bar/src/ottabase/config/packages.ts')).toContain(
            "    definePackageClient({ key: 'app' }),\n    definePackageClient({ key: 'vault' }),\n    definePackageClient({\n",
        );

        const again = planAdd(root, 'bar', readPackageDescriptor(root, 'vault'));
        expect(again.steps.every((step) => step.action === 'skip')).toBe(true);
    });

    it('writes a stub composition when the reference app has none, and re-exports tables for drizzle-kit', () => {
        const root = fixture();
        const plan = planAdd(root, 'bar', readPackageDescriptor(root, 'postmaster'));
        applyAdd(root, plan);
        const stub = text(root, 'apps/bar/ottabase/packages/postmaster.ts');
        expect(stub).toContain("import { createPostmasterPackage } from '@ottabase/postmaster';");
        expect(stub).toContain('export const postmasterPackage = createPostmasterPackage<CloudflareEnv>({');
        expect(text(root, 'apps/bar/ottabase/db/schema.ts')).toBe(
            [
                '// Statically re-exported so drizzle-kit sees them without evaluating config.',
                "export { apiKeysTable } from '@ottabase/apikeys/schema';",
                "export { brandKitsTable } from '@ottabase/brand-engine/persistence';",
                "export { emailSuppressionsTable } from '@ottabase/postmaster/schema';",
                '',
            ].join('\n'),
        );
    });

    it('ships a bundle package: its composition and pages are copied, the admin page registered with its icon', () => {
        const root = fixture();
        const plan = planAdd(root, 'bar', readPackageDescriptor(root, 'tower'));
        expect(plan.steps.map((step) => [step.action, step.file])).toEqual([
            ['edit', 'apps/bar/package.json'],
            ['create', 'apps/bar/ottabase/packages/tower.ts'],
            ['edit', 'apps/bar/ottabase/packages.ts'],
            ['edit', 'apps/bar/src/ottabase/config/packages.ts'],
            ['edit', 'apps/bar/ottabase/db/schema.ts'],
            ['create', 'apps/bar/src/pages/admin/infrastructure/TowerPage.tsx'],
        ]);
        expect(formatAddPlan(plan)).toContain(
            'create apps/bar/ottabase/packages/tower.ts  copied from packages/pro/tower/app',
        );
        applyAdd(root, plan);

        expect(text(root, 'apps/bar/ottabase/packages/tower.ts')).toContain('// shipped composition');
        expect(text(root, 'apps/bar/src/pages/admin/infrastructure/TowerPage.tsx')).toContain(
            'export function TowerPage',
        );
        const client = text(root, 'apps/bar/src/ottabase/config/packages.ts');
        expect(client.startsWith("import { Radar } from 'lucide-react';\nexport const CLIENT_PACKAGES = [")).toBe(true);
        expect(client).toContain(
            [
                "    definePackageClient({ key: 'app' }),",
                '    definePackageClient({',
                "        key: 'tower',",
                '        adminPages: [',
                '            {',
                "                path: '/admin/infrastructure/tower',",
                "                title: 'Tower',",
                "                description: 'Every app you run, on one board. It\\'s live.',",
                '                icon: Radar,',
                "                group: 'infrastructure',",
                "                scope: 'platform',",
                "                load: () => import('@/pages/admin/infrastructure/TowerPage'),",
                "                exportName: 'TowerPage',",
                '            },',
                '        ],',
                '    }),',
                '    definePackageClient({',
                '        key: WEBHOOKS_PACKAGE_KEY,',
            ].join('\n'),
        );
        expect(text(root, 'apps/bar/ottabase/db/schema.ts')).toContain(
            "export { towerAppsTable } from '@ottabase/tower/schema';",
        );

        const again = planAdd(root, 'bar', readPackageDescriptor(root, 'tower'));
        expect(again.steps.every((step) => step.action === 'skip')).toBe(true);
    });

    it('merges icons into an existing lucide-react import', () => {
        const root = fixture();
        const clientFile = path.join(root, 'apps/bar/src/ottabase/config/packages.ts');
        fs.writeFileSync(clientFile, "import { Webhook } from 'lucide-react';\n" + fs.readFileSync(clientFile, 'utf8'));
        applyAdd(root, planAdd(root, 'bar', readPackageDescriptor(root, 'tower')));
        const client = text(root, 'apps/bar/src/ottabase/config/packages.ts');
        expect(client.startsWith("import { Radar, Webhook } from 'lucide-react';\n")).toBe(true);
        expect(client.match(/from 'lucide-react'/g)).toHaveLength(1);
    });

    it('keeps CRLF files CRLF and refuses an app without a package.json', () => {
        const root = fixture();
        const listFile = path.join(root, 'apps/bar/ottabase/packages.ts');
        fs.writeFileSync(listFile, fs.readFileSync(listFile, 'utf8').replace(/\n/g, '\r\n'));
        applyAdd(root, planAdd(root, 'bar', readPackageDescriptor(root, 'vault')));
        const list = text(root, 'apps/bar/ottabase/packages.ts');
        expect(list).toContain("import { vaultPackage } from './packages/vault';\r\n");
        expect(list.includes('\n') && !/[^\r]\n/.test(list)).toBe(true);
        expect(() => planAdd(root, 'missing', readPackageDescriptor(root, 'vault'))).toThrow(/has no package.json/);
    });
});
