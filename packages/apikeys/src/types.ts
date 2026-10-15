// ============================================================
// @ottabase/apikeys — API keys for an app's own users
// ============================================================
// Not the operator's provider keys (that is `@ottabase/ottaai`): the keys a customer
// creates to call YOUR API from their own code, their widget embed, their CI. Shown once,
// stored as a hash, scoped, expiring, revocable, verified in one indexed lookup.
// ============================================================

export type Awaitable<T> = T | Promise<T>;

/** Whose key. `organizationId: null` is a personal key; a key may belong to an org with `userId` as its creator. */
export interface Subject {
    appId: string;
    organizationId: string | null;
    userId: string | null;
}

/** What a key is allowed to do. Free-form strings the host defines (`read`, `write`, `events:ingest`). */
export type Scope = string;

export interface ApiKeyView {
    id: string;
    name: string;
    /** The visible head of the key (`ok_live_ab12cd34`), for telling two keys apart. */
    prefix: string;
    scopes: Scope[];
    organizationId: string | null;
    userId: string | null;
    createdBy: string | null;
    lastUsedAt: number | null;
    expiresAt: number | null;
    revokedAt: number | null;
    createdAt: number;
}

export interface IssueInput {
    name: string;
    scopes?: Scope[];
    /** Epoch ms; omit for a key that does not expire. */
    expiresAt?: number | null;
}

export interface IssuedKey {
    /** The plaintext key. Returned ONCE; it is never stored. */
    key: string;
    record: ApiKeyView;
}

export type VerifyFailure = 'MISSING' | 'MALFORMED' | 'NOT_FOUND' | 'REVOKED' | 'EXPIRED' | 'SCOPE';

export type VerifyResult =
    | { ok: true; key: ApiKeyView; subject: Subject }
    | { ok: false; reason: VerifyFailure; key?: ApiKeyView };

export interface ApiKeysOptions<Env = unknown> {
    /** Key prefix, so a leaked key is recognisable in logs and scanners. Default `ok_live_`. */
    prefix?: string;
    /** How often `lastUsedAt` is written back, at most. Default 60s; 0 writes on every use. */
    touchIntervalMs?: number;
    /** Keys per subject. Default 25. */
    maxKeysPerSubject?: number;
    now?: () => number;
    /** For tests: deterministic key material. */
    random?: (bytes: number) => Uint8Array;
    /** Runs after a key verifies, before the request proceeds (a rate limit per key). Return a Response to refuse. */
    afterVerify?: (env: Env, key: ApiKeyView, request: Request) => Awaitable<Response | null>;
}

export interface ApiKeys<Env = unknown> {
    issue(env: Env, subject: Subject, input: IssueInput): Promise<IssuedKey>;
    list(env: Env, subject: Subject): Promise<ApiKeyView[]>;
    revoke(env: Env, subject: Subject, id: string): Promise<ApiKeyView | null>;
    /** Verify a plaintext key. Touches `lastUsedAt` (throttled). Does not check scopes. */
    verify(env: Env, token: string | null | undefined, options?: { scopes?: Scope[] }): Promise<VerifyResult>;
    /** Read the key from `Authorization: Bearer` or `X-Api-Key`, verify it, check scopes. Returns the auth or the 401/403. */
    authenticate(
        request: Request,
        env: Env,
        options?: { scopes?: Scope[] },
    ): Promise<Extract<VerifyResult, { ok: true }> | Response>;
    /** Where a key is read from. Exposed so a host can log which header its customers use. */
    readToken(request: Request): string | null;
}
