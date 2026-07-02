// ============================================================
// @ottabase/auth - Cryptographic Primitives
// ============================================================
//
// Every primitive here runs on the Web Crypto API (crypto.subtle),
// which Cloudflare Workers implements natively. No Node.js crypto,
// no native bindings, no third-party crypto dependency.
//
// ============================================================

const PBKDF2_PREFIX = 'pbkdf2';
// Cloudflare Workers caps PBKDF2 at 100k iterations; OWASP's floor for PBKDF2-SHA256 is 100k too.
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_HASH_BYTES = 32;

/** A byte buffer backed by a concrete (non-shared) ArrayBuffer -- what WebCrypto's BufferSource requires. */
type Bytes = Uint8Array<ArrayBuffer>;

export function bufferToBase64(buffer: Bytes): string {
    let binary = '';
    for (const byte of buffer) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

export function base64ToBuffer(base64: string): Bytes {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

export function base64UrlEncode(bytes: Bytes): string {
    return bufferToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(value: string): Bytes {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const paddingNeeded = (4 - (normalized.length % 4)) % 4;
    return base64ToBuffer(normalized + '='.repeat(paddingNeeded));
}

/** Constant-time byte comparison. Always walks the full (equal) length to avoid early-exit timing leaks. */
export function timingSafeEqual(a: Bytes, b: Bytes): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a[i] ^ b[i];
    }
    return diff === 0;
}

export function timingSafeEqualString(a: string, b: string): boolean {
    const encoder = new TextEncoder();
    return timingSafeEqual(encoder.encode(a), encoder.encode(b));
}

export function randomBytes(length: number): Bytes {
    return crypto.getRandomValues(new Uint8Array(length));
}

/** URL-safe random token (verification tokens, OAuth state/PKCE verifiers, session ids). */
export function randomToken(byteLength = 32): string {
    return base64UrlEncode(randomBytes(byteLength));
}

async function derivePbkdf2(password: string, salt: Bytes, iterations: number): Promise<Bytes> {
    const passwordBytes = new TextEncoder().encode(password);
    const keyMaterial = await crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveBits']);
    const derivedBits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        keyMaterial,
        PBKDF2_HASH_BYTES * 8,
    );
    return new Uint8Array(derivedBits);
}

/**
 * Hash a password with PBKDF2-SHA256.
 * Output format: `pbkdf2$iterations$saltBase64$hashBase64`
 */
export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(PBKDF2_SALT_BYTES);
    const derived = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
    return `${PBKDF2_PREFIX}$${PBKDF2_ITERATIONS}$${bufferToBase64(salt)}$${bufferToBase64(derived)}`;
}

/**
 * Verify a password against a stored PBKDF2 hash using a constant-time comparison.
 *
 * Returns `false` (never throws) for any malformed/corrupt/unsupported hash: a single
 * bad row must degrade to a clean auth failure, not an uncaught 500. Iteration counts
 * are clamped to a sane range so an out-of-range value can't make `deriveBits` throw
 * (Cloudflare Workers hard-caps PBKDF2 at 100k).
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
        if (!hash || !hash.startsWith(`${PBKDF2_PREFIX}$`)) return false;

        const parts = hash.split('$');
        if (parts.length !== 4) return false;

        const iterations = Number(parts[1]);
        if (!Number.isInteger(iterations) || iterations < 1 || iterations > PBKDF2_ITERATIONS) return false;

        const salt = base64ToBuffer(parts[2]);
        const expected = base64ToBuffer(parts[3]);
        if (salt.length === 0 || expected.length === 0) return false;

        const derived = await derivePbkdf2(password, salt, iterations);
        return timingSafeEqual(derived, expected);
    } catch {
        return false;
    }
}

/**
 * A cached, valid dummy password hash used to equalize timing on the "user/hash not
 * found" credential path. Verifying a submitted password against this (always-failing)
 * hash makes the unknown-account path cost the same PBKDF2 derive as the known-account
 * path, closing the user-enumeration timing oracle. Computed once per isolate.
 */
let dummyPasswordHashPromise: Promise<string> | null = null;
export function getDummyPasswordHash(): Promise<string> {
    if (!dummyPasswordHashPromise) {
        dummyPasswordHashPromise = hashPassword('ottabase::timing-equalization::do-not-use');
    }
    return dummyPasswordHashPromise;
}

/**
 * Hash a single-use verification token for storage at rest (SHA-256, base64url).
 * The plaintext token is only ever put in the emailed link; the database stores the
 * hash, so a database read leak cannot be replayed to mint sessions or reset passwords.
 * SHA-256 is appropriate here (tokens are high-entropy random, unlike passwords).
 */
export async function hashToken(token: string): Promise<string> {
    return sha256Base64Url(token);
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
        'sign',
        'verify',
    ]);
}

/** HMAC-SHA256 over a string, base64url-encoded. */
export async function hmacSign(data: string, secret: string): Promise<string> {
    const key = await importHmacKey(secret);
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    return base64UrlEncode(new Uint8Array(signature));
}

/** Verify an HMAC-SHA256 signature. `crypto.subtle.verify` performs the comparison in constant time. */
export async function hmacVerify(data: string, signature: string, secret: string): Promise<boolean> {
    try {
        const key = await importHmacKey(secret);
        const signatureBytes = base64UrlDecode(signature);
        return await crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(data));
    } catch {
        return false;
    }
}

/** SHA-256 digest, base64url-encoded (used for PKCE code_challenge). */
export async function sha256Base64Url(data: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return base64UrlEncode(new Uint8Array(digest));
}
