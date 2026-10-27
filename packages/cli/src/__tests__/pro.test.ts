import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { changelogEntry, latestProTag, proUpdate, requiredPublicVersion, type Git } from '../commands/pro.js';

const LS_REMOTE = [
    'abc\trefs/tags/v1.2.0',
    'def\trefs/tags/v1.10.0',
    'ghi\trefs/tags/v1.9.3',
    'jkl\trefs/tags/preview',
    'mno\trefs/tags/v2.0.0-rc.1',
].join('\n');

const CHANGELOG = `# Changelog

## Unreleased

- something cooking

## [1.10.0] 2026-11-02

Needs public Ottabase main of 2026-10-30 or later. Update public main first.

### Added
- SSO

## [1.9.3]

- a fix
`;

describe('pro update helpers', () => {
    it('picks the newest release tag by semver, ignoring other refs', () => {
        expect(latestProTag(LS_REMOTE)).toBe('v1.10.0');
        expect(latestProTag('')).toBeNull();
    });

    it('finds the changelog entry for a tag, falling back to Unreleased, and its public-main requirement', () => {
        const entry = changelogEntry(CHANGELOG, 'v1.10.0')!;
        expect(entry.startsWith('## [1.10.0]')).toBe(true);
        expect(entry).toContain('- SSO');
        expect(entry).not.toContain('a fix');
        expect(requiredPublicVersion(entry)).toBe('Needs public Ottabase main of 2026-10-30 or later.');
        expect(changelogEntry(CHANGELOG, 'v1.9.3')).toContain('- a fix');
        expect(changelogEntry(CHANGELOG, 'v3.0.0')!.startsWith('## Unreleased')).toBe(true);
        expect(changelogEntry('# nothing', 'v1.0.0')).toBeNull();
        expect(requiredPublicVersion('- a fix')).toBeNull();
    });
});

const roots: string[] = [];
afterEach(() => {
    for (const root of roots.splice(0)) fs.removeSync(root);
});

function fixture(options: { nested?: boolean; dirty?: boolean } = {}): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'otta-pro-'));
    roots.push(root);
    const write = (file: string, content: string) => fs.outputFileSync(path.join(root, file), content);
    write('pnpm-workspace.yaml', 'packages:\n  - apps/*\n  - packages/pro/*\n');
    write('packages/pro/CHANGELOG.md', CHANGELOG);
    if (options.nested) write('packages/pro/.git/HEAD', 'ref: refs/heads/main');
    write('apps/shop/package.json', JSON.stringify({ name: '@ottabase/shop' }));
    return root;
}

describe('proUpdate', () => {
    it('refuses a dirty tree, a nested repository, and a missing subtree', async () => {
        const dirty: Git = (args) => (args[0] === 'status' ? ' M file.ts\n' : '');
        await expect(proUpdate(fixture(), 'shop', {}, dirty)).rejects.toThrow(/working tree has changes/);
        await expect(proUpdate(fixture({ nested: true }), 'shop', {}, () => '')).rejects.toThrow(
            /repository of its own/,
        );
        const root = fixture();
        fs.removeSync(path.join(root, 'packages/pro'));
        await expect(proUpdate(root, 'shop', {}, () => '')).rejects.toThrow(/Install Pro first/);
    });

    it('resolves the newest tag and, in a dry run, pulls nothing', async () => {
        const calls: string[][] = [];
        const git: Git = (args) => {
            calls.push(args);
            if (args[0] === 'ls-remote') return LS_REMOTE;
            return '';
        };
        const result = await proUpdate(fixture(), 'shop', { dryRun: true }, git);
        expect(result).toEqual({ tag: 'v1.10.0', pulled: false, entry: null });
        expect(calls.some((call) => call[0] === 'subtree')).toBe(false);
        await expect(proUpdate(fixture(), 'shop', { tag: 'main' }, git)).rejects.toThrow(/not a release tag/);
    });
});
