/**
 * Standardized API error response from the server.
 * All API endpoints should return errors in this format.
 */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface ApiErrorResponse {
    /** Primary error message */
    error: string;
    /** Error code for programmatic handling (e.g., "UNAUTHORIZED", "RATE_LIMITED") */
    code?: string;
    /** Human-readable context. Keep machine-readable values in metadata. */
    details?: string;
    /** Actionable suggestion for fixing the error */
    hint?: string;
    /** Multiple error messages (e.g., validation errors) */
    messages?: string[];
    /** Field-specific errors for form validation */
    fieldErrors?: Record<string, string[]>;
    /** Safe, machine-readable context for client-side conflict handling. */
    metadata?: Record<string, JsonValue>;
    /** Correlation ID for support and server-side log lookup. */
    requestId?: string;
}

export interface ErrorResponseOptions extends Partial<ApiErrorResponse> {
    /**
     * Explicitly expose a 5xx message and its optional context.
     *
     * Five-hundred responses are private by default. Use this only for a message
     * deliberately written as public API copy, never for an exception message.
     */
    exposure?: 'public';
    /** Additional response headers. Content-Type and Cache-Control remain enforced. */
    headers?: HeadersInit;
}

export interface ServiceErrorOptions extends Omit<ErrorResponseOptions, 'headers'> {
    /** Private underlying failure for the server error boundary; never serialized to clients. */
    internalCause?: unknown;
}

const STATUS_CODES: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    402: 'PAYMENT_REQUIRED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    405: 'METHOD_NOT_ALLOWED',
    406: 'NOT_ACCEPTABLE',
    407: 'PROXY_AUTHENTICATION_REQUIRED',
    408: 'REQUEST_TIMEOUT',
    409: 'CONFLICT',
    410: 'GONE',
    411: 'LENGTH_REQUIRED',
    412: 'PRECONDITION_FAILED',
    413: 'PAYLOAD_TOO_LARGE',
    414: 'URI_TOO_LONG',
    415: 'UNSUPPORTED_MEDIA_TYPE',
    416: 'RANGE_NOT_SATISFIABLE',
    417: 'EXPECTATION_FAILED',
    421: 'MISDIRECTED_REQUEST',
    422: 'VALIDATION_ERROR',
    423: 'LOCKED',
    424: 'FAILED_DEPENDENCY',
    425: 'TOO_EARLY',
    426: 'UPGRADE_REQUIRED',
    428: 'PRECONDITION_REQUIRED',
    429: 'RATE_LIMITED',
    431: 'REQUEST_HEADER_FIELDS_TOO_LARGE',
    451: 'UNAVAILABLE_FOR_LEGAL_REASONS',
    500: 'INTERNAL_SERVER_ERROR',
    501: 'NOT_IMPLEMENTED',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
    504: 'GATEWAY_TIMEOUT',
};

const PRIVATE_SERVER_MESSAGES: Record<number, string> = {
    500: 'Internal server error',
    501: 'Server functionality is unavailable',
    502: 'Bad gateway',
    503: 'Service temporarily unavailable',
    504: 'Gateway timeout',
};

/** Return a stable programmatic code when the caller did not provide one. */
export function defaultErrorCode(status: number): string {
    return STATUS_CODES[status] ?? (status >= 500 ? 'SERVER_ERROR' : status >= 400 ? 'CLIENT_ERROR' : 'HTTP_ERROR');
}

function buildApiError(message: string, status: number, options: ErrorResponseOptions = {}): ApiErrorResponse {
    const exposeServerDetails = status < 500 || options.exposure === 'public';
    const publicMessage = exposeServerDetails ? message : (PRIVATE_SERVER_MESSAGES[status] ?? 'Internal server error');

    return {
        error: publicMessage,
        code: options.code || defaultErrorCode(status),
        messages: exposeServerDetails ? options.messages || [publicMessage] : [publicMessage],
        details: exposeServerDetails ? options.details : undefined,
        hint: exposeServerDetails ? options.hint : undefined,
        fieldErrors: exposeServerDetails ? options.fieldErrors : undefined,
        metadata: exposeServerDetails ? options.metadata : undefined,
        requestId: options.requestId,
    };
}

/**
 * Custom error class for service-level errors that can be caught
 * by a global error handler to return structured API responses.
 */
export class ServiceError extends Error {
    public readonly code?: string;
    public readonly status: number;
    public readonly details?: string;
    public readonly hint?: string;
    public readonly messages?: string[];
    public readonly fieldErrors?: Record<string, string[]>;
    public readonly metadata?: Record<string, JsonValue>;
    public readonly requestId?: string;
    public readonly exposure?: 'public';
    public readonly internalCause?: unknown;

    constructor(message: string, status: number = 400, options: ServiceErrorOptions = {}) {
        super(message);
        this.name = 'ServiceError';
        this.status = status;
        this.code = options.code;
        this.details = options.details;
        this.hint = options.hint;
        this.messages = options.messages;
        this.fieldErrors = options.fieldErrors;
        this.metadata = options.metadata;
        this.requestId = options.requestId;
        this.exposure = options.exposure;
        Object.defineProperty(this, 'internalCause', {
            value: options.internalCause,
            enumerable: false,
            configurable: false,
            writable: false,
        });

        const errorConstructor = Error as ErrorConstructor & {
            captureStackTrace?: (target: object, constructor?: typeof ServiceError) => void;
        };
        errorConstructor.captureStackTrace?.(this, ServiceError);
    }

    /**
     * Convert the error to a standardized API error response object.
     */
    toApiResponse(): ApiErrorResponse {
        return buildApiError(this.message, this.status, {
            code: this.code,
            details: this.details,
            hint: this.hint,
            messages: this.messages,
            fieldErrors: this.fieldErrors,
            metadata: this.metadata,
            requestId: this.requestId,
            exposure: this.exposure,
        });
    }

    /**
     * Keep accidental JSON serialization aligned with the secure public shape.
     * In particular, private causes and default-private 5xx context never leak.
     */
    toJSON(): ApiErrorResponse {
        return this.toApiResponse();
    }
}

/**
 * Utility to create a structured JSON error response. Server failures are
 * deliberately opaque unless the caller opts in with `exposure: 'public'`.
 */
export function errorResponse(message: string, status: number = 500, options: ErrorResponseOptions = {}): Response {
    const body = buildApiError(message, status, options);
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json; charset=utf-8');
    headers.set('Cache-Control', 'no-store');

    return new Response(JSON.stringify(body), {
        status,
        headers,
    });
}

const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const AUTHORIZATION_VALUE = /\b(authorization|proxy-authorization)\b\s*[:=]\s*(?:Bearer|Basic)\s+[^\s,;]+/gi;
const SECRET_ASSIGNMENT =
    /(["']?)\b(password|passphrase|secret|token|authorization|cookie|api[-_ ]?key|credential|private[-_ ]?key)\b\1(\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}]+)/gi;
const PRIVATE_KEY_BLOCK = /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi;
const URL_CREDENTIALS = /\b([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^@\s/]+@/gi;

function redactLogText(value: string, maxLength: number): string {
    const redacted = value
        .replace(PRIVATE_KEY_BLOCK, '[REDACTED PRIVATE KEY]')
        .replace(URL_CREDENTIALS, '$1[REDACTED]@')
        .replace(AUTHORIZATION_VALUE, '$1: [REDACTED]')
        .replace(BEARER_TOKEN, 'Bearer [REDACTED]')
        .replace(SECRET_ASSIGNMENT, '$1$2$1$3[REDACTED]');
    return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}…[truncated]` : redacted;
}

export interface RedactedErrorLog {
    name: string;
    message: string;
    stack?: string;
}

/**
 * Convert a thrown value to bounded, secret-redacted structured log data.
 * It intentionally does not serialize arbitrary thrown objects.
 */
export function redactErrorForLog(error: unknown, maxLength = 2_000): RedactedErrorLog {
    if (!(error instanceof Error)) {
        return {
            name: 'NonErrorThrow',
            message: redactLogText(typeof error === 'string' ? error : 'A non-Error value was thrown', maxLength),
        };
    }

    return {
        name: redactLogText(error.name || 'Error', 128),
        message: redactLogText(error.message || 'No error message', maxLength),
        stack: error.stack ? redactLogText(error.stack, maxLength * 2) : undefined,
    };
}
