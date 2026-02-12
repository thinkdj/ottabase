type MaybePromise<T> = T | Promise<T>;

export interface RouterContextBase {
    route: string;
    method: string;
}

export type RouterContext<Context extends RouterContextBase> = Context & { params: Record<string, string> };

export type RouterHandler<Context extends RouterContextBase> = (
    context: RouterContext<Context>,
) => MaybePromise<Response | null>;

export type RouterMiddleware<Context extends RouterContextBase> = (
    context: RouterContext<Context>,
    next: () => Promise<Response | null>,
) => MaybePromise<Response | null>;

export interface RouterGroupOptions<Context extends RouterContextBase> {
    prefix?: string;
    middleware?: RouterMiddleware<Context>[];
}

export interface RouterRouteOptions<Context extends RouterContextBase> {
    middleware?: RouterMiddleware<Context>[];
}

interface RouteMatcher {
    regex: RegExp;
    keys: string[];
}

interface RouteEntry<Context extends RouterContextBase> {
    method: string;
    path: string;
    matcher: RouteMatcher;
    handler: RouterHandler<Context>;
    middleware: RouterMiddleware<Context>[];
}

function normalizePath(path: string): string {
    if (!path) return '/';
    const trimmed = path.trim();
    if (trimmed === '*' || trimmed === '/*') return '/*';
    const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    if (withLeading.length > 1 && withLeading.endsWith('/')) {
        return withLeading.slice(0, -1);
    }
    return withLeading;
}

function normalizeSegment(segment: string): string {
    return segment.replace(/^\/+|\/+$/g, '');
}

function joinPaths(prefix: string, path: string): string {
    const normalizedPrefix = normalizeSegment(prefix);
    const normalizedPath = normalizeSegment(path);
    if (!normalizedPrefix && !normalizedPath) return '/';
    if (!normalizedPrefix) return `/${normalizedPath}`;
    if (!normalizedPath) return `/${normalizedPrefix}`;
    return `/${normalizedPrefix}/${normalizedPath}`;
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildMatcher(path: string): RouteMatcher {
    const normalized = normalizePath(path);
    if (normalized === '/*') {
        return { regex: /^.*$/, keys: ['wildcard'] };
    }

    if (normalized === '/') {
        return { regex: /^\/$/, keys: [] };
    }

    const segments = normalized.split('/').slice(1);
    const keys: string[] = [];
    const pattern = segments
        .map((segment) => {
            if (segment === '*') {
                keys.push('wildcard');
                return '(.*)';
            }
            if (segment.startsWith(':')) {
                keys.push(segment.slice(1));
                return '([^/]+)';
            }
            return escapeRegex(segment);
        })
        .join('/');

    return {
        regex: new RegExp(`^/${pattern}$`),
        keys,
    };
}

function safeDecode(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function buildParams(keys: string[], match: RegExpExecArray): Record<string, string> {
    const params: Record<string, string> = {};
    keys.forEach((key, index) => {
        const value = match[index + 1];
        if (value !== undefined) {
            params[key] = safeDecode(value);
        }
    });
    return params;
}

async function runMiddleware<Context extends RouterContextBase>(
    context: RouterContext<Context>,
    middleware: RouterMiddleware<Context>[],
    handler: RouterHandler<Context>,
): Promise<Response | null> {
    const run = async (index: number): Promise<Response | null> => {
        if (index < middleware.length) {
            return middleware[index](context, () => run(index + 1));
        }
        return handler(context);
    };
    return run(0);
}

class RouterGroup<Context extends RouterContextBase> {
    constructor(
        private readonly router: Router<Context>,
        private readonly prefix: string,
        private readonly middleware: RouterMiddleware<Context>[],
    ) {}

    group(options: RouterGroupOptions<Context>, handler: (group: RouterGroup<Context>) => void): this {
        const nextPrefix = joinPaths(this.prefix, options.prefix ?? '');
        const nextMiddleware = [...this.middleware, ...(options.middleware ?? [])];
        handler(new RouterGroup(this.router, nextPrefix, nextMiddleware));
        return this;
    }

    get(path: string, handler: RouterHandler<Context>, options: RouterRouteOptions<Context> = {}): this {
        this.router.addRoute('GET', joinPaths(this.prefix, path), handler, this.mergeMiddleware(options));
        return this;
    }

    post(path: string, handler: RouterHandler<Context>, options: RouterRouteOptions<Context> = {}): this {
        this.router.addRoute('POST', joinPaths(this.prefix, path), handler, this.mergeMiddleware(options));
        return this;
    }

    put(path: string, handler: RouterHandler<Context>, options: RouterRouteOptions<Context> = {}): this {
        this.router.addRoute('PUT', joinPaths(this.prefix, path), handler, this.mergeMiddleware(options));
        return this;
    }

    patch(path: string, handler: RouterHandler<Context>, options: RouterRouteOptions<Context> = {}): this {
        this.router.addRoute('PATCH', joinPaths(this.prefix, path), handler, this.mergeMiddleware(options));
        return this;
    }

    delete(path: string, handler: RouterHandler<Context>, options: RouterRouteOptions<Context> = {}): this {
        this.router.addRoute('DELETE', joinPaths(this.prefix, path), handler, this.mergeMiddleware(options));
        return this;
    }

    all(path: string, handler: RouterHandler<Context>, options: RouterRouteOptions<Context> = {}): this {
        this.router.addRoute('*', joinPaths(this.prefix, path), handler, this.mergeMiddleware(options));
        return this;
    }

    private mergeMiddleware(options: RouterRouteOptions<Context>): RouterMiddleware<Context>[] {
        return [...this.middleware, ...(options.middleware ?? [])];
    }
}

export class Router<Context extends RouterContextBase = RouterContextBase> {
    private readonly routes: RouteEntry<Context>[] = [];

    group(options: RouterGroupOptions<Context>, handler: (group: RouterGroup<Context>) => void): this {
        handler(new RouterGroup(this, normalizePath(options.prefix ?? ''), options.middleware ?? []));
        return this;
    }

    get(path: string, handler: RouterHandler<Context>, options: RouterRouteOptions<Context> = {}): this {
        return this.addRoute('GET', path, handler, options.middleware ?? []);
    }

    post(path: string, handler: RouterHandler<Context>, options: RouterRouteOptions<Context> = {}): this {
        return this.addRoute('POST', path, handler, options.middleware ?? []);
    }

    put(path: string, handler: RouterHandler<Context>, options: RouterRouteOptions<Context> = {}): this {
        return this.addRoute('PUT', path, handler, options.middleware ?? []);
    }

    patch(path: string, handler: RouterHandler<Context>, options: RouterRouteOptions<Context> = {}): this {
        return this.addRoute('PATCH', path, handler, options.middleware ?? []);
    }

    delete(path: string, handler: RouterHandler<Context>, options: RouterRouteOptions<Context> = {}): this {
        return this.addRoute('DELETE', path, handler, options.middleware ?? []);
    }

    all(path: string, handler: RouterHandler<Context>, options: RouterRouteOptions<Context> = {}): this {
        return this.addRoute('*', path, handler, options.middleware ?? []);
    }

    async handle(context: Context): Promise<Response | null> {
        const method = context.method.toUpperCase();
        const route = normalizePath(context.route);

        for (const entry of this.routes) {
            if (entry.method !== '*' && entry.method !== method) {
                continue;
            }

            const match = entry.matcher.regex.exec(route);
            if (!match) {
                continue;
            }

            const params = buildParams(entry.matcher.keys, match);
            const contextWithParams = { ...context, route, params } as RouterContext<Context>;
            const response = await runMiddleware(contextWithParams, entry.middleware, entry.handler);
            if (response) {
                return response;
            }
        }

        return null;
    }

    addRoute(
        method: string,
        path: string,
        handler: RouterHandler<Context>,
        middleware: RouterMiddleware<Context>[] = [],
    ): this {
        const normalizedPath = normalizePath(path);
        this.routes.push({
            method: method.toUpperCase(),
            path: normalizedPath,
            matcher: buildMatcher(normalizedPath),
            handler,
            middleware,
        });
        return this;
    }
}
