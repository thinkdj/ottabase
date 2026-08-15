import { defineConfig } from 'tsup';

export default defineConfig({
    entry: [
        'src/index.ts',
        'src/metadata.ts',
        'src/server.ts',
        'src/routes.ts',
        'src/client.ts',
        'src/react/index.tsx',
    ],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    splitting: false,
    sourcemap: false,
    external: ['@cloudflare/puppeteer', 'react'],
});
