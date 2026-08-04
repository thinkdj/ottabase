// ============================================================
// @ottabase/premium-webhooks — request signing
// ============================================================
// HMAC-SHA256 over `<timestamp>.<body>`, in a Stripe-shaped header:
//
//     X-Ottabase-Signature: t=1735689600,v1=<hex>
//
// THE TIMESTAMP IS INSIDE THE SIGNED STRING, not merely alongside it. Signing the body
// alone produces a signature that is valid forever and replayable by anyone who has ever
// seen one delivery; binding the timestamp lets a receiver reject anything older than
// its own tolerance and have that rejection actually mean something.
// ============================================================

const encoder = new TextEncoder();

/** Header carrying the signature. */
export const SIGNATURE_HEADER = 'X-Ottabase-Signature';
/** Header carrying the event name, so a receiver can route without parsing the body. */
export const EVENT_HEADER = 'X-Ottabase-Event';
/** Header carrying the delivery id, for idempotent receivers. */
export const DELIVERY_HEADER = 'X-Ottabase-Delivery';

function toHex(buffer: ArrayBuffer): string {
    return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Generate a signing secret. 32 bytes of CSPRNG output, hex-encoded, prefixed for recognisability. */
export function generateSigningSecret(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return `whsec_${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/** Compute the `v1` signature for a body at a given timestamp (seconds). */
export async function signPayload(secret: string, body: string, timestampSeconds: number): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret) as unknown as ArrayBuffer,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(`${timestampSeconds}.${body}`) as unknown as ArrayBuffer,
    );
    return toHex(signature);
}

/** Build the full header value for a body. */
export async function buildSignatureHeader(secret: string, body: string, timestampSeconds: number): Promise<string> {
    return `t=${timestampSeconds},v1=${await signPayload(secret, body, timestampSeconds)}`;
}

/**
 * Verify a signature header — the RECEIVER's half, shipped so customers do not have to
 * re-implement it (and get the timestamp binding subtly wrong).
 *
 * Compares in constant time and enforces a tolerance window; a verifier without both is
 * a verifier in name only.
 */
export async function verifySignatureHeader(
    secret: string,
    body: string,
    header: string | null,
    options?: { toleranceSeconds?: number; now?: number },
): Promise<boolean> {
    if (!header) return false;

    const parts = Object.fromEntries(
        header
            .split(',')
            .map((part) => part.trim().split('='))
            .filter((pair): pair is [string, string] => pair.length === 2),
    );
    const timestamp = Number(parts.t);
    const provided = parts.v1;
    if (!Number.isFinite(timestamp) || !provided) return false;

    const now = options?.now ?? Math.floor(Date.now() / 1000);
    const tolerance = options?.toleranceSeconds ?? 300;
    if (Math.abs(now - timestamp) > tolerance) return false;

    return timingSafeEqual(provided, await signPayload(secret, body, timestamp));
}

/** Length-independent constant-time comparison of two hex strings. */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return mismatch === 0;
}
