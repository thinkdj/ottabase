// ============================================================
// ottarouter — the simplest opinionated router for Cloudflare Workers
// ============================================================
//
// The rules (in full):
//   1. Routes are order-free. Precedence lives in the pattern, never in the
//      code layout: static > :param > *, leftmost segment first; exact
//      method > ALL. Identical shapes with overlapping methods throw at
//      registration.
//   2. A handler returns a Response or null. null means "not mine — keep
//      matching".
//   3. Unmatched is a value: handle() resolves null so the app can compose
//      (`?? fallback ?? assets`). fetch() turns null into a 404.
//   4. One middleware model: prefix-scoped onion functions that run once per
//      request — even when no route matches. A finalizer is just code after
//      `await next()`.
//   5. The grammar is closed: static, :param (one segment), final * (rest,
//      one or more segments). Anything fancier is an `if` inside a handler.
//
// Zero runtime dependencies. No Node APIs — only Request, Response and URL.
// ============================================================

export type Awaitable<T> = T | Promise<T>;

/** Captured path parameters. `:name` values are percent-decoded; `'*'` is raw. */
export type Params = Record<string, string>;

/**
 * Structural subset of Cloudflare's `ExecutionContext`, so the package needs
 * no type dependency. The real ExecutionContext satisfies it.
 */
export interface ExecutionContextLike {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
}

/** Template-literal param extraction from a route pattern. Type-only, zero runtime. */
export type PathParams<P extends string> = string extends P
    ? Params
    : P extends `${infer A}/${infer B}`
      ? PathParams<A> & PathParams<B>
      : P extends `:${infer N}`
        ? { [K in N]: string }
        : P extends '*'
          ? { '*': string }
          : Record<never, string>;

/** Per-request context. One object, passed to middleware and handlers. */
export interface Ctx<Env = unknown, P = Params> {
    /** The original request. */
    req: Request;
    env: Env;
    /** Execution context (`c.ctx.waitUntil(...)`). A no-op stub when `handle()` is called without one. */
    ctx: ExecutionContextLike;
    /** Parsed once from `req.url`. Original, un-normalized; query string lives here. */
    url: URL;
    /** Normalized pathname (one trailing slash stripped, unless the path is `/`). All matching uses this. */
    path: string;
    /** `req.method`, uppercased. */
    method: string;
    /** Path captures. Only meaningful inside a handler; `{}` in middleware. */
    params: P;
    /** Per-request scratch space: middleware writes, handlers read. */
    data: Record<string, unknown>;
}

/** A `Response` means handled — stop. `null` means "not mine — keep matching". */
export type Handler<Env = unknown, P = Params> = (c: Ctx<Env, P>) => Awaitable<Response | null>;

/** Resolves to the downstream result: a Response, or null when nothing matched. */
export type Next = () => Promise<Response | null>;

export type Middleware<Env = unknown> = (c: Ctx<Env>, next: Next) => Awaitable<Response | null>;

/**
 * Request-time visibility gate for `mount()`. Returns false to make the
 * mounted subtree invisible for this request (matching continues past it).
 * Synchronous by design; evaluated at most once per request per gate.
 */
export type Gate<Env = unknown> = (c: Ctx<Env>) => boolean;

/** Thrown at registration when two routes have the same shape and overlapping methods. */
export class RouteConflictError extends Error {
    readonly a: string;
    readonly b: string;

    constructor(a: string, b: string) {
        super(
            `Route conflict: "${a}" and "${b}" have the same shape and overlapping methods — ` +
                `no request could ever distinguish them. Remove one, or give them different methods.`,
        );
        this.name = 'RouteConflictError';
        this.a = a;
        this.b = b;
    }
}

/**
 * Set headers on a response, safely for Workers:
 * - 101 / WebSocket upgrade responses are returned unchanged (never rebuild an upgrade);
 * - immutable headers (cache/subrequest responses) are handled by cloning via `new Response(res.body, res)`;
 * - `Vary` is merged as unique comma-separated tokens instead of replaced, so stamping `Vary: Origin`
 *   for CORS never erases a `Vary` the underlying response already had (e.g. `Accept-Encoding`).
 */
export function withHeaders(res: Response, headers: HeadersInit): Response {
    if (res.status === 101 || (res as Response & { webSocket?: unknown }).webSocket) {
        return res;
    }
    // Replace each incoming header name once, then append — so a repeated name
    // (most notably Set-Cookie, which Headers deliberately never combines)
    // keeps every value instead of the last write clobbering the rest.
    const apply = (target: Headers): void => {
        const toSet = new Headers(headers);
        const replaced = new Set<string>();
        toSet.forEach((value, key) => {
            if (key === 'vary') {
                const existing = (target.get('vary') ?? '').split(',').map((token) => token.trim());
                const incoming = value.split(',').map((token) => token.trim());
                const merged = [...new Set([...existing, ...incoming].filter(Boolean))];
                target.set('vary', merged.join(', '));
                return;
            }
            if (!replaced.has(key)) {
                target.delete(key);
                replaced.add(key);
            }
            target.append(key, value);
        });
    };
    try {
        apply(res.headers);
        return res;
    } catch {
        const clone = new Response(res.body, res);
        apply(clone.headers);
        return clone;
    }
}

// ------------------------------------------------------------
// Pattern grammar
// ------------------------------------------------------------

const STATIC = 0;
const PARAM = 1;
const WILD = 2;
type SegKind = typeof STATIC | typeof PARAM | typeof WILD;

interface Seg {
    kind: SegKind;
    /** Static text, or param name. Empty for `*`. */
    text: string;
}

function parsePattern(pattern: string): Seg[] {
    if (!pattern.startsWith('/')) {
        throw new Error(`Invalid pattern "${pattern}": must start with "/".`);
    }
    if (pattern.includes('?') || pattern.includes('#')) {
        throw new Error(`Invalid pattern "${pattern}": query strings and fragments do not participate in routing.`);
    }
    if (pattern === '/') {
        return [];
    }
    const parts = pattern.slice(1).split('/');
    const segs: Seg[] = [];
    const names = new Set<string>();
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part === '') {
            throw new Error(`Invalid pattern "${pattern}": empty segment.`);
        }
        if (part === '*') {
            if (i !== parts.length - 1) {
                throw new Error(`Invalid pattern "${pattern}": "*" is only allowed as the final segment.`);
            }
            segs.push({ kind: WILD, text: '' });
        } else if (part.startsWith(':')) {
            const name = part.slice(1);
            if (name === '') {
                throw new Error(`Invalid pattern "${pattern}": ":" must be followed by a parameter name.`);
            }
            if (name === '*') {
                throw new Error(`Invalid pattern "${pattern}": ":*" is reserved — "*" is the wildcard capture key.`);
            }
            if (names.has(name)) {
                throw new Error(`Invalid pattern "${pattern}": duplicate parameter name ":${name}".`);
            }
            names.add(name);
            segs.push({ kind: PARAM, text: name });
        } else {
            segs.push({ kind: STATIC, text: part });
        }
    }
    return segs;
}

/** Static-only prefix (for `use()` scopes and `mount()` prefixes). */
function parseStaticPrefix(prefix: string, what: string): string[] {
    const segs = parsePattern(prefix);
    for (const seg of segs) {
        if (seg.kind !== STATIC) {
            throw new Error(`Invalid ${what} "${prefix}": only static segments are allowed.`);
        }
    }
    return segs.map((seg) => seg.text);
}

/** Shape identity: kinds and static text; param names do not distinguish shapes. */
function shapeKey(segs: Seg[]): string {
    let key = '';
    for (const seg of segs) {
        key += seg.kind === STATIC ? `/s:${seg.text}` : seg.kind === PARAM ? '/p' : '/w';
    }
    return key === '' ? '/' : key;
}

// ------------------------------------------------------------
// Matching
// ------------------------------------------------------------

/** One trailing slash is forgiven, everywhere. */
function normalizePath(pathname: string): string {
    return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function pathSegments(path: string): string[] {
    return path === '/' ? [] : path.slice(1).split('/');
}

/**
 * Match raw (un-decoded) path segments against a pattern.
 * Returns raw captures, or null. Decoding happens after a route is selected.
 */
function matchSegments(segs: Seg[], pathSegs: string[]): Params | null {
    const params: Params = {};
    for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        if (seg.kind === WILD) {
            if (pathSegs.length <= i) {
                return null;
            }
            const tail = pathSegs.slice(i);
            // An empty segment (from "//") never matches anything, including the
            // wildcard — "one or more remaining segments" means real segments.
            if (tail.some((s) => s === '')) {
                return null;
            }
            params['*'] = tail.join('/');
            return params;
        }
        if (pathSegs.length <= i) {
            return null;
        }
        const raw = pathSegs[i];
        if (seg.kind === STATIC) {
            if (raw !== seg.text) {
                return null;
            }
        } else {
            if (raw === '') {
                return null;
            }
            params[seg.text] = raw;
        }
    }
    return segs.length === pathSegs.length ? params : null;
}

/** Decode `:name` captures; `*` stays raw. A malformed encoding throws URIError (error path). */
function decodeParams(raw: Params): Params {
    const params: Params = {};
    for (const key of Object.keys(raw)) {
        params[key] = key === '*' ? raw[key] : decodeURIComponent(raw[key]);
    }
    return params;
}

// ------------------------------------------------------------
// Router
// ------------------------------------------------------------

interface RouteEntry<Env> {
    method: string;
    pattern: string;
    segs: Seg[];
    gates: ReadonlyArray<Gate<Env>>;
    handler: Handler<Env, Params>;
    index: number;
}

interface MiddlewareEntry<Env> {
    scope: string[];
    gates: ReadonlyArray<Gate<Env>>;
    fn: Middleware<Env>;
}

/**
 * Total precedence order. Compare shapes position by position; at the first
 * position where kinds differ, static > param > wild — that position decides.
 * Same shape: exact method > ALL. Everything else is disjoint (or threw at
 * registration), so the remaining tie-breaks are for sort stability only.
 */
function compareRoutes<Env>(a: RouteEntry<Env>, b: RouteEntry<Env>): number {
    const len = Math.min(a.segs.length, b.segs.length);
    for (let i = 0; i < len; i++) {
        if (a.segs[i].kind !== b.segs[i].kind) {
            return a.segs[i].kind - b.segs[i].kind;
        }
    }
    if (a.segs.length !== b.segs.length) {
        return a.segs.length - b.segs.length;
    }
    const aAll = a.method === 'ALL' ? 1 : 0;
    const bAll = b.method === 'ALL' ? 1 : 0;
    if (aAll !== bAll) {
        return aAll - bAll;
    }
    return a.index - b.index;
}

const NOOP_EXECUTION_CONTEXT: ExecutionContextLike = {
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
};

/** Internal marker: onError itself threw. Propagates untouched — one safety net, not two. */
class OnErrorFailure {
    constructor(readonly cause: unknown) {}
}

/** RFC 9110 token characters (tchar), checked after uppercasing — accepts any valid HTTP method token. */
const HTTP_METHOD_RE = /^[A-Z0-9!#$%&'*+\-.^_`|~]+$/;

export class Router<Env = unknown> {
    private readonly routeTable: RouteEntry<Env>[] = [];
    private readonly middlewareTable: MiddlewareEntry<Env>[] = [];
    /** shapeKey -> method -> registered pattern label (for conflict errors). */
    private readonly shapes = new Map<string, Map<string, string>>();
    private errorHandler: ((err: unknown, c: Ctx<Env>) => Awaitable<Response>) | null = null;
    private notFoundHandler: (c: Ctx<Env>) => Awaitable<Response> = () =>
        Response.json({ code: 'NOT_FOUND' }, { status: 404 });
    private customNotFound = false;
    private frozen = false;
    private sorted: RouteEntry<Env>[] | null = null;

    // -------------------- registration --------------------

    /**
     * Register a handler for any method string(s), uppercased.
     * `'ALL'` matches every method (and loses to an exact-method route of the same shape).
     */
    on<P extends string>(method: string | readonly string[], pattern: P, handler: Handler<Env, PathParams<P>>): this {
        this.assertOpen('register routes');
        const methods = typeof method === 'string' ? [method] : method;
        if (methods.length === 0) {
            throw new Error('on() requires at least one method.');
        }
        const segs = parsePattern(pattern);
        const upper = methods.map((m) => m.toUpperCase());

        // Validate every method against a disposable snapshot first — a
        // conflict (including a duplicate within this same call) must leave
        // the router untouched rather than half-registering the pattern.
        const shape = shapeKey(segs);
        const snapshot = new Map(this.shapes.get(shape) ?? []);
        for (const m of upper) {
            if (!HTTP_METHOD_RE.test(m)) {
                throw new Error(`Invalid method "${m}".`);
            }
            const existing = snapshot.get(m);
            if (existing !== undefined) {
                throw new RouteConflictError(`${m} ${existing}`, `${m} ${pattern}`);
            }
            snapshot.set(m, pattern);
        }

        for (const m of upper) {
            this.addRoute(m, pattern, segs, [], handler as Handler<Env, Params>, pattern);
        }
        return this;
    }

    get<P extends string>(pattern: P, handler: Handler<Env, PathParams<P>>): this {
        return this.on('GET', pattern, handler);
    }

    post<P extends string>(pattern: P, handler: Handler<Env, PathParams<P>>): this {
        return this.on('POST', pattern, handler);
    }

    put<P extends string>(pattern: P, handler: Handler<Env, PathParams<P>>): this {
        return this.on('PUT', pattern, handler);
    }

    patch<P extends string>(pattern: P, handler: Handler<Env, PathParams<P>>): this {
        return this.on('PATCH', pattern, handler);
    }

    delete<P extends string>(pattern: P, handler: Handler<Env, PathParams<P>>): this {
        return this.on('DELETE', pattern, handler);
    }

    options<P extends string>(pattern: P, handler: Handler<Env, PathParams<P>>): this {
        return this.on('OPTIONS', pattern, handler);
    }

    head<P extends string>(pattern: P, handler: Handler<Env, PathParams<P>>): this {
        return this.on('HEAD', pattern, handler);
    }

    /** Matches every method. No auto-405, no auto-HEAD: unmatched methods fall through. */
    all<P extends string>(pattern: P, handler: Handler<Env, PathParams<P>>): this {
        return this.on('ALL', pattern, handler);
    }

    /**
     * Register middleware. `use(mw)` is global; `use(prefix, mw)` scopes by
     * segment-boundary prefix (`/api` covers `/api` and `/api/...`, never `/apifoo`).
     * Middleware runs once per request, in registration order, outermost first —
     * even when no route matches.
     */
    use(mw: Middleware<Env>): this;
    use(prefix: string, mw: Middleware<Env>): this;
    use(prefixOrMw: string | Middleware<Env>, maybeMw?: Middleware<Env>): this {
        this.assertOpen('register middleware');
        const [prefix, fn] = typeof prefixOrMw === 'string' ? [prefixOrMw, maybeMw] : ['/', prefixOrMw];
        if (typeof fn !== 'function') {
            throw new Error('use() requires a middleware function.');
        }
        this.middlewareTable.push({ scope: parseStaticPrefix(prefix, 'middleware scope'), gates: [], fn });
        return this;
    }

    /**
     * Mount a sub-router under a static prefix (`/` is legal). Routes flatten
     * into one global precedence table; cross-tree conflicts throw. The `when`
     * gate is evaluated per request: false makes the whole subtree (routes and
     * middleware) invisible, and matching continues past it. Mounting freezes
     * the sub-router.
     */
    mount(prefix: string, sub: Router<Env>, opts?: { when?: Gate<Env> }): this {
        this.assertOpen('mount sub-routers');
        if (sub === (this as Router<Env>)) {
            throw new Error('Cannot mount a router into itself.');
        }
        if (sub.errorHandler || sub.customNotFound) {
            throw new Error('onError/notFound belong to the root router only — remove them from the mounted router.');
        }
        if (sub.frozen) {
            throw new Error(
                'This router has already been mounted (or already served a request) — mount a fresh Router instance instead.',
            );
        }
        const prefixSegs = parseStaticPrefix(prefix, 'mount prefix');
        const gate = opts?.when;

        const newRoutes = sub.routeTable.map((route) => {
            const pattern =
                prefix === '/' ? route.pattern : route.pattern === '/' ? prefix : `${prefix}${route.pattern}`;
            const segs = [...prefixSegs.map((text): Seg => ({ kind: STATIC, text })), ...route.segs];
            const gates = gate ? [gate, ...route.gates] : route.gates;
            return { method: route.method, pattern, segs, gates, handler: route.handler };
        });

        // Validate every new route against a disposable snapshot first — a
        // conflicting mount must leave both routers completely untouched.
        const snapshot = new Map<string, Map<string, string>>();
        for (const [shape, methods] of this.shapes) {
            snapshot.set(shape, new Map(methods));
        }
        for (const route of newRoutes) {
            const shape = shapeKey(route.segs);
            let methods = snapshot.get(shape);
            if (!methods) {
                methods = new Map();
                snapshot.set(shape, methods);
            }
            const existing = methods.get(route.method);
            if (existing !== undefined) {
                throw new RouteConflictError(`${route.method} ${existing}`, `${route.method} ${route.pattern}`);
            }
            methods.set(route.method, route.pattern);
        }

        // Validated — commit for real, then freeze the sub last.
        for (const route of newRoutes) {
            this.addRoute(route.method, route.pattern, route.segs, route.gates, route.handler, route.pattern);
        }
        for (const mw of sub.middlewareTable) {
            this.middlewareTable.push({
                scope: [...prefixSegs, ...mw.scope],
                gates: gate ? [gate, ...mw.gates] : mw.gates,
                fn: mw.fn,
            });
        }
        sub.frozen = true;
        return this;
    }

    /**
     * Root-only error hook. Handler-path errors (handler throw, gate throw,
     * `:param` decode URIError) are replaced by its Response, which unwinds
     * through the middleware onion. Middleware errors are caught at the
     * `handle()` boundary. Without it, errors propagate to the caller.
     */
    onError(fn: (err: unknown, c: Ctx<Env>) => Awaitable<Response>): this {
        this.assertOpen('set onError');
        this.errorHandler = fn;
        return this;
    }

    /** Root-only. Used by `fetch()` when nothing matched. `handle()` returns null instead. */
    notFound(fn: (c: Ctx<Env>) => Awaitable<Response>): this {
        this.assertOpen('set notFound');
        this.notFoundHandler = fn;
        this.customNotFound = true;
        return this;
    }

    /** Debug: the full route table in precedence order. Freezes the router. */
    routes(): ReadonlyArray<{ method: string; pattern: string }> {
        return this.freeze().map((route) => ({ method: route.method, pattern: route.pattern }));
    }

    // -------------------- dispatch --------------------

    /**
     * Composable entry point: resolves the matched Response, or null when no
     * route claimed the request (`await router.handle(...) ?? yourFallback(...)`).
     * The first call freezes the router.
     */
    async handle(req: Request, env: Env, ctx?: ExecutionContextLike): Promise<Response | null> {
        return (await this.run(req, env, ctx)).response;
    }

    /**
     * Standalone entry point: `handle()`, then `notFound` on null (default: JSON 404).
     * Pre-bound, so a Router instance works directly as `export default router`.
     */
    fetch = async (req: Request, env: Env, ctx?: ExecutionContextLike): Promise<Response> => {
        const { response, c } = await this.run(req, env, ctx);
        return response ?? (await this.notFoundHandler(c));
    };

    private async run(
        req: Request,
        env: Env,
        executionContext?: ExecutionContextLike,
    ): Promise<{ response: Response | null; c: Ctx<Env> }> {
        const table = this.freeze();
        const url = new URL(req.url);
        const path = normalizePath(url.pathname);
        const c: Ctx<Env> = {
            req,
            env,
            ctx: executionContext ?? NOOP_EXECUTION_CONTEXT,
            url,
            path,
            method: req.method.toUpperCase(),
            params: {},
            data: {},
        };
        const pathSegs = pathSegments(path);
        const gateResults = new Map<Gate<Env>, boolean>();
        const passes = (gates: ReadonlyArray<Gate<Env>>): boolean => {
            for (const gate of gates) {
                let pass = gateResults.get(gate);
                if (pass === undefined) {
                    pass = !!gate(c);
                    gateResults.set(gate, pass);
                }
                if (!pass) {
                    return false;
                }
            }
            return true;
        };

        // A handler-path error (route handler throw, gate throw, :param decode
        // URIError — from either the dispatch loop or a mounted middleware's
        // gate) is replaced by onError's Response, which unwinds through the
        // onion like any other matched response. If onError itself throws, that
        // failure is wrapped so the outer boundary below rethrows it untouched
        // instead of invoking onError a second time.
        const handleError = async (err: unknown): Promise<Response> => {
            if (!this.errorHandler) {
                throw err;
            }
            try {
                return await this.errorHandler(err, c);
            } catch (onErrorErr) {
                throw new OnErrorFailure(onErrorErr);
            }
        };

        const dispatch = async (): Promise<Response | null> => {
            for (const route of table) {
                if (route.method !== 'ALL' && route.method !== c.method) {
                    continue;
                }
                const raw = matchSegments(route.segs, pathSegs);
                if (raw === null) {
                    continue;
                }
                try {
                    if (!passes(route.gates)) {
                        continue;
                    }
                    c.params = decodeParams(raw);
                    const result = await route.handler(c);
                    if (result instanceof Response) {
                        return result;
                    }
                } catch (err) {
                    return await handleError(err);
                } finally {
                    c.params = {};
                }
            }
            return null;
        };

        const applicable = this.middlewareTable.filter((mw) => isScopePrefix(mw.scope, pathSegs));
        const runFrom = async (start: number): Promise<Response | null> => {
            for (let i = start; i < applicable.length; i++) {
                let passed: boolean;
                try {
                    passed = passes(applicable[i].gates);
                } catch (err) {
                    return await handleError(err);
                }
                if (!passed) {
                    continue;
                }
                let called = false;
                const next: Next = () => {
                    if (called) {
                        throw new Error('next() called multiple times.');
                    }
                    called = true;
                    return runFrom(i + 1);
                };
                const result = await applicable[i].fn(c, next);
                return result instanceof Response ? result : null;
            }
            return dispatch();
        };

        try {
            return { response: await runFrom(0), c };
        } catch (err) {
            if (err instanceof OnErrorFailure) {
                throw err.cause;
            }
            if (this.errorHandler) {
                return { response: await this.errorHandler(err, c), c };
            }
            throw err;
        }
    }

    // -------------------- internals --------------------

    private addRoute(
        method: string,
        displayPattern: string,
        segs: Seg[],
        gates: ReadonlyArray<Gate<Env>>,
        handler: Handler<Env, Params>,
        pattern: string,
    ): void {
        if (!HTTP_METHOD_RE.test(method)) {
            throw new Error(`Invalid method "${method}".`);
        }
        const shape = shapeKey(segs);
        let methods = this.shapes.get(shape);
        if (!methods) {
            methods = new Map();
            this.shapes.set(shape, methods);
        }
        const existing = methods.get(method);
        if (existing !== undefined) {
            throw new RouteConflictError(`${method} ${existing}`, `${method} ${pattern}`);
        }
        methods.set(method, pattern);
        this.routeTable.push({
            method,
            pattern: displayPattern,
            segs,
            gates,
            handler,
            index: this.routeTable.length,
        });
    }

    private freeze(): RouteEntry<Env>[] {
        if (!this.sorted) {
            this.frozen = true;
            this.sorted = [...this.routeTable].sort(compareRoutes);
        }
        return this.sorted;
    }

    private assertOpen(action: string): void {
        if (this.frozen) {
            throw new Error(
                `Router is frozen (it already served a request or was mounted) — cannot ${action}. ` +
                    `Register everything before the first request.`,
            );
        }
    }
}

/** Segment-boundary prefix check for middleware scopes. Scope `[]` is global. */
function isScopePrefix(scope: string[], pathSegs: string[]): boolean {
    if (scope.length > pathSegs.length) {
        return false;
    }
    for (let i = 0; i < scope.length; i++) {
        if (scope[i] !== pathSegs[i]) {
            return false;
        }
    }
    return true;
}
