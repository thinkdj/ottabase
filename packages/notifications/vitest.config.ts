import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        // Use the repo-root setup file
        setupFiles: ['../../vitest.setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov', 'text-summary'],
            exclude: ['node_modules/', 'dist/', '**/*.config.ts', '**/*.d.ts'],
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
