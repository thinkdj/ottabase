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
    external: [
        '@ottabase/ui-shadcn',
        '@tanstack/react-table',
        '@tanstack/react-query',
        'lucide-react',
        'react',
        'react-dom',
    ],
});
