import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // `node`: the tests run the real SQL against Node's built-in SQLite.
        environment: 'node',
        globals: true,
        include: ['src/**/__tests__/**/*.{test,spec}.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/**/__tests__/**', 'src/index.ts', 'src/react/**'],
            thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
        },
    },
    resolve: {
        alias: {
            // Dist-only packages aliased to source so this suite runs without a prior build.
            // Subpaths before the bare specifier.
            '@ottabase/utils/http-errors': path.resolve(__dirname, '../utils/src/http-errors.ts'),
            '@ottabase/utils/http-response': path.resolve(__dirname, '../utils/src/http-response.ts'),
            '@ottabase/ottarouter': path.resolve(__dirname, '../ottarouter/src/index.ts'),
        },
    },
});
