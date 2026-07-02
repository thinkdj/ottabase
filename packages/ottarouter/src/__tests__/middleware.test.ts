import { describe, expect, it, vi } from 'vitest';

import { Router } from '../index';
import type { Middleware } from '../index';

const req = (path: string, method = 'GET'): Request => new Request(`http://localhost${path}`, { method });

describe('middleware: global use(mw)', () => {
    it('runs for every request, including when no route matches, and null passes through', async () => {
        const router = new Router();
        const spy = vi.fn(async (_c, next) => await next());
        router.use(spy);

        const result = await router.handle(req('/nothing/here'), {});

        expect(spy).toHaveBeenCalledTimes(1);
        expect(result).toBeNull();
    });

    it('runs even when a route exists for the path but the method does not match', async () => {
        const router = new Router();
        const spy = vi.fn(async (_c, next) => await next());
        const handler = vi.fn(() => new Response('get'));
        router.use(spy);
        router.get('/x', handler);

        const result = await router.handle(req('/x', 'POST'), {});

        expect(spy).toHaveBeenCalledTimes(1);
        expect(handler).not.toHaveBeenCalled();
        expect(result).toBeNull();
    });

    it("use('/', mw) is global: runs for the root path and for deep paths", async () => {
        const router = new Router();
        const spy = vi.fn(async (_c, next) => await next());
        router.use('/', spy);

        await router.handle(req('/'), {});
        await router.handle(req('/a/b/c'), {});

        expect(spy).toHaveBeenCalledTimes(2);
    });
});

describe('middleware: prefix scope is a segment boundary', () => {
    const scopedRouter = (): { router: Router; spy: ReturnType<typeof vi.fn> } => {
        const router = new Router();
        const spy = vi.fn(async (_c, next) => await next());
        router.use('/api', spy);
        return { router, spy };
    };

    it("runs for the exact prefix path '/api'", async () => {
        const { router, spy } = scopedRouter();
        await router.handle(req('/api'), {});
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it("runs for nested paths like '/api/x'", async () => {
        const { router, spy } = scopedRouter();
        await router.handle(req('/api/x'), {});
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it("does NOT run for '/apifoo' (no mid-segment gluing)", async () => {
        const { router, spy } = scopedRouter();
        await router.handle(req('/apifoo'), {});
        expect(spy).not.toHaveBeenCalled();
    });

    it("does NOT run for '/'", async () => {
        const { router, spy } = scopedRouter();
        await router.handle(req('/'), {});
        expect(spy).not.toHaveBeenCalled();
    });

    it("a single trailing slash is forgiven: '/api/' is inside the '/api' scope", async () => {
        const { router, spy } = scopedRouter();
        await router.handle(req('/api/'), {});
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('scope must be static: a :param segment in the scope throws at registration', () => {
        const router = new Router();
        expect(() => router.use('/api/:x', async (_c, next) => await next())).toThrow(
            'only static segments are allowed',
        );
    });

    it('scope must be static: a * segment in the scope throws at registration', () => {
        const router = new Router();
        expect(() => router.use('/api/*', async (_c, next) => await next())).toThrow(
            'only static segments are allowed',
        );
    });

    it('use(prefix) without a middleware function throws', () => {
        const router = new Router();
        expect(() => router.use('/api', undefined as unknown as Middleware<unknown>)).toThrow(
            'use() requires a middleware function.',
        );
    });
});

describe('middleware: onion order', () => {
    it('runs in registration order, outermost first, unwinding in reverse after next()', async () => {
        const router = new Router();
        const order: string[] = [];
        const layer =
            (name: string): Middleware<unknown> =>
            async (_c, next) => {
                order.push(`${name}:before`);
                const res = await next();
                order.push(`${name}:after`);
                return res;
            };
        router.use(layer('a'));
        router.use(layer('b'));
        router.use(layer('c'));
        router.get('/x', () => {
            order.push('handler');
            return new Response('ok');
        });

        const result = await router.handle(req('/x'), {});

        expect(result).toBeInstanceOf(Response);
        expect(order).toEqual(['a:before', 'b:before', 'c:before', 'handler', 'c:after', 'b:after', 'a:after']);
    });

    it('scoped middleware keeps its registration position: scoped-then-global nests scoped outermost', async () => {
        const router = new Router();
        const order: string[] = [];
        router.use('/api', async (_c, next) => {
            order.push('scoped:before');
            const res = await next();
            order.push('scoped:after');
            return res;
        });
        router.use(async (_c, next) => {
            order.push('global:before');
            const res = await next();
            order.push('global:after');
            return res;
        });

        await router.handle(req('/api/x'), {});

        expect(order).toEqual(['scoped:before', 'global:before', 'global:after', 'scoped:after']);
    });
});

describe('middleware: short-circuit and the forgotten-return footgun', () => {
    it('returning a Response without calling next() skips later middleware and every route', async () => {
        const router = new Router();
        const later = vi.fn(async (_c, next) => await next());
        const handler = vi.fn(() => new Response('handler'));
        router.use(() => new Response('short', { status: 403 }));
        router.use(later);
        router.get('/x', handler);

        const result = await router.handle(req('/x'), {});

        expect(later).not.toHaveBeenCalled();
        expect(handler).not.toHaveBeenCalled();
        expect(result?.status).toBe(403);
        expect(await result?.text()).toBe('short');
    });

    it('FOOTGUN: forgetting to return the awaited next() drops the matched Response — handle() resolves null', async () => {
        const router = new Router();
        const handler = vi.fn(() => new Response('real'));
        router.use(async (_c, next) => {
            await next(); // downstream ran, but its Response is not returned...
        });
        router.get('/x', handler);

        const result = await router.handle(req('/x'), {});

        expect(handler).toHaveBeenCalledTimes(1); // the handler DID run
        expect(result).toBeNull(); // ...yet the request counts as unmatched
    });
});

describe('middleware: next()', () => {
    it('next() resolves the downstream Response and the middleware can modify it before returning', async () => {
        const router = new Router();
        router.use(async (_c, next) => {
            const res = await next();
            if (res) {
                res.headers.set('x-mw', 'stamped');
            }
            return res;
        });
        router.get('/x', () => new Response('body', { status: 201 }));

        const result = await router.handle(req('/x'), {});

        expect(result?.status).toBe(201);
        expect(result?.headers.get('x-mw')).toBe('stamped');
        expect(await result?.text()).toBe('body');
    });

    it('the middleware can replace the downstream Response entirely', async () => {
        const router = new Router();
        router.use(async (_c, next) => {
            await next();
            return new Response('replaced', { status: 418 });
        });
        router.get('/x', () => new Response('original'));

        const result = await router.handle(req('/x'), {});

        expect(result?.status).toBe(418);
        expect(await result?.text()).toBe('replaced');
    });

    it('next() resolves null when nothing matched downstream', async () => {
        const router = new Router();
        let seen: Response | null | undefined;
        router.use(async (_c, next) => {
            seen = await next();
            return seen;
        });

        const result = await router.handle(req('/no-route'), {});

        expect(seen).toBeNull();
        expect(result).toBeNull();
    });

    it('next() resolves null when every matching handler declines with null', async () => {
        const router = new Router();
        let seen: Response | null | undefined;
        router.use(async (_c, next) => {
            seen = await next();
            return seen;
        });
        router.get('/x', () => null);

        const result = await router.handle(req('/x'), {});

        expect(seen).toBeNull();
        expect(result).toBeNull();
    });

    it("calling next() twice throws 'next() called multiple times'", async () => {
        const router = new Router();
        router.use(async (_c, next) => {
            await next();
            return await next();
        });
        router.get('/x', () => new Response('ok'));

        await expect(router.handle(req('/x'), {})).rejects.toThrow('next() called multiple times');
    });
});

describe('middleware: ctx during middleware vs handler', () => {
    it('c.params is {} inside middleware before next(), even when the matched route has params', async () => {
        const router = new Router();
        let paramsInMiddleware: Record<string, string> | undefined;
        let paramsInHandler: Record<string, string> | undefined;
        router.use(async (c, next) => {
            paramsInMiddleware = { ...c.params };
            return await next();
        });
        router.get('/users/:id', (c) => {
            paramsInHandler = { ...c.params };
            return new Response('ok');
        });

        await router.handle(req('/users/42'), {});

        expect(paramsInMiddleware).toEqual({});
        expect(paramsInHandler).toEqual({ id: '42' });
    });

    it('c.data written by middleware is visible in the handler, and handler writes are visible after next()', async () => {
        const router = new Router();
        let dataInHandler: unknown;
        let dataAfterNext: unknown;
        router.use(async (c, next) => {
            c.data.user = 'alice';
            const res = await next();
            dataAfterNext = c.data.fromHandler;
            return res;
        });
        router.get('/x', (c) => {
            dataInHandler = c.data.user;
            c.data.fromHandler = 'seen';
            return new Response('ok');
        });

        await router.handle(req('/x'), {});

        expect(dataInHandler).toBe('alice');
        expect(dataAfterNext).toBe('seen');
    });
});

describe('middleware: runs once per request across decline-and-continue', () => {
    it('a null-returning handler lets the next matching route run, while middleware ran exactly once', async () => {
        const router = new Router();
        const spy = vi.fn(async (_c, next) => await next());
        const decliner = vi.fn(() => null);
        router.use(spy);
        router.get('/a/:id', decliner); // :param outranks *, matches first, declines
        router.all('/a/*', () => new Response('wild'));

        const result = await router.handle(req('/a/hello'), {});

        expect(decliner).toHaveBeenCalledTimes(1);
        expect(await result?.text()).toBe('wild');
        expect(spy).toHaveBeenCalledTimes(1); // one onion pass wraps the whole scan
    });
});
