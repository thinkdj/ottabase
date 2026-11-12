/**
 * The `ottabase-update` skill's scripts (.claude/skills/ottabase-update/scripts), run end to end on
 * a small upstream and an app repo built from it. They are plain Node so they keep working while an
 * update rewrites the repo's packages; this is the one place they are tested.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SCRIPTS = fileURLToPath(new URL('../../../../.claude/skills/ottabase-update/scripts/', import.meta.url));
// Built at runtime so this file is not itself a marker site for check.mjs.
const MARK = 'ottabase-' + 'local:';
const FILLER = ['// a', '// b', '// c', '// d', '// e', '// f', '// g', '// h'];
const text = (...lines: string[]) => `${lines.join('\n')}\n`;

let tmp: string;
let app: string;
let from: string;
let to: string;

const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', ...args], {
        cwd,
        encoding: 'utf8',
    }).trim();
const script = (name: string, ...args: string[]) =>
    spawnSync('node', [path.join(SCRIPTS, name), ...args], { cwd: app, encoding: 'utf8' });
const write = (root: string, files: Record<string, string>) => {
    for (const [file, content] of Object.entries(files)) fs.outputFileSync(path.join(root, file), content);
};
const commit = (root: string) => {
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'commit');
    return git(root, 'rev-parse', 'HEAD');
};
const init = (root: string) => {
    fs.ensureDirSync(root);
    git(root, 'init', '-q');
    git(root, 'config', 'core.autocrlf', 'false');
};
const read = (file: string) => fs.readFileSync(path.join(app, file), 'utf8');

beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'otta-update-'));
    const upstream = path.join(tmp, 'upstream');
    app = path.join(tmp, 'app');

    init(upstream);
    write(upstream, {
        'packages/a/x.ts': text('export const one = 1;', ...FILLER, 'export const two = 2;'),
        'apps/otta-web/src/y.ts': text('export const y = 1;'),
        // A route folder named like a glob, next to a folder that glob would match.
        'apps/otta-web/src/[id]/z.ts': text('export const z = 1;'),
        'apps/otta-web/src/i/z.ts': text('export const i = 1;'),
        'README.md': text('# Ottabase'),
        'SUPPORT.md': text('support v1'),
    });
    from = commit(upstream);
    write(upstream, {
        'packages/a/x.ts': text('export const one = 1;', ...FILLER, 'export const two = 22;'),
        'apps/otta-web/src/y.ts': text('export const y = 2;'),
        'apps/otta-web/src/[id]/z.ts': text('export const z = 2;'),
        'apps/otta-web/src/i/z.ts': text('export const i = 2;'),
        'README.md': text('# Ottabase 2'),
        'SUPPORT.md': text('support v2'),
    });
    to = commit(upstream);

    // The app: built from `from`, app renamed, one patch to a package, its own README, SUPPORT.md deleted.
    init(app);
    write(app, {
        'packages/a/x.ts': text(
            'export const one = 1;',
            `export const mine = true; // ${MARK} a-tweak`,
            ...FILLER,
            'export const two = 2;',
        ),
        'apps/my-app/src/y.ts': text('export const y = 1;'),
        'apps/my-app/src/[id]/z.ts': text('export const z = 1;'),
        'apps/my-app/src/i/z.ts': text('export const i = 1;'),
        'README.md': text('# My product'),
        '.gitignore': text('.upstream'),
        '.ottabase-upstream.json': JSON.stringify({ apps: { 'otta-web': 'my-app' } }),
        'OTTABASE_LOCAL.md': text(
            '| id | kind | paths | why |',
            '| --- | --- | --- | --- |',
            '| `a-tweak` | patch | `packages/a/x.ts` | we need mine |',
            '| `our-files` | owned | `README.md`, `SUPPORT.md` | our README; no support page |',
        ),
    });
    commit(app);
    git(app, 'clone', '-q', upstream, '.upstream/ottabase');
    git(path.join(app, '.upstream/ottabase'), 'config', 'core.autocrlf', 'false');
}, 60_000);

afterAll(() => tmp && fs.removeSync(tmp));

// A repo that removed the skill has nothing to test.
describe.skipIf(!fs.existsSync(SCRIPTS))('ottabase-update scripts', () => {
    it('apply.mjs lands upstream changes, keeps the patch, re-roots the renamed app and leaves owned paths alone', () => {
        const run = script('apply.mjs', '.upstream/ottabase', from, to);
        expect(run.status, run.stderr).toBe(0);

        expect(read('packages/a/x.ts')).toContain('two = 22');
        expect(read('packages/a/x.ts')).toContain(`${MARK} a-tweak`);
        expect(read('apps/my-app/src/y.ts')).toBe(text('export const y = 2;'));
        expect(read('apps/my-app/src/[id]/z.ts')).toBe(text('export const z = 2;'));
        expect(read('apps/my-app/src/i/z.ts')).toBe(text('export const i = 2;'));
        expect(read('.upstream/run/ottabase/failed')).toBe('');
        expect(read('README.md')).toBe(text('# My product'));
        expect(fs.existsSync(path.join(app, 'SUPPORT.md'))).toBe(false);
        expect(read('.upstream/run/ottabase/owned')).toBe(text('README.md', 'SUPPORT.md'));
        // The index is usable afterwards (no blobs that live only in the clone).
        const changed = git(app, 'status', '--porcelain')
            .split('\n')
            .map((line) => line.trim());
        expect(changed.sort()).toEqual([
            'M apps/my-app/src/[id]/z.ts',
            'M apps/my-app/src/i/z.ts',
            'M apps/my-app/src/y.ts',
            'M packages/a/x.ts',
        ]);
    }, 60_000);

    it('check.mjs and regression-map.mjs pass while the patch is in place', () => {
        expect(script('check.mjs').status).toBe(0);
        expect(script('regression-map.mjs', '.upstream/ottabase', from).stdout).toContain(
            '0 files with lost lines, 0 missing files',
        );
    }, 60_000);

    it('both report a patch the update dropped, and check.mjs reports a marker with no row', () => {
        write(app, { 'packages/a/x.ts': text('export const one = 1;', ...FILLER, 'export const two = 22;') });
        const lost = script('check.mjs');
        expect(lost.status).toBe(1);
        expect(lost.stderr).toContain('Lost: `a-tweak`');
        script('regression-map.mjs', '.upstream/ottabase', from);
        expect(read('.upstream/run/regression-map.md')).toContain('export const mine = true;');

        write(app, { 'apps/my-app/src/y.ts': text(`export const y = 2; // ${MARK} quick-hack`) });
        expect(script('check.mjs').stderr).toContain('Unrecorded: marker `quick-hack` (apps/my-app/src/y.ts:1)');
    }, 60_000);
});
