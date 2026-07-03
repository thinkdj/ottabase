import { describe, expect, it } from 'vitest';
import { Router } from '../index';

const req = (path: string, method = 'GET'): Request => new Request(`http://localhost${path}`, { method });
const ok = () => new Response('ok');
const text = (res: Response | null): Promise<string> => {
    if (res === null) {
        throw new Error('expected a Response, got null');
    }
    return res.text();
};

describe('pattern grammar — registration validation', () => {
    it('throws when the pattern does not start with "/"', () => {
        expect(() => new Router().get('users', ok)).toThrow('must start with "/"');
    });

    it('throws when the pattern contains "?"', () => {
        expect(() => new Router().get('/x?y=1', ok)).toThrow('query strings and fragments do not participate');
    });

    it('throws when the pattern contains "#"', () => {
        expect(() => new Router().get('/x#frag', ok)).toThrow('query strings and fragments do not participate');
    });

    it('throws on an empty segment ("/a//b")', () => {
        expect(() => new Router().get('/a//b', ok)).toThrow('empty segment');
    });

    it('throws when "*" is not the final segment ("/a/*/b")', () => {
        expect(() => new Router().get('/a/*/b', ok)).toThrow('"*" is only allowed as the final segment');
    });

    it('throws on a bare ":" with no parameter name', () => {
        expect(() => new Router().get('/a/:', ok)).toThrow('":" must be followed by a parameter name');
    });

    it('throws on duplicate parameter names in one pattern ("/a/:x/:x")', () => {
        expect(() => new Router().get('/a/:x/:x', ok)).toThrow('duplicate parameter name ":x"');
    });
});

describe('root pattern "/"', () => {
    it('matches exactly "/"', async () => {
        const router = new Router().get('/', () => new Response('root'));
        const res = await router.handle(req('/'), {});
        expect(await text(res)).toBe('root');
    });

    it('does not match any non-root path', async () => {
        const router = new Router().get('/', ok);
        expect(await router.handle(req('/x'), {})).toBeNull();
    });

    it('matches "//" because exactly one trailing slash is forgiven everywhere', async () => {
        const router = new Router().get('/', () => new Response('root'));
        const res = await router.handle(req('//'), {});
        expect(await text(res)).toBe('root');
    });
});

describe('static segments', () => {
    it('treats dots as literal characters ("/api/blog/sitemap.xml")', async () => {
        const router = new Router().get('/api/blog/sitemap.xml', () => new Response('xml'));
        const res = await router.handle(req('/api/blog/sitemap.xml'), {});
        expect(await text(res)).toBe('xml');
    });

    it('does not treat "." as a wildcard character', async () => {
        const router = new Router().get('/api/blog/sitemap.xml', ok);
        expect(await router.handle(req('/api/blog/sitemapXxml'), {})).toBeNull();
    });
});

describe(':param semantics', () => {
    it('captures exactly one segment', async () => {
        const router = new Router().get('/u/:id', (c) => new Response(c.params.id));
        const res = await router.handle(req('/u/42'), {});
        expect(await text(res)).toBe('42');
    });

    it('does not match when the segment is missing', async () => {
        const router = new Router().get('/u/:id', ok);
        expect(await router.handle(req('/u'), {})).toBeNull();
    });

    it('does not span multiple segments', async () => {
        const router = new Router().get('/u/:id', ok);
        expect(await router.handle(req('/u/a/b'), {})).toBeNull();
    });

    it('does not match an empty segment ("/a//b" path)', async () => {
        const router = new Router().get('/a/:x/b', ok);
        expect(await router.handle(req('/a//b'), {})).toBeNull();
    });

    it('decodeURIComponent-decodes captured values ("/u/%40x" -> "@x")', async () => {
        const router = new Router().get('/u/:id', (c) => new Response(c.params.id));
        const res = await router.handle(req('/u/%40x'), {});
        expect(await text(res)).toBe('@x');
    });
});

describe('matching happens on raw (un-decoded) segments', () => {
    it('an encoded %2F cannot forge a segment boundary', async () => {
        const router = new Router()
            .get('/files/:name', (c) => new Response(`one:${c.params.name}`))
            .get('/files/:a/:b', (c) => new Response(`two:${c.params.a}/${c.params.b}`));
        const res = await router.handle(req('/files/a%2Fb'), {});
        // Still ONE segment: it matches /files/:name, and only then decodes to contain a slash.
        expect(await text(res)).toBe('one:a/b');
    });
});

describe('"*" wildcard', () => {
    it('requires at least one remaining segment ("/api/auth/*" does not match "/api/auth")', async () => {
        const router = new Router().all('/api/auth/*', ok);
        expect(await router.handle(req('/api/auth'), {})).toBeNull();
        expect(await router.handle(req('/api/auth/'), {})).toBeNull();
    });

    it('captures a single remaining segment under params["*"]', async () => {
        const router = new Router().all('/api/auth/*', (c) => new Response(c.params['*']));
        const res = await router.handle(req('/api/auth/csrf'), {});
        expect(await text(res)).toBe('csrf');
    });

    it('captures the rest of the path with slashes preserved', async () => {
        const router = new Router().all('/api/auth/*', (c) => new Response(c.params['*']));
        const res = await router.handle(req('/api/auth/a/b/c'), {});
        expect(await text(res)).toBe('a/b/c');
    });

    it('is captured raw — percent-encodings (including %2F) are NOT decoded', async () => {
        const router = new Router().all('/api/auth/*', (c) => new Response(c.params['*']));
        const res = await router.handle(req('/api/auth/x%2Fy/%40z'), {});
        expect(await text(res)).toBe('x%2Fy/%40z');
    });

    it('never throws URIError for malformed encodings because it is never decoded', async () => {
        const router = new Router().all('/api/auth/*', (c) => new Response(c.params['*']));
        const res = await router.handle(req('/api/auth/%zz'), {});
        expect(await text(res)).toBe('%zz');
    });
});

describe('trailing-slash normalization', () => {
    it('forgives exactly one trailing slash ("/a/" matches "/a")', async () => {
        const router = new Router().get('/a', () => new Response('a'));
        const res = await router.handle(req('/a/'), {});
        expect(await text(res)).toBe('a');
    });

    it('does not forgive two trailing slashes ("/a//" does not match "/a")', async () => {
        const router = new Router().get('/a', ok);
        expect(await router.handle(req('/a//'), {})).toBeNull();
    });

    it('applies to param routes too ("/u/42/" matches "/u/:id")', async () => {
        const router = new Router().get('/u/:id', (c) => new Response(c.params.id));
        const res = await router.handle(req('/u/42/'), {});
        expect(await text(res)).toBe('42');
    });

    it('exposes c.path normalized and c.url.pathname original inside a handler', async () => {
        let seen: { path: string; pathname: string } | null = null;
        const router = new Router().get('/a', (c) => {
            seen = { path: c.path, pathname: c.url.pathname };
            return ok();
        });
        await router.handle(req('/a/'), {});
        expect(seen).toEqual({ path: '/a', pathname: '/a/' });
    });
});

describe('query strings never participate in matching', () => {
    it('"/a?x=1" matches the "/a" route and searchParams are readable via c.url', async () => {
        const router = new Router().get('/a', (c) => {
            expect(c.path).toBe('/a');
            return new Response(c.url.searchParams.get('x') ?? 'missing');
        });
        const res = await router.handle(req('/a?x=1'), {});
        expect(await text(res)).toBe('1');
    });
});

describe('method handling', () => {
    it('matches a Request constructed with lowercase "get" (normalized to GET per fetch spec)', async () => {
        const router = new Router().get('/m', (c) => new Response(c.method));
        const res = await router.handle(req('/m', 'get'), {});
        expect(await text(res)).toBe('GET');
    });

    it('uppercases non-standard methods on both registration and request sides', async () => {
        // The fetch spec only normalizes the six standard methods, so 'purge' survives on the
        // Request — the router itself must uppercase both sides for them to meet.
        const router = new Router().on('purge', '/cache', (c) => new Response(c.method));
        const res = await router.handle(req('/cache', 'purge'), {});
        expect(await text(res)).toBe('PURGE');
    });
});

describe('malformed percent-encoding in a :param', () => {
    it('throws URIError out of handle() when no onError is set', async () => {
        const router = new Router().get('/u/:id', ok);
        await expect(router.handle(req('/u/%zz'), {})).rejects.toThrow(URIError);
    });
});
