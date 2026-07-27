// ============================================================
// @ottabase/ottaai — Envelope encryption (HKDF-SHA-256 → AES-256-GCM)
// ============================================================
// WEB CRYPTO ONLY — no platform crypto import — so the same code runs on
// Workers, modern Node, Deno and browsers, and the root stays dependency-free.
//
// PARAMETERS (frozen-format facts — changing ANY of them makes every stored row
// in every consuming app undecryptable):
//   16-byte salt · 12-byte IV (96-bit, the GCM standard) · 256-bit derived AES
//   key · SHA-256 · ONE constant `info` string.
//
// WHY HKDF, NOT PBKDF2/ARGON2: the master secret is high-entropy and
// machine-generated, not a human password. There is no offline-guessing threat to
// slow down, and decryption sits on the hot path of EVERY AI call, so a
// deliberately slow KDF buys no security and costs latency per request.
// (The premise is enforced — see MIN_MASTER_SECRET_BYTES in keyring.ts.)
//
// WHY AES-GCM: it AUTHENTICATES. A wrong key or tampered ciphertext FAILS rather
// than returning plausible garbage — which matters uniquely here, because the
// garbage would then be transmitted to a third party as an API key.
// ============================================================

import { AI_ERROR_CODES, AiProvisioningError } from '../errors';
import { SecretValue } from '../secret';
import {
    CURRENT_FORMAT_VERSION,
    formatEnvelope,
    fromBase64Url,
    parseEnvelope,
    toBase64Url,
    type ParsedEnvelope,
} from './envelope';
import { createDecryptorRegistry, type DecryptorRegistry, type Keyring } from './keyring';

export * from './envelope';
export * from './keyring';

const SALT_BYTES = 16;
const IV_BYTES = 12;
const AES_BITS = 256;

/**
 * FROZEN INVARIANT #2 — THE HKDF `info` STRING.
 *
 * Namespaces derived keys to this package, so a master secret shared with another feature
 * cannot produce a colliding content key. ONE CONSTANT FOR THE PACKAGE, never per app,
 * and frozen forever. Changing it makes every stored ciphertext undecryptable.
 */
const HKDF_INFO = 'ottabase/ottaai/credential-secret/v1';

/**
 * FROZEN INVARIANT #3a — THE AAD FIELD SEPARATOR.
 *
 * Written as the ESCAPE `\u0000`, never as a literal control character: a literal NUL is
 * invisible in every editor, diff and code review, and one well-meaning "strip weird
 * characters" pass would silently make EVERY stored ciphertext in EVERY consuming app
 * undecryptable — reporting only "wrong key or corrupt data" and pointing nowhere near
 * the cause. The escape IS the documentation. Do not change it. Ever.
 */
const AAD_SEPARATOR = '\u0000';

/** Identity tuple bound into the ciphertext as AAD. */
export interface AadTuple {
    formatVersion: string;
    credentialId: string;
    organizationId: string | null;
    userId: string | null;
    appId: string | null;
    provider: string;
}

/**
 * FROZEN INVARIANT #3 — THE AAD ENCODING.
 *
 *     AAD = UTF-8 bytes of
 *           [formatVersion, credentialId, organizationId, userId, appId, provider]
 *           joined with the NUL character U+0000, `null` encoded as the empty string.
 *
 * Fixed field order, a NUL separator that cannot appear in an id, and an empty-string
 * null encoding are what stop `(orgA, null)` and `(null, orgA)` colliding. NOTHING may be
 * added to the tuple later without a NEW FORMAT VERSION.
 *
 * TRAP PREVENTED: without AAD the blob is portable. A ciphertext lifted from tenant A's
 * row into tenant B's row decrypts perfectly and then authenticates B's inference —
 * billing A and sending B's prompts under A's provider contract. The realistic vectors are
 * mundane: a buggy admin import, a partial backup restore, a bad merge, or anyone with
 * database write access.
 *
 * Consequences that constrain other decisions:
 *  • Row identity becomes IMMUTABLE — cloning a credential to another scope is
 *    decrypt-then-re-encrypt, never a row copy.
 *  • Ids must be generated APPLICATION-SIDE, because a DB-generated id forces
 *    encrypt-after-insert, i.e. a window where the row exists without its ciphertext.
 *  • `provider` is IN THE AAD, so changing provider with a new key re-derives the binding.
 */
export function buildAad(tuple: AadTuple): Uint8Array {
    const parts = [
        tuple.formatVersion,
        tuple.credentialId,
        tuple.organizationId ?? '',
        tuple.userId ?? '',
        tuple.appId ?? '',
        tuple.provider,
    ];
    return new TextEncoder().encode(parts.join(AAD_SEPARATOR));
}

function subtle(): SubtleCrypto {
    const cryptoObj = globalThis.crypto;
    if (!cryptoObj?.subtle) {
        throw new AiProvisioningError(
            'This runtime provides no Web Crypto subtle implementation; credential encryption is impossible.',
            AI_ERROR_CODES.NO_WEB_CRYPTO,
        );
    }
    return cryptoObj.subtle;
}

function randomBytes(length: number): Uint8Array {
    const cryptoObj = globalThis.crypto;
    if (!cryptoObj?.getRandomValues) {
        throw new AiProvisioningError(
            'This runtime provides no Web Crypto getRandomValues; credential encryption is impossible.',
            AI_ERROR_CODES.NO_WEB_CRYPTO,
        );
    }
    return cryptoObj.getRandomValues(new Uint8Array(length));
}

/** HKDF-SHA-256 → a 256-bit AES-GCM content key, per record (fresh salt each write). */
async function deriveContentKey(material: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
    const s = subtle();
    const baseKey = await s.importKey('raw', material as BufferSource, 'HKDF', false, ['deriveKey']);
    return s.deriveKey(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: salt as BufferSource,
            info: new TextEncoder().encode(HKDF_INFO) as BufferSource,
        },
        baseKey,
        { name: 'AES-GCM', length: AES_BITS },
        false,
        ['encrypt', 'decrypt'],
    );
}

/**
 * Wrap a plaintext secret.
 *
 * FRESH RANDOM SALT AND IV PER ENCRYPTION: identical keys produce different ciphertext
 * (no equality leak revealing that two tenants share a key), and the content key is
 * per-record rather than per-master-secret.
 *
 * CONSEQUENCE, decide up front: because salt and IV are fresh per write, the secret
 * column can never carry a uniqueness constraint and can never be indexed. "Is this key
 * already in use?" is unbuildable without a separate keyed fingerprint (an HMAC of the
 * plaintext under the master secret).
 *
 * @param plaintext MUST already be trimmed — the same trimmed string that derives the hint.
 */
export async function encryptSecret(input: {
    plaintext: string;
    keyring: Keyring;
    aad: Omit<AadTuple, 'formatVersion'>;
}): Promise<{ envelope: string; keyId: string; formatVersion: string }> {
    const { plaintext, keyring } = input;

    if (typeof plaintext !== 'string' || plaintext.length === 0) {
        // A write path must NEVER persist an empty secret as an "encrypted" value.
        throw new AiProvisioningError('Refusing to encrypt an empty secret.', AI_ERROR_CODES.VALIDATION);
    }

    const keyId = keyring.currentKeyId;
    const material = keyring.currentMaterial();
    const salt = randomBytes(SALT_BYTES);
    const iv = randomBytes(IV_BYTES);
    const aad = buildAad({ ...input.aad, formatVersion: CURRENT_FORMAT_VERSION });

    const key = await deriveContentKey(material, salt);
    const cipher = new Uint8Array(
        await subtle().encrypt(
            { name: 'AES-GCM', iv: iv as BufferSource, additionalData: aad as BufferSource },
            key,
            new TextEncoder().encode(plaintext) as BufferSource,
        ),
    );

    return {
        envelope: formatEnvelope({
            formatVersion: CURRENT_FORMAT_VERSION,
            keyId,
            saltB64: toBase64Url(salt),
            ivB64: toBase64Url(iv),
            cipherB64: toBase64Url(cipher),
        }),
        keyId,
        formatVersion: CURRENT_FORMAT_VERSION,
    };
}

/** The v1 reader. Registered into the decryptor registry under `'v1'`. */
export const decryptV1: import('./keyring').EnvelopeDecryptor = async ({ envelope, keyring, aad }) => {
    const material = keyring.materialFor(envelope.keyId);
    if (!material) {
        throw new AiProvisioningError(
            `Credential is wrapped with key id "${envelope.keyId}", which this deployment does not hold. ` +
                'Either the wrong master secret is deployed, or the row was written by another app.',
            AI_ERROR_CODES.NO_ENCRYPTION_KEY,
            { details: { keyId: envelope.keyId, formatVersion: envelope.formatVersion } },
        );
    }

    const key = await deriveContentKey(material, fromBase64Url(envelope.saltB64));
    try {
        const plain = await subtle().decrypt(
            {
                name: 'AES-GCM',
                iv: fromBase64Url(envelope.ivB64) as BufferSource,
                additionalData: aad as BufferSource,
            },
            key,
            fromBase64Url(envelope.cipherB64) as BufferSource,
        );
        return new TextDecoder().decode(plain);
    } catch {
        // AES-GCM cannot distinguish a wrong key from tampering — one code covers both.
        throw new AiProvisioningError(
            'Credential decryption failed (wrong master secret, wrong row binding, or tampered data).',
            AI_ERROR_CODES.DECRYPT_FAILED,
            { details: { keyId: envelope.keyId, formatVersion: envelope.formatVersion } },
        );
    }
};

/** The registry every instance starts from. */
export function createDefaultDecryptorRegistry(): DecryptorRegistry {
    return createDecryptorRegistry({ v1: decryptV1 });
}

/**
 * Unwrap a stored envelope into a redacting {@link SecretValue}.
 *
 * Throws `BAD_CIPHERTEXT` (shape/version), `NO_ENCRYPTION_KEY` (key id not held) or
 * `DECRYPT_FAILED` (wrong key / tampering / wrong AAD). The RESOLVER, not this function,
 * decides what a failure means for the request — and its default is fail-closed.
 */
export async function decryptSecret(input: {
    envelope: string;
    keyring: Keyring;
    registry: DecryptorRegistry;
    aad: Omit<AadTuple, 'formatVersion'>;
}): Promise<SecretValue> {
    const parsed: ParsedEnvelope = parseEnvelope(input.envelope);
    const decryptor = input.registry.get(parsed.formatVersion);
    if (!decryptor) {
        throw new AiProvisioningError(
            `No decryptor registered for envelope format "${parsed.formatVersion}".`,
            AI_ERROR_CODES.BAD_CIPHERTEXT,
            { details: { formatVersion: parsed.formatVersion, registered: input.registry.versions() } },
        );
    }
    const aad = buildAad({ ...input.aad, formatVersion: parsed.formatVersion });
    return new SecretValue(await decryptor({ envelope: parsed, keyring: input.keyring, aad }));
}
