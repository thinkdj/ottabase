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
    ],
    format: ["cjs", "esm"],
    dts: {
        // Use the build-specific tsconfig that doesn't inherit path mappings
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
    ],
});
