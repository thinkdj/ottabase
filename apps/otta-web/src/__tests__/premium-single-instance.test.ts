// @vitest-environment node
// (Vite's esbuild refuses to run inside jsdom, whose TextEncoder is not Node's.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * `@ottabase/premium/react` owns a React context (`PremiumProvider` / `usePremiumClient`). The browser
 * bundle must hold exactly ONE copy of it. A second copy has its own context object: the page mounts the
 * provider of one while a package's hooks read the other's default (`mounted: false`), every premium query
 * stays disabled, and the page renders its empty state with no error.
 *
 * tsconfig `paths` send only this app's own files to source. Workspace packages compiled from their source
 * (webhooks, vault, every Pro package) sit outside the app's tsconfig and would resolve through the
 * package `exports` to dist, so `vite.config.ts` aliases the specifier for every importer. This resolves
 * the specifier from each real importer with the app's real Vite config and requires one answer.
 */

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repoRoot = path.resolve(appRoot, '../..');
const SPECIFIER = '@ottabase/premium/react';
const IMPORT = /from\s+['"]@ottabase\/premium\/react['"]/;
const SKIP = new Set(['node_modules', 'dist', '.turbo', '.wrangler', '.next', '__tests__']);
const PREMIUM_PACKAGE = path.join(repoRoot, 'packages', 'premium');

const normalize = (file: string) => file.replace(/\\/g, '/').toLowerCase();

/** Every source file under `dir` that imports the specifier (the premium package itself excluded). */
function importersUnder(dir: string, found: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (SKIP.has(entry.name) || file === PREMIUM_PACKAGE) continue;
        if (entry.isDirectory()) importersUnder(file, found);
        else if (/\.tsx?$/.test(entry.name) && IMPORT.test(fs.readFileSync(file, 'utf8'))) found.push(file);
    }
    return found;
}

describe('@ottabase/premium/react in the browser bundle', () => {
    let server: ViteDevServer;

    beforeAll(async () => {
        server = await createServer({
            root: appRoot,
            configFile: path.join(appRoot, 'vite.config.ts'),
            appType: 'custom',
            logLevel: 'silent',
            server: { middlewareMode: true, hmr: false, watch: null },
            optimizeDeps: { noDiscovery: true, include: [] },
        });
    }, 60_000);

    afterAll(async () => {
        await server?.close();
    });

    it('resolves to the premium source for the app and for every package that imports it', async () => {
        // Pro packages are found here too when they are installed (packages/pro/*).
        const importers = [
            ...importersUnder(path.join(appRoot, 'src')),
            ...importersUnder(path.join(repoRoot, 'packages')),
        ];
        expect(importers.length).toBeGreaterThan(0);

        const resolved = new Map<string, string[]>();
        for (const importer of importers) {
            const result = await server.environments.client.pluginContainer.resolveId(SPECIFIER, importer);
            const id = normalize(result?.id ?? '(unresolved)');
            resolved.set(id, [...(resolved.get(id) ?? []), path.relative(repoRoot, importer)]);
        }

        const source = normalize(path.join(repoRoot, 'packages/premium/src/react/index.ts'));
        // A single key, and it is the source file. Anything else lists the importers that got a second copy.
        expect(Object.fromEntries(resolved)).toEqual({ [source]: expect.any(Array) });
    }, 60_000);
});
