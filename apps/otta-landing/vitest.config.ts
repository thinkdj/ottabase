import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [react()],
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
                '.storybook/',
                'prisma/',
                '**/*.config.ts',
                '**/*.config.js',
                '**/*.d.ts',
                'ottabase/',
                'public/',
                'scripts/',
                'cloudflare-stub.js',
            ],
        },
        include: ['app/**/*.{test,spec}.{ts,tsx}', '__tests__/**/*.{test,spec}.{ts,tsx}'],
        testTimeout: 30000,
        // Pre-resolve packages whose dist may not be built in dev
        server: {
            deps: {
                inline: ['@ottabase/ottalayout'],
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
            // Stub packages that may not have dist built
            '@ottabase/ottalayout/react': path.resolve(__dirname, './vitest.stubs.ts'),
            '@ottabase/ottalayout': path.resolve(__dirname, './vitest.stubs.ts'),
        },
    },
});
