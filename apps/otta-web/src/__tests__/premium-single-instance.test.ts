// @vitest-environment node
// (Vite's esbuild refuses to run inside jsdom, whose TextEncoder is not Node's.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Some workspace modules own a React context, and the browser bundle must hold exactly ONE copy of each.
 * A second copy has its own context object: the page mounts the provider of one while a package's hooks
 * read the other's default.
 *
 * - `@ottabase/premium/react` (`PremiumProvider` / `usePremiumClient`): `mounted` stays false, every
 *   premium query stays disabled, and the page renders its empty state with no error.
 * - `@ottabase/ottaorm/client` (`OttaQueryProvider` / `useApiClient`): every @ottabase/forms request
 *   throws "useApiClient must be used within an OttaQueryProvider configured with apiClient".
 *
 * tsconfig `paths` send only this app's own files to source. Workspace packages compiled from their source
 * (forms, webhooks, vault, every Pro package) sit outside the app's tsconfig and would resolve through the
 * package `exports` to dist, so `vite.config.ts` aliases each specifier for every importer. This resolves
 * each specifier from each real importer with the app's real Vite config and requires one answer.
 */

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repoRoot = path.resolve(appRoot, '../..');
const SKIP = new Set(['node_modules', 'dist', '.turbo', '.wrangler', '.next', '__tests__']);

const CONTEXT_MODULES = [
    { specifier: '@ottabase/premium/react', owner: 'packages/premium', source: 'packages/premium/src/react/index.ts' },
    {
        specifier: '@ottabase/ottaorm/client',
        owner: 'packages/ottaorm',
        source: 'packages/ottaorm/src/client/index.ts',
    },
];

const normalize = (file: string) => file.replace(/\\/g, '/').toLowerCase();
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** Every source file under `dir` that imports the specifier (the owning package itself excluded). */
function importersUnder(dir: string, pattern: RegExp, owner: string, found: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (SKIP.has(entry.name) || file === owner) continue;
        if (entry.isDirectory()) importersUnder(file, pattern, owner, found);
        else if (/\.tsx?$/.test(entry.name) && pattern.test(fs.readFileSync(file, 'utf8'))) found.push(file);
    }
    return found;
}

describe('React contexts in the browser bundle', () => {
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

    it.each(CONTEXT_MODULES)(
        '$specifier resolves to its source for the app and for every package that imports it',
        async ({ specifier, owner, source }) => {
            const pattern = new RegExp(`from\\s+['"]${escape(specifier)}['"]`);
            const ownerDir = path.join(repoRoot, owner);
            // Pro packages are found here too when they are installed (packages/pro/*).
            const importers = [
                ...importersUnder(path.join(appRoot, 'src'), pattern, ownerDir),
                ...importersUnder(path.join(repoRoot, 'packages'), pattern, ownerDir),
            ];
            expect(importers.length).toBeGreaterThan(0);

            const resolved = new Map<string, string[]>();
            for (const importer of importers) {
                const result = await server.environments.client.pluginContainer.resolveId(specifier, importer);
                const id = normalize(result?.id ?? '(unresolved)');
                resolved.set(id, [...(resolved.get(id) ?? []), path.relative(repoRoot, importer)]);
            }

            // A single key, and it is the source file. Anything else lists the importers that got a second copy.
            expect(Object.fromEntries(resolved)).toEqual({
                [normalize(path.join(repoRoot, source))]: expect.any(Array),
            });
        },
        60_000,
    );
});
