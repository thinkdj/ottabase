import { describe, expect, it, vi } from 'vitest';
import { Router, withHeaders } from '../index';
import type { ExecutionContextLike } from '../index';

const req = (path: string, method = 'GET'): Request => new Request(`http://localhost${path}`, { method });

/** Narrow `Response | null` with an assertion so failures read clearly. */
const mustRespond = (res: Response | null): Response => {
    expect(res).not.toBeNull();
    return res as Response;
};

describe('handle(): unmatched is a value', () => {
    it('resolves null when no route matches', async () => {
        const router = new Router();
        router.get('/present', () => new Response('here'));

        expect(await router.handle(req('/absent'), {})).toBeNull();
    });

    it('composes with ?? — fallback runs on null, is skipped on a match', async () => {
        const router = new Router();
        router.get('/hit', () => new Response('routed'));
        const fallback = vi.fn(() => new Response('fallback', { status: 200 }));

        const missed = (await router.handle(req('/miss'), {})) ?? fallback();
        expect(await missed.text()).toBe('fallback');
        expect(fallback).toHaveBeenCalledTimes(1);

        const hit = (await router.handle(req('/hit'), {})) ?? fallback();
        expect(await hit.text()).toBe('routed');
        expect(fallback).toHaveBeenCalledTimes(1);
    });
});

describe('fetch(): standalone entry point and 404 policy', () => {
    it('returns the default JSON 404 ({ code: "NOT_FOUND" }, status 404) when nothing matches', async () => {
        const router = new Router();
        router.get('/present', () => new Response('here'));

        const res = await router.fetch(req('/absent'), {});

        expect(res.status).toBe(404);
        expect(res.headers.get('content-type')).toContain('application/json');
        expect(await res.json()).toEqual({ code: 'NOT_FOUND' });
    });

    it('notFound() replaces the default 404 and receives a Ctx with normalized path and method', async () => {
        const router = new Router();
        let seen: { path: string; method: string } | undefined;
        router.notFound((c) => {
            seen = { path: c.path, method: c.method };
            return new Response('custom-404', { status: 404, headers: { 'x-custom': 'nf' } });
        });

        const res = await router.fetch(req('/missing/', 'POST'), {});

        expect(res.status).toBe(404);
        expect(await res.text()).toBe('custom-404');
        expect(res.headers.get('x-custom')).toBe('nf');
        expect(seen).toEqual({ path: '/missing', method: 'POST' });
    });

    it('does not invoke notFound when a route matches', async () => {
        const router = new Router();
        const nf = vi.fn(() => new Response('nf', { status: 404 }));
        router.notFound(nf);
        router.get('/hit', () => new Response('routed'));

        const res = await router.fetch(req('/hit'), {});

        expect(await res.text()).toBe('routed');
        expect(nf).not.toHaveBeenCalled();
    });

    it('is pre-bound: a detached reference and an { fetch } object both dispatch correctly', async () => {
        const router = new Router();
        router.get('/ping', () => new Response('pong'));

        const detached = router.fetch;
        expect(await (await detached(req('/ping'), {})).text()).toBe('pong');

        const worker = { fetch: router.fetch };
        expect(await (await worker.fetch(req('/ping'), {})).text()).toBe('pong');
    });

    it('produces the 404 after and outside the onion: finalizers never stamp it, but stamp matched responses', async () => {
        const router = new Router();
        router.use(async (_c, next) => {
            const res = await next();
            return res ? withHeaders(res, { 'x-onion': '1' }) : res;
        });
        router.get('/hit', () => new Response('ok'));

        const miss = await router.fetch(req('/miss'), {});
        expect(miss.status).toBe(404);
        expect(miss.headers.get('x-onion')).toBeNull();

        const hit = await router.fetch(req('/hit'), {});
        expect(hit.headers.get('x-onion')).toBe('1');
    });
});

describe('onError: error routing', () => {
    it('a handler throw WITHOUT onError propagates out of handle() and fetch()', async () => {
        const router = new Router();
        const boom = new Error('handler boom');
        router.get('/explode', () => {
            throw boom;
        });

        await expect(router.handle(req('/explode'), {})).rejects.toBe(boom);
        await expect(router.fetch(req('/explode'), {})).rejects.toBe(boom);
    });

    it('a handler throw WITH onError returns its Response, which unwinds through middleware finalizers', async () => {
        const router = new Router();
        router.use(async (_c, next) => {
            const res = await next();
            return res ? withHeaders(res, { 'x-finalized': '1' }) : res;
        });
        router.onError(
            (err, c) => new Response(`err:${(err as Error).message}:${c.path}:${c.method}`, { status: 500 }),
        );
        router.get('/explode', () => {
            throw new Error('handler boom');
        });

        const res = mustRespond(await router.handle(req('/explode'), {}));

        expect(res.status).toBe(500);
        expect(await res.text()).toBe('err:handler boom:/explode:GET');
        expect(res.headers.get('x-finalized')).toBe('1');
    });

    it('a gate throw is a handler-path error: onError responds and the response unwinds through the onion', async () => {
        const router = new Router();
        router.use(async (_c, next) => {
            const res = await next();
            return res ? withHeaders(res, { 'x-finalized': '1' }) : res;
        });
        const gateErr = new Error('gate boom');
        const onError = vi.fn(() => new Response('gate-handled', { status: 500 }));
        router.onError(onError);
        const sub = new Router();
        sub.get('/thing', () => new Response('never'));
        router.mount('/gated', sub, {
            when: () => {
                throw gateErr;
            },
        });

        const res = mustRespond(await router.handle(req('/gated/thing'), {}));

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0]).toBe(gateErr);
        expect(res.status).toBe(500);
        expect(await res.text()).toBe('gate-handled');
        expect(res.headers.get('x-finalized')).toBe('1');
    });

    it('a malformed :param percent-encoding throws URIError, routed to onError', async () => {
        const router = new Router();
        let caught: unknown;
        router.onError((err) => {
            caught = err;
            return new Response('bad-id', { status: 400 });
        });
        router.get('/users/:id', (c) => new Response(c.params.id));

        const res = mustRespond(await router.handle(req('/users/%ZZ'), {}));

        expect(caught).toBeInstanceOf(URIError);
        expect(res.status).toBe(400);
        expect(await res.text()).toBe('bad-id');
    });

    it('a middleware throw BEFORE next() is caught at the handle() boundary: onError responds, outer finalizer is skipped', async () => {
        const router = new Router();
        const events: string[] = [];
        router.use(async (_c, next) => {
            const res = await next();
            events.push('outer-after');
            return res ? withHeaders(res, { 'x-outer': '1' }) : res;
        });
        router.use(() => {
            throw new Error('mw boom');
        });
        router.onError((err) => new Response(`caught:${(err as Error).message}`, { status: 500 }));
        router.get('/x', () => new Response('never'));

        const res = mustRespond(await router.handle(req('/x'), {}));

        expect(res.status).toBe(500);
        expect(await res.text()).toBe('caught:mw boom');
        expect(res.headers.get('x-outer')).toBeNull();
        expect(events).toEqual([]);
    });

    it('a middleware throw AFTER next() (finalizer position) is also caught at the boundary, skipping outer finalizers', async () => {
        const router = new Router();
        router.use(async (_c, next) => {
            const res = await next();
            return res ? withHeaders(res, { 'x-outer': '1' }) : res;
        });
        router.use(async (_c, next) => {
            await next();
            throw new Error('finalizer boom');
        });
        const onError = vi.fn(() => new Response('boundary-handled', { status: 500 }));
        router.onError(onError);
        const handler = vi.fn(() => new Response('routed'));
        router.get('/x', handler);

        const res = mustRespond(await router.handle(req('/x'), {}));

        expect(handler).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(res.status).toBe(500);
        expect(await res.text()).toBe('boundary-handled');
        expect(res.headers.get('x-outer')).toBeNull();
    });

    it('onError itself throwing propagates — one safety net, not two', async () => {
        const router = new Router();
        const secondary = new Error('onError boom');
        router.onError(() => {
            throw secondary;
        });
        router.get('/explode', () => {
            throw new Error('original boom');
        });

        await expect(router.handle(req('/explode'), {})).rejects.toBe(secondary);
    });
});

describe('c.ctx: ExecutionContext plumbing', () => {
    it('is a no-op stub when handle() is called without an ExecutionContext — waitUntil/passThroughOnException do not throw', async () => {
        const router = new Router();
        router.get('/c', (c) => {
            c.ctx.waitUntil(Promise.resolve());
            c.ctx.passThroughOnException();
            return new Response('survived');
        });

        const res = mustRespond(await router.handle(req('/c'), {}));

        expect(await res.text()).toBe('survived');
    });

    it('is the exact object passed to handle() when provided', async () => {
        const router = new Router();
        const ec: ExecutionContextLike = { waitUntil: vi.fn(), passThroughOnException: vi.fn() };
        let seen: ExecutionContextLike | undefined;
        router.get('/c', (c) => {
            seen = c.ctx;
            c.ctx.waitUntil(Promise.resolve());
            return new Response('ok');
        });

        await router.handle(req('/c'), {}, ec);

        expect(seen).toBe(ec);
        expect(ec.waitUntil).toHaveBeenCalledTimes(1);
    });
});

describe('withHeaders()', () => {
    it('sets headers on a mutable Response and returns the SAME instance', () => {
        const res = new Response('body');
        const out = withHeaders(res, { 'x-a': '1', 'x-b': '2' });

        expect(out).toBe(res);
        expect(out.headers.get('x-a')).toBe('1');
        expect(out.headers.get('x-b')).toBe('2');
    });

    it('returns a CLONE (headers set, status/body/existing headers preserved) when headers.set throws', async () => {
        const res = new Response('payload', { status: 201, headers: { 'x-orig': 'kept' } });
        Object.defineProperty(res.headers, 'set', {
            value: () => {
                throw new TypeError('immutable headers');
            },
        });

        const out = withHeaders(res, { 'x-new': '1' });

        expect(out).not.toBe(res);
        expect(out.status).toBe(201);
        expect(out.headers.get('x-new')).toBe('1');
        expect(out.headers.get('x-orig')).toBe('kept');
        expect(await out.text()).toBe('payload');
    });

    it('returns a 101 response UNCHANGED — same reference, headers untouched', () => {
        const upgrade = { status: 101, headers: new Headers() } as unknown as Response;

        const out = withHeaders(upgrade, { 'x-a': '1' });

        expect(out).toBe(upgrade);
        expect(upgrade.headers.get('x-a')).toBeNull();
    });

    it('returns a webSocket response UNCHANGED — same reference, headers untouched', () => {
        const ws = { webSocket: {}, status: 200, headers: new Headers() } as unknown as Response;

        const out = withHeaders(ws, { 'x-a': '1' });

        expect(out).toBe(ws);
        expect(ws.headers.get('x-a')).toBeNull();
    });

    it('accepts all HeadersInit forms: plain object, entries array, Headers instance', () => {
        const fromObject = withHeaders(new Response('x'), { 'x-form': 'object' });
        const fromEntries = withHeaders(new Response('x'), [['x-form', 'entries']]);
        const fromHeaders = withHeaders(new Response('x'), new Headers({ 'x-form': 'headers' }));

        expect(fromObject.headers.get('x-form')).toBe('object');
        expect(fromEntries.headers.get('x-form')).toBe('entries');
        expect(fromHeaders.headers.get('x-form')).toBe('headers');
    });
});
