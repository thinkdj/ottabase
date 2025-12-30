import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Base Vitest configuration for the monorepo
 * Individual packages and apps can extend this config
 */
export default defineConfig({
  test: {
    // Use happy-dom for DOM testing (faster than jsdom)
    environment: 'happy-dom',

    // Global test setup
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.{ts,js}',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/types.ts',
        '**/__tests__/',
      ],
    },

    // Test file patterns
    include: [
      '**/__tests__/**/*.{test,spec}.{ts,tsx}',
      '**/*.{test,spec}.{ts,tsx}',
    ],

    // Exclude patterns
    exclude: [
      'node_modules',
      'dist',
      '.next',
      '.turbo',
      'build',
    ],

    // Setup files that run before each test file
    // Individual packages can override this
    setupFiles: [],
  },

  resolve: {
    alias: {
      // Monorepo package aliases
      '@ottabase/utils': path.resolve(__dirname, './packages/utils/src'),
      '@ottabase/config': path.resolve(__dirname, './packages/config/src'),
      '@ottabase/db': path.resolve(__dirname, './packages/db/src'),
      '@ottabase/cf': path.resolve(__dirname, './packages/cf/src'),
      '@ottabase/cf-realtime': path.resolve(__dirname, './packages/cf-realtime/src'),
      '@ottabase/ottaorm': path.resolve(__dirname, './packages/ottaorm/src'),
      '@ottabase/auth': path.resolve(__dirname, './packages/auth/src'),
      '@ottabase/state': path.resolve(__dirname, './packages/state/src'),
      '@ottabase/scripts': path.resolve(__dirname, './packages/scripts/src'),
      '@ottabase/ui-base': path.resolve(__dirname, './packages/ui-base/src'),
      '@ottabase/ui-tailwind': path.resolve(__dirname, './packages/ui-tailwind/src'),
      '@ottabase/ui-shadcn': path.resolve(__dirname, './packages/ui-shadcn/src'),
      '@ottabase/ui-mantine': path.resolve(__dirname, './packages/ui-mantine/src'),
      '@ottabase/ui-components': path.resolve(__dirname, './packages/ui-components/src'),
      '@ottabase/ui-code-highlight': path.resolve(__dirname, './packages/ui-code-highlight/src'),
      '@ottabase/ottaeditor': path.resolve(__dirname, './packages/ottaeditor/src'),
      '@ottabase/ottaselect': path.resolve(__dirname, './packages/ottaselect/src'),
    },
  },
});
