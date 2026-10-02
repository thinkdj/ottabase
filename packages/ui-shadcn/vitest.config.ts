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
            provider: 'v8',
            include: ['src/**/*.{ts,tsx}'],
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
        },
        include: ['src/**/*.{test,spec}.{ts,tsx}', '__tests__/**/*.{test,spec}.{ts,tsx}'],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            // Self-referencing package imports used by components/ui/*.tsx
            '@ottabase/ui-shadcn/lib/utils': path.resolve(__dirname, './src/lib/utils.ts'),
            '@ottabase/ui-shadcn/brand-components': path.resolve(__dirname, './providers/brand-components.tsx'),
            '@ottabase/ui-shadcn': path.resolve(__dirname, './src/index.ts'),
        },
    },
});
