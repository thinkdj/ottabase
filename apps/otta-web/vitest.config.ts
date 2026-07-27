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
            all: true,
            lines: 70,
            functions: 70,
            branches: 65,
            statements: 70,
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
            '@ottabase/cf-realtime/server': path.resolve(__dirname, './src/test-mocks/cf-realtime-server.ts'),
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
