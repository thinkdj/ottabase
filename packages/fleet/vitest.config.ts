import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: ['src/**/__tests__/**/*.{test,spec}.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/**/__tests__/**', 'src/index.ts'],
            thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
        },
    },
    resolve: {
        alias: {
            // Dist-only packages aliased to source so this suite runs without a prior build.
            '@ottabase/utils/http-errors': path.resolve(__dirname, '../utils/src/http-errors.ts'),
            '@ottabase/utils/http-response': path.resolve(__dirname, '../utils/src/http-response.ts'),
            '@ottabase/ottarouter': path.resolve(__dirname, '../ottarouter/src/index.ts'),
            '@ottabase/ottaorm': path.resolve(__dirname, '../ottaorm/src/index.ts'),
        },
    },
});
