// ============================================================
// @ottabase/utils/hmac-signature: signed outbound requests
// ============================================================
// HMAC-SHA256 over `<timestamp>.<body>`, in a Stripe-shaped header value:
//
//     t=1735689600,v1=<hex>
//
// THE TIMESTAMP IS INSIDE THE SIGNED STRING, not merely alongside it. Signing the body
// alone produces a signature that is valid forever and replayable by anyone who has ever
// seen one request; binding the timestamp lets a receiver reject anything older than its
// own tolerance and have that rejection actually mean something.
//
// One scheme for every request Ottabase signs (@ottabase/webhooks deliveries,
// @ottabase/alerts webhook channels), so a receiver verifies all of them with
// `verifySignatureHeader`.
// ============================================================

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
    return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** A signing secret: 32 bytes of CSPRNG output, hex-encoded, with a recognisable prefix. */
export function generateSigningSecret(prefix = 'whsec_'): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return `${prefix}${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/** The `v1` signature of a body at a timestamp (seconds). */
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

/** The full header value for a body: `t=<seconds>,v1=<hex>`. */
export async function buildSignatureHeader(secret: string, body: string, timestampSeconds: number): Promise<string> {
    return `t=${timestampSeconds},v1=${await signPayload(secret, body, timestampSeconds)}`;
}

/**
 * Verify a signature header: the RECEIVER's half, shipped so nobody re-implements it (and
 * gets the timestamp binding subtly wrong). Compares in constant time and enforces a
 * tolerance window; a verifier without both is a verifier in name only.
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

/** Constant-time comparison of two strings; strings of different lengths are simply unequal. */
export function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return mismatch === 0;
}
