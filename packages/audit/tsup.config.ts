import { defineConfig } from 'tsup';

export default defineConfig({
    external: ['@ottabase/ottaorm/models', '@ottabase/logger'],
    dts: {
        resolve: false,
    },
});
