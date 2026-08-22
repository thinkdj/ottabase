import { describe, expect, it } from 'vitest';
import { escapeRegExp, parseJsonc, resolveCfApp } from '../cli/cf-app';

describe('parseJsonc', () => {
    it('strips line + block comments and trailing commas', () => {
        const input = `{
            // a line comment
            "a": 1, /* a block comment */
            "b": [1, 2,], // trailing comma in array
            "c": { "d": 2, }, // trailing comma in object
        }`;
        expect(parseJsonc(input)).toEqual({ a: 1, b: [1, 2], c: { d: 2 } });
    });

    it('does not treat // or trailing-comma-like sequences inside strings as syntax', () => {
        const input = `{ "url": "https://x.com//path", "weird": "a,]" }`;
        expect(parseJsonc(input)).toEqual({ url: 'https://x.com//path', weird: 'a,]' });
    });
});

describe('escapeRegExp', () => {
    it('escapes regex metacharacters so resource names match literally', () => {
        const re = new RegExp(escapeRegExp('my-app.db+'));
        expect(re.test('my-app.db+')).toBe(true);
        expect(re.test('myXappYdbZ')).toBe(false);
    });
});

describe('resolveCfApp', () => {
    it('reads resource names from the app wrangler.jsonc (nothing hardcoded)', () => {
        const ctx = resolveCfApp({ app: 'otta-web' });

        expect(ctx.appName).toBe('otta-web');
        expect(ctx.packageName).toBe('@ottabase/otta-web');
        expect(ctx.wranglerCmd).toBe('pnpm --filter @ottabase/otta-web exec wrangler');
        expect(ctx.workerName).toBe('otta-web');

        // KV title is derived from the worker name and is distinct from the binding.
        expect(ctx.resources.kv.binding).toBe('OBCF_KV');
        expect(ctx.resources.kv.title).toBe(`${ctx.workerName}-kv`);
        expect(ctx.resources.kv.previewTitle).toBe(`${ctx.workerName}-kv_preview`);

        // D1 / R2 / Queue names come straight from wrangler.jsonc.
        expect(ctx.resources.d1.name).toBe('ottabase-db');
        expect(ctx.resources.d1.previewName).toBe('ottabase-db-preview');
        expect(ctx.resources.r2.name).toBe('ottabase-bucket');
        expect(ctx.resources.r2.previewName).toBe('ottabase-bucket-preview');
        expect(ctx.resources.queue.name).toBe('ottabase-queue');
        expect(ctx.resources.queue.previewName).toBe('ottabase-queue-preview');

        // GitHub Secret names come from the env.production / env.preview placeholders.
        expect(ctx.resources.secrets.d1Id).toBe('D1_DATABASE_ID');
        expect(ctx.resources.secrets.kvPreviewId).toBe('KV_PREVIEW_NAMESPACE_ID');
    });

    it('falls back to the root package.json ottabase.defaultApp default when not told which app', () => {
        // Repo has two apps with wrangler.jsonc; the root declares otta-web as the default.
        expect(resolveCfApp().appName).toBe('otta-web');
    });

    it('honors the --app=<name> flag over the configured default', () => {
        const origArgv = process.argv;
        process.argv = [...origArgv, '--app=otta-landing'];
        try {
            expect(resolveCfApp().appName).toBe('otta-landing');
        } finally {
            process.argv = origArgv;
        }
    });

    it('honors the OTTABASE_APP env var', () => {
        const had = Object.prototype.hasOwnProperty.call(process.env, 'OTTABASE_APP');
        const orig = process.env.OTTABASE_APP;
        process.env.OTTABASE_APP = 'otta-landing';
        try {
            expect(resolveCfApp().appName).toBe('otta-landing');
        } finally {
            if (had) process.env.OTTABASE_APP = orig as string;
            else delete process.env.OTTABASE_APP;
        }
    });

    it('lets an explicit opts.app win over env and the configured default', () => {
        const had = Object.prototype.hasOwnProperty.call(process.env, 'OTTABASE_APP');
        const orig = process.env.OTTABASE_APP;
        process.env.OTTABASE_APP = 'otta-landing';
        try {
            expect(resolveCfApp({ app: 'otta-web' }).appName).toBe('otta-web');
        } finally {
            if (had) process.env.OTTABASE_APP = orig as string;
            else delete process.env.OTTABASE_APP;
        }
    });

    it('throws a helpful error for an unknown app', () => {
        expect(() => resolveCfApp({ app: 'does-not-exist' })).toThrow(/no wrangler\.jsonc|Available/i);
    });
});
