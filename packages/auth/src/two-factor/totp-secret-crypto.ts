/**
 * Encrypt TOTP shared secrets at rest (AES-256-GCM) using a key derived from AUTH_SECRET.
 */

import type { PreAuthSecretEnv } from './pre-auth-token';

const SALT = new TextEncoder().encode('ottabase-totp-v1');

async function deriveAesKey(env: PreAuthSecretEnv): Promise<CryptoKey> {
    const raw = env.AUTH_SECRET || 'dev-secret-change-in-production';
    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(raw), 'PBKDF2', false, [
        'deriveKey',
    ]);
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: SALT,
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
    );
}

function toB64(iv: Uint8Array, ct: Uint8Array): string {
    const merged = new Uint8Array(iv.length + ct.length);
    merged.set(iv, 0);
    merged.set(ct, iv.length);
    let s = '';
    for (const b of merged) {
        s += String.fromCharCode(b);
    }
    return btoa(s);
}

function fromB64(s: string): { iv: Uint8Array; ct: Uint8Array } {
    const bin = atob(s);
    const all = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        all[i] = bin.charCodeAt(i);
    }
    const iv = all.slice(0, 12);
    const ct = all.slice(12);
    return { iv, ct };
}

export async function encryptTotpSecret(env: PreAuthSecretEnv, plainBase32: string): Promise<string> {
    const key = await deriveAesKey(env);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        key,
        new TextEncoder().encode(plainBase32),
    );
    return toB64(iv, new Uint8Array(enc));
}

export async function decryptTotpSecret(env: PreAuthSecretEnv, stored: string): Promise<string | null> {
    try {
        const key = await deriveAesKey(env);
        const { iv, ct } = fromB64(stored);
        const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ct as BufferSource);
        return new TextDecoder().decode(dec);
    } catch {
        return null;
    }
}
