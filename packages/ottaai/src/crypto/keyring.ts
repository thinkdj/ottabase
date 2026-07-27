// ============================================================
// @ottabase/ottaai — Keyring + versioned decryptor registry
// ============================================================
// Both ship in v1 because BOTH are unretrofittable:
//
//  • A format version WITHOUT a key id has no slot naming WHICH master secret
//    wrapped a row. You cannot run two secrets concurrently, cannot re-wrap
//    lazily on read, and cannot distinguish an old-secret row from a corrupt
//    one from a foreign one — every failure looks identical, and rotation
//    becomes a flag day or a mass "re-enter your key" email.
//
//  • A reader that hard-rejects any prefix other than the current one makes
//    "a future v2 can be detected and migrated lazily on read" UNACHIEVABLE.
//    Worse: if the is-this-ciphertext sniffer is version-pinned the same way, a
//    v2 row classifies as PLAINTEXT on the next save and gets wrapped twice; the
//    eventual decrypt then returns a ciphertext string that is sent to a provider
//    as an API key.
// ============================================================

import { AI_ERROR_CODES, AiProvisioningError } from '../errors';
import { assertValidKeyId, decodeSecretMaterial, type ParsedEnvelope } from './envelope';

/** Minimum decoded entropy for a master secret, in bytes. */
export const MIN_MASTER_SECRET_BYTES = 32;

export interface KeyringOptions {
    /** key id → master secret (base64/base64url preferred; raw UTF-8 accepted). */
    keys: Record<string, string>;
    /** Which key id NEW writes are wrapped with. Must exist in `keys`. */
    currentKeyId: string;
}

/** The four derived rotation states. DERIVED, never stored — there is no state row to desync. */
export type RotationState = 'single' | 'dual' | 'drain' | 'retire';

export interface Keyring {
    readonly currentKeyId: string;
    /** Ids readable by this ring (writes always use `currentKeyId`). */
    keyIds(): string[];
    /** Raw material for a key id, or null when the ring does not hold it. */
    materialFor(keyId: string): Uint8Array | null;
    /** Material for the write key. */
    currentMaterial(): Uint8Array;
    has(keyId: string): boolean;
}

/**
 * FROZEN INVARIANT #1 — THE MASTER-SECRET TRIM.
 *
 * Normalise (trim surrounding whitespace) at EXACTLY THIS ONE PLACE, applied identically
 * to a configured secret and to any explicitly passed override.
 *
 * The visible reason: secrets pasted into secret stores routinely carry a trailing
 * newline, and without trimming the same secret encrypts and decrypts as two different keys.
 *
 * The invisible and far more expensive reason is the reverse: because the TRIMMED STRING
 * IS THE HKDF INPUT, a later cosmetic cleanup that removes the trim makes EVERY STORED
 * CIPHERTEXT IN EVERY CONSUMING APP UNDECRYPTABLE, reporting only "wrong key or corrupt
 * data" and pointing nowhere near the cause.
 *
 * DO NOT REMOVE. DO NOT "NORMALISE" FURTHER. DO NOT MOVE.
 */
export function normalizeMasterSecret(secret: string): string {
    return secret.trim();
}

/**
 * Build a keyring.
 *
 * Rejects at composition any master secret below {@link MIN_MASTER_SECRET_BYTES} of decoded
 * material. THE PREMISE OF CHOOSING HKDF OVER PBKDF2 IS THAT THE SECRET IS HIGH-ENTROPY AND
 * MACHINE-GENERATED — HKDF-Extract over a weak secret is one hash, so an operator who sets a
 * project name or a reused password turns one stolen database backup into an offline break of
 * every tenant's key at commodity GPU rates with no iteration cost. A future reader who
 * relaxes this length check has silently downgraded the cipher.
 *
 * Generate with a CSPRNG, never type one:
 *   `openssl rand -base64 48`
 */
export function createKeyring(options: KeyringOptions): Keyring {
    const material = new Map<string, Uint8Array>();

    const ids = Object.keys(options.keys);
    if (ids.length === 0) {
        throw new AiProvisioningError(
            'The AI credential keyring is empty. Provide at least one master secret.',
            AI_ERROR_CODES.NO_ENCRYPTION_KEY,
        );
    }

    for (const keyId of ids) {
        assertValidKeyId(keyId);
        const normalized = normalizeMasterSecret(options.keys[keyId] ?? '');
        if (!normalized) {
            throw new AiProvisioningError(
                `Master secret for key id "${keyId}" is empty.`,
                AI_ERROR_CODES.NO_ENCRYPTION_KEY,
            );
        }
        const bytes = decodeSecretMaterial(normalized);
        if (bytes.length < MIN_MASTER_SECRET_BYTES) {
            throw new AiProvisioningError(
                `Master secret for key id "${keyId}" carries ${bytes.length} bytes of material; ` +
                    `at least ${MIN_MASTER_SECRET_BYTES} are required. Generate one with a CSPRNG ` +
                    '(`openssl rand -base64 48`) — never type one.',
                AI_ERROR_CODES.CONFIGURATION,
            );
        }
        material.set(keyId, bytes);
    }

    if (!material.has(options.currentKeyId)) {
        throw new AiProvisioningError(
            `currentKeyId "${options.currentKeyId}" is not present in the keyring (have: ${ids.join(', ')}).`,
            AI_ERROR_CODES.CONFIGURATION,
        );
    }

    return {
        currentKeyId: options.currentKeyId,
        keyIds: () => [...material.keys()],
        materialFor: (keyId) => material.get(keyId) ?? null,
        currentMaterial: () => material.get(options.currentKeyId)!,
        has: (keyId) => material.has(keyId),
    };
}

/**
 * Derive the rotation state from the ring's shape. There is no stored state, so it
 * cannot drift from reality.
 *
 *   single → dual  (new secret added, old still primary, both readable)
 *          → drain (new secret primary, background re-wrap running, old still readable)
 *          → retire(old removed — PERMITTED ONLY at a zero-rows envelope scan)
 */
export function rotationState(keyring: Keyring, previousKeyId?: string | null): RotationState {
    const ids = keyring.keyIds();
    if (ids.length === 1) return 'single';
    if (!previousKeyId) return 'dual';
    if (!keyring.has(previousKeyId)) return 'retire';
    return keyring.currentKeyId === previousKeyId ? 'dual' : 'drain';
}

// ---------------------------------------------------------------------------
// Decryptor registry
// ---------------------------------------------------------------------------

/** A reader for ONE envelope format version. */
export type EnvelopeDecryptor = (input: {
    envelope: ParsedEnvelope;
    keyring: Keyring;
    /** Additional authenticated data bound to the row (see `buildAad`). */
    aad: Uint8Array;
}) => Promise<string>;

export interface DecryptorRegistry {
    register(formatVersion: string, decryptor: EnvelopeDecryptor): void;
    get(formatVersion: string): EnvelopeDecryptor | undefined;
    versions(): string[];
}

export function createDecryptorRegistry(initial?: Record<string, EnvelopeDecryptor>): DecryptorRegistry {
    const decryptors = new Map<string, EnvelopeDecryptor>(Object.entries(initial ?? {}));
    return {
        register: (formatVersion, decryptor) => {
            decryptors.set(formatVersion, decryptor);
        },
        get: (formatVersion) => decryptors.get(formatVersion),
        versions: () => [...decryptors.keys()],
    };
}

/**
 * DECLARED, NOT IMPLEMENTED — the seam a future network KMS plugs into.
 *
 * If key material ever moves behind a network service, cache the DERIVED key and never
 * the plaintext master secret, keyed by `(instance, keyId, record id)`. A derived-key
 * cache shared across instances in one isolate re-creates the per-request-setter bleed
 * one layer down.
 */
export interface KeyProvider {
    materialFor(keyId: string): Promise<Uint8Array | null>;
}
