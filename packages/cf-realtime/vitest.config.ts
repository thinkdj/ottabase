import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for @ottabase/cf-realtime
 *
 * Note: Durable Object tests in src/__tests__/server/ require the Cloudflare Workers
 * runtime and are currently excluded. To test Durable Objects properly, you need to:
 * 1. Use wrangler's dev environment
 * 2. Use @cloudflare/vitest-pool-workers with proper Workers setup
 * 3. Or wait for Cloudflare's introspection APIs (similar to Workflows testing)
 *
 * For now, we focus on testing the client and integration flows which work in Node.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 15000,
    hookTimeout: 15000,
    // Exclude Durable Object tests until proper Workers test environment is set up
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/*.{config,setup}.{js,ts}",
      "src/__tests__/server/**", // Requires Cloudflare Workers runtime
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
