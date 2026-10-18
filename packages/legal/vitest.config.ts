import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: ['src/**/__tests__/**/*.{test,spec}.{ts,tsx}'],
    },
    esbuild: { jsx: 'automatic' },
    resolve: {
        alias: {
            // Dist-only exports, aliased to source so this package tests without a prior `pnpm build:pkg`.
            '@ottabase/utils/http-response': path.resolve(__dirname, '../utils/src/http-response.ts'),
            '@ottabase/ottarouter': path.resolve(__dirname, '../ottarouter/src/index.ts'),
        },
    },
});
