import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['../../vitest.setup.ts'],
        coverage: {
            provider: 'c8',
            reporter: ['text', 'json', 'html', 'lcov'],
            exclude: [
                'node_modules/',
                'dist/',
                '**/*.config.ts',
                '**/*.config.js',
                '**/index.ts',
                '**/*.d.ts',
                'components/',
                'styles/',
            ],
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
            // Self-referencing package imports used by components/ui/*.tsx
            '@ottabase/ui-shadcn/lib/utils': path.resolve(__dirname, './src/lib/utils.ts'),
            '@ottabase/ui-shadcn': path.resolve(__dirname, './src/index.ts'),
        },
    },
});
