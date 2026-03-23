// ============================================================
// PBKDF2 password hashing (shared by credentials + backup codes)
// ============================================================

const PBKDF2_PREFIX = 'pbkdf2';
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_HASH_BYTES = 32;

function bufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    for (const byte of buffer) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
        return false;
    }
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a[i] ^ b[i];
    }
    return diff === 0;
}

async function derivePbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);
    const passwordBuffer = Uint8Array.from(passwordBytes).buffer;
    const saltBuffer = Uint8Array.from(salt).buffer;
    const keyMaterial = await crypto.subtle.importKey('raw', passwordBuffer, 'PBKDF2', false, ['deriveBits']);
    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: saltBuffer,
            iterations,
            hash: 'SHA-256',
        },
        keyMaterial,
        PBKDF2_HASH_BYTES * 8,
    );
    return new Uint8Array(derivedBits);
}

/**
 * Password hashing using PBKDF2 (SHA-256)
 * Output format: pbkdf2$iterations$saltBase64$hashBase64
 */
export async function hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
    const derived = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
    return `${PBKDF2_PREFIX}$${PBKDF2_ITERATIONS}$${bufferToBase64(salt)}$${bufferToBase64(derived)}`;
}

/**
 * Verify password against stored hash
 * Supports PBKDF2 format only.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    if (!hash) return false;

    if (hash.startsWith(`${PBKDF2_PREFIX}$`)) {
        const parts = hash.split('$');
        if (parts.length !== 4) return false;

        const iterations = Number(parts[1]);
        if (!Number.isFinite(iterations) || iterations <= 0) return false;

        const salt = base64ToBuffer(parts[2]);
        const expected = base64ToBuffer(parts[3]);
        const derived = await derivePbkdf2(password, salt, iterations);
        return timingSafeEqual(derived, expected);
    }

    return false;
}
