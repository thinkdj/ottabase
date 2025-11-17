import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

/**
 * Vitest configuration for @ottabase/cf-realtime
 *
 * This config uses @cloudflare/vitest-pool-workers which provides:
 * - Miniflare runtime for local Cloudflare Workers emulation
 * - Full Durable Objects support
 * - KV, R2, D1, Queues, and other bindings
 * - Isolated test environments
 *
 * Test Organization:
 * - Client tests (src/__tests__/client/): Run in simulated browser/Node environment
 * - Server tests (src/__tests__/server/): Run in Workers runtime with Durable Objects
 * - Integration tests: Run in Workers runtime with full bindings
 */
export default defineWorkersConfig({
  test: {
    globals: true,
    testTimeout: 15000,
    hookTimeout: 15000,
    // Separate pools for different test types
    poolOptions: {
      workers: {
        wrangler: {
          configPath: "./wrangler.toml",
        },
        miniflare: {
          // Miniflare options for local Workers emulation
          compatibilityDate: "2024-01-01",
          compatibilityFlags: ["nodejs_compat"],
        },
        // Isolate each test file for clean state
        isolatedStorage: true,
      },
    },
    // Only exclude standard directories
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/examples/**",
      "**/*.{config,setup}.{js,ts}",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/examples/**",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/__tests__/**",
      ],
    },
  },
});
