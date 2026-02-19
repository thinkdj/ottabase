import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        coverage: {
            provider: 'c8',
            reporter: ['text', 'json', 'html', 'lcov'],
            exclude: ['node_modules/', 'dist/', '**/*.config.ts', '**/*.config.js', '**/index.ts', '**/*.d.ts'],
            all: true,
            lines: 60,
            functions: 60,
            branches: 50,
            statements: 60,
        },
        include: ['src/**/*.{test,spec}.{ts,tsx}', '__tests__/**/*.{test,spec}.{ts,tsx}'],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
