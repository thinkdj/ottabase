import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/registry.ts",
    "src/templates/index.ts",
    "src/providers/index.ts",
    "src/providers/resend.ts",
    "src/providers/cloudflare.ts",
  ],
  format: ["cjs", "esm"],
  dts: {
    compilerOptions: {
      paths: {},
      skipLibCheck: true,
    },
  },
  external: [],
  clean: true,
  splitting: false,
});
