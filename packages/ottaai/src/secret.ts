// ============================================================
// @ottabase/ottaai — Secret union + redacting holder + key hint
// ============================================================
// The secret is a UNION WITH A STORED DISCRIMINATOR, not two nullable columns
// resolved by truthiness. Truthiness resolution ships two live bugs:
//   1. an alias-only credential silently keeps the platform's provider key
//      alongside the tenant's alias — two auth mechanisms on one request;
//   2. the UI infers "has a key" from the hint, so an alias-only credential
//      WORKS at call time but reads as keyless and keeps the gate closed.
// ============================================================

import { AI_ERROR_CODES, AiProvisioningError } from './errors';

/** How a credential carries (or does not carry) provider authentication. */
export type SecretKind = 'inline' | 'alias' | 'none';

/**
 * The reconstituted domain shape of the three secret columns
 * (`secretKind`, `secretCiphertext`, `secretAlias`).
 */
export type SecretRef = { kind: 'inline'; ciphertext: string } | { kind: 'alias'; alias: string } | { kind: 'none' };

/** A credential "has a secret" iff its discriminator is not `none`. Never stored; always computed. */
export function hasSecret(ref: SecretRef): boolean {
    return ref.kind !== 'none';
}

// ---------------------------------------------------------------------------
// Redacting holder
// ---------------------------------------------------------------------------

const PLAINTEXT = Symbol('ottaai.secret.plaintext');
const REDACTED = '[redacted:ottaai-secret]';

/**
 * A holder for a decrypted provider secret whose plaintext cannot escape by accident.
 *
 * `JSON.stringify`, template interpolation, `String()`, `console.log` and `util.inspect`
 * all yield `[redacted:ottaai-secret]`. The value is reachable only through the explicit,
 * greppable `.expose()` call — so every place a plaintext key is read is one grep away.
 *
 * A JS string cannot be zeroed, so the mitigation is scope minimisation, not erasure:
 * construct it as late as possible and never store it beyond the request.
 */
export class SecretValue {
    private readonly [PLAINTEXT]: string;

    constructor(plaintext: string) {
        this[PLAINTEXT] = plaintext;
        // Non-enumerable so `{...secret}` / Object.keys / structured logging see nothing.
        Object.defineProperty(this, PLAINTEXT, { enumerable: false, writable: false, configurable: false });
    }

    /** The ONLY way to read the plaintext. Deliberately verbose and greppable. */
    expose(): string {
        return this[PLAINTEXT];
    }

    /** Length of the underlying secret — safe to log, useful for "did we get an empty string?". */
    get length(): number {
        return this[PLAINTEXT].length;
    }

    toString(): string {
        return REDACTED;
    }

    toJSON(): string {
        return REDACTED;
    }

    /** Node's `util.inspect` hook. */
    [Symbol.for('nodejs.util.inspect.custom')](): string {
        return REDACTED;
    }

    get [Symbol.toStringTag](): string {
        return 'SecretValue';
    }
}

/** Type guard — useful at transport boundaries that accept `string | SecretValue`. */
export function isSecretValue(value: unknown): value is SecretValue {
    return value instanceof SecretValue;
}

// ---------------------------------------------------------------------------
// Key hint
// ---------------------------------------------------------------------------

/** The mask used for the display hint. Exactly four bullets — the LENGTH is load-bearing. */
export const KEY_HINT_MASK = '••••';

/**
 * How the display hint is derived for a provider.
 * - `tail`   — last four characters of the trimmed secret (the default)
 * - `none`   — never reveal anything (the mask alone)
 * - `{ path }` — a dot path into a JSON secret document, e.g. `client_email`
 *   (the last four characters of a service-account document are meaningless)
 */
export type HintSource = 'tail' | 'none' | { path: string };

/**
 * Derive the tenant-visible hint from PLAINTEXT, at write time, from the SAME trimmed
 * string that gets encrypted. It cannot be recomputed from ciphertext — a write path
 * that forgets it leaves that row hintless forever.
 *
 * Encoding (a cross-package contract the frontend gate keys off — do NOT normalise
 * the second and third rows together, and do NOT vary the mask width):
 *
 * | value                          | means                                             |
 * | ------------------------------ | ------------------------------------------------- |
 * | `''`                           | no secret                                         |
 * | `'••••'` exactly (4 chars)     | secret set, shorter than 4 chars — nothing shown  |
 * | `'••••' + last4` (8 chars)     | secret set, last four revealed                    |
 */
export function deriveKeyHint(trimmedPlaintext: string, source: HintSource = 'tail'): string {
    if (!trimmedPlaintext) return '';
    if (source === 'none') return KEY_HINT_MASK;

    let material = trimmedPlaintext;
    if (typeof source === 'object') {
        material = readJsonPath(trimmedPlaintext, source.path) ?? '';
        if (!material) return KEY_HINT_MASK;
    }

    if (material.length < 4) return KEY_HINT_MASK;
    return KEY_HINT_MASK + material.slice(-4);
}

/** Best-effort read of a dot path out of a JSON secret document. Never throws. */
function readJsonPath(document: string, path: string): string | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(document);
    } catch {
        return null;
    }
    let cursor: unknown = parsed;
    for (const segment of path.split('.')) {
        if (cursor === null || typeof cursor !== 'object') return null;
        cursor = (cursor as Record<string, unknown>)[segment];
    }
    return typeof cursor === 'string' ? cursor : null;
}

// ---------------------------------------------------------------------------
// Redaction for error / telemetry paths
// ---------------------------------------------------------------------------

/**
 * Strip live secret material out of an arbitrary upstream message before it crosses
 * the package boundary.
 *
 * Provider 4xx bodies and SDK error objects routinely echo the `Authorization` header,
 * the request URL with query parameters, and sometimes the whole serialised request
 * config — so the `ERROR` arm of the taxonomy must not re-open the leak that the
 * resolution return shape closes.
 *
 * @param message   the raw upstream text
 * @param sentinels every secret that was live for this call (platform key, tenant
 *                  plaintext, alias, gateway token). Short values are ignored so a
 *                  1-character secret cannot blank the whole message.
 */
export function redactSecrets(message: string, sentinels: Array<string | SecretValue | null | undefined>): string {
    let output = message;

    for (const sentinel of sentinels) {
        const raw = sentinel instanceof SecretValue ? sentinel.expose() : sentinel;
        if (!raw || raw.length < 8) continue;
        output = output.split(raw).join(REDACTED);
    }

    // Header / query echoes, even when the value is not one of our sentinels (e.g. a
    // gateway-minted token we never held).
    output = output.replace(/\b(authorization|api-key|x-api-key|x-goog-api-key)\b\s*[:=]\s*\S+/gi, '$1: ' + REDACTED);
    output = output.replace(/([?&](?:key|api_key|access_token)=)[^&\s"']+/gi, '$1' + REDACTED);
    output = output.replace(/\bBearer\s+[A-Za-z0-9._~+/-]{8,}=*/g, 'Bearer ' + REDACTED);

    return output;
}

/** Cap for any secret accepted on the write path — stops a multi-megabyte paste reaching D1. */
export const MAX_SECRET_LENGTH = 8192;

/** Validate + normalise a submitted plaintext secret. Throws on the write path by design. */
export function normalizeSubmittedSecret(value: unknown): string {
    if (typeof value !== 'string') {
        throw new AiProvisioningError('Secret must be a string', AI_ERROR_CODES.VALIDATION);
    }
    // Trim once, here. Keys pasted from provider dashboards routinely carry a trailing
    // newline; without this the stored + transmitted key differs from what the user sees,
    // and the hint's last-four does not match what was stored.
    const trimmed = value.trim();
    if (trimmed.length > MAX_SECRET_LENGTH) {
        throw new AiProvisioningError(`Secret exceeds ${MAX_SECRET_LENGTH} characters`, AI_ERROR_CODES.VALIDATION);
    }
    return trimmed;
}
