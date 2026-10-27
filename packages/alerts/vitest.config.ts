import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // `node`: channel secrets are sealed and webhook bodies signed with Web Crypto, as in the Worker,
        // and the models run on real SQLite (node:sqlite) behind the D1 driver.
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
            // Dist-built packages aliased to source so this suite runs without a prior build.
            '@ottabase/utils/http-errors': path.resolve(__dirname, '../utils/src/http-errors.ts'),
            '@ottabase/utils/http-response': path.resolve(__dirname, '../utils/src/http-response.ts'),
            '@ottabase/utils/outbound-url': path.resolve(__dirname, '../utils/src/outbound-url.ts'),
            '@ottabase/utils/hmac-signature': path.resolve(__dirname, '../utils/src/hmac-signature.ts'),
            '@ottabase/ottarouter': path.resolve(__dirname, '../ottarouter/src/index.ts'),
            '@ottabase/ottaorm': path.resolve(__dirname, '../ottaorm/src/index.ts'),
        },
    },
});
