// ============================================================
// @ottabase/premium/license-tools — VENDOR-SIDE key + license minting
// ============================================================
// Deliberately behind its own subpath. A consuming app never imports this: it only
// ever VERIFIES, and shipping the minting helpers next to the verifier invites the
// one mistake that makes the whole scheme decorative — bundling a private key into
// the app that is supposed to be gated by it.
//
// Keep the private key wherever you keep your release signing material. Anyone
// holding it can mint licenses for your package, forever.
// ============================================================

import type { PremiumLicenseClaims } from '../types';
import { LICENSE_TOKEN_PREFIX, base64UrlToBytes, bytesToBase64Url } from './token';

const encoder = new TextEncoder();

export interface PremiumKeypair {
    /** base64url SPKI — this is the value that goes in the package manifest. */
    publicKey: string;
    /** base64url PKCS8 — vendor secret. Never ship this. */
    privateKey: string;
}

/** Generate an ECDSA P-256 keypair for signing a package's licenses. */
export async function generateLicenseKeypair(): Promise<PremiumKeypair> {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const [spki, pkcs8] = await Promise.all([
        crypto.subtle.exportKey('spki', pair.publicKey),
        crypto.subtle.exportKey('pkcs8', pair.privateKey),
    ]);
    return {
        publicKey: bytesToBase64Url(new Uint8Array(spki)),
        privateKey: bytesToBase64Url(new Uint8Array(pkcs8)),
    };
}

/** Claims a caller supplies; `id` and `iat` are filled in when omitted. */
export type IssueLicenseInput = Omit<PremiumLicenseClaims, 'id' | 'iat'> &
    Partial<Pick<PremiumLicenseClaims, 'id' | 'iat'>>;

/**
 * Mint a license token.
 *
 * `expiresInDays` is the ergonomic path for subscriptions; pass `exp` directly for an
 * exact date, or omit both for a perpetual license.
 */
export async function issueLicense(
    input: IssueLicenseInput,
    privateKeyB64Url: string,
    options?: { expiresInDays?: number; now?: number },
): Promise<string> {
    const now = options?.now ?? Math.floor(Date.now() / 1000);
    const claims: PremiumLicenseClaims = {
        ...input,
        id: input.id ?? `lic_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`,
        iat: input.iat ?? now,
        ...(options?.expiresInDays !== undefined
            ? { exp: now + Math.round(options.expiresInDays * 24 * 60 * 60) }
            : {}),
    };

    const key = await crypto.subtle.importKey(
        'pkcs8',
        base64UrlToBytes(privateKeyB64Url) as unknown as ArrayBuffer,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign'],
    );

    // The signature covers the ENCODED payload segment, not a re-serialized object, so
    // verification never depends on two JSON implementations agreeing on key order.
    const payloadSegment = bytesToBase64Url(encoder.encode(JSON.stringify(claims)));
    const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        encoder.encode(payloadSegment) as unknown as ArrayBuffer,
    );

    return `${LICENSE_TOKEN_PREFIX}.${payloadSegment}.${bytesToBase64Url(new Uint8Array(signature))}`;
}
