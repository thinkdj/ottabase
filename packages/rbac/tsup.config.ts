import { defineConfig } from 'tsup';

export default defineConfig({
    entry: [
        'src/index.ts',
        'src/middleware.ts',
        'src/utils.ts',
        'src/context.ts',
        'src/request-context.ts',
        'src/admin-guard.ts',
    ],
    external: ['@ottabase/ottaorm/models', '@ottabase/logger'],
    dts: {
        resolve: false,
    },
    clean: true,
    format: ['cjs', 'esm'],
});
