import { defineConfig } from 'tsup';

export default defineConfig({
    external: ['@ottabase/ottaorm/models', '@ottabase/rbac', '@ottabase/logger'],
    dts: {
        resolve: false,
    },
});
