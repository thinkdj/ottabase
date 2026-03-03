import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/metadata.ts', 'src/server.ts', 'src/client.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    splitting: false,
    sourcemap: false,
    external: ['@cloudflare/puppeteer'],
});
