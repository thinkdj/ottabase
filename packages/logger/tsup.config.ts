import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/transports.ts', 'src/formatters.ts', 'src/config.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
});
