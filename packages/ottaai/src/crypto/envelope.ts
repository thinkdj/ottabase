// ============================================================
// @ottabase/ottaai — Ciphertext envelope: format, parse, sniff
// ============================================================
// FORMAT (five dot-joined segments):
//
//     <formatVersion>.<keyId>.<saltB64url>.<ivB64url>.<cipherB64url>
//
// base64url avoids the charset papercuts plain base64's `+ / =` cause in text
// columns and JSON, so the whole envelope is one opaque text column.
//
// The DECRYPTOR REGISTRY keys on segment 0 only; the KEYRING lookup keys on
// segment 1. Keeping them separate is what lets a rotation (new key id) and a
// format migration (new version) proceed independently — and versions may
// legitimately differ in ARITY, which is why arity is checked per registered
// version rather than globally.
// ============================================================

import { AI_ERROR_CODES, AiProvisioningError } from '../errors';

/** The format version this package WRITES. Frozen for the life of the major. */
export const CURRENT_FORMAT_VERSION = 'v1';

/** Segment count for each known format version. Checked BEFORE any crypto runs. */
export const FORMAT_ARITY: Record<string, number> = {
    v1: 5,
};

export interface ParsedEnvelope {
    formatVersion: string;
    keyId: string;
    saltB64: string;
    ivB64: string;
    cipherB64: string;
}

const BASE64URL = /^[A-Za-z0-9_-]+$/;
/** A key id must never contain the segment separator, and must stay greppable in logs. */
const KEY_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** Validate a key id at composition time so a bad one can never reach an envelope. */
export function assertValidKeyId(keyId: string): void {
    if (!KEY_ID.test(keyId)) {
        throw new AiProvisioningError(
            `Invalid encryption key id "${keyId}". Use 1-64 characters of [A-Za-z0-9_-], starting alphanumeric; ` +
                'a dot would collide with the envelope separator.',
            AI_ERROR_CODES.CONFIGURATION,
        );
    }
}

/**
 * THE CIPHERTEXT SNIFFER — a security control, not a convenience.
 *
 * A FALSE POSITIVE here stores a plaintext provider key unencrypted: the worst failure in
 * the system, with no error anywhere. So verify the version prefix, the segment count FOR
 * THAT VERSION, and that every trailing segment is non-empty base64url.
 *
 * Use this ONE implementation for the write path and for any import/migration tooling.
 * Two divergent implementations is a latent plaintext leak.
 *
 * DELETE THE PREMISE, KEEP THE CHECK: do not reason "real provider keys contain no dots,
 * so they always read as plaintext". JWT-style and structured credentials do contain dots,
 * and the space of formats only grows. The strict check makes the premise unnecessary; a
 * reader who trusts the premise relaxes the check.
 */
export function isEnvelope(value: string): boolean {
    return parseEnvelopeOrNull(value) !== null;
}

/** Parse an envelope, or return null when the value is not one (i.e. treat it as plaintext). */
export function parseEnvelopeOrNull(value: string): ParsedEnvelope | null {
    if (typeof value !== 'string' || value.length === 0) return null;

    const segments = value.split('.');
    const formatVersion = segments[0];
    if (!formatVersion) return null;

    const arity = FORMAT_ARITY[formatVersion];
    if (arity === undefined || segments.length !== arity) return null;

    const [, keyId, saltB64, ivB64, cipherB64] = segments;
    if (!keyId || !KEY_ID.test(keyId)) return null;
    for (const segment of [saltB64, ivB64, cipherB64]) {
        if (!segment || !BASE64URL.test(segment)) return null;
    }

    return { formatVersion, keyId: keyId!, saltB64: saltB64!, ivB64: ivB64!, cipherB64: cipherB64! };
}

/**
 * Parse an envelope, throwing `BAD_CIPHERTEXT` when the shape or version is unusable.
 *
 * Distinguishing this from `DECRYPT_FAILED` is operationally load-bearing:
 *   • EVERY row failing decrypt  ⇒ the wrong master secret is deployed.
 *   • ONE row failing bad-ciphertext ⇒ foreign or corrupt data.
 * Collapsing them costs hours during an incident.
 */
export function parseEnvelope(value: string): ParsedEnvelope {
    const parsed = parseEnvelopeOrNull(value);
    if (!parsed) {
        const version = typeof value === 'string' ? value.split('.')[0] : '(non-string)';
        throw new AiProvisioningError(
            `Unreadable credential envelope (version "${version}"). Expected ` +
                `<version>.<keyId>.<salt>.<iv>.<cipher>; no registered format matches.`,
            AI_ERROR_CODES.BAD_CIPHERTEXT,
            { details: { formatVersion: version } },
        );
    }
    return parsed;
}

export function formatEnvelope(parts: ParsedEnvelope): string {
    return [parts.formatVersion, parts.keyId, parts.saltB64, parts.ivB64, parts.cipherB64].join('.');
}

// ---------------------------------------------------------------------------
// base64url helpers (no padding, URL-safe)
// ---------------------------------------------------------------------------

export function toBase64Url(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(value: string): Uint8Array {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

/** Decode a base64/base64url master secret, or treat it as raw UTF-8 when it is not base64. */
export function decodeSecretMaterial(secret: string): Uint8Array {
    const candidate = secret.replace(/-/g, '+').replace(/_/g, '/');
    if (/^[A-Za-z0-9+/]+=*$/.test(candidate) && candidate.length % 4 !== 1) {
        try {
            const binary = atob(candidate + '='.repeat((4 - (candidate.length % 4)) % 4));
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            // Only accept the base64 reading when it actually yields enough entropy;
            // a short alnum passphrase would otherwise decode to a tiny buffer.
            if (bytes.length >= 32) return bytes;
        } catch {
            // fall through to UTF-8
        }
    }
    return new TextEncoder().encode(secret);
}
