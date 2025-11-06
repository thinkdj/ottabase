import { defineConfig } from "vitest/config";

/**
 * Root Vitest configuration
 * Individual packages can extend this config with their own settings
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.turbo/**",
        "**/.next/**",
        "**/coverage/**",
        "**/*.config.*",
        "**/examples/**",
        "**/__tests__/fixtures/**",
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
