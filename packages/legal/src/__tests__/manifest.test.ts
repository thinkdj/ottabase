import { describe, expect, it } from 'vitest';
import { createLegalPackage } from '../manifest';
import type { LegalConfig } from '../types';

const base: LegalConfig = {
    appName: 'Acme',
    companyName: 'Acme Inc.',
    siteUrl: 'https://acme.test',
    contactEmail: 'support@acme.test',
    jurisdiction: 'Delaware, United States',
    lastUpdated: '1 January 2026',
    features: { paidPlans: true },
};

type Env = { LEGAL_NAME?: string };
type Pkg = ReturnType<typeof createLegalPackage<Env>>;
/** The one route contribution the package declares. */
const routesOf = (pkg: Pkg) => (Array.isArray(pkg.routes) ? pkg.routes[0] : pkg.routes)!;
const hit = (pkg: Pkg, path: string, env: Env = {}) =>
    routesOf(pkg)
        .build({} as never)
        .handle(new Request(`https://acme.test${path}`), env);

describe('createLegalPackage', () => {
    it('mounts at the config basePath and serves html, md and json for every published document', async () => {
        const pkg = createLegalPackage<Env>({ config: base });
        expect(pkg.key).toBe('legal');
        expect(routesOf(pkg).basePath).toBe('/legal');
        const page = await hit(pkg, '/privacy');
        expect(page?.status).toBe(200);
        expect(page?.headers.get('content-type')).toBe('text/html; charset=utf-8');
        expect(page?.headers.get('cache-control')).toBe('public, max-age=3600');
        expect(await page!.text()).toContain('<h1 class="otta-legal-title">Privacy Policy</h1>');
        expect((await (await hit(pkg, '/privacy.md'))!.text()).startsWith('# Privacy Policy')).toBe(true);
        const json = (await (await hit(pkg, '/refunds.json'))!.json()) as { slug: string; toc: unknown[] };
        expect(json.slug).toBe('refunds');
        expect(json.toc.length).toBeGreaterThan(2);
        expect(await (await hit(pkg, '/'))!.text()).toContain('href="/legal/refunds"');
        expect(((await (await hit(pkg, '/index.json'))!.json()) as { slug: string }[]).map((d) => d.slug)).toEqual([
            'terms',
            'privacy',
            'acceptable-use',
            'refunds',
        ]);
    });
    it('falls through on unknown and disabled documents, and on a bad extension', async () => {
        const pkg = createLegalPackage<Env>({ config: { ...base, features: {} } });
        expect(await hit(pkg, '/refunds')).toBeNull();
        expect(await hit(pkg, '/nope')).toBeNull();
        expect(await hit(pkg, '/privacy.txt')).toBeNull();
        expect(await hit(pkg, '/privacy/extra')).toBeNull();
    });
    it("in api mode a bare slug is JSON, the index is a list, and the config's basePath still drives the links", async () => {
        const pkg = createLegalPackage<Env>({ config: base, basePath: '/api/legal', serve: 'api', maxAge: 60 });
        expect(routesOf(pkg).basePath).toBe('/api/legal');
        const doc = await hit(pkg, '/terms');
        expect(doc?.headers.get('content-type')).toBe('application/json');
        expect(doc?.headers.get('cache-control')).toBe('public, max-age=60');
        expect(((await doc!.json()) as { markdown: string }).markdown).toContain('(/legal/acceptable-use)');
        expect(Array.isArray(await (await hit(pkg, '/'))!.json())).toBe(true);
        expect(await (await hit(pkg, '/terms.html'))!.text()).toContain('<!doctype html>');
    });
    it('resolves the config from env per request and reports gaps through health', async () => {
        const pkg = createLegalPackage<Env>({
            config: (env) => ({
                ...base,
                appName: env.LEGAL_NAME ?? 'Default',
                jurisdiction: env.LEGAL_NAME ? 'Delaware' : 'TODO',
            }),
        });
        expect(routesOf(pkg).basePath).toBe('/legal');
        expect(await (await hit(pkg, '/terms.md', { LEGAL_NAME: 'Tenant' }))!.text()).toContain('Tenant');
        expect(await pkg.health!({ LEGAL_NAME: 'Tenant' })).toEqual({
            name: 'legal:config',
            ok: true,
            detail: undefined,
        });
        const bad = (await pkg.health!({})) as { ok: boolean; detail?: string };
        expect(bad.ok).toBe(false);
        expect(bad.detail).toContain('jurisdiction');
    });
});
