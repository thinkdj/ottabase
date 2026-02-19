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
        '@ottabase/config',
        '@ottabase/api',
        '@radix-ui/react-dialog',
        '@tabler/icons-react',
        'react',
        'react-dom',
    ],
});
