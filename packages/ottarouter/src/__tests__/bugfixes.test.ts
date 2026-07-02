import { describe, expect, it, vi } from 'vitest';
import { RouteConflictError, Router, withHeaders } from '../index';

const req = (path: string, method = 'GET'): Request => new Request(`http://localhost${path}`, { method });

describe('bugfixes: onError invoked at most once', () => {
    it('when onError itself throws on a handler-path error, the failure propagates without a second onError call', async () => {
        const router = new Router();
        router.get('/x', () => {
            throw new Error('handler blew up');
        });
        const seen: string[] = [];
        router.onError((err) => {
            seen.push((err as Error).message);
            throw new Error('onError blew up too');
        });

        await expect(router.handle(req('/x'), {})).rejects.toThrow('onError blew up too');
        expect(seen).toEqual(['handler blew up']);
    });

    it('a failing onError response still unwinds — but only once — through outer finalizer middleware', async () => {
        const router = new Router();
        let onErrorCalls = 0;
        router.onError(() => {
            onErrorCalls++;
            throw new Error('nope');
        });
        router.get('/x', () => {
            throw new Error('boom');
        });

        await expect(router.handle(req('/x'), {})).rejects.toThrow('nope');
        expect(onErrorCalls).toBe(1);
    });

    it('onError is invoked exactly once for an ordinary handler throw', async () => {
        const router = new Router();
        const onError = vi.fn(async () => new Response('handled', { status: 500 }));
        router.onError(onError);
        router.get('/x', () => {
            throw new Error('boom');
        });

        const res = await router.handle(req('/x'), {});
        expect(onError).toHaveBeenCalledTimes(1);
        expect(res?.status).toBe(500);
    });
});

describe('bugfixes: mounted-middleware gate throw unwinds through the onion', () => {
    it('a throwing mount gate on a subtree WITH middleware still unwinds through an outer finalizer, same as a subtree with no middleware', async () => {
        const order: string[] = [];
        const router = new Router();
        router.use(async (c, next) => {
            order.push('outer:pre');
            const res = await next();
            order.push('outer:post');
            return res;
        });
        router.onError(() => new Response('caught', { status: 599 }));

        const sub = new Router();
        sub.use((c, next) => next()); // subtree HAS middleware
        sub.get('/y', () => new Response('y'));
        router.mount('/sub', sub, {
            when: () => {
                throw new Error('gate exploded');
            },
        });

        const res = await router.handle(req('/sub/y'), {});
        expect(res?.status).toBe(599);
        expect(order).toEqual(['outer:pre', 'outer:post']);
    });
});

describe('bugfixes: gate truthy coercion', () => {
    it('a gate returning a truthy non-boolean (e.g. a string) makes the subtree visible, not invisible', async () => {
        const router = new Router();
        const sub = new Router();
        sub.get('/y', () => new Response('y'));
        // @ts-expect-error deliberately returning a non-boolean truthy value
        router.mount('/sub', sub, { when: () => 'yes' });

        const res = await router.handle(req('/sub/y'), {});
        expect(res?.status).toBe(200);
    });
});

describe('bugfixes: wildcard never matches an empty segment', () => {
    it('a double trailing slash does not match a wildcard route (falls through as null)', async () => {
        const router = new Router();
        const handler = vi.fn(() => new Response('ok'));
        router.get('/a/*', handler);

        expect(await router.handle(req('/a//'), {})).toBeNull();
        expect(handler).not.toHaveBeenCalled();
    });

    it('a single trailing slash still normalizes and reaches a static route (unaffected by the fix)', async () => {
        const router = new Router();
        router.get('/a', () => new Response('ok'));

        const res = await router.handle(req('/a/'), {});
        expect(res?.status).toBe(200);
    });

    it('a genuine multi-segment wildcard capture with real content still works', async () => {
        const router = new Router();
        router.get('/a/*', (c) => new Response(c.params['*']));

        const res = await router.handle(req('/a/b/c'), {});
        expect(await res?.text()).toBe('b/c');
    });

    it('triple slashes never match a bare wildcard root either', async () => {
        const router = new Router();
        const handler = vi.fn(() => new Response('ok'));
        router.get('/*', handler);

        expect(await router.handle(req('///'), {})).toBeNull();
        expect(handler).not.toHaveBeenCalled();
    });
});

describe('bugfixes: reserved wildcard capture key', () => {
    it('a param literally named ":*" is rejected at registration', () => {
        const router = new Router();
        expect(() => router.get('/x/:*', () => new Response('x'))).toThrow(/reserved/);
    });
});

describe('bugfixes: withHeaders preserves repeated header values', () => {
    it('preserves multiple Set-Cookie values instead of the last one clobbering the rest', () => {
        const res = new Response('ok');
        const out = withHeaders(res, [
            ['Set-Cookie', 'a=1'],
            ['Set-Cookie', 'b=2'],
        ]);

        const cookies =
            typeof out.headers.getSetCookie === 'function'
                ? out.headers.getSetCookie()
                : [out.headers.get('set-cookie') ?? ''];
        expect(cookies).toEqual(['a=1', 'b=2']);
    });

    it('still overwrites an ordinary repeated header (single combined value replaces the old one)', () => {
        const res = new Response('ok', { headers: { 'x-tag': 'old' } });
        const out = withHeaders(res, { 'x-tag': 'new' });

        expect(out.headers.get('x-tag')).toBe('new');
    });
});

describe('bugfixes: on() is atomic across multiple methods', () => {
    it('registering the same method twice in one on() call throws and registers nothing', () => {
        const router = new Router();
        expect(() => router.on(['GET', 'GET'], '/x', () => new Response('x'))).toThrow(RouteConflictError);
        expect(router.routes()).toEqual([]);
    });

    it('a conflict on one method in a multi-method call leaves ALL methods unregistered', async () => {
        const router = new Router();
        router.post('/x', () => new Response('existing-post'));

        expect(() => router.on(['GET', 'POST'], '/x', () => new Response('new'))).toThrow(RouteConflictError);

        // GET must NOT have been registered as a side effect of the failed call.
        expect(await router.handle(req('/x', 'GET'), {})).toBeNull();
        const res = await router.handle(req('/x', 'POST'), {});
        expect(await res?.text()).toBe('existing-post');
    });
});

describe('bugfixes: mount() is atomic and rejects re-mounting', () => {
    it('a conflicting mount leaves the parent router completely untouched', async () => {
        const router = new Router();
        router.get('/api/:id', () => new Response('parent'));

        const sub = new Router();
        sub.get('/:slug', () => new Response('sub'));

        expect(() => router.mount('/api', sub, {})).toThrow(RouteConflictError);

        // Parent's own route must still work normally after the failed mount.
        const res = await router.handle(req('/api/42'), {});
        expect(await res?.text()).toBe('parent');
    });

    it('a router that failed to mount (due to conflict) is not frozen and can be fixed and re-mounted', async () => {
        const router = new Router();
        router.get('/api/:id', () => new Response('parent'));

        const sub = new Router();
        sub.get('/:slug', () => new Response('sub-old'));
        expect(() => router.mount('/api', sub, {})).toThrow(RouteConflictError);

        // sub must not be frozen — still safe to keep configuring a fresh router
        // and mount that instead.
        const fixedSub = new Router();
        fixedSub.get('/items/:slug', () => new Response('sub-new'));
        expect(() => router.mount('/api', fixedSub, {})).not.toThrow();

        const res = await router.handle(req('/api/items/hello'), {});
        expect(await res?.text()).toBe('sub-new');
    });

    it('mounting an already-mounted router a second time throws instead of silently doubling its middleware', () => {
        const router1 = new Router();
        const router2 = new Router();
        const sub = new Router();
        sub.use((c, next) => next());

        router1.mount('/a', sub, {});
        expect(() => router2.mount('/b', sub, {})).toThrow(/already been mounted/);
    });
});
