import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // `node`: the security-critical surface here is HMAC signing and the URL policy,
        // which must run against the same Web Crypto implementation the Worker provides.
        environment: 'node',
        globals: true,
        include: ['src/**/__tests__/**/*.{test,spec}.{ts,tsx}'],
        coverage: {
            provider: 'v8',
            thresholds: {
                lines: 70,
                functions: 70,
                statements: 70,
                branches: 65,
            },
        },
    },
    resolve: {
        alias: {
            // Dist-only packages aliased to source so this suite runs without a prior
            // `pnpm build:pkg`. Subpaths must come BEFORE the bare specifier.
            '@ottabase/premium/server': path.resolve(__dirname, '../premium/src/server/index.ts'),
            '@ottabase/premium/react': path.resolve(__dirname, '../premium/src/react/index.ts'),
            '@ottabase/premium/license-tools': path.resolve(__dirname, '../premium/src/license-tools.ts'),
            '@ottabase/premium': path.resolve(__dirname, '../premium/src/index.ts'),
            '@ottabase/utils/http-errors': path.resolve(__dirname, '../utils/src/http-errors.ts'),
            '@ottabase/utils/http-response': path.resolve(__dirname, '../utils/src/http-response.ts'),
            '@ottabase/ottarouter': path.resolve(__dirname, '../ottarouter/src/index.ts'),
            '@ottabase/ottaorm': path.resolve(__dirname, '../ottaorm/src/index.ts'),
        },
    },
});
