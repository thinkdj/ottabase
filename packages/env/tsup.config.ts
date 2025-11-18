import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
    "schemas/index": "src/schemas/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false,
  sourcemap: true,
  target: "es2022",
  platform: "node",
  shims: true,
});
