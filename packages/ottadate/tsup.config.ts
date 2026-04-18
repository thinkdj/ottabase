import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        core: 'src/core.ts',
        fuzzy: 'src/fuzzy.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    splitting: true,
    treeshake: true,
    sourcemap: true,
});
