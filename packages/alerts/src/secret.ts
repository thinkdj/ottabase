// ============================================================
// @ottabase/alerts: channel secrets at rest
// ============================================================
// A Slack webhook URL, a Telegram bot token or a PagerDuty routing key is a credential:
// whoever holds it posts to your team. They are sealed before they reach D1, so a backup
// in R2, a CSV export or a glance at the SQL console shows ciphertext.
//
// AES-GCM-256 with a fresh 96-bit IV per seal; the key is HKDF-SHA-256 over the configured
// secret (trimmed: a pasted secret with a trailing newline must stay the same key).
// Envelope: `v1.<iv>.<ciphertext>`, base64url.
//
// ponytail: one key, no rotation. Changing the secret leaves stored channels unreadable;
// the console says so per channel and the target is entered again. A keyring (as in
// @ottabase/ottaai) if channel counts ever make that painful.
// ============================================================

const VERSION = 'v1';
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const keys = new Map<string, Promise<CryptoKey>>();

/** The configured secret is missing or too short to derive a key from. */
export class AlertsSecretError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AlertsSecretError';
    }
}

function toBase64Url(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function keyFor(secret: string | null | undefined): Promise<CryptoKey> {
    const material = secret?.trim() ?? '';
    if (material.length < 16) {
        throw new AlertsSecretError(
            'No usable secret to seal channel targets with (set ALERTS_SECRET or AUTH_SECRET).',
        );
    }
    let key = keys.get(material);
    if (!key) {
        key = (async () => {
            const base = await crypto.subtle.importKey(
                'raw',
                encoder.encode(material) as unknown as ArrayBuffer,
                'HKDF',
                false,
                ['deriveKey'],
            );
            return crypto.subtle.deriveKey(
                {
                    name: 'HKDF',
                    hash: 'SHA-256',
                    salt: encoder.encode('ottabase-alerts') as unknown as ArrayBuffer,
                    info: encoder.encode('channel-secrets v1') as unknown as ArrayBuffer,
                },
                base,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt'],
            );
        })();
        keys.set(material, key);
    }
    return key;
}

/** Seal a value. Throws {@link AlertsSecretError} when there is no usable secret. */
export async function seal(secret: string | null | undefined, plaintext: string): Promise<string> {
    const key = await keyFor(secret);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(plaintext) as unknown as ArrayBuffer,
    );
    return `${VERSION}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
}

/** Open a sealed value; null when it does not open (another secret, or not an envelope). */
export async function open(
    secret: string | null | undefined,
    sealed: string | null | undefined,
): Promise<string | null> {
    if (!sealed) return null;
    const [version, iv, ciphertext] = sealed.split('.');
    if (version !== VERSION || !iv || !ciphertext) return null;
    try {
        const key = await keyFor(secret);
        const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: fromBase64Url(iv) as unknown as ArrayBuffer },
            key,
            fromBase64Url(ciphertext) as unknown as ArrayBuffer,
        );
        return decoder.decode(plaintext);
    } catch {
        return null;
    }
}
