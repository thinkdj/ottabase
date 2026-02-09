import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/channels/index.ts', 'src/models/index.ts', 'src/manager.ts'],
    format: ['cjs', 'esm'],
    dts: {
        compilerOptions: {
            skipLibCheck: true,
        },
    },
    clean: true,
    external: [
        'drizzle-orm',
        '@ottabase/cf',
        '@ottabase/email',
        '@ottabase/cf-realtime',
        '@ottabase/cf-realtime/server',
        '@ottabase/queue',
        '@ottabase/ottaorm',
        '@ottabase/ottaorm/base',
    ],
});
