/**
 * Short-lived HMAC-signed pre-auth tokens used after TOTP/WebAuthn verification
 * to complete Auth.js credentials sign-in without exposing the password again.
 */

/** Minimal env shape (avoids circular imports with backend-handler). */
export interface PreAuthSecretEnv {
    AUTH_SECRET?: string;
}

const PREFIX = 'ob2fa1';
const TTL_SEC = 120;

function getSecretBytes(env: PreAuthSecretEnv): Uint8Array {
    const raw = env.AUTH_SECRET || 'dev-secret-change-in-production';
    const enc = new TextEncoder();
    return enc.encode(raw);
}

function base64UrlEncode(data: Uint8Array): string {
    let s = '';
    for (const b of data) {
        s += String.fromCharCode(b);
    }
    const b64 = btoa(s);
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(s: string): Uint8Array {
    const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        out[i] = bin.charCodeAt(i);
    }
    return out;
}

async function hmacSha256(key: Uint8Array, data: string): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key as BufferSource,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
    return new Uint8Array(sig);
}

function timingSafeEqualStr(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

export interface PreAuthPayload {
    typ: '2fa-ok';
    sub: string;
    email: string;
    exp: number;
}

export async function signPreAuthToken(env: PreAuthSecretEnv, payload: Omit<PreAuthPayload, 'typ'>): Promise<string> {
    const body: PreAuthPayload = {
        typ: '2fa-ok',
        sub: payload.sub,
        email: payload.email.toLowerCase(),
        exp: Math.floor(Date.now() / 1000) + TTL_SEC,
    };
    const json = JSON.stringify(body);
    const payloadB64 = base64UrlEncode(new TextEncoder().encode(json));
    const key = getSecretBytes(env);
    const sig = await hmacSha256(key, payloadB64);
    const sigB64 = base64UrlEncode(sig);
    return `${PREFIX}.${payloadB64}.${sigB64}`;
}

export async function verifyPreAuthToken(token: string, env: PreAuthSecretEnv): Promise<PreAuthPayload | null> {
    if (!token.startsWith(`${PREFIX}.`)) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadB64 = parts[1];
    const sigB64 = parts[2];
    if (!payloadB64 || !sigB64) return null;

    const key = getSecretBytes(env);
    const expectedSig = await hmacSha256(key, payloadB64);
    const gotSig = base64UrlDecode(sigB64);
    if (expectedSig.length !== gotSig.length) return null;
    let diff = 0;
    for (let i = 0; i < expectedSig.length; i++) {
        diff |= expectedSig[i] ^ gotSig[i];
    }
    if (diff !== 0) return null;

    let parsed: PreAuthPayload;
    try {
        parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as PreAuthPayload;
    } catch {
        return null;
    }
    if (parsed.typ !== '2fa-ok' || typeof parsed.sub !== 'string' || typeof parsed.email !== 'string') {
        return null;
    }
    if (typeof parsed.exp !== 'number' || parsed.exp < Math.floor(Date.now() / 1000)) {
        return null;
    }
    return parsed;
}

/** Compare two strings in constant time (length may differ — still best-effort). */
export function timingSafeEqualString(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqualStr(a, b);
}
