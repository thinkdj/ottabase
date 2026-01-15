import react from "@vitejs/plugin-react";
import path from "path";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "c8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "dist/",
        ".wrangler/",
        ".next/",
        "**/*.config.ts",
        "**/*.config.js",
        "cloudflare-env.d.ts",
        "**/*.d.ts",
        "public/",
      ],
      all: true,
      lines: 70,
      functions: 70,
      branches: 65,
      statements: 70,
    },
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "__tests__/**/*.{test,spec}.{ts,tsx}",
    ],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@ottabase/cf-realtime/server": path.resolve(
        __dirname,
        "./src/test-mocks/cf-realtime-server.ts",
      ),
    },
  },
});
