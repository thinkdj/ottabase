import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: ['worker/**/*.{test,spec}.ts', 'ottabase/**/*.{test,spec}.ts'],
        coverage: {
            provider: 'v8',
            include: ['worker/**/*.ts', 'ottabase/**/*.ts'],
            exclude: ['**/__tests__/**', '**/*.d.ts'],
        },
    },
    resolve: {
        alias: {
            // One ottaorm (see wrangler.jsonc), and the dist-only subpaths mapped to source so
            // the tests run without a prior `pnpm build:pkg`. Subpaths before bare specifiers.
            '@ottabase/ottaorm/models': path.resolve(__dirname, '../../packages/ottaorm/src/models/index.ts'),
            '@ottabase/ottaorm': path.resolve(__dirname, '../../packages/ottaorm/src/index.ts'),
            '@ottabase/ottarouter': path.resolve(__dirname, '../../packages/ottarouter/src/index.ts'),
            '@ottabase/premium/server': path.resolve(__dirname, '../../packages/premium/src/server/index.ts'),
            '@ottabase/premium/react': path.resolve(__dirname, '../../packages/premium/src/react/index.ts'),
            '@ottabase/premium': path.resolve(__dirname, '../../packages/premium/src/index.ts'),
            '@ottabase/utils/http-response': path.resolve(__dirname, '../../packages/utils/src/http-response.ts'),
            '@ottabase/utils/http-errors': path.resolve(__dirname, '../../packages/utils/src/http-errors.ts'),
        },
    },
});
