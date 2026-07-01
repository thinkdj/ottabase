// ============================================================
// @ottabase/auth - Compact JWT (HS256 only)
// ============================================================
//
// A minimal, self-verified compact JWT implementation. There is no
// external JWT library and no support for any algorithm other than
// HS256 -- the header is never parsed from the token, it is compared
// byte-for-byte against our own fixed header, which rules out "alg"
// confusion / "none" algorithm attacks by construction.
//
// ============================================================

import { base64UrlDecode, base64UrlEncode, hmacSign, hmacVerify, timingSafeEqualString } from './crypto';

export interface JwtPayload {
    [key: string]: unknown;
    iat?: number;
    exp?: number;
}

const HEADER_JSON = JSON.stringify({ alg: 'HS256', typ: 'JWT' });
const HEADER = base64UrlEncode(new TextEncoder().encode(HEADER_JSON));

export interface SignJwtOptions {
    /** Token lifetime in seconds, used unless `payload.exp` is already set. */
    expiresInSeconds: number;
}

export async function signJwt<T extends JwtPayload>(payload: T, secret: string, options: SignJwtOptions): Promise<string> {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const body: JwtPayload = {
        ...payload,
        iat: payload.iat ?? nowSeconds,
        exp: payload.exp ?? nowSeconds + options.expiresInSeconds,
    };
    const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(body)));
    const signingInput = `${HEADER}.${encodedPayload}`;
    const signature = await hmacSign(signingInput, secret);
    return `${signingInput}.${signature}`;
}

/**
 * Verify and decode a compact JWT signed by `signJwt`.
 *
 * Returns `null` for any structural, signature, or expiry failure. Callers
 * must treat every failure identically (never branch on *why* verification
 * failed) to avoid turning this into a padding-oracle-style side channel.
 */
export async function verifyJwt<T extends JwtPayload = JwtPayload>(token: string, secret: string): Promise<T | null> {
    if (typeof token !== 'string' || token.length === 0) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, signature] = parts;

    // Only our own exact HS256 header is accepted -- there is no "parse the alg and dispatch" step.
    if (!timingSafeEqualString(encodedHeader, HEADER)) return null;

    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const validSignature = await hmacVerify(signingInput, signature, secret);
    if (!validSignature) return null;

    try {
        const json = new TextDecoder().decode(base64UrlDecode(encodedPayload));
        const payload = JSON.parse(json) as T;
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (typeof payload.exp === 'number' && payload.exp < nowSeconds) return null;
        return payload;
    } catch {
        return null;
    }
}
