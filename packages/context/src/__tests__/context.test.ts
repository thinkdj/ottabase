// The schema end to end: facts clamped and never invented, the document written with the public lines out and the
// owner's lines in, the same facts hashing the same whoever wrote them, a version 1 file (Ottabuzz's, this
// package's old one) read into the version 2 shape, a founder manifest, a paste turned into an address, a fetch
// that knows a 304 and a change, and the inherit-or-pin merge.
import { describe, expect, it } from 'vitest';
import {
    contextHash,
    defineProduct,
    fetchOtta,
    founderJson,
    inherit,
    ottaJson,
    ottaJsonUrl,
    parseFounderJson,
    parseOttaJson,
    pricingLine,
} from '../index';

const FACTS = defineProduct({
    name: ' Alpha ',
    url: 'https://alpha.test',
    tagline: 'A SaaS starter for Cloudflare.',
    whatItIs: 'Auth and billing in the box, on one Worker.\n\nIt deploys in a minute.',
    whoItIsFor: 'founders who ship alone',
    problem: 'Every SaaS needs the same plumbing first.',
    features: ['Auth in the box', 'Billing in the box', 'One Worker', 42, ''],
    pricing: {
        plans: [
            { name: 'Hobby', price: 'free' },
            { name: 'Pro', price: 15.004, period: 'month', includes: ['8 projects'] },
            { name: 'Lifetime', price: 199, currency: 'EUR', period: 'once' },
            { name: 'Broken', price: -1 },
        ],
        note: 'No card to start.',
    },
    different: 'You clone it.',
    positioning: 'The starter for one person.',
    objections: ['Why not Supabase: it is a database, this is the app around one.'],
    neverClaim: ['Enterprise ready'],
    founder: {
        name: 'Dj',
        title: 'solo founder',
        url: 'https://think.dj',
        place: 'www',
        photo: 'https://alpha.test/dj.jpg',
        socials: {
            x: 'https://x.com/thinkdj',
            GitHub: 'https://github.com/thinkdj',
            bad: 'thinkdj',
            'no space': 'https://x.test',
        },
    },
    brand: {
        primary: '#F5A90A',
        secondary: '#abc',
        background: 'honey',
        fontHeading: 'Young Serif',
        logoDark: 'https://alpha.test/dark.svg',
    },
    facts: { founded: '2026', category: 'Developer tools', platforms: ['Web', 'CLI'], license: 'MIT' },
    feeds: { releases: 'https://alpha.test/releases.xml', blog: 'ftp://nope' },
    links: {
        repo: 'https://github.com/thinkdj/alpha',
        press: 'https://ottabuzz.com/b/alpha/press',
        nope: 'https://x.test',
    },
    copy: { short: 'Alpha is the starter.', taglines: ['Ship it.', 'Own it.'], quotes: [] },
    logo: 'https://alpha.test/logo.png',
    image: 'https://alpha.test/card.png',
    screenshots: [
        'https://alpha.test/1.png',
        { url: 'https://alpha.test/2.png', caption: 'The radar' },
        'relative.png',
    ],
    sameAs: ['https://github.com/thinkdj/alpha', 'javascript:alert(1)'],
    launched: '2026-03-01',
    keywords: ['saas starter'],
    hero: { line: 'Ship the SaaS', sub: 'Skip the plumbing', button: 'Start free' },
    contact: 'hi@alpha.test',
    stage: 'launched',
    brief: '## What it is\nA starter.',
    updatedAt: '2026-10-01T10:00:00Z',
});

describe('defineProduct', () => {
    it('clamps and normalises, drops what it cannot use, and invents nothing', () => {
        expect(FACTS.name).toBe('Alpha');
        expect(FACTS.url).toBe('https://alpha.test/');
        expect(FACTS.features).toEqual(['Auth in the box', 'Billing in the box', 'One Worker']);
        expect(FACTS.pricing?.plans.map((p) => [p.name, p.price, p.currency, p.period])).toEqual([
            ['Hobby', 'free', 'USD', 'month'],
            ['Pro', 15, 'USD', 'month'],
            ['Lifetime', 199, 'EUR', 'once'],
        ]);
        expect(pricingLine(FACTS.pricing)).toBe(
            'Hobby free; Pro $15 a month; Lifetime EUR 199 once. No card to start.',
        );
        expect(FACTS.founder).toEqual({
            name: 'Dj',
            title: 'solo founder',
            url: 'https://think.dj/',
            place: 'www',
            photo: 'https://alpha.test/dj.jpg',
            socials: { x: 'https://x.com/thinkdj', github: 'https://github.com/thinkdj' },
        });
        expect(FACTS.brand).toEqual({
            primary: '#f5a90a',
            secondary: '#aabbcc',
            fontHeading: 'Young Serif',
            logoDark: 'https://alpha.test/dark.svg',
        });
        expect(FACTS.facts).toEqual({
            founded: '2026',
            category: 'Developer tools',
            platforms: ['Web', 'CLI'],
            license: 'MIT',
        });
        expect(FACTS.feeds).toEqual({ releases: 'https://alpha.test/releases.xml' });
        expect(FACTS.links).toEqual({
            repo: 'https://github.com/thinkdj/alpha',
            press: 'https://ottabuzz.com/b/alpha/press',
        });
        expect(FACTS.copy).toEqual({ short: 'Alpha is the starter.', taglines: ['Ship it.', 'Own it.'] });
        expect(FACTS.screenshots).toEqual([
            { url: 'https://alpha.test/1.png' },
            { url: 'https://alpha.test/2.png', caption: 'The radar' },
        ]);
        expect(FACTS.sameAs).toEqual(['https://github.com/thinkdj/alpha']);
        expect(FACTS.updatedAt).toBe('2026-10-01T10:00:00.000Z');
        const bare = defineProduct({
            name: 'Beta',
            url: 'https://beta.test',
            brand: { primary: 'red' },
            founder: { title: 'no name' },
        });
        expect(bare).toEqual({ name: 'Beta', url: 'https://beta.test/', features: [] });
    });

    it('refuses a product without a name or an absolute address', () => {
        expect(() => defineProduct({ url: 'https://x.test' })).toThrow(/needs a name/);
        expect(() => defineProduct({ name: 'X', url: '/relative' })).toThrow(/absolute/);
    });
});

describe('ottaJson', () => {
    it('writes version 2 with version 1 intact, keeps the owner lines out of the public file, and hashes the facts', () => {
        const pub = ottaJson(FACTS, { from: 'https://alpha.test/.well-known/otta.json' });
        expect(pub).toMatchObject({
            version: 2,
            kind: 'otta-context',
            scope: 'public',
            at: '2026-10-01T10:00:00.000Z',
        });
        expect(pub.hash).toMatch(/^[0-9a-f]{14}$/);
        // Version 1 fields, as a version 1 reader expects them.
        expect(pub.product).toMatchObject({
            name: 'Alpha',
            tagline: 'A SaaS starter for Cloudflare.',
            pricing: 'Hobby free; Pro $15 a month; Lifetime EUR 199 once. No card to start.',
            neverClaim: [],
            brief: '',
            hero: { line: 'Ship the SaaS', sub: 'Skip the plumbing', button: 'Start free' },
            launchOn: '2026-03-01',
            logo: 'https://alpha.test/logo.png',
            card: 'https://alpha.test/card.png',
            press: 'https://ottabuzz.com/b/alpha/press',
            screenshots: ['https://alpha.test/1.png', 'https://alpha.test/2.png'],
            feed: null,
            log: null,
        });
        // Version 2 blocks, every key present.
        expect(pub.product.plans).toHaveLength(3);
        expect(pub.product.captions).toEqual({ 'https://alpha.test/2.png': 'The radar' });
        expect(pub.product.brand).toEqual({
            primary: '#f5a90a',
            secondary: '#aabbcc',
            background: '',
            foreground: '',
            fontHeading: 'Young Serif',
            fontBody: '',
            logo: 'https://alpha.test/logo.png',
            logoDark: 'https://alpha.test/dark.svg',
            wordmark: null,
            icon: null,
            naming: '',
            pronounce: '',
        });
        expect(pub.product.founder.socials).toEqual({
            x: 'https://x.com/thinkdj',
            github: 'https://github.com/thinkdj',
        });
        expect(pub.product.founder.bioShort).toBe('');
        expect(pub.product.sameAs).toEqual([
            'https://github.com/thinkdj/alpha',
            'https://x.com/thinkdj',
            'https://github.com/thinkdj',
        ]);
        expect(pub.product.facts.platforms).toEqual(['Web', 'CLI']);
        expect(pub.product.feeds).toEqual({
            blog: null,
            releases: 'https://alpha.test/releases.xml',
            changelog: null,
            log: null,
        });
        expect(pub.product.links.repo).toBe('https://github.com/thinkdj/alpha');
        expect(pub.product.links.docs).toBeNull();
        expect(pub.product.copy.taglines).toEqual(['Ship it.', 'Own it.']);
        expect(pub.product.copy.story).toBe('');
        expect(JSON.stringify(pub)).not.toContain('Enterprise ready');

        const own = ottaJson(FACTS, { from: 'https://alpha.test/.well-known/otta.json?key=x', scope: 'owner' });
        expect(own.scope).toBe('owner');
        expect(own.product.neverClaim).toEqual(['Enterprise ready']);
        expect(own.product.brief).toBe('## What it is\nA starter.');
        expect(own.hash).not.toBe(pub.hash);

        // The same facts, the same hash, whatever the time and the address.
        const again = ottaJson(FACTS, { from: 'https://elsewhere.test/x.json', at: new Date(0) });
        expect(again.hash).toBe(pub.hash);
        expect(contextHash({ ...pub.product, tagline: 'Changed' })).not.toBe(pub.hash);
        // And it reads back as itself.
        expect(parseOttaJson(JSON.parse(JSON.stringify(pub)))).toEqual(pub);
        expect(parseOttaJson(JSON.parse(JSON.stringify(own)))).toEqual(own);
    });

    it('reads a version 1 file into the version 2 shape, and refuses anything else', () => {
        const v1 = {
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
                bio: 'Dj builds Alpha.',
                contact: '',
                log: 'https://ottabuzz.com/b/alpha',
                feed: 'https://ottabuzz.com/b/alpha/feed',
                press: 'https://ottabuzz.com/b/alpha/press',
                card: 'https://ottabuzz.com/b/alpha/card',
                logo: null,
                screenshots: ['https://ottabuzz.com/b/alpha/i/shot-1', 'nope'],
            },
        };
        const read = parseOttaJson(v1)!;
        expect(read.version).toBe(1);
        expect(read.scope).toBe('public');
        expect(read.hash).toMatch(/^[0-9a-f]{14}$/);
        expect(read.product.objections).toEqual(['Why not Supabase: it is a database.']);
        expect(read.product.neverClaim).toEqual(['Cheaper than Supabase']);
        expect(read.product.screenshots).toEqual(['https://ottabuzz.com/b/alpha/i/shot-1']);
        expect(read.product.plans).toEqual([]);
        expect(read.product.brand.logo).toBeNull();
        // The version 1 bio is the founder's bio.
        expect(read.product.founder.bio).toBe('Dj builds Alpha.');
        expect(read.product.links.press).toBe('https://ottabuzz.com/b/alpha/press');
        expect(read.product.links.card).toBe('https://ottabuzz.com/b/alpha/card');
        expect(read.product.feeds.log).toBe('https://ottabuzz.com/b/alpha/feed');
        expect(read.product.copy.short).toBe('');
        expect(
            parseOttaJson({ ...v1, product: { ...v1.product, features: 'Auth', logo: 'x', brand: 'no' } })!.product,
        ).toMatchObject({
            features: [],
            logo: null,
        });
        expect(parseOttaJson({ kind: 'otta-context', product: {} })).toBeNull();
        expect(parseOttaJson({ product: v1.product })).toBeNull();
        expect(parseOttaJson('nope')).toBeNull();
        expect(parseOttaJson(null)).toBeNull();
    });
});

describe('the founder manifest', () => {
    it('names the person and every product with its own file, and reads back', () => {
        const file = founderJson(
            {
                founder: { name: 'Dj', url: 'https://think.dj', socials: { x: 'https://x.com/thinkdj' } },
                products: [
                    { name: 'Alpha', url: 'https://alpha.test', tagline: 'A starter.', stage: 'launched' },
                    {
                        name: 'Buzz',
                        url: 'https://ottabuzz.com',
                        context: 'https://ottabuzz.com/b/ottabuzz/context.json',
                    },
                    { name: 'No address', url: 'nope' },
                ],
            },
            { from: 'https://think.dj/.well-known/otta.json', at: new Date('2026-10-28T00:00:00Z') },
        );
        expect(file).toMatchObject({ version: 2, kind: 'otta-founder', at: '2026-10-28T00:00:00.000Z' });
        expect(file.founder.name).toBe('Dj');
        expect(file.products).toEqual([
            {
                name: 'Alpha',
                url: 'https://alpha.test/',
                tagline: 'A starter.',
                stage: 'launched',
                context: 'https://alpha.test/.well-known/otta.json',
            },
            {
                name: 'Buzz',
                url: 'https://ottabuzz.com/',
                tagline: '',
                stage: '',
                context: 'https://ottabuzz.com/b/ottabuzz/context.json',
            },
        ]);
        expect(parseFounderJson(JSON.parse(JSON.stringify(file)))).toEqual(file);
        expect(parseFounderJson({ kind: 'otta-context' })).toBeNull();
        expect(parseFounderJson({ kind: 'otta-founder', founder: {}, products: 'x' })!.products).toEqual([]);
    });
});

describe('ottaJsonUrl', () => {
    it('turns what a founder pastes into the address of a context file', () => {
        expect(ottaJsonUrl('alpha.test')).toBe('https://alpha.test/.well-known/otta.json');
        expect(ottaJsonUrl('https://alpha.test/pricing?x=1#top')).toBe('https://alpha.test/.well-known/otta.json');
        expect(ottaJsonUrl('ottabuzz.com/b/alpha/press')).toBe('https://ottabuzz.com/b/alpha/context.json');
        expect(ottaJsonUrl('http://localhost:8787/p/12/writing')).toBe('http://localhost:8787/p/12/context.json');
        expect(ottaJsonUrl('https://think.dj/otta.json')).toBe('https://think.dj/otta.json');
        // The owner key rides along; nothing else in the query does.
        expect(ottaJsonUrl('https://alpha.test/.well-known/otta.json?utm=x&key=s3cret#top')).toBe(
            'https://alpha.test/.well-known/otta.json?key=s3cret',
        );
        expect(ottaJsonUrl('alpha.test/?key=s3cret')).toBe('https://alpha.test/.well-known/otta.json?key=s3cret');
        expect(ottaJsonUrl('{"kind":"otta-context"}')).toBeNull();
        expect(ottaJsonUrl('not an address')).toBeNull();
        expect(ottaJsonUrl('')).toBeNull();
    });
});

describe('fetchOtta', () => {
    const file = ottaJson(FACTS, { from: 'https://alpha.test/.well-known/otta.json' });
    const stub =
        (body: unknown, init: ResponseInit & { on304?: boolean } = {}) =>
        async (_url: string | URL | Request, req?: RequestInit) => {
            const headers = new Headers(req?.headers);
            if (init.on304 && headers.get('if-none-match') === '"abc"')
                return new Response(null, { status: 304, headers: { etag: '"abc"' } });
            return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
                status: init.status ?? 200,
                headers: { etag: '"abc"', 'content-type': 'application/json', ...(init.headers ?? {}) },
            });
        };

    it('reads a file, keeps the ETag, and says whether it changed', async () => {
        const got = await fetchOtta('https://alpha.test/.well-known/otta.json', { fetch: stub(file) as typeof fetch });
        expect(got.status).toBe(200);
        expect(got.etag).toBe('"abc"');
        expect(got.context?.product.name).toBe('Alpha');
        expect(got.founder).toBeNull();
        expect(got.changed).toBe(true);
        const same = await fetchOtta('x', { fetch: stub(file) as typeof fetch, hash: file.hash });
        expect(same.changed).toBe(false);
        const cached = await fetchOtta('x', { fetch: stub(file, { on304: true }) as typeof fetch, etag: '"abc"' });
        expect(cached).toMatchObject({ status: 304, context: null, changed: false });
    });

    it('is never thrown by a bad network, a bad body or a huge body', async () => {
        expect(
            await fetchOtta('x', {
                fetch: (async () => {
                    throw new Error('down');
                }) as typeof fetch,
            }),
        ).toMatchObject({ status: 0, context: null });
        expect((await fetchOtta('x', { fetch: stub('<html>') as typeof fetch })).context).toBeNull();
        expect((await fetchOtta('x', { fetch: stub({ kind: 'nope' }, { status: 404 }) as typeof fetch })).status).toBe(
            404,
        );
        const big = await fetchOtta('x', { fetch: stub(file) as typeof fetch, maxBytes: 100 });
        expect(big.context).toBeNull();
        const manifest = founderJson({ founder: { name: 'Dj' }, products: [] }, { from: 'x' });
        expect((await fetchOtta('x', { fetch: stub(manifest) as typeof fetch })).founder?.founder.name).toBe('Dj');
    });
});

describe('inherit', () => {
    it('fills what is empty and keeps what is pinned', () => {
        const local = {
            founded: '',
            location: 'www',
            platforms: [] as string[],
            socials: {} as Record<string, string>,
            team: 'Two',
        };
        const up = {
            founded: '2026',
            location: 'Kochi',
            platforms: ['web'],
            socials: { x: 'https://x.com/a' },
            team: '',
        };
        expect(inherit(local, up)).toEqual({
            founded: '2026',
            location: 'www',
            platforms: ['web'],
            socials: { x: 'https://x.com/a' },
            team: 'Two',
        });
    });
});
