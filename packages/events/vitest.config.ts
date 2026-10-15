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
            thresholds: { lines: 85, functions: 85, statements: 85, branches: 75 },
        },
    },
    resolve: {
        alias: {
            // Dist-only exports, aliased to source so this package tests without a prior `pnpm build:pkg`.
            '@ottabase/utils/http-errors': path.resolve(__dirname, '../utils/src/http-errors.ts'),
            '@ottabase/queue': path.resolve(__dirname, '../queue/src/index.ts'),
        },
    },
});
