import { describe, expect, it } from 'vitest';
import { RouteConflictError, Router } from '../index';

const req = (method: string, path: string): Request => new Request(`http://localhost${path}`, { method });

const tag = (name: string) => (): Response => new Response(name);

const text = async (res: Response | null): Promise<string | null> => (res ? await res.text() : null);

describe('precedence: static > :param at the same position (order-free)', () => {
    it('static wins when the :param route is registered first', async () => {
        const router = new Router();
        router.get('/u/:id', tag('param'));
        router.get('/u/search', tag('static'));
        expect(await text(await router.handle(req('GET', '/u/search'), {}))).toBe('static');
    });

    it('static wins when the static route is registered first (identical outcome)', async () => {
        const router = new Router();
        router.get('/u/search', tag('static'));
        router.get('/u/:id', tag('param'));
        expect(await text(await router.handle(req('GET', '/u/search'), {}))).toBe('static');
    });

    it('the :param route still matches non-static values in both registration orders', async () => {
        const first = new Router();
        first.get('/u/:id', (c) => new Response(`param:${c.params.id}`));
        first.get('/u/search', tag('static'));
        const second = new Router();
        second.get('/u/search', tag('static'));
        second.get('/u/:id', (c) => new Response(`param:${c.params.id}`));
        expect(await text(await first.handle(req('GET', '/u/42'), {}))).toBe('param:42');
        expect(await text(await second.handle(req('GET', '/u/42'), {}))).toBe('param:42');
    });
});

describe('precedence: :param > *', () => {
    it(':param beats * for a single-segment tail regardless of registration order', async () => {
        const first = new Router();
        first.get('/files/*', tag('wild'));
        first.get('/files/:name', tag('param'));
        const second = new Router();
        second.get('/files/:name', tag('param'));
        second.get('/files/*', tag('wild'));
        expect(await text(await first.handle(req('GET', '/files/a'), {}))).toBe('param');
        expect(await text(await second.handle(req('GET', '/files/a'), {}))).toBe('param');
    });

    it('* still receives multi-segment tails that :param cannot match', async () => {
        const router = new Router();
        router.get('/files/*', tag('wild'));
        router.get('/files/:name', tag('param'));
        expect(await text(await router.handle(req('GET', '/files/a/b'), {}))).toBe('wild');
    });
});

describe('precedence: leftmost differing position decides', () => {
    it("'/a/static/:y' (static at position 1) beats '/a/:x/spec' for GET /a/static/spec, both orders", async () => {
        const first = new Router();
        first.get('/a/:x/spec', (c) => new Response(`pos1-param:${c.params.x}`));
        first.get('/a/static/:y', (c) => new Response(`pos1-static:${c.params.y}`));
        const second = new Router();
        second.get('/a/static/:y', (c) => new Response(`pos1-static:${c.params.y}`));
        second.get('/a/:x/spec', (c) => new Response(`pos1-param:${c.params.x}`));
        expect(await text(await first.handle(req('GET', '/a/static/spec'), {}))).toBe('pos1-static:spec');
        expect(await text(await second.handle(req('GET', '/a/static/spec'), {}))).toBe('pos1-static:spec');
    });

    it('the losing pattern remains reachable for paths only it matches', async () => {
        const router = new Router();
        router.get('/a/:x/spec', (c) => new Response(`pos1-param:${c.params.x}`));
        router.get('/a/static/:y', (c) => new Response(`pos1-static:${c.params.y}`));
        expect(await text(await router.handle(req('GET', '/a/other/spec'), {}))).toBe('pos1-param:other');
        expect(await text(await router.handle(req('GET', '/a/static/thing'), {}))).toBe('pos1-static:thing');
    });
});

describe('precedence: exact method > ALL on the same shape', () => {
    it('a GET request hits the GET handler, a POST request hits the ALL handler', async () => {
        const router = new Router();
        router.get('/thing', tag('get'));
        router.all('/thing', tag('all'));
        expect(await text(await router.handle(req('GET', '/thing'), {}))).toBe('get');
        expect(await text(await router.handle(req('POST', '/thing'), {}))).toBe('all');
    });

    it('registering ALL before GET yields identical outcomes', async () => {
        const router = new Router();
        router.all('/thing', tag('all'));
        router.get('/thing', tag('get'));
        expect(await text(await router.handle(req('GET', '/thing'), {}))).toBe('get');
        expect(await text(await router.handle(req('DELETE', '/thing'), {}))).toBe('all');
    });
});

describe('method matching', () => {
    it('method mismatch is a skip, not a 405: GET-only route + POST request resolves null', async () => {
        const router = new Router();
        router.get('/only-get', tag('get'));
        expect(await router.handle(req('POST', '/only-get'), {})).toBeNull();
    });

    it('a method-mismatched exact route is skipped so a broader ALL catch-all can claim the request', async () => {
        const router = new Router();
        router.get('/api/auth/config', tag('exact-get'));
        router.all('/api/auth/*', tag('auth-all'));
        expect(await text(await router.handle(req('GET', '/api/auth/config'), {}))).toBe('exact-get');
        expect(await text(await router.handle(req('POST', '/api/auth/config'), {}))).toBe('auth-all');
    });

    it('ALL matches any method, including PROPFIND', async () => {
        const router = new Router();
        router.all('/dav', tag('dav'));
        expect(await text(await router.handle(new Request('http://localhost/dav', { method: 'PROPFIND' }), {}))).toBe(
            'dav',
        );
        expect(await text(await router.handle(req('PUT', '/dav'), {}))).toBe('dav');
    });
});

describe('RouteConflictError at registration', () => {
    it('same shape + same method throws — param names do not distinguish shapes', () => {
        const router = new Router();
        router.get('/u/:id', tag('a'));
        let caught: unknown;
        try {
            router.get('/u/:slug', tag('b'));
        } catch (err) {
            caught = err;
        }
        expect(caught).toBeInstanceOf(RouteConflictError);
        const conflict = caught as RouteConflictError;
        expect(conflict.name).toBe('RouteConflictError');
        expect(conflict.a).toBe('GET /u/:id');
        expect(conflict.b).toBe('GET /u/:slug');
    });

    it('same shape with both registered as ALL throws', () => {
        const router = new Router();
        router.all('/x/:a', tag('a'));
        expect(() => router.all('/x/:b', tag('b'))).toThrow(RouteConflictError);
    });

    it('GET + ALL on the same shape does NOT throw', () => {
        const router = new Router();
        router.get('/kv/:key', tag('get'));
        expect(() => router.all('/kv/:key', tag('all'))).not.toThrow();
    });

    it('same shape with disjoint exact methods does NOT throw', () => {
        const router = new Router();
        router.get('/item/:id', tag('get'));
        expect(() => router.post('/item/:id', tag('post'))).not.toThrow();
    });

    it('disjoint static patterns do NOT throw', () => {
        const router = new Router();
        router.get('/alpha', tag('a'));
        expect(() => router.get('/beta', tag('b'))).not.toThrow();
        expect(() => router.get('/alpha/beta', tag('c'))).not.toThrow();
    });

    it('wildcard shapes conflict too: two GET catch-alls under the same prefix throw', () => {
        const router = new Router();
        router.get('/assets/*', tag('a'));
        expect(() => router.get('/assets/*', tag('b'))).toThrow(RouteConflictError);
    });
});

describe('routes(): precedence-ordered table + freeze', () => {
    it('returns the full table in precedence order regardless of registration order', () => {
        const router = new Router();
        router.get('/files/*', tag('files-wild'));
        router.all('/u/:id', tag('u-all'));
        router.get('/u/:id', tag('u-get'));
        router.get('/u/search', tag('u-search'));
        router.get('/', tag('root'));
        expect(router.routes()).toEqual([
            { method: 'GET', pattern: '/' },
            { method: 'GET', pattern: '/u/search' },
            { method: 'GET', pattern: '/u/:id' },
            { method: 'ALL', pattern: '/u/:id' },
            { method: 'GET', pattern: '/files/*' },
        ]);
    });

    it('calling routes() freezes the router', () => {
        const router = new Router();
        router.get('/a', tag('a'));
        router.routes();
        expect(() => router.get('/b', tag('b'))).toThrow(/frozen/);
        expect(() => router.use(async (_c, next) => next())).toThrow(/frozen/);
        expect(() => router.onError(() => new Response('err', { status: 500 }))).toThrow(/frozen/);
    });
});

describe('freeze after first handle()', () => {
    it('get()/on()/all()/use()/mount()/onError()/notFound() all throw the frozen error', async () => {
        const router = new Router();
        router.get('/a', tag('a'));
        await router.handle(req('GET', '/a'), {});
        expect(() => router.get('/b', tag('b'))).toThrow(/frozen/);
        expect(() => router.on('POST', '/b', tag('b'))).toThrow(/frozen/);
        expect(() => router.all('/b', tag('b'))).toThrow(/frozen/);
        expect(() => router.use(async (_c, next) => next())).toThrow(/frozen/);
        expect(() => router.mount('/sub', new Router())).toThrow(/frozen/);
        expect(() => router.onError(() => new Response('err', { status: 500 }))).toThrow(/frozen/);
        expect(() => router.notFound(() => new Response('nope', { status: 404 }))).toThrow(/frozen/);
    });

    it('a frozen router keeps serving requests', async () => {
        const router = new Router();
        router.get('/a', tag('a'));
        expect(await text(await router.handle(req('GET', '/a'), {}))).toBe('a');
        expect(await text(await router.handle(req('GET', '/a'), {}))).toBe('a');
        expect(await router.handle(req('GET', '/missing'), {})).toBeNull();
    });
});

describe('on() with multiple methods', () => {
    it("on(['GET','POST'], ...) registers both methods; others fall through", async () => {
        const router = new Router();
        router.on(['GET', 'POST'], '/multi', tag('multi'));
        expect(await text(await router.handle(req('GET', '/multi'), {}))).toBe('multi');
        expect(await text(await router.handle(req('POST', '/multi'), {}))).toBe('multi');
        expect(await router.handle(req('PUT', '/multi'), {})).toBeNull();
    });

    it('conflicts are tracked independently per method slot', () => {
        const router = new Router();
        router.on(['GET', 'POST'], '/multi', tag('multi'));
        expect(() => router.get('/multi', tag('dup'))).toThrow(RouteConflictError);
        expect(() => router.put('/multi', tag('ok'))).not.toThrow();
    });

    it('a duplicate method within a single on() call conflicts with itself', () => {
        const router = new Router();
        expect(() => router.on(['GET', 'GET'], '/dup', tag('dup'))).toThrow(RouteConflictError);
    });
});

describe('on() method string validation', () => {
    it('lowercase method strings are uppercased before registration', async () => {
        const router = new Router();
        router.on('get', '/lower', tag('lower'));
        expect(await text(await router.handle(req('GET', '/lower'), {}))).toBe('lower');
        expect(router.routes()).toEqual([{ method: 'GET', pattern: '/lower' }]);
    });

    it('method strings outside the HTTP token grammar throw', () => {
        // '@' and '/' are RFC 9110 delimiters, never legal in a method token.
        expect(() => new Router().on('B@D', '/x', tag('x'))).toThrow(/Invalid method/);
        expect(() => new Router().on('GET/POST', '/x', tag('x'))).toThrow(/Invalid method/);
        expect(() => new Router().on('', '/x', tag('x'))).toThrow(/Invalid method/);
    });

    it('accepts non-alpha HTTP token characters (RFC 9110 tchar), e.g. a WebDAV-style method', async () => {
        // '!', digits, and '-' are all legal token characters, just unusual.
        const router = new Router();
        router.on('M-SEARCH', '/x', tag('m-search'));
        expect(await text(await router.handle(req('M-SEARCH', '/x'), {}))).toBe('m-search');
    });

    it('on([]) with no methods throws instead of silently registering nothing', () => {
        const router = new Router();
        expect(() => router.on([], '/x', tag('x'))).toThrow(/at least one method/);
        expect(router.routes()).toEqual([]);
    });
});
