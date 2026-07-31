import { ServiceError } from '@ottabase/utils/http-errors';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleUnhandledRequestError } from '../http-error-boundary';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('handleUnhandledRequestError', () => {
    it('returns a generic correlated 500 and emits one secret-redacted JSON log', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const request = new Request('https://app.example.com/api/users?password=hunter2', {
            headers: { 'x-request-id': 'attacker-controlled' },
        });

        const response = handleUnhandledRequestError(
            new Error('Database failed password=hunter2 token=secret-token'),
            request,
        );
        const body = (await response.json()) as Record<string, unknown>;

        expect(body).toMatchObject({
            error: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
            messages: ['Internal server error'],
        });
        expect(typeof body.requestId).toBe('string');
        expect(body.requestId).not.toBe('attacker-controlled');
        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy.mock.calls[0]).toHaveLength(1);

        const logged = String(consoleSpy.mock.calls[0]![0]);
        const parsedLog = JSON.parse(logged) as { code: string; path: string; requestId: string; status: number };
        expect(logged).not.toContain('hunter2');
        expect(logged).not.toContain('secret-token');
        expect(parsedLog.requestId).toBe(body.requestId);
        expect(parsedLog.status).toBe(500);
        expect(parsedLog.code).toBe('INTERNAL_SERVER_ERROR');
        // Query strings are excluded from the structured path field.
        expect(parsedLog.path).toBe('/api/users');
    });

    it('preserves a typed 503 code but not its private message or details', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const error = new ServiceError('D1 lookup failed for private table', 503, {
            code: 'SECURITY_CONTEXT_UNAVAILABLE',
            details: 'no such table organization_members',
            internalCause: new Error('D1 token=private-database-token'),
        });

        const response = handleUnhandledRequestError(
            error,
            new Request('https://app.example.com/api/ottaorm/users', {
                headers: { 'cf-ray': 'cf-ray-456' },
            }),
        );

        expect(await response.json()).toEqual({
            error: 'Service temporarily unavailable',
            code: 'SECURITY_CONTEXT_UNAVAILABLE',
            messages: ['Service temporarily unavailable'],
            requestId: 'cf-ray-456',
        });
        const logged = String(consoleSpy.mock.calls[0]![0]);
        expect(logged).not.toContain('private-database-token');
        const parsedLog = JSON.parse(logged);
        expect(parsedLog.status).toBe(503);
        expect(parsedLog.code).toBe('SECURITY_CONTEXT_UNAVAILABLE');
        expect(parsedLog.cause.message).toContain('[REDACTED]');
    });
});
