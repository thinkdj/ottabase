import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['../../vitest.setup.ts'],
        coverage: {
            provider: 'c8',
            reporter: ['text', 'json', 'html', 'lcov'],
            exclude: ['node_modules/', 'dist/', '**/*.config.ts', '**/*.config.js', '**/index.ts', '**/*.d.ts'],
            all: true,
            lines: 75,
            functions: 75,
            branches: 70,
            statements: 75,
        },
        include: ['src/**/*.{test,spec}.{ts,tsx}', '__tests__/**/*.{test,spec}.{ts,tsx}'],
    },
    resolve: {
        alias: [
            {
                find: '@',
                replacement: path.resolve(__dirname, './src'),
            },
            {
                find: /^@ottabase\/ui-shadcn$/,
                replacement: path.resolve(__dirname, '../ui-shadcn/src/index.ts'),
            },
            {
                find: /^@ottabase\/ui-shadcn\/(.*)$/,
                replacement: path.resolve(__dirname, '../ui-shadcn/src/$1'),
            },
        ],
    },
});
