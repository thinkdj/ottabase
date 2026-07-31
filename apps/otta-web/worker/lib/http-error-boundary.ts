import { errorResponse, redactErrorForLog, ServiceError } from '@ottabase/utils/http-errors';

function requestIdFor(request: Request): string {
    // CF-Ray is edge-controlled in production. A browser-provided X-Request-Id
    // is not an authority source and could otherwise create misleading/colliding
    // log correlations.
    const candidate = request.headers.get('cf-ray');
    return candidate && /^[A-Za-z0-9._:-]{1,128}$/.test(candidate) ? candidate : crypto.randomUUID();
}

/**
 * Shared final error boundary for both ottarouter and the outer Worker fetch
 * handler. It emits one bounded structured log and never returns exception
 * messages or private ServiceError context for a 5xx response.
 */
export function handleUnhandledRequestError(error: unknown, request: Request): Response {
    const requestId = requestIdFor(request);
    const status = error instanceof ServiceError ? error.status : 500;

    if (status >= 500) {
        console.error(
            JSON.stringify({
                event: 'worker_request_failed',
                requestId,
                method: request.method.slice(0, 16),
                path: new URL(request.url).pathname.slice(0, 512),
                status,
                code:
                    error instanceof ServiceError
                        ? (error.code || 'SERVICE_ERROR').slice(0, 64)
                        : 'INTERNAL_SERVER_ERROR',
                error: redactErrorForLog(error),
                cause:
                    error instanceof ServiceError && error.internalCause !== undefined
                        ? redactErrorForLog(error.internalCause)
                        : undefined,
            }),
        );
    }

    if (error instanceof ServiceError) {
        return errorResponse(error.message, error.status, {
            code: error.code,
            details: error.details,
            hint: error.hint,
            messages: error.messages,
            fieldErrors: error.fieldErrors,
            metadata: error.metadata,
            requestId: error.requestId || requestId,
            exposure: error.exposure,
        });
    }

    return errorResponse('Internal server error', 500, {
        code: 'INTERNAL_SERVER_ERROR',
        requestId,
    });
}
