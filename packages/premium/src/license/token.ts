// ============================================================
// @ottabase/premium — license token codec + signature verification
// ============================================================
// A license is a compact, OFFLINE-VERIFIABLE token:
//
//     obp1.<base64url(claims JSON)>.<base64url(signature)>
//
// ECDSA P-256 / SHA-256, verified with Web Crypto — the same primitive set the rest
// of the framework uses, so it runs unchanged on Workers, Node and the browser.
//
// WHY OFFLINE: a paid add-on that phones home on the request path adds a network
// dependency to every gate, fails during the vendor's outage, and leaks customer
// traffic patterns to the vendor. A signed token is checked in microseconds, works
// air-gapped, and cannot be forged without the vendor's private key.
//
// WHAT THAT COSTS, stated plainly: an offline token CANNOT BE REVOKED before its
// expiry. Revocation is what expiry is for — vendors selling subscriptions mint
// short-dated tokens and re-issue on renewal. A vendor that needs instant revocation
// needs an online check, which is a different product decision, not a missing feature.
// ============================================================

import type { PremiumLicenseClaims } from '../types';

/** Token prefix. Bumped only if the signed byte string ever changes shape. */
export const LICENSE_TOKEN_PREFIX = 'obp1';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function bytesToBase64Url(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(value: string): Uint8Array {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

/** A structurally valid token, split but not yet verified. */
export interface ParsedLicenseToken {
    /** The exact base64url payload segment — this, not a re-serialized object, is what was signed. */
    payloadSegment: string;
    claims: PremiumLicenseClaims;
    signature: Uint8Array;
}

/**
 * Split and JSON-decode a token WITHOUT verifying it.
 *
 * Returns null for anything malformed. Callers must treat the claims as untrusted
 * until {@link verifyLicenseSignature} has passed — this function exists so the
 * verifier can report "malformed" separately from "bad signature", which is the
 * difference between a typo and an attack in an operator's error message.
 */
export function parseLicenseToken(token: string): ParsedLicenseToken | null {
    const parts = token.trim().split('.');
    if (parts.length !== 3 || parts[0] !== LICENSE_TOKEN_PREFIX) return null;

    const [, payloadSegment, signatureSegment] = parts;
    if (!payloadSegment || !signatureSegment) return null;

    try {
        const claims = JSON.parse(decoder.decode(base64UrlToBytes(payloadSegment))) as PremiumLicenseClaims;
        if (!claims || typeof claims !== 'object') return null;
        if (typeof claims.pkg !== 'string' || !claims.pkg) return null;
        if (typeof claims.id !== 'string' || !claims.id) return null;
        if (typeof claims.iat !== 'number') return null;
        return { payloadSegment, claims, signature: base64UrlToBytes(signatureSegment) };
    } catch {
        return null;
    }
}

/** Import a base64url SPKI public key for verification. */
async function importPublicKey(publicKeyB64Url: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'spki',
        base64UrlToBytes(publicKeyB64Url) as unknown as ArrayBuffer,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
    );
}

/**
 * Verify a parsed token's signature against the vendor's public key.
 *
 * Returns false rather than throwing for EVERY failure mode, including a malformed
 * public key: a package shipped with a corrupt key must fail closed, not crash the
 * request that happened to touch it first.
 */
export async function verifyLicenseSignature(parsed: ParsedLicenseToken, publicKeyB64Url: string): Promise<boolean> {
    try {
        const key = await importPublicKey(publicKeyB64Url);
        return await crypto.subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' },
            key,
            parsed.signature as unknown as ArrayBuffer,
            encoder.encode(parsed.payloadSegment) as unknown as ArrayBuffer,
        );
    } catch {
        return false;
    }
}
