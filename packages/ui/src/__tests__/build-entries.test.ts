import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The build emits one flat file per tsup entry and does not bundle (bundle: false, so `'use client'` stays at the
 * top of each file). A relative import therefore only works in `dist` when its target is an entry too: the sidebar
 * once shipped `import '../../hooks/use-mobile'`, a path that exists in the repo and nowhere in the package. These
 * checks read the source, so they catch that without a build.
 */
// Tests run from the package folder, as client-boundaries.test.ts relies on too
const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const tsupEntries = [...read('tsup.config.ts').matchAll(/^\s+'((?:src|components|providers)\/[^']+)',/gm)].map(
    (match) => match[1],
);
/** Output name of an entry, as tsup.config.ts derives it: `lib/*` keeps its folder, the rest are flattened. */
const outputName = (entry: string) =>
    entry.startsWith('src/lib/')
        ? entry.replace(/^src\//, '').replace(/\.tsx?$/, '')
        : path.basename(entry).replace(/\.tsx?$/, '');

const componentFiles = fs
    .readdirSync(path.join(root, 'components/ui'))
    .filter((file) => /\.tsx?$/.test(file) && file !== 'index.ts');
const exportsMap = JSON.parse(read('package.json')).exports as Record<string, string | Record<string, string>>;

describe('@ottabase/ui build entries', () => {
    it('lists only files that exist', () => {
        expect(tsupEntries.length).toBeGreaterThan(50);
        for (const entry of tsupEntries) expect(fs.existsSync(path.join(root, entry)), entry).toBe(true);
    });

    it('builds every component file', () => {
        const built = new Set(tsupEntries.map((entry) => path.basename(entry)));
        for (const file of componentFiles) expect(built.has(file), `${file} is not in tsup.config.ts`).toBe(true);
    });

    it('only imports siblings that are built next to it', () => {
        const built = new Set(tsupEntries.filter((e) => e.startsWith('components/ui/')).map(outputName));
        for (const file of componentFiles) {
            const source = read(`components/ui/${file}`);
            for (const [, specifier] of source.matchAll(/(?:from|import)\s+'(\.[^']*)'/g)) {
                expect(specifier, `${file} imports outside components/ui, which dist does not have`).toMatch(
                    /^\.\/[\w-]+$/,
                );
                expect(built.has(specifier.slice(2)), `${file} imports ${specifier}, which is not a build entry`).toBe(
                    true,
                );
            }
        }
    });

    it('has a built file behind every export', () => {
        const names = new Set(tsupEntries.map(outputName));
        for (const [key, target] of Object.entries(exportsMap)) {
            if (typeof target === 'string') continue; // styles.css points at a source file
            const built = target.import.replace(/^\.\/dist\//, '').replace(/\.mjs$/, '');
            expect(names.has(built), `${key} points at dist/${built}, which no entry builds`).toBe(true);
        }
    });

    it('resolves every self-import through the exports map', () => {
        const dirs = ['components/ui', 'providers', 'src'];
        for (const dir of dirs) {
            for (const file of fs.readdirSync(path.join(root, dir)).filter((f) => /\.tsx?$/.test(f))) {
                const source = read(`${dir}/${file}`);
                for (const [, subpath] of source.matchAll(/'@ottabase\/ui\/([^']+)'/g)) {
                    expect(exportsMap[`./${subpath}`], `${dir}/${file} imports @ottabase/ui/${subpath}`).toBeDefined();
                }
            }
        }
    });
});
