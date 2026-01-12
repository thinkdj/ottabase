import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/adapter.ts",
    "src/adapters/drizzle-adapter.ts",
    "src/config.ts",
    "src/providers.ts",
    "src/session.ts",
    "src/components/index.ts",
    "src/backend-handler.ts",
    "src/client-api.ts",
    "src/react-hooks.ts",
  ],
  format: ["cjs", "esm"],
  // Use explicit DTS compiler options to avoid inheriting path mappings
  // and to prevent type resolution issues from third-party libraries.
  dts: {
    compilerOptions: {
      paths: {},
      skipLibCheck: true,
    },
  },
  clean: true,
  external: [
    // Externalize all @ottabase packages to use their built types
    "@ottabase/ui-shadcn",
    "@ottabase/ottaorm",
    // Externalize React to avoid type resolution issues during DTS build
    "react",
    "react-dom",
    "jotai",
    "jotai/utils",
    "@auth/core",
  ],
});
