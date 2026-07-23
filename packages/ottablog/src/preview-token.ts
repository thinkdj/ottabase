/**
 * Signed draft-preview tokens — Web Crypto HMAC, zero dependencies.
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

async function hmacKey(secret: string, usage: KeyUsage): Promise<CryptoKey> {
    return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
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

    const payloadJson = JSON.stringify(payload);
    const key = await hmacKey(secret, 'sign');
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payloadJson)));

    return {
        token: `${base64UrlEncode(encoder.encode(payloadJson))}.${base64UrlEncode(signature)}`,
        expiresAt,
    };
}

/**
 * Verify a preview token. Returns the payload when the signature is valid and
 * the token is unexpired, null otherwise. Verification uses crypto.subtle.verify
 * (constant-time comparison inside the platform).
 */
export async function verifyPreviewToken(secret: string, token: string): Promise<PreviewTokenPayload | null> {
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

        const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as PreviewTokenPayload;
        if (
            typeof payload?.slug !== 'string' ||
            typeof payload?.appId !== 'string' ||
            typeof payload?.exp !== 'number'
        ) {
            return null;
        }
        if (payload.exp <= Date.now()) return null;
        return payload;
    } catch {
        return null;
    }
}
