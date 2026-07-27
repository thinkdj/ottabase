import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // `node` (not jsdom): the security-critical surface is crypto + resolution, which must be
        // exercised against the same Web Crypto implementation the Worker runtime provides.
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
            '@': path.resolve(__dirname, './src'),
            // @ottabase/ottaorm ships DIST-only exports; alias its subpaths to source so
            // `pnpm test --filter=@ottabase/ottaai` runs without a prior `pnpm build:pkg`.
            // Subpaths must come BEFORE the bare specifier.
            '@ottabase/ottaorm/models': path.resolve(__dirname, '../ottaorm/src/models/index.ts'),
            '@ottabase/ottaorm/client': path.resolve(__dirname, '../ottaorm/src/client/index.ts'),
            '@ottabase/ottaorm': path.resolve(__dirname, '../ottaorm/src/index.ts'),
            '@ottabase/utils/permissions': path.resolve(__dirname, '../utils/src/permissions.ts'),
        },
    },
});
