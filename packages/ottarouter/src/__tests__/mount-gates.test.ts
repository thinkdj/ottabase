import { describe, expect, it, vi } from 'vitest';
import { RouteConflictError, Router, withHeaders } from '../index';

const req = (path: string, method = 'GET'): Request => new Request(`http://localhost${path}`, { method });
const ok = () => new Response('ok');
const text = (res: Response | null): Promise<string> => {
    if (res === null) {
        throw new Error('expected a Response, got null');
    }
    return res.text();
};

describe('mount — prefixing', () => {
    it('prefixes all sub routes: sub.get("/posts") serves "/api/blog/posts" and nothing else', async () => {
        const sub = new Router();
        sub.get('/posts', () => new Response('posts'));
        const root = new Router();
        root.mount('/api/blog', sub);

        expect(await text(await root.handle(req('/api/blog/posts'), {}))).toBe('posts');
        expect(await root.handle(req('/posts'), {})).toBeNull();
        expect(await root.handle(req('/api/blog'), {})).toBeNull();
        expect(await root.handle(req('/api/blog/posts/extra'), {})).toBeNull();
    });

    it('captures and decodes :params through the mount prefix', async () => {
        const sub = new Router();
        sub.get('/posts/:id', (c) => new Response(`id:${c.params.id}`));
        const root = new Router();
        root.mount('/api/blog', sub);

        expect(await text(await root.handle(req('/api/blog/posts/caf%C3%A9'), {}))).toBe('id:café');
    });

    it('mounts a sub "/" pattern to exactly the prefix (one trailing slash forgiven)', async () => {
        const sub = new Router();
        sub.get('/', () => new Response('blog index'));
        const root = new Router();
        root.mount('/api/blog', sub);

        expect(await text(await root.handle(req('/api/blog'), {}))).toBe('blog index');
        expect(await text(await root.handle(req('/api/blog/'), {}))).toBe('blog index');
        expect(await root.handle(req('/api/blog/x'), {})).toBeNull();
    });

    it('mount("/", sub) mounts routes unprefixed, so one gate spans unrelated prefixes', async () => {
        const sub = new Router();
        sub.get('/api/shortlinks/:id', (c) => new Response(`sl:${c.params.id}`));
        sub.get('/shortlinks/go', () => new Response('go'));
        let on = true;
        const root = new Router();
        root.mount('/', sub, { when: () => on });

        expect(await text(await root.handle(req('/api/shortlinks/7'), {}))).toBe('sl:7');
        expect(await text(await root.handle(req('/shortlinks/go'), {}))).toBe('go');
        on = false;
        expect(await root.handle(req('/api/shortlinks/7'), {})).toBeNull();
        expect(await root.handle(req('/shortlinks/go'), {})).toBeNull();
    });

    it('routes() reports mounted routes under their prefixed patterns', () => {
        const sub = new Router();
        sub.get('/posts', ok);
        sub.get('/', ok);
        const root = new Router();
        root.mount('/api/blog', sub);

        const table = root.routes();
        expect(table).toContainEqual({ method: 'GET', pattern: '/api/blog/posts' });
        expect(table).toContainEqual({ method: 'GET', pattern: '/api/blog' });
    });
});

describe('mount — global precedence and cross-tree conflicts', () => {
    it('parent static beats a sub-mounted :param at the same position (one global table)', async () => {
        const sub = new Router();
        sub.get('/:slug', (c) => new Response(`slug:${c.params.slug}`));
        const root = new Router();
        root.get('/api/blog/special', () => new Response('parent-special'));
        root.mount('/api/blog', sub);

        expect(await text(await root.handle(req('/api/blog/special'), {}))).toBe('parent-special');
        expect(await text(await root.handle(req('/api/blog/other'), {}))).toBe('slug:other');
    });

    it('throws RouteConflictError at mount time when a sub route collides with a parent route', () => {
        const sub = new Router();
        sub.get('/posts', ok);
        const root = new Router();
        root.get('/api/blog/posts', ok);

        expect(() => root.mount('/api/blog', sub)).toThrow(RouteConflictError);
    });

    it('cross-tree conflict is by shape, not param name', () => {
        const sub = new Router();
        sub.get('/:slug', ok);
        const root = new Router();
        root.get('/api/blog/:id', ok);

        expect(() => root.mount('/api/blog', sub)).toThrow(RouteConflictError);
    });

    it('rejects a :param segment in the mount prefix', () => {
        expect(() => new Router().mount('/api/:v', new Router())).toThrow('only static segments are allowed');
    });

    it('rejects a "*" segment in the mount prefix', () => {
        expect(() => new Router().mount('/api/*', new Router())).toThrow('only static segments are allowed');
    });
});

describe('gates — evaluated per request', () => {
    it('re-evaluates the gate on every request: invisible -> null, then visible -> Response', async () => {
        let visible = false;
        const gate = vi.fn(() => visible);
        const sub = new Router();
        sub.get('/posts', () => new Response('posts'));
        const root = new Router();
        root.mount('/api/blog', sub, { when: gate });

        expect(await root.handle(req('/api/blog/posts'), {})).toBeNull();
        expect(gate).toHaveBeenCalledTimes(1);
        visible = true;
        expect(await text(await root.handle(req('/api/blog/posts'), {}))).toBe('posts');
        expect(gate).toHaveBeenCalledTimes(2);
    });

    it('continues matching past a gated-off subtree to a later, less specific route', async () => {
        let on = false;
        const sub = new Router();
        sub.get('/posts', () => new Response('sub-static'));
        const root = new Router();
        root.get('/api/blog/*', () => new Response('parent-wild'));
        root.mount('/api/blog', sub, { when: () => on });

        // Gate off: the more specific mounted static is invisible; the wildcard serves.
        expect(await text(await root.handle(req('/api/blog/posts'), {}))).toBe('parent-wild');
        // Gate on: global precedence resumes — mounted static beats the parent wildcard.
        on = true;
        expect(await text(await root.handle(req('/api/blog/posts'), {}))).toBe('sub-static');
    });

    it('runs each distinct gate function at most once per request across middleware and many routes', async () => {
        const gate = vi.fn(() => true);
        const mwSpy = vi.fn();
        const sub = new Router();
        sub.use((c, next) => {
            mwSpy();
            return next();
        });
        sub.get('/x/y', () => null); // matches, declines — the next gated route is consulted
        sub.get('/x/:p', (c) => new Response(`p:${c.params.p}`));
        const root = new Router();
        root.mount('/m', sub, { when: gate });

        expect(await text(await root.handle(req('/m/x/y'), {}))).toBe('p:y');
        expect(gate).toHaveBeenCalledTimes(1);
        expect(mwSpy).toHaveBeenCalledTimes(1);
    });

    it('memoizes a false gate within a request but starts fresh on the next request', async () => {
        const gate = vi.fn(() => false);
        const mwSpy = vi.fn();
        const sub = new Router();
        sub.use((c, next) => {
            mwSpy();
            return next();
        });
        sub.get('/x/y', ok);
        sub.get('/x/:p', ok);
        const root = new Router();
        root.mount('/m', sub, { when: gate });

        expect(await root.handle(req('/m/x/y'), {})).toBeNull();
        expect(gate).toHaveBeenCalledTimes(1); // guards middleware + two matching routes: one evaluation
        expect(mwSpy).not.toHaveBeenCalled();
        expect(await root.handle(req('/m/x/y'), {})).toBeNull();
        expect(gate).toHaveBeenCalledTimes(2); // per-request memo, not cross-request
    });
});

describe('nested mounts and gate composition', () => {
    const build = (flags: { outer: boolean; inner: boolean }) => {
        const leaf = new Router();
        leaf.get('/deep', () => new Response('leaf'));
        const mid = new Router();
        mid.get('/here', () => new Response('mid'));
        mid.mount('/child', leaf, { when: () => flags.inner });
        const root = new Router();
        root.mount('/top', mid, { when: () => flags.outer });
        return root;
    };

    it('grandparent gate false hides the entire subtree, including nested mounts', async () => {
        const flags = { outer: false, inner: true };
        const root = build(flags);

        expect(await root.handle(req('/top/here'), {})).toBeNull();
        expect(await root.handle(req('/top/child/deep'), {})).toBeNull();
    });

    it('gates AND across nesting: inner gate false hides only the inner subtree', async () => {
        const flags = { outer: true, inner: false };
        const root = build(flags);

        expect(await text(await root.handle(req('/top/here'), {}))).toBe('mid');
        expect(await root.handle(req('/top/child/deep'), {})).toBeNull();
        flags.inner = true;
        expect(await text(await root.handle(req('/top/child/deep'), {}))).toBe('leaf');
    });
});

describe('mounted sub-router middleware', () => {
    it('splices sub middleware with the prefix prepended to its scope', async () => {
        const seen: string[] = [];
        const sub = new Router();
        sub.use((c, next) => {
            seen.push(`global:${c.path}`);
            return next();
        });
        sub.use('/admin', (c, next) => {
            seen.push(`admin:${c.path}`);
            return next();
        });
        sub.get('/admin/x', ok);
        sub.get('/y', ok);
        const root = new Router();
        root.mount('/api', sub);

        await root.handle(req('/api/admin/x'), {});
        expect(seen).toEqual(['global:/api/admin/x', 'admin:/api/admin/x']);

        seen.length = 0;
        await root.handle(req('/api/y'), {});
        expect(seen).toEqual(['global:/api/y']);

        seen.length = 0;
        await root.handle(req('/other'), {});
        expect(seen).toEqual([]); // outside the mount prefix, sub middleware never runs
    });

    it('splices sub middleware at the position of the mount call, in registration order', async () => {
        const order: string[] = [];
        const record =
            (name: string) =>
            async (c: { path: string }, next: () => Promise<Response | null>): Promise<Response | null> => {
                order.push(name);
                return next();
            };
        const sub = new Router();
        sub.use(record('B'));
        sub.get('/hit', () => new Response('done'));
        const root = new Router();
        root.use(record('A'));
        root.mount('/s', sub);
        root.use(record('C'));

        expect(await text(await root.handle(req('/s/hit'), {}))).toBe('done');
        expect(order).toEqual(['A', 'B', 'C']);
    });

    it('sub middleware inherits the mount gate: gate off means it does not run at all', async () => {
        const parentSpy = vi.fn();
        const subSpy = vi.fn();
        const sub = new Router();
        sub.use((c, next) => {
            subSpy();
            return next();
        });
        sub.get('/p', ok);
        const root = new Router();
        root.use((c, next) => {
            parentSpy();
            return next();
        });
        root.mount('/g', sub, { when: () => false });

        expect(await root.handle(req('/g/p'), {})).toBeNull();
        expect(parentSpy).toHaveBeenCalledTimes(1);
        expect(subSpy).not.toHaveBeenCalled();
    });
});

describe('mount rigidity', () => {
    it('freezes the sub-router: registering on it after mount throws', () => {
        const sub = new Router();
        sub.get('/a', ok);
        const root = new Router();
        root.mount('/api', sub);

        expect(() => sub.get('/late', ok)).toThrow(/frozen/);
    });

    it('throws when mounting a sub-router that has onError set', () => {
        const sub = new Router();
        sub.onError(() => new Response('e', { status: 500 }));

        expect(() => new Router().mount('/api', sub)).toThrow('onError/notFound belong to the root router only');
    });

    it('throws when mounting a sub-router that has notFound set', () => {
        const sub = new Router();
        sub.notFound(() => new Response('nf', { status: 404 }));

        expect(() => new Router().mount('/api', sub)).toThrow('onError/notFound belong to the root router only');
    });

    it('throws when mounting a router into itself', () => {
        const root = new Router();

        expect(() => root.mount('/self', root)).toThrow('Cannot mount a router into itself');
    });
});

describe('gate errors follow the error path', () => {
    it('a gate throw during dispatch propagates to the caller when no onError is set', async () => {
        const sub = new Router();
        sub.get('/x', ok);
        const root = new Router();
        root.mount('/api', sub, {
            when: () => {
                throw new Error('gate exploded');
            },
        });

        await expect(root.handle(req('/api/x'), {})).rejects.toThrow('gate exploded');
    });

    it('with onError on the root, a gate throw yields its Response, unwinding through the onion', async () => {
        const sub = new Router();
        sub.get('/x', ok);
        const root = new Router();
        root.use(async (c, next) => {
            const res = await next();
            return res ? withHeaders(res, { 'x-finalized': 'yes' }) : null;
        });
        root.onError((err) => new Response(`caught:${(err as Error).message}`, { status: 500 }));
        root.mount('/api', sub, {
            when: () => {
                throw new Error('gate exploded');
            },
        });

        const res = await root.handle(req('/api/x'), {});
        expect(res?.status).toBe(500);
        expect(await text(res)).toBe('caught:gate exploded');
        expect(res?.headers.get('x-finalized')).toBe('yes'); // handler-path error Response flows through finalizers
    });
});
