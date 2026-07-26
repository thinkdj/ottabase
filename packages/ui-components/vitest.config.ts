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
            // Resolve ui-shadcn to source so its components are covered here without a
            // rebuild. Its subpaths do NOT all live under src/ (components/ui/*.tsx
            // self-import these two), so map them explicitly rather than by wildcard —
            // a `src/$1` rewrite points at files that do not exist. Mirrors
            // packages/ui-shadcn/vitest.config.ts; keep the two in sync.
            {
                find: '@ottabase/ui-shadcn/lib/utils',
                replacement: path.resolve(__dirname, '../ui-shadcn/src/lib/utils.ts'),
            },
            {
                find: '@ottabase/ui-shadcn/brand-components',
                replacement: path.resolve(__dirname, '../ui-shadcn/providers/brand-components.tsx'),
            },
            {
                find: /^@ottabase\/ui-shadcn$/,
                replacement: path.resolve(__dirname, '../ui-shadcn/src/index.ts'),
            },
        ],
    },
});
