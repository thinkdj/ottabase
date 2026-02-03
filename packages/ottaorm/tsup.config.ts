import { defineConfig } from 'tsup';

export default defineConfig({
    external: ['@ottabase/ottaorm/models', '@ottabase/rbac'],
    dts: {
        resolve: true,
        compilerOptions: {
            rootDir: '.',
        },
    },
});
