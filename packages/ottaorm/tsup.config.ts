import { defineConfig } from 'tsup';

export default defineConfig({
    external: ['@ottabase/ottaorm/models', '@ottabase/rbac', '@ottabase/logger'],
    esbuildOptions(options) {
        options.loader = {
            ...options.loader,
            '.sql': 'text',
        };
    },
    dts: {
        resolve: false,
    },
});
