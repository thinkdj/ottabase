// ============================================================
// TOTP (Time-based One-Time Password) - Edge-compatible
// ============================================================
//
// Pure implementation using Web Crypto API (works on Cloudflare Workers).
// Implements RFC 6238 (TOTP) and RFC 4226 (HOTP) with HMAC-SHA1.
//
// ============================================================

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encode a Uint8Array to a Base32 string (RFC 4648)
 */
export function base32Encode(buffer: Uint8Array): string {
    let bits = 0;
    let value = 0;
    let output = '';

    for (const byte of buffer) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }

    if (bits > 0) {
        output += BASE32_CHARS[(value << (5 - bits)) & 31];
    }

    return output;
}

/**
 * Decode a Base32 string to a Uint8Array
 */
export function base32Decode(input: string): Uint8Array {
    const cleaned = input.replace(/[\s=]/g, '').toUpperCase();
    const bytes: number[] = [];
    let bits = 0;
    let value = 0;

    for (const char of cleaned) {
        const idx = BASE32_CHARS.indexOf(char);
        if (idx === -1) {
            throw new Error(`Invalid base32 character: ${char}`);
        }
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }

    return new Uint8Array(bytes);
}

/**
 * Generate a cryptographically random TOTP secret (20 bytes = 160 bits)
 */
export function generateTotpSecret(): string {
    const buffer = crypto.getRandomValues(new Uint8Array(20));
    return base32Encode(buffer);
}

/**
 * Generate an otpauth:// URI for authenticator apps
 */
export function generateTotpUri(secret: string, email: string, issuer: string): string {
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedEmail = encodeURIComponent(email);
    return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generate a TOTP code for the given secret and time step
 */
async function generateHotp(secret: Uint8Array, counter: bigint): Promise<string> {
    // Convert counter to 8-byte big-endian buffer
    const counterBuffer = new ArrayBuffer(8);
    const view = new DataView(counterBuffer);
    view.setBigUint64(0, counter, false);

    // Import key for HMAC-SHA1
    const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);

    // Generate HMAC
    const hmac = await crypto.subtle.sign('HMAC', key, counterBuffer);
    const hmacBytes = new Uint8Array(hmac);

    // Dynamic truncation (RFC 4226 Section 5.3)
    const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;
    const code =
        ((hmacBytes[offset] & 0x7f) << 24) |
        ((hmacBytes[offset + 1] & 0xff) << 16) |
        ((hmacBytes[offset + 2] & 0xff) << 8) |
        (hmacBytes[offset + 3] & 0xff);

    // Return 6-digit code with leading zeros
    return String(code % 1000000).padStart(6, '0');
}

/**
 * Verify a TOTP code against a secret
 *
 * @param secret - Base32-encoded secret
 * @param code - 6-digit TOTP code to verify
 * @param window - Number of time steps to check before/after current (default: 1)
 * @returns true if the code is valid
 */
export async function verifyTotp(secret: string, code: string, window = 1): Promise<boolean> {
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
        return false;
    }

    const secretBytes = base32Decode(secret);
    const timeStep = BigInt(Math.floor(Date.now() / 30000));

    // Check current time step and ±window
    for (let i = -window; i <= window; i++) {
        const step = timeStep + BigInt(i);
        const expected = await generateHotp(secretBytes, step);
        if (timingSafeEqual(code, expected)) {
            return true;
        }
    }

    return false;
}

/**
 * Generate the current TOTP code (useful for testing)
 */
export async function generateTotp(secret: string): Promise<string> {
    const secretBytes = base32Decode(secret);
    const timeStep = BigInt(Math.floor(Date.now() / 30000));
    return generateHotp(secretBytes, timeStep);
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}
