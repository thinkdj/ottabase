import { defineConfig } from 'tsup';

export default defineConfig({
    entry: [
        'src/index.ts',
        'src/templates.ts',
        'src/render.ts',
        'src/mailer.ts',
        'src/providers/dev-trap.ts',
        'src/providers/resend.ts',
        'src/providers/cloudflare.ts',
        'src/providers/nodemailer.ts',
        'src/providers/ses.ts',
    ],
    format: ['cjs', 'esm'],
    dts: {
        compilerOptions: {
            paths: {},
            skipLibCheck: true,
        },
    },
    clean: true,
});
