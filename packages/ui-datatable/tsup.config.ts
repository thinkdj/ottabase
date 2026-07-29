import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/react.ts'],
    format: ['cjs', 'esm'],
    dts: {
        compilerOptions: {
            paths: {},
            skipLibCheck: true,
        },
    },
    clean: true,
    treeshake: true,
    external: ['@tanstack/react-table', '@tanstack/react-query', 'clsx', 'lucide-react', 'react', 'react-dom'],
});
