/**
 * Signed draft-preview tokens — Web Crypto HMAC, zero dependencies.
 *
 * The same signer mints post-unlock tokens (see `signUnlockToken` below): a different `purpose`
 * in the signed payload, so neither kind is ever accepted as the other.
 *
 * A preview token lets an author hand a reviewer a link to an UNPUBLISHED post
 * without any account or session. The token binds the post's slug, appId, org
 * scope, and an expiry; the public by-slug handler accepts it as an alternate
 * access path that bypasses ONLY the `status: 'published'` filter — never RLS,
 * never other tenants' content (the org/app scope is inside the signature).
 *
 * Format: base64url(payloadJson) + '.' + base64url(hmacSha256(payloadJson)).
 * Same signing primitive as @ottabase/auth sessions (HS256 over Web Crypto).
 */

export interface PreviewTokenPayload {
    /** Post slug the token grants preview access to. */
    slug: string;
    /** App the slug is scoped to. */
    appId: string;
    /** Org scope (org mode); null = platform-owned content. Omitted in platform mode. */
    organizationId?: string | null;
    /** Unix ms expiry. */
    exp: number;
}

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Uint8Array | null {
    try {
        const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    } catch {
        return null;
    }
}

async function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
    return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

/**
 * A post-unlock token: proof that this reader gave a password-protected post's password. The
 * unlock route returns it; the host checks it on writes that need the post unlocked (a comment).
 */
export interface UnlockTokenPayload {
    purpose: 'unlock';
    /** Post id (not slug: the comment write names the post by id). */
    postId: string;
    appId: string;
    /** The post's own organization; null = platform-owned. */
    organizationId: string | null;
    /** Unix ms expiry. */
    exp: number;
}

/** How long an unlock lasts: a reading session. */
export const UNLOCK_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

async function signPayload(secret: string, payload: object): Promise<string> {
    const payloadJson = JSON.stringify(payload);
    const key = await hmacKey(secret, 'sign');
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payloadJson)));
    return `${base64UrlEncode(encoder.encode(payloadJson))}.${base64UrlEncode(signature)}`;
}

/**
 * The payload of a validly signed, unexpired token, else null. Verification uses
 * crypto.subtle.verify (constant-time comparison inside the platform).
 */
async function verifyPayload(secret: string, token: string): Promise<Record<string, unknown> | null> {
    const dot = token.indexOf('.');
    if (dot <= 0 || dot === token.length - 1) return null;

    const payloadBytes = base64UrlDecode(token.slice(0, dot));
    const signatureBytes = base64UrlDecode(token.slice(dot + 1));
    if (!payloadBytes || !signatureBytes) return null;

    try {
        const key = await hmacKey(secret, 'verify');
        const valid = await crypto.subtle.verify(
            'HMAC',
            key,
            signatureBytes as unknown as ArrayBuffer,
            payloadBytes as unknown as ArrayBuffer,
        );
        if (!valid) return null;

        const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as Record<string, unknown> | null;
        if (!payload || typeof payload !== 'object' || typeof payload.exp !== 'number') return null;
        if (payload.exp <= Date.now()) return null;
        return payload;
    } catch {
        return null;
    }
}

/** Sign a preview token for a post. `ttlMs` defaults to 24 hours. */
export async function signPreviewToken(
    secret: string,
    input: { slug: string; appId: string; organizationId?: string | null; ttlMs?: number },
): Promise<{ token: string; expiresAt: number }> {
    const expiresAt = Date.now() + (input.ttlMs ?? 24 * 60 * 60 * 1000);
    const payload: PreviewTokenPayload = {
        slug: input.slug,
        appId: input.appId,
        exp: expiresAt,
    };
    if (input.organizationId !== undefined) payload.organizationId = input.organizationId;
    return { token: await signPayload(secret, payload), expiresAt };
}

/** Verify a preview token: the payload when it is a valid, unexpired preview token, null otherwise. */
export async function verifyPreviewToken(secret: string, token: string): Promise<PreviewTokenPayload | null> {
    const payload = await verifyPayload(secret, token);
    // A token of any other purpose (an unlock token) is never a preview token.
    if (!payload || payload.purpose !== undefined) return null;
    if (typeof payload.slug !== 'string' || typeof payload.appId !== 'string') return null;
    return payload as unknown as PreviewTokenPayload;
}

/** Sign an unlock token for a post. `ttlMs` defaults to UNLOCK_TOKEN_TTL_MS (2 hours). */
export async function signUnlockToken(
    secret: string,
    input: { postId: string; appId: string; organizationId: string | null; ttlMs?: number },
): Promise<{ token: string; expiresAt: number }> {
    const expiresAt = Date.now() + (input.ttlMs ?? UNLOCK_TOKEN_TTL_MS);
    const payload: UnlockTokenPayload = {
        purpose: 'unlock',
        postId: input.postId,
        appId: input.appId,
        organizationId: input.organizationId,
        exp: expiresAt,
    };
    return { token: await signPayload(secret, payload), expiresAt };
}

/**
 * True when `token` is a valid, unexpired unlock token for exactly this post (id, app and org).
 * A preview token, or an unlock token for another post, is refused.
 */
export async function verifyUnlockToken(
    secret: string,
    token: string,
    post: { postId: string; appId: string; organizationId: string | null },
): Promise<boolean> {
    const payload = await verifyPayload(secret, token);
    return (
        payload?.purpose === 'unlock' &&
        payload.postId === post.postId &&
        payload.appId === post.appId &&
        (payload.organizationId ?? null) === post.organizationId
    );
}
