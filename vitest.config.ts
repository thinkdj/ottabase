import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [react()],
    test: {
        // Global test environment
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./vitest.setup.ts'],

        // Coverage configuration
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov', 'text-summary'],
            exclude: [
                'node_modules/',
                'dist/',
                '**/*.config.ts',
                '**/*.config.js',
                '**/index.ts',
                '**/*.d.ts',
                'coverage/',
                '.turbo/',
                '.next/',
                '.wrangler/',
                'build/',
            ],
            all: true,
            lines: 70,
            functions: 70,
            branches: 65,
            statements: 70,
            skipFull: false,
        },

        // Workspace support - defines include patterns for projects
        include: [
            '**/__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
            '**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
        ],

        // Test isolation and configuration
        isolate: true,
        threads: true,
        maxThreads: 4,
        minThreads: 1,
    },

    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
        },
    },
});
