import fs from 'fs';
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

    it('names the resources of a named env from its own block, and its KV title after the env', () => {
        const demo = resolveCfApp({ app: 'otta-web', env: 'demo' });
        expect(demo.resources.d1.name).toBe('ottabase-db-demo');
        expect(demo.resources.r2.name).toBe('ottabase-bucket-demo');
        expect(demo.resources.queue.name).toBe('ottabase-queue-demo');
        expect(demo.resources.kv.title).toBe('otta-web-demo-kv');
        expect(demo.resources.secrets.d1Id).toBe('DEMO_D1_DATABASE_ID');
        expect(demo.resources.secrets.kvId).toBe('DEMO_KV_NAMESPACE_ID');

        const production = resolveCfApp({ app: 'otta-web', env: 'production' });
        expect(production.resources.d1.name).toBe('ottabase-db');
        expect(production.resources.kv.title).toBe('otta-web-kv');
        expect(production.resources.secrets.d1Id).toBe('D1_DATABASE_ID');

        expect(() => resolveCfApp({ app: 'otta-web', env: 'nope' })).toThrow(/no env\.nope block/);
    });
});

describe('otta-web queue wiring', () => {
    // A producer binding only fills the queue. Without a `consumers` entry for the same queue the Worker's
    // queue() handler never runs, so queued events and Beacon incident mail are lost without any error.
    // `queues` is not inherited by env.*, so the top level and every environment must pair them.
    it('every scope that produces to a queue also consumes that queue', () => {
        const config = parseJsonc<any>(fs.readFileSync(resolveCfApp({ app: 'otta-web' }).wranglerPath, 'utf8'));
        const scopes: Record<string, any> = { default: config, ...config.env };
        const names = (list: Array<{ queue: string }> | undefined) => (list ?? []).map((q) => q.queue).sort();

        expect(names(config.queues?.producers).length).toBeGreaterThan(0);
        for (const [scope, value] of Object.entries(scopes)) {
            expect({ scope, consumes: names(value.queues?.consumers) }).toEqual({
                scope,
                consumes: names(value.queues?.producers),
            });
        }
    });
});
