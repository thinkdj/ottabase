import { describe, expect, it } from 'vitest';
import {
    defaultErrorCode,
    errorResponse,
    redactErrorForLog,
    ServiceError,
    type ApiErrorResponse,
} from '../http-errors';

async function readError(response: Response): Promise<ApiErrorResponse> {
    return (await response.json()) as ApiErrorResponse;
}

describe('errorResponse', () => {
    it('redacts 5xx content by default while preserving stable correlation fields', async () => {
        const response = errorResponse('Database password=super-secret', 500, {
            code: 'DATABASE_FAILURE',
            details: 'SQL and stack details',
            hint: 'Restart the private database',
            messages: ['token=secret-token'],
            fieldErrors: { password: ['super-secret'] },
            metadata: { host: 'private.internal' },
            requestId: 'req-123',
        });
        const body = await readError(response);

        expect(response.status).toBe(500);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
        expect(body).toEqual({
            error: 'Internal server error',
            code: 'DATABASE_FAILURE',
            messages: ['Internal server error'],
            requestId: 'req-123',
        });
        expect(JSON.stringify(body)).not.toContain('super-secret');
        expect(JSON.stringify(body)).not.toContain('private.internal');
    });

    it('uses status-specific default codes instead of collapsing every 4xx to BAD_REQUEST', () => {
        expect(defaultErrorCode(400)).toBe('BAD_REQUEST');
        expect(defaultErrorCode(401)).toBe('UNAUTHORIZED');
        expect(defaultErrorCode(403)).toBe('FORBIDDEN');
        expect(defaultErrorCode(404)).toBe('NOT_FOUND');
        expect(defaultErrorCode(409)).toBe('CONFLICT');
        expect(defaultErrorCode(422)).toBe('VALIDATION_ERROR');
        expect(defaultErrorCode(426)).toBe('UPGRADE_REQUIRED');
        expect(defaultErrorCode(429)).toBe('RATE_LIMITED');
        expect(defaultErrorCode(503)).toBe('SERVICE_UNAVAILABLE');
    });

    it('allows deliberate public 5xx copy only through the explicit exposure marker', async () => {
        const response = errorResponse('Maintenance window in progress', 503, {
            exposure: 'public',
            code: 'PLANNED_MAINTENANCE',
            details: 'Try again after 18:00 UTC',
        });

        expect(await readError(response)).toEqual({
            error: 'Maintenance window in progress',
            code: 'PLANNED_MAINTENANCE',
            messages: ['Maintenance window in progress'],
            details: 'Try again after 18:00 UTC',
        });
    });
});

describe('ServiceError', () => {
    it('is also opaque by default when converted directly to an API response', () => {
        const error = new ServiceError('D1 failed: password=super-secret', 503, {
            code: 'SECURITY_CONTEXT_UNAVAILABLE',
            details: 'internal lookup details',
            internalCause: { token: 'private-cause-token' },
        });

        expect(error.toApiResponse()).toEqual({
            error: 'Service temporarily unavailable',
            code: 'SECURITY_CONTEXT_UNAVAILABLE',
            messages: ['Service temporarily unavailable'],
            requestId: undefined,
            details: undefined,
            hint: undefined,
            fieldErrors: undefined,
            metadata: undefined,
        });
        const serialized = JSON.stringify(error);
        expect(serialized).not.toContain('super-secret');
        expect(serialized).not.toContain('internal lookup details');
        expect(serialized).not.toContain('private-cause-token');
    });
});

describe('redactErrorForLog', () => {
    it('bounds logs and removes common credential forms without serializing arbitrary objects', () => {
        const redacted = redactErrorForLog(
            new Error(
                'authorization: Basic YWxhZGRpbjpvcGVuc2VzYW1l {"password":"hunter2"} token=secret-token\n' +
                    'postgresql://database-user:database-password@db.internal/app\n' +
                    '-----BEGIN PRIVATE KEY-----\nprivate-key-material\n-----END PRIVATE KEY-----',
            ),
            500,
        );
        const serialized = JSON.stringify(redacted);

        expect(serialized).not.toContain('YWxhZGRpbjpvcGVuc2VzYW1l');
        expect(serialized).not.toContain('hunter2');
        expect(serialized).not.toContain('secret-token');
        expect(serialized).not.toContain('database-user');
        expect(serialized).not.toContain('database-password');
        expect(serialized).not.toContain('private-key-material');
        expect(serialized).toContain('[REDACTED]');
        expect(redactErrorForLog({ password: 'do-not-serialize' })).toEqual({
            name: 'NonErrorThrow',
            message: 'A non-Error value was thrown',
        });
    });
});
