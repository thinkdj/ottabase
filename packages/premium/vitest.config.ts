import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // `node` (not jsdom): the security-critical surface is license verification, which must
        // run against the same Web Crypto implementation the Worker runtime provides. The one
        // React suite opts into jsdom with a per-file `// @vitest-environment jsdom` docblock.
        environment: 'node',
        globals: true,
        include: ['src/**/__tests__/**/*.{test,spec}.{ts,tsx}'],
        coverage: {
            provider: 'v8',
            thresholds: {
                lines: 75,
                functions: 75,
                statements: 75,
                branches: 70,
            },
        },
    },
    resolve: {
        alias: {
            // These packages ship DIST-only exports; aliasing to source lets
            // `pnpm test --filter=@ottabase/premium` run without a prior `pnpm build:pkg`.
            // Subpaths must come BEFORE the bare specifier.
            '@ottabase/utils/http-errors': path.resolve(__dirname, '../utils/src/http-errors.ts'),
            '@ottabase/utils/http-response': path.resolve(__dirname, '../utils/src/http-response.ts'),
            '@ottabase/ottarouter': path.resolve(__dirname, '../ottarouter/src/index.ts'),
        },
    },
});
