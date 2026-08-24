import react from '@vitejs/plugin-react';
import path from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./vitest.setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            exclude: [
                'node_modules/',
                'dist/',
                '.wrangler/',
                '.next/',
                '**/*.config.ts',
                '**/*.config.js',
                'cloudflare-env.d.ts',
                '**/*.d.ts',
                'public/',
            ],
            thresholds: {
                lines: 70,
                functions: 70,
                branches: 65,
                statements: 70,
            },
        },
        include: [
            'src/**/*.{test,spec}.{ts,tsx}',
            '__tests__/**/*.{test,spec}.{ts,tsx}',
            'ottabase/**/*.{test,spec}.{ts,tsx}',
            'worker/**/*.{test,spec}.{ts,tsx}',
        ],
        testTimeout: 10000,
    },
    resolve: {
        alias: {
            // Subpaths before the bare package — these ship dist-only exports, so aliasing to
            // source lets the app's tests run without a prior `pnpm build:pkg`.
            '@ottabase/ottaai/resolver': path.resolve(__dirname, '../../packages/ottaai/src/resolver/index.ts'),
            '@ottabase/ottaai/testing': path.resolve(__dirname, '../../packages/ottaai/src/testing/index.ts'),
            '@ottabase/ottaai/ottaorm': path.resolve(__dirname, '../../packages/ottaai/src/ottaorm/index.ts'),
            '@ottabase/ottaai/schema': path.resolve(__dirname, '../../packages/ottaai/src/schema.ts'),
            '@ottabase/ottaai/transports/gateway': path.resolve(
                __dirname,
                '../../packages/ottaai/src/transports/gateway.ts',
            ),
            '@ottabase/ottaai/react': path.resolve(__dirname, '../../packages/ottaai/src/react/index.ts'),
            '@ottabase/ottaai': path.resolve(__dirname, '../../packages/ottaai/src/index.ts'),
            // Headless-decoupling subpaths (see apps/otta-web/tsconfig.json) — dist-only exports
            // aliased to source so tests resolve them without a prior `pnpm build:pkg`.
            '@ottabase/auth/config': path.resolve(__dirname, '../../packages/auth/src/components/helpers.ts'),
            '@ottabase/forms/react': path.resolve(__dirname, '../../packages/forms/src/react.ts'),
            '@ottabase/ui-datatable/react': path.resolve(__dirname, '../../packages/ui-datatable/src/react.ts'),
            '@ottabase/spotlight/react': path.resolve(__dirname, '../../packages/spotlight/src/react.ts'),
            '@ottabase/docs/react': path.resolve(__dirname, '../../packages/docs/src/react.ts'),
            '@ottabase/medialibrary/react': path.resolve(__dirname, '../../packages/medialibrary/src/react.ts'),
            '@ottabase/ottablog/renderer': path.resolve(__dirname, '../../packages/ottablog/src/renderer.ts'),
            '@ottabase/ottamenu/render': path.resolve(__dirname, '../../packages/ottamenu/src/render/index.tsx'),
            // Premium Packages (ottabase/config.premium.ts) — subpaths before the bare specifier.
            '@ottabase/premium/server': path.resolve(__dirname, '../../packages/premium/src/server/index.ts'),
            '@ottabase/premium/react': path.resolve(__dirname, '../../packages/premium/src/react/index.ts'),
            '@ottabase/premium': path.resolve(__dirname, '../../packages/premium/src/index.ts'),
            '@ottabase/premium-webhooks/schema': path.resolve(
                __dirname,
                '../../packages/premium-webhooks/src/schema.ts',
            ),
            '@ottabase/premium-webhooks/react': path.resolve(
                __dirname,
                '../../packages/premium-webhooks/src/react/index.ts',
            ),
            '@ottabase/premium-webhooks': path.resolve(__dirname, '../../packages/premium-webhooks/src/index.ts'),
            '@ottabase/cf-pdf/metadata': path.resolve(__dirname, '../../packages/cf-pdf/src/metadata.ts'),
            '@ottabase/cf-pdf/router': path.resolve(__dirname, '../../packages/cf-pdf/src/routes.ts'),
            '@ottabase/cf-pdf/server': path.resolve(__dirname, '../../packages/cf-pdf/src/server.ts'),
            '@ottabase/cf-pdf/react': path.resolve(__dirname, '../../packages/cf-pdf/src/react/index.tsx'),
            '@ottabase/cf-pdf/client': path.resolve(__dirname, '../../packages/cf-pdf/src/client.ts'),
            '@ottabase/cf-pdf': path.resolve(__dirname, '../../packages/cf-pdf/src/index.ts'),
            // Workerd provides this runtime-only module. Unit tests import the worker
            // entrypoint in Node, so map it to the intentionally minimal test double.
            'cloudflare:workers': path.resolve(__dirname, './src/test-mocks/cloudflare-workers.ts'),
            '@ottabase/cf-realtime/server': path.resolve(__dirname, './src/test-mocks/cf-realtime-server.ts'),
            '@ottabase/ottaorm/client': path.resolve(__dirname, '../../packages/ottaorm/src/client/index.ts'),
            '@ottabase/ottaorm/models': path.resolve(__dirname, '../../packages/ottaorm/src/models'),
            '@ottabase/ottarouter': path.resolve(__dirname, '../../packages/ottarouter/src/index.ts'),
            '@ottabase/auth/backend': path.resolve(__dirname, '../../packages/auth/src/backend-handler'),
            '@ottabase/utils/http-response': path.resolve(__dirname, '../../packages/utils/src/http-response'),
            '@ottabase/utils/http-errors': path.resolve(__dirname, '../../packages/utils/src/http-errors'),
            '@ottabase/rbac/admin-guard': path.resolve(__dirname, '../../packages/rbac/src/admin-guard.ts'),
            '@ottabase/rbac/request-context': path.resolve(__dirname, '../../packages/rbac/src/request-context.ts'),
        },
    },
});
