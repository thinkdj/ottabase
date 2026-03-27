import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: {
        compilerOptions: {
            paths: {},
            skipLibCheck: true,
        },
    },
    clean: true,
    treeshake: true,
    external: ['react', 'react-dom'],
});
