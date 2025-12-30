import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import path from 'path';

/**
 * Vitest configuration for @ottabase/cf package
 * Uses Cloudflare Workers test pool for testing Workers APIs
 */
export default defineWorkersConfig({
  test: {
    globals: true,
    environment: 'node',
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          // Cloudflare Workers environment simulation
          compatibilityDate: '2024-01-01',
          compatibilityFlags: ['nodejs_compat'],

          // Mock bindings for testing
          bindings: {
            // These are test bindings - real bindings come from wrangler.toml
          },

          // Enable D1 beta for database testing
          d1Databases: ['TEST_DB'],
          kvNamespaces: ['TEST_KV'],
          r2Buckets: ['TEST_R2'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@ottabase/utils': path.resolve(__dirname, '../utils/src'),
      '@ottabase/config': path.resolve(__dirname, '../config/src'),
    },
  },
});
