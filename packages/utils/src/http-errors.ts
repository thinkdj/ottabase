/**
 * Standardized API error response from the server.
 * All API endpoints should return errors in this format.
 */
export interface ApiErrorResponse {
    /** Primary error message */
    error: string;
    /** Error code for programmatic handling (e.g., "UNAUTHORIZED", "RATE_LIMITED") */
    code?: string;
    /** Additional context about the error */
    details?: string;
    /** Actionable suggestion for fixing the error */
    hint?: string;
    /** Multiple error messages (e.g., validation errors) */
    messages?: string[];
    /** Field-specific errors for form validation */
    fieldErrors?: Record<string, string[]>;
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

    constructor(
        message: string,
        status: number = 400,
        options: {
            code?: string;
            details?: string;
            hint?: string;
            messages?: string[];
            fieldErrors?: Record<string, string[]>;
        } = {},
    ) {
        super(message);
        this.name = 'ServiceError';
        this.status = status;
        this.code = options.code;
        this.details = options.details;
        this.hint = options.hint;
        this.messages = options.messages;
        this.fieldErrors = options.fieldErrors;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ServiceError);
        }
    }

    /**
     * Convert the error to a standardized API error response object.
     */
    toApiResponse(): ApiErrorResponse {
        return {
            error: this.message,
            code: this.code || (this.status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'),
            details: this.details,
            hint: this.hint,
            messages: this.messages || [this.message],
            fieldErrors: this.fieldErrors,
        };
    }
}

/**
 * Utility to create a structured JSON error response.
 */
export function errorResponse(
    message: string,
    status: number = 500,
    options: Partial<ApiErrorResponse> = {},
): Response {
    const body: ApiErrorResponse = {
        error: message,
        code: options.code || (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'),
        messages: options.messages || [message],
        details: options.details,
        hint: options.hint,
        fieldErrors: options.fieldErrors,
    };

    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}
