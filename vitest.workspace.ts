import { defineWorkspace } from 'vitest/config';

/**
 * Vitest workspace configuration for monorepo testing
 * This allows running tests across all packages and apps
 *
 * Usage:
 *   pnpm test              - Run all tests in the monorepo
 *   pnpm test packages/utils            - Run tests in specific directory
 *
 * Note: Only packages/apps with test files are included here
 * Add more configurations as you add tests to other packages
 */
export default defineWorkspace([
  // Packages with tests
  {
    extends: './vitest.config.ts',
    test: {
      name: '@ottabase/utils',
      root: './packages/utils',
      environment: 'node',
    },
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: '@ottabase/cf',
      root: './packages/cf',
      environment: 'node',
    },
  },

  // Apps with tests
  {
    extends: './vitest.config.ts',
    test: {
      name: 'ottabase-template-app-tanstack',
      root: './apps/ottabase-template-app-tanstack',
      environment: 'happy-dom',
    },
  },
]);
