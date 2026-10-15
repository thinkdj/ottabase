import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyAdd, formatAddPlan, planAdd, readPackageDescriptor } from '../commands/add.js';

const roots: string[] = [];

function fixture(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'otta-add-'));
    roots.push(root);
    const write = (file: string, content: string) => fs.outputFileSync(path.join(root, file), content);
    write('pnpm-workspace.yaml', 'packages:\n  - apps/*\n  - packages/*\n');
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
        });
        expect(readPackageDescriptor(root, 'postmaster').tables).toEqual({
            import: '@ottabase/postmaster/schema',
            names: ['emailSuppressionsTable'],
        });
        expect(() => readPackageDescriptor(root, 'plain')).toThrow(/no "ottabase" descriptor/);
        expect(() => readPackageDescriptor(root, 'nope')).toThrow(/No workspace package/);
        expect(() => readPackageDescriptor(root, '../etc')).toThrow(/Invalid package name/);
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
