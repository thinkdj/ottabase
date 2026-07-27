// ============================================================
// @ottabase/ottaai — Error class + shared error taxonomy
// ============================================================
// ONE taxonomy, used on BOTH paths: verify-a-key (pre-save) and runtime
// inference classification. Confining classification to pre-save validation
// makes "selection, not cascade" (see resolver/resolve.ts) degrade into an
// opaque failure the tenant cannot act on.
// ============================================================

/**
 * Stable, machine-readable failure codes.
 *
 * These are PUBLIC API — a UI branches on the code, never on the message.
 * Renaming one is a breaking change.
 */
export const AI_ERROR_CODES = {
    /** The provider rejected this API key (upstream 401/403). */
    INVALID_KEY: 'INVALID_KEY',
    /** Provider could not find that model (upstream 404). */
    MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
    /** The KEY WORKS; the provider is throttling right now (upstream 429). */
    RATE_LIMITED: 'RATE_LIMITED',
    /** The request timed out or was aborted. */
    TIMEOUT: 'TIMEOUT',
    /** AI is not fully configured (no usable credential at ANY tier). */
    NOT_CONFIGURED: 'NOT_CONFIGURED',
    /** The selected transport intentionally has no verified implementation for this operation. */
    UNSUPPORTED_OPERATION: 'UNSUPPORTED_OPERATION',
    /** A credential row EXISTS but could not be decrypted/used — re-enter it. */
    CREDENTIAL_UNREADABLE: 'CREDENTIAL_UNREADABLE',
    /** This task requires the tenant's own key (`gate: 'required'`). */
    BYOK_REQUIRED: 'BYOK_REQUIRED',
    /** Caller is not permitted to perform this credential operation. */
    FORBIDDEN: 'FORBIDDEN',
    /** Verification budget exhausted for this actor. */
    VERIFY_RATE_LIMITED: 'VERIFY_RATE_LIMITED',
    /** Write-path validation failure (bad provider, bad model ref, blank secret, …). */
    VALIDATION: 'VALIDATION',
    /** Composition / boot misconfiguration a developer must fix. */
    CONFIGURATION: 'CONFIGURATION',
    /** Crypto: envelope shape or version is unreadable BEFORE any crypto runs. */
    BAD_CIPHERTEXT: 'BAD_CIPHERTEXT',
    /** Crypto: wrong key OR tampering — AES-GCM cannot distinguish the two. */
    DECRYPT_FAILED: 'DECRYPT_FAILED',
    /** Crypto: no keyring / no primary secret registered. */
    NO_ENCRYPTION_KEY: 'NO_ENCRYPTION_KEY',
    /** Crypto: the runtime exposes no Web Crypto subtle implementation. */
    NO_WEB_CRYPTO: 'NO_WEB_CRYPTO',
    /** Anything else — message is REDACTED passthrough. */
    ERROR: 'ERROR',
} as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[keyof typeof AI_ERROR_CODES];

/**
 * The package's single error type. Exported as a VALUE so consumers can `instanceof` it.
 *
 * Thrown only at the two tiers where throwing is correct (see §2.7 of the design record):
 *  - boot/composition — misconfiguration a developer must fix
 *  - write path — crypto and validation, because a `Result` can be ignored and the write
 *    would then proceed with plaintext
 *
 * Everywhere else (`resolve`, `verify`, transport) returns values; absence of a client is the signal.
 */
export class AiProvisioningError extends Error {
    readonly code: AiErrorCode;
    readonly statusCode?: number;
    readonly provider?: string;
    readonly details?: Record<string, unknown>;

    constructor(
        message: string,
        code: AiErrorCode,
        options?: { statusCode?: number; provider?: string; details?: Record<string, unknown>; cause?: unknown },
    ) {
        super(message);
        this.name = 'AiProvisioningError';
        this.code = code;
        this.statusCode = options?.statusCode;
        this.provider = options?.provider;
        this.details = options?.details;
        if (options?.cause !== undefined) {
            (this as { cause?: unknown }).cause = options.cause;
        }
    }
}

/** HTTP status suggested for each taxonomy code when an app maps a result onto a response. */
export const AI_ERROR_HTTP_STATUS: Record<AiErrorCode, number> = {
    INVALID_KEY: 400,
    MODEL_NOT_FOUND: 400,
    RATE_LIMITED: 429,
    TIMEOUT: 504,
    NOT_CONFIGURED: 501,
    UNSUPPORTED_OPERATION: 501,
    CREDENTIAL_UNREADABLE: 409,
    BYOK_REQUIRED: 402,
    FORBIDDEN: 403,
    VERIFY_RATE_LIMITED: 429,
    VALIDATION: 422,
    CONFIGURATION: 500,
    BAD_CIPHERTEXT: 500,
    DECRYPT_FAILED: 500,
    NO_ENCRYPTION_KEY: 500,
    NO_WEB_CRYPTO: 500,
    ERROR: 502,
};

/**
 * Default, tenant-facing copy per code. Apps may override; the point is that every
 * consuming app does NOT re-invent a subtly different sentence for the same condition.
 *
 * Note `RATE_LIMITED`: the key is VALID. A UI branching on an ok/not-ok boolean rather than
 * the code tells the user their working key is broken.
 */
export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
    INVALID_KEY: 'The provider rejected this API key.',
    MODEL_NOT_FOUND: 'The provider could not find that model — check the model name.',
    RATE_LIMITED: 'Your key works, but the provider is rate-limiting right now. Try again shortly.',
    TIMEOUT: 'The request to the provider timed out.',
    NOT_CONFIGURED: 'AI is not configured. Connect a provider to enable this feature.',
    UNSUPPORTED_OPERATION: 'This AI provider does not support this operation on this deployment.',
    CREDENTIAL_UNREADABLE: 'Your saved key could not be used. Please re-enter it.',
    BYOK_REQUIRED: 'This feature runs on your own provider key. Connect a provider to continue.',
    FORBIDDEN: 'You do not have permission to manage this AI provider connection.',
    VERIFY_RATE_LIMITED: 'Too many key tests. Wait a moment before testing again.',
    VALIDATION: 'The provider connection could not be saved.',
    CONFIGURATION: 'AI is misconfigured on this deployment.',
    BAD_CIPHERTEXT: 'The stored credential is unreadable.',
    DECRYPT_FAILED: 'The stored credential could not be decrypted.',
    NO_ENCRYPTION_KEY: 'Credential encryption is not configured on this deployment.',
    NO_WEB_CRYPTO: 'This runtime does not provide Web Crypto.',
    ERROR: 'The provider request failed.',
};

/**
 * Classify an upstream HTTP status into the shared taxonomy.
 * Used identically by verify-a-key and by the instrumented client at inference time.
 */
export function classifyUpstreamStatus(status: number | undefined): AiErrorCode {
    if (status === 401 || status === 403) return AI_ERROR_CODES.INVALID_KEY;
    if (status === 404) return AI_ERROR_CODES.MODEL_NOT_FOUND;
    if (status === 429) return AI_ERROR_CODES.RATE_LIMITED;
    return AI_ERROR_CODES.ERROR;
}

/** True when the error is an abort/timeout rather than a provider verdict. */
export function isAbortError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const name = (error as { name?: unknown }).name;
    return name === 'AbortError' || name === 'TimeoutError';
}
