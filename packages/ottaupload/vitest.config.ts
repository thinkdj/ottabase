import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom', // Use jsdom for React component testing
        globals: true,
        setupFiles: ['./vitest.setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            exclude: ['node_modules/', 'dist/', '**/*.config.ts', '**/*.config.js', '**/index.ts', '**/*.d.ts'],
            all: true,
            lines: 70,
            functions: 70,
            branches: 65,
            statements: 70,
        },
        include: ['src/**/*.{test,spec}.{ts,tsx}', '__tests__/**/*.{test,spec}.{ts,tsx}'],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
