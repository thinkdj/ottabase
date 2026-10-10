import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            exclude: [
                'node_modules/',
                '.next/',
                '.open-next/',
                '.wrangler/',
                '**/*.config.*',
                '**/*.d.ts',
                'scripts/',
                'cloudflare-stub.js',
            ],
        },
        include: ['__tests__/**/*.{test,spec}.{ts,tsx}'],
        testTimeout: 30000,
    },
    resolve: {
        alias: { '@': path.resolve(__dirname, './') },
    },
    esbuild: { jsx: 'automatic' },
});
