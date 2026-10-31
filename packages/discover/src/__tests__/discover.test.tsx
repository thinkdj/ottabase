// One facts object, every file it becomes: robots that really allow the crawlers it names (read
// back by a small evaluator), a sitemap that escapes, otta.json in Ottabuzz's shape without the
// private lines, JSON-LD that cannot close its own tag, a paragraph that invents nothing, and the
// three routes on a Worker router and in the Next.js handler.
import { createPackageRegistry, mountPackages } from '@ottabase/kernel';
import { Router } from '@ottabase/ottarouter';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    AI_SEARCH_BOTS,
    AI_TRAINING_BOTS,
    brandFromTheme,
    canonicalParagraph,
    cssColorToHex,
    defineProduct,
    fontFamilyName,
    isOwnerKey,
    jsonLd,
    jsonLdScript,
    llmsTxt,
    ottaJson,
    parseOttaJson,
    pricingLine,
    robotsRules,
    robotsTxt,
    sitemapXml,
} from '../index';
import { createDiscoverPackage } from '../manifest';
import { discoverRobots, ottaJsonHandler, ProductJsonLd } from '../next';

const FACTS = defineProduct({
    name: 'Alpha',
    url: 'https://alpha.test',
    tagline: 'A SaaS starter for Cloudflare.',
    whatItIs: 'Auth and billing in the box, on one Worker.\n\nIt deploys in a minute.',
    whoItIsFor: 'founders who ship alone',
    features: ['Auth in the box', 'Billing in the box', 'One Worker'],
    pricing: {
        plans: [
            { name: 'Hobby', price: 'free' },
            { name: 'Pro', price: 15, period: 'month', includes: ['8 projects'] },
            { name: 'Lifetime', price: 199, currency: 'EUR', period: 'once' },
        ],
        note: 'No card to start.',
    },
    neverClaim: ['Enterprise ready'],
    founder: { name: 'Dj', url: 'https://think.dj' },
    logo: 'https://alpha.test/logo.png',
    sameAs: ['https://github.com/thinkdj/alpha', 'javascript:alert(1)'],
    launched: '2026-03-01',
    keywords: ['saas starter'],
    hero: { line: 'Ship the SaaS', sub: 'Skip the plumbing', button: 'Start free' },
    contact: 'hi@alpha.test',
});

/** Whether `ua` may fetch `path` under `txt`: the group naming it, else `*`; longest matching rule wins; nothing matching allows. */
function allowed(txt: string, ua: string, path: string): boolean {
    const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
    let cur: (typeof groups)[number] | null = null;
    let inAgents = false;
    for (const raw of txt.split('\n')) {
        const line = raw.replace(/#.*/, '').trim();
        if (!line) continue;
        const i = line.indexOf(':');
        const key = line.slice(0, i).trim().toLowerCase();
        const value = line.slice(i + 1).trim();
        if (key === 'user-agent') {
            if (!cur || !inAgents) groups.push((cur = { agents: [], rules: [] }));
            cur.agents.push(value.toLowerCase());
            inAgents = true;
            continue;
        }
        inAgents = false;
        if (cur && (key === 'allow' || key === 'disallow')) cur.rules.push({ allow: key === 'allow', path: value });
    }
    const group = groups.find((g) => g.agents.includes(ua.toLowerCase())) ?? groups.find((g) => g.agents.includes('*'));
    const hit = group?.rules
        .filter((r) => r.path && path.startsWith(r.path))
        .sort((a, b) => b.path.length - a.path.length)[0];
    return hit ? hit.allow : true;
}

describe('defineProduct', () => {
    it('clamps and normalises, drops what it cannot use, and invents nothing', () => {
        expect(FACTS.url).toBe('https://alpha.test/');
        expect(FACTS.sameAs).toEqual(['https://github.com/thinkdj/alpha']);
        expect(FACTS.pricing?.plans.map((p) => [p.name, p.price, p.currency, p.period])).toEqual([
            ['Hobby', 'free', 'USD', 'month'],
            ['Pro', 15, 'USD', 'month'],
            ['Lifetime', 199, 'EUR', 'once'],
        ]);
        expect(pricingLine(FACTS.pricing)).toBe(
            'Hobby free; Pro $15 a month; Lifetime EUR 199 once. No card to start.',
        );
        const bare = defineProduct({ name: '  Beta  ', url: 'https://beta.test/x', stage: 'nope', launched: 'March' });
        expect(bare).toEqual({ name: 'Beta', url: 'https://beta.test/x', features: [] });
        expect(defineProduct({ name: 'x'.repeat(200), url: 'https://x.test' }).name).toHaveLength(80);
    });

    it('refuses a product without a name or an absolute address', () => {
        expect(() => defineProduct({ url: 'https://x.test' })).toThrow(/name/);
        expect(() => defineProduct({ name: 'X', url: '/relative' })).toThrow(/url/);
    });
});

describe('robots', () => {
    const txt = robotsTxt({
        sitemap: 'https://alpha.test/sitemap.xml',
        disallow: ['/api/', 'not-a-path'],
        allow: ['/api/files/public/'],
    });

    it('allows every AI search crawler by name and keeps the private paths from all of them', () => {
        for (const bot of [...AI_SEARCH_BOTS, ...AI_TRAINING_BOTS, 'SomeOtherBot']) {
            expect(allowed(txt, bot, '/pricing'), bot).toBe(true);
            expect(allowed(txt, bot, '/api/leads'), bot).toBe(false);
            // The images live under the disallowed prefix; the longer allow wins.
            expect(allowed(txt, bot, '/api/files/public/logo.png'), bot).toBe(true);
        }
        expect(txt.match(/^Sitemap: https:\/\/alpha\.test\/sitemap\.xml$/gm)).toHaveLength(1);
        expect(txt).not.toContain('not-a-path');
    });

    it('blocks only the training crawlers when asked, and everyone off production', () => {
        const blocked = robotsTxt({ training: 'block' });
        for (const bot of AI_TRAINING_BOTS) expect(allowed(blocked, bot, '/'), bot).toBe(false);
        for (const bot of AI_SEARCH_BOTS) expect(allowed(blocked, bot, '/'), bot).toBe(true);
        expect(allowed(blocked, 'Mozilla', '/')).toBe(true);
        const closed = robotsTxt({ closed: true, sitemap: 'https://alpha.test/sitemap.xml' });
        expect(allowed(closed, 'OAI-SearchBot', '/')).toBe(false);
        expect(closed).not.toContain('Sitemap');
    });

    it('gives Next.js the same rules as data', () => {
        const rules = robotsRules({ sitemap: 'https://alpha.test/sitemap.xml' });
        expect(discoverRobots({ sitemap: 'https://alpha.test/sitemap.xml' })).toEqual(rules);
        expect(rules.sitemap).toBe('https://alpha.test/sitemap.xml');
        expect(rules.rules.map((r) => r.userAgent)).toEqual([...AI_SEARCH_BOTS, [...AI_TRAINING_BOTS], '*']);
        expect(robotsRules({ closed: true })).toEqual({ rules: [{ userAgent: '*', disallow: '/' }] });
    });
});

describe('sitemapXml', () => {
    it('escapes addresses, writes dates as ISO and drops anything relative', () => {
        const xml = sitemapXml([
            { url: 'https://alpha.test/?a=1&b=2', lastModified: new Date('2026-10-01T00:00:00Z'), priority: 0.8 },
            { url: '/about' },
            { url: 'https://alpha.test/docs', changeFrequency: 'weekly', lastModified: 'not a date' },
        ]);
        expect(xml).toContain(
            '<loc>https://alpha.test/?a=1&amp;b=2</loc><lastmod>2026-10-01T00:00:00.000Z</lastmod><priority>0.8</priority>',
        );
        expect(xml).toContain('<loc>https://alpha.test/docs</loc><changefreq>weekly</changefreq></url>');
        expect(xml).not.toContain('/about');
    });
});

describe('otta.json', () => {
    it("is Ottabuzz's shape, keeps the private lines out, and reads back through parseOttaJson", () => {
        const at = new Date('2026-10-22T00:00:00Z');
        const file = ottaJson(FACTS, { from: 'https://alpha.test/.well-known/otta.json', at });
        expect(file).toMatchObject({ version: 2, kind: 'otta-context', scope: 'public', at: at.toISOString() });
        expect(file.hash).toMatch(/^[0-9a-f]{14}$/);
        expect(file.product).toMatchObject({
            name: 'Alpha',
            tagline: 'A SaaS starter for Cloudflare.',
            whoItIsFor: 'founders who ship alone',
            features: ['Auth in the box', 'Billing in the box', 'One Worker'],
            pricing: 'Hobby free; Pro $15 a month; Lifetime EUR 199 once. No card to start.',
            neverClaim: [],
            hero: { line: 'Ship the SaaS', sub: 'Skip the plumbing', button: 'Start free' },
            launchOn: '2026-03-01',
            logo: 'https://alpha.test/logo.png',
            log: null,
            press: null,
            // Version 2: the plans as data, the founder as a block, the brand with the mark in it.
            pricingNote: 'No card to start.',
        });
        expect(file.product.plans).toHaveLength(3);
        expect(file.product.plans[0]).toEqual({
            name: 'Hobby',
            price: 'free',
            currency: 'USD',
            period: 'month',
            includes: [],
        });
        expect(file.product.founder).toMatchObject({ name: 'Dj', url: 'https://think.dj/' });
        expect(file.product.brand.logo).toBe('https://alpha.test/logo.png');
        expect(JSON.stringify(file)).not.toContain('Enterprise ready');
        expect(parseOttaJson(JSON.parse(JSON.stringify(file)))).toEqual(file);
        // The owner's copy carries the lines the public one keeps out, and hashes differently.
        const own = ottaJson(FACTS, { from: 'https://alpha.test/.well-known/otta.json', at, scope: 'owner' });
        expect(own.product.neverClaim).toEqual(['Enterprise ready']);
        expect(own.hash).not.toBe(file.hash);
    });

    it('reads a file Ottabuzz wrote, with its extra sections, and refuses anything else', () => {
        const fromOttabuzz = {
            version: 1,
            kind: 'otta-context',
            at: '2026-10-22T06:00:00.000Z',
            from: 'https://ottabuzz.com/b/alpha/context.json',
            product: {
                name: 'Alpha',
                url: 'https://alpha.test/',
                tagline: 'A SaaS starter.',
                stage: 'launched',
                launchOn: null,
                whatItIs: 'A SaaS starter.',
                whoItIsFor: 'Founders.',
                problem: 'Plumbing takes a month.',
                features: ['Auth'],
                pricing: '',
                different: '',
                objections: ['Why not Supabase: it is a database.'],
                neverClaim: ['Cheaper than Supabase'],
                positioning: 'The starter for one person.',
                keywords: ['alpha'],
                hero: null,
                brief: '## What it is\n...',
                bio: '',
                contact: '',
                log: 'https://ottabuzz.com/b/alpha',
                feed: 'https://ottabuzz.com/b/alpha/feed',
                press: 'https://ottabuzz.com/b/alpha/press',
                card: 'https://ottabuzz.com/b/alpha/card',
                logo: null,
                screenshots: [],
            },
        };
        const read = parseOttaJson(fromOttabuzz)!;
        expect(read.product.objections).toEqual(['Why not Supabase: it is a database.']);
        expect(read.product.neverClaim).toEqual(['Cheaper than Supabase']);
        expect(read.product.press).toBe('https://ottabuzz.com/b/alpha/press');
        expect(
            parseOttaJson({ ...fromOttabuzz, product: { ...fromOttabuzz.product, features: 'Auth', logo: 'x' } })!
                .product,
        ).toMatchObject({ features: [], logo: null });
        expect(parseOttaJson({ kind: 'otta-context', product: {} })).toBeNull();
        expect(parseOttaJson({ product: fromOttabuzz.product })).toBeNull();
        expect(parseOttaJson('nope')).toBeNull();
    });
});

describe('JSON-LD', () => {
    it('carries the organization, the site and the application with its offers', () => {
        const graph = jsonLd(FACTS)['@graph'];
        expect(graph.map((n) => n['@type'])).toEqual(['Organization', 'WebSite', 'SoftwareApplication']);
        expect(graph[0]).toMatchObject({
            founder: { '@type': 'Person', name: 'Dj' },
            foundingDate: '2026-03-01',
            email: 'hi@alpha.test',
        });
        const app = graph[2] as { offers: { name: string; price: number; priceCurrency: string }[]; audience: unknown };
        expect(app.offers.map((o) => [o.name, o.price, o.priceCurrency])).toEqual([
            ['Hobby', 0, 'USD'],
            ['Pro', 15, 'USD'],
            ['Lifetime', 199, 'EUR'],
        ]);
        expect(app.audience).toEqual({ '@type': 'Audience', audienceType: 'founders who ship alone' });
        expect(jsonLd(defineProduct({ name: 'Beta', url: 'https://beta.test' }))['@graph'][2]).not.toHaveProperty(
            'offers',
        );
    });

    it('cannot be closed early by a fact that contains a script tag', () => {
        const sneaky = defineProduct({ ...FACTS, features: ['</script><script>alert(1)</script>'] });
        const script = jsonLdScript(sneaky);
        expect(script.match(/<\/script>/g)).toHaveLength(1);
        expect(script).toContain('\\u003c/script');
    });
});

describe('canonicalParagraph', () => {
    it('says only what the facts say', () => {
        expect(canonicalParagraph(FACTS)).toBe(
            'Alpha is a SaaS starter for Cloudflare. It is for founders who ship alone. Made by Dj, since 2026. https://alpha.test/',
        );
        expect(
            canonicalParagraph(
                defineProduct({ name: 'Beta', url: 'https://beta.test', whatItIs: 'Does one thing well. Then stops.' }),
            ),
        ).toBe('Beta is does one thing well. https://beta.test/');
    });
});

describe('llmsTxt', () => {
    it('writes the summary and skips empty sections', () => {
        const txt = llmsTxt(FACTS, [
            { title: 'Docs', links: [{ title: 'Start', href: '/docs/start', note: 'Five minutes.' }] },
            { title: 'Empty', links: [] },
        ]);
        expect(txt).toBe(
            '# Alpha\n\n> A SaaS starter for Cloudflare.\n\n## Docs\n\n- [Start](/docs/start): Five minutes.\n',
        );
    });
});

describe('the Worker manifest', () => {
    const env = { facts: FACTS as typeof FACTS | null };
    const router = new Router<typeof env>();
    const packages = createPackageRegistry<typeof env>({
        packages: [
            createDiscoverPackage<typeof env>({
                facts: (e) => e.facts,
                robots: { sitemap: 'https://alpha.test/sitemap.xml', disallow: ['/api/'] },
                sitemap: async () => [{ url: 'https://alpha.test/' }],
            }),
        ],
    });
    const mounted = mountPackages(router, { packages });
    const get = (path: string, e = env) => router.handle(new Request(`https://alpha.test${path}`), e);

    it('serves robots.txt, otta.json and the sitemap from the root', async () => {
        expect(mounted).toEqual(['/']);
        const robots = (await get('/robots.txt'))!;
        expect(robots.headers.get('content-type')).toBe('text/plain; charset=utf-8');
        expect(allowed(await robots.text(), 'OAI-SearchBot', '/api/x')).toBe(false);
        const json = (await get('/.well-known/otta.json?x=1'))!;
        expect(json.status).toBe(200);
        expect(json.headers.get('access-control-allow-origin')).toBe('*');
        expect(json.headers.get('cache-control')).toBe('public, max-age=300');
        expect(await json.json()).toMatchObject({
            kind: 'otta-context',
            from: 'https://alpha.test/.well-known/otta.json',
        });
        expect(await (await get('/sitemap.xml'))!.text()).toContain('<loc>https://alpha.test/</loc>');
        expect(await get('/nothing-here')).toBeNull();
    });

    it('answers 404 and an unhealthy line while there are no facts', async () => {
        const none = { facts: null };
        expect((await get('/.well-known/otta.json', none))!.status).toBe(404);
        const health = await packages.packages[0]!.health!(none);
        expect(health).toMatchObject({ name: 'discover:facts', ok: false });
        expect(await packages.packages[0]!.health!(env)).toMatchObject({ ok: true });
    });
});

describe('the Next.js half', () => {
    it('renders the JSON-LD script and answers the route handler', async () => {
        const out = renderToStaticMarkup(<ProductJsonLd facts={FACTS} />);
        expect(out).toMatch(/^<script type="application\/ld\+json">\{"@context":"https:\/\/schema.org"/);
        expect(out).toContain('"SoftwareApplication"');
        const handler = ottaJsonHandler(
            async (req) => (new URL(req.url).searchParams.has('none') ? null : FACTS),
            () => 'next-secret',
        );
        const res = await handler(new Request('https://alpha.test/.well-known/otta.json'));
        expect(res.status).toBe(200);
        expect((await res.json()).product.name).toBe('Alpha');
        expect((await handler(new Request('https://alpha.test/.well-known/otta.json?none'))).status).toBe(404);
        const own = await handler(new Request('https://alpha.test/.well-known/otta.json?key=next-secret'));
        expect((await own.json()).product.neverClaim).toEqual(['Enterprise ready']);
    });
});

describe('the owner key and the ETag', () => {
    const env = { facts: FACTS as typeof FACTS | null, key: 'a-long-random-secret' as string | null };
    const router = new Router<typeof env>();
    mountPackages(router, {
        packages: createPackageRegistry<typeof env>({
            packages: [createDiscoverPackage<typeof env>({ facts: (e) => e.facts, owner: (e) => e.key })],
        }),
    });
    const get = (path: string, headers: Record<string, string> = {}, e = env) =>
        router.handle(new Request(`https://alpha.test${path}`, { headers }), e);

    it('serves the owner copy to the key alone, uncached, with the key kept out of the file', async () => {
        const own = (await get('/.well-known/otta.json?key=a-long-random-secret'))!;
        expect(own.status).toBe(200);
        expect(own.headers.get('cache-control')).toBe('private, no-store');
        const doc = await own.json();
        expect(doc.scope).toBe('owner');
        expect(doc.from).toBe('https://alpha.test/.well-known/otta.json');
        expect(doc.product.neverClaim).toEqual(['Enterprise ready']);
        // A wrong key, a short key and a key when none is set all get the public file, never an error.
        for (const path of ['?key=a-long-random-secreT', '?key=a', '?key=']) {
            const pub = (await get(`/.well-known/otta.json${path}`))!;
            expect(pub.status).toBe(200);
            expect((await pub.json()).scope).toBe('public');
        }
        const unset = (await get('/.well-known/otta.json?key=a-long-random-secret', {}, { ...env, key: null }))!;
        expect((await unset.json()).scope).toBe('public');
        expect(isOwnerKey('abc', 'abc')).toBe(true);
        expect(isOwnerKey('abd', 'abc')).toBe(false);
        expect(isOwnerKey('', '')).toBe(false);
    });

    it('takes a list of keys, and keeps a private file off the open web as a 404', async () => {
        const quiet = { facts: FACTS as typeof FACTS | null, keys: ['for-ottabuzz', 'for-imageine'] as string[] };
        const r = new Router<typeof quiet>();
        mountPackages(r, {
            packages: createPackageRegistry<typeof quiet>({
                packages: [
                    createDiscoverPackage<typeof quiet>({
                        facts: (e) => e.facts,
                        owner: (e) => e.keys,
                        visibility: 'private',
                    }),
                ],
            }),
        });
        const ask = (path: string, e = quiet) => r.handle(new Request(`https://alpha.test${path}`), e);
        expect((await ask('/.well-known/otta.json'))!.status).toBe(404);
        expect((await ask('/.well-known/otta.json?key=wrong'))!.status).toBe(404);
        for (const key of quiet.keys) {
            const res = (await ask(`/.well-known/otta.json?key=${key}`))!;
            expect(res.status).toBe(200);
            expect((await res.json()).scope).toBe('owner');
        }
        // One consumer's key revoked, the other still reads.
        const revoked = { ...quiet, keys: ['for-imageine'] };
        expect((await ask('/.well-known/otta.json?key=for-ottabuzz', revoked))!.status).toBe(404);
        expect((await ask('/.well-known/otta.json?key=for-imageine', revoked))!.status).toBe(200);
        // robots.txt is still served: private is about the file, not the site.
        expect((await ask('/robots.txt'))!.status).toBe(200);
        // The Next.js handler, the same way.
        const handler = ottaJsonHandler(
            async () => FACTS,
            () => ['k1', 'k2'],
            'private',
        );
        expect((await handler(new Request('https://alpha.test/.well-known/otta.json'))).status).toBe(404);
        expect((await handler(new Request('https://alpha.test/.well-known/otta.json?key=k2'))).status).toBe(200);
        expect(isOwnerKey('k2', ['k1', 'k2'])).toBe(true);
        expect(isOwnerKey('k3', ['k1', 'k2'])).toBe(false);
        expect(isOwnerKey('k1', [])).toBe(false);
    });

    it('answers 304 to the ETag it gave, and 200 again once a fact changed', async () => {
        const first = (await get('/.well-known/otta.json'))!;
        const etag = first.headers.get('etag')!;
        expect(etag).toMatch(/^"[0-9a-f]{14}"$/);
        expect((await first.json()).hash).toBe(etag.slice(1, -1));
        const same = (await get('/.well-known/otta.json', { 'if-none-match': etag }))!;
        expect(same.status).toBe(304);
        expect(same.headers.get('etag')).toBe(etag);
        const changed = (await get(
            '/.well-known/otta.json',
            { 'if-none-match': etag },
            {
                ...env,
                facts: defineProduct({ ...FACTS, tagline: 'Changed.' }),
            },
        ))!;
        expect(changed.status).toBe(200);
        expect(changed.headers.get('etag')).not.toBe(etag);
        // The owner copy has its own tag, so a public 304 never hides the owner lines.
        const own = (await get('/.well-known/otta.json?key=a-long-random-secret', { 'if-none-match': etag }))!;
        expect(own.status).toBe(200);
    });
});

describe('brandFromTheme', () => {
    it('reads the brand block off a Brand Engine theme, light side, and invents nothing', () => {
        expect(cssColorToHex('221.2 83.2% 53.3%')).toBe('#2563eb');
        expect(cssColorToHex('0 0% 100%')).toBe('#ffffff');
        expect(cssColorToHex('hsl(39, 92%, 50%)')).toBe('#f5a30a');
        expect(cssColorToHex('#F5A90A')).toBe('#f5a90a');
        expect(cssColorToHex('var(--x)')).toBe('');
        expect(cssColorToHex(undefined)).toBe('');
        expect(fontFamilyName('"Young Serif", Georgia, serif')).toBe('Young Serif');
        expect(fontFamilyName('system-ui, sans-serif')).toBe('');
        const theme = {
            tokens: {
                color: {
                    light: { primary: '221.2 83.2% 53.3%', background: '0 0% 100%' },
                    dark: { primary: '0 0% 0%' },
                },
                typography: { heading: { fontFamily: 'Inter' }, body: { fontFamily: 'ui-sans-serif' } },
            },
        };
        expect(brandFromTheme(theme, { logo: 'https://alpha.test/logo.png' })).toEqual({
            logo: 'https://alpha.test/logo.png',
            primary: '#2563eb',
            background: '#ffffff',
            fontHeading: 'Inter',
        });
        expect(brandFromTheme({ tokens: { color: { primary: '0 0% 50%' } } })).toEqual({ primary: '#808080' });
        expect(brandFromTheme({ tokens: {} })).toEqual({});
        // The facts take it as any other brand block.
        const facts = defineProduct({ name: 'A', url: 'https://a.test', brand: brandFromTheme(theme) });
        expect(ottaJson(facts, { from: 'x' }).product.brand.primary).toBe('#2563eb');
    });
});

describe('JSON-LD, version 2', () => {
    it('carries the founder as a person with their profiles, the platforms and the license', () => {
        const rich = defineProduct({
            ...FACTS,
            founder: {
                name: 'Dj',
                title: 'Solo founder',
                photo: 'https://alpha.test/dj.jpg',
                place: 'www',
                socials: { x: 'https://x.com/thinkdj' },
            },
            facts: {
                founded: '2026',
                location: 'www',
                category: 'Developer tools',
                platforms: ['Web', 'CLI'],
                license: 'MIT',
            },
            screenshots: [{ url: 'https://alpha.test/1.png', caption: 'The radar' }],
            brand: { logo: 'https://alpha.test/brand-mark.png' },
        });
        const graph = jsonLd(rich)['@graph'];
        expect(graph[0]).toMatchObject({
            '@type': 'Organization',
            logo: 'https://alpha.test/brand-mark.png',
            foundingDate: '2026',
            location: 'www',
            founder: {
                '@type': 'Person',
                name: 'Dj',
                jobTitle: 'Solo founder',
                image: 'https://alpha.test/dj.jpg',
                address: 'www',
                sameAs: ['https://x.com/thinkdj'],
            },
        });
        expect(graph[2]).toMatchObject({
            applicationSubCategory: 'Developer tools',
            operatingSystem: 'Web, CLI',
            license: 'MIT',
            screenshot: ['https://alpha.test/1.png'],
        });
    });
});
