/**
 * Cache Key Builder for KV Storage
 *
 * Type-safe, scoped cache keys for multi-tenant SaaS architecture.
 * Prevents cross-tenant KV collisions via consistent namespace:scope:id format.
 *
 * Key Format: namespace:scope:id[:scope:id]:segments
 * Examples:
 *   brand:org:acme:app:web:layout
 *   rbac:org:acme:usr:user-123:roles
 *   session:usr:user-123:active
 *
 * @see docs/CACHE_KEYS.md
 */

// ── Types ───────────────────────────────────────────────────

export type CacheScope = 'org' | 'user' | 'app' | 'global';

/**
 * Suggested cache namespaces. Accepts any string for extensibility —
 * packages can use their own namespaces (e.g., 'auth', 'order').
 */
export type CacheNamespace =
    | 'rbac'
    | 'brand'
    | 'ratelimit'
    | 'dedupe'
    | 'session'
    | 'config'
    | 'cache'
    | 'auth'
    | 'system'
    | 'temp'
    | (string & {}); // extensible — any string is accepted

// ── Internal helpers ────────────────────────────────────────

/** Cloudflare KV max key length in bytes */
const MAX_KEY_LENGTH = 512;

/** Replace colons and collapse whitespace to prevent key structure corruption */
function sanitize(value: string): string {
    return value
        .replace(/[:\s]+/g, '-') // colons & whitespace → dash
        .replace(/^-+|-+$/g, ''); // trim leading/trailing dashes
}

/** Validate that a required ID is non-empty, then sanitize */
function requireId(value: string, label: string): string {
    if (!value) throw new Error(`${label} is required`);
    return sanitize(value);
}

// ── Builder (for complex / dynamic keys) ────────────────────

/**
 * Fluent builder for constructing cache keys with arbitrary scope combinations.
 * Use the helper functions below for common patterns.
 *
 * @example
 * CacheKeyBuilder.create('rbac')
 *   .org('acme').version(1).app('web').user('u-123').segment('context')
 *   .build()
 * // → rbac:org:acme:v1:app:web:usr:u-123:context
 */
export class CacheKeyBuilder {
    private parts: string[] = [];

    private constructor(namespace?: string) {
        if (namespace) {
            const ns = sanitize(namespace);
            if (ns) this.parts.push(ns);
        }
    }

    static create(namespace?: CacheNamespace): CacheKeyBuilder {
        return new CacheKeyBuilder(namespace);
    }

    /** Add organization scope */
    org(orgId: string): this {
        this.parts.push('org', requireId(orgId, 'Organization ID'));
        return this;
    }

    /** Add user scope */
    user(userId: string): this {
        this.parts.push('usr', requireId(userId, 'User ID'));
        return this;
    }

    /** Add app scope */
    app(appId: string): this {
        this.parts.push('app', requireId(appId, 'App ID'));
        return this;
    }

    /** Add version segment (auto-prefixes 'v' if missing) */
    version(v: string | number): this {
        const s = String(v);
        const withPrefix = s.startsWith('v') ? s : `v${s}`;
        this.parts.push(sanitize(withPrefix));
        return this;
    }

    /** Add one or more custom segments */
    segment(...segments: string[]): this {
        for (const s of segments) {
            if (!s) throw new Error('Segment cannot be empty');
            this.parts.push(sanitize(s));
        }
        return this;
    }

    /** Build the final colon-separated cache key. Throws if >512 bytes (KV limit). */
    build(): string {
        if (!this.parts.length) throw new Error('Cache key must have at least one part');
        const key = this.parts.join(':');
        if (new TextEncoder().encode(key).byteLength > MAX_KEY_LENGTH) {
            throw new Error(`Cache key exceeds ${MAX_KEY_LENGTH}-byte KV limit (${key.length} chars)`);
        }
        return key;
    }
}

// ── Helper functions (cover all scope combinations) ─────────

// -- Single scope --

/** Global key (no scope markers). Example: `system:maintenance` */
export function globalKey(namespace: CacheNamespace, ...segments: string[]): string {
    return CacheKeyBuilder.create(namespace)
        .segment(...segments)
        .build();
}

/** Org-scoped key. Example: `brand:org:acme:brandkit` */
export function orgKey(namespace: CacheNamespace, orgId: string, ...segments: string[]): string {
    return CacheKeyBuilder.create(namespace)
        .org(orgId)
        .segment(...segments)
        .build();
}

/** User-scoped key. Example: `session:usr:user-123:active` */
export function userKey(namespace: CacheNamespace, userId: string, ...segments: string[]): string {
    return CacheKeyBuilder.create(namespace)
        .user(userId)
        .segment(...segments)
        .build();
}

/** App-scoped key. Example: `config:app:web:settings` */
export function appKey(namespace: CacheNamespace, appId: string, ...segments: string[]): string {
    return CacheKeyBuilder.create(namespace)
        .app(appId)
        .segment(...segments)
        .build();
}

// -- Double scope --

/** Org+App composite key. Example: `brand:org:acme:app:web:layout` */
export function orgAppKey(namespace: CacheNamespace, orgId: string, appId: string, ...segments: string[]): string {
    return CacheKeyBuilder.create(namespace)
        .org(orgId)
        .app(appId)
        .segment(...segments)
        .build();
}

/** Org+User composite key. Example: `rbac:org:acme:usr:user-123:roles` */
export function orgUserKey(namespace: CacheNamespace, orgId: string, userId: string, ...segments: string[]): string {
    return CacheKeyBuilder.create(namespace)
        .org(orgId)
        .user(userId)
        .segment(...segments)
        .build();
}

/** App+User composite key. Example: `config:app:web:usr:user-123:theme` */
export function appUserKey(namespace: CacheNamespace, appId: string, userId: string, ...segments: string[]): string {
    return CacheKeyBuilder.create(namespace)
        .app(appId)
        .user(userId)
        .segment(...segments)
        .build();
}

// -- Triple scope --

/** Org+App+User composite key. Example: `rbac:org:acme:app:web:usr:user-123:perms` */
export function orgAppUserKey(
    namespace: CacheNamespace,
    orgId: string,
    appId: string,
    userId: string,
    ...segments: string[]
): string {
    return CacheKeyBuilder.create(namespace)
        .org(orgId)
        .app(appId)
        .user(userId)
        .segment(...segments)
        .build();
}

// -- Versioned --

/** Versioned org key for O(1) cache invalidation. Example: `rbac:org:acme:v2:perms` */
export function versionedOrgKey(
    namespace: CacheNamespace,
    orgId: string,
    version: string | number,
    ...segments: string[]
): string {
    return CacheKeyBuilder.create(namespace)
        .org(orgId)
        .version(version)
        .segment(...segments)
        .build();
}

// ── Parse (debugging / monitoring) ──────────────────────────

/** Known scope markers used for parsing */
const SCOPE_MARKERS = new Set(['org', 'usr', 'app']);

/**
 * Parse a cache key to extract its components.
 * Useful for debugging and monitoring — not for production hot paths.
 */
export function parseKey(key: string): {
    namespace?: string;
    scope?: CacheScope;
    orgId?: string;
    userId?: string;
    appId?: string;
    version?: string;
    segments: string[];
} {
    const parts = key.split(':');
    const result: ReturnType<typeof parseKey> = { segments: [] };
    let i = 0;

    // First part is namespace if it's not an exact scope marker or version tag
    if (parts[i] && !SCOPE_MARKERS.has(parts[i]) && !/^v\d+/.test(parts[i])) {
        result.namespace = parts[i];
        i++;
    }

    while (i < parts.length) {
        const part = parts[i];

        if (part === 'org' && parts[i + 1]) {
            result.scope = 'org';
            result.orgId = parts[i + 1];
            i += 2;
        } else if (part === 'usr' && parts[i + 1]) {
            result.scope = 'user';
            result.userId = parts[i + 1];
            i += 2;
        } else if (part === 'app' && parts[i + 1]) {
            result.scope = 'app';
            result.appId = parts[i + 1];
            i += 2;
        } else if (/^v\d+$/.test(part)) {
            result.version = part.substring(1);
            i++;
        } else {
            result.segments.push(part);
            i++;
        }
    }

    return result;
}
