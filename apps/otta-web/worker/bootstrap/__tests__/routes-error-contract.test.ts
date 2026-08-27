import { describe, expect, it } from 'vitest';
import { handleBootstrapRoute, interceptIfNotReady } from '../routes';
import type { PlatformStateResult } from '../types';

function platformState(overrides: Partial<PlatformStateResult> = {}): PlatformStateResult {
    return {
        state: 'UNINITIALIZED',
        source: 'probe',
        panic: false,
        reason: 'test fixture',
        bindings: { d1: false, kv: false, r2: false, queue: false, assets: false },
        ...overrides,
    };
}

function context(path: string, init: RequestInit = {}, env: Record<string, unknown> = {}) {
    const request = new Request(`https://app.test${path}`, {
        ...init,
        headers: {
            'X-Bootstrap-Secret': 'fixture-secret',
            ...init.headers,
        },
    });
    return {
        request,
        url: new URL(request.url),
        env: { BOOTSTRAP_OWNER_SECRET: 'fixture-secret', ...env } as any,
        platformState: platformState(),
    };
}

describe('bootstrap API response contract', () => {
    it('keeps 5xx responses opaque and non-cacheable', async () => {
        const ctx = context('/__bootstrap__/api/status');
        ctx.platformState = platformState({ state: 'UNINITIALIZED', source: 'env' });

        const response = await handleBootstrapRoute(ctx);
        const body = (await response.json()) as Record<string, unknown>;

        expect(response.status).toBe(503);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(body).toMatchObject({ error: 'Service temporarily unavailable', code: 'PLATFORM_LOCKED' });
        expect(JSON.stringify(body)).not.toContain('environment configuration');
    });

    it('returns canonical 404 and method errors', async () => {
        const missing = await handleBootstrapRoute(context('/__bootstrap__/missing', { method: 'POST' }));
        expect(missing.status).toBe(404);
        await expect(missing.json()).resolves.toMatchObject({ error: 'Not found', code: 'NOT_FOUND' });

        const method = await handleBootstrapRoute(
            context('/__bootstrap__/api/init', { method: 'GET' }, { OBCF_D1: {} }),
        );
        expect(method.status).toBe(405);
        await expect(method.json()).resolves.toMatchObject({ code: 'METHOD_NOT_ALLOWED' });
    });

    it('maps malformed and invalid owner requests to client errors with field errors', async () => {
        const malformed = await handleBootstrapRoute(
            context('/__bootstrap__/api/create-owner', { method: 'POST', body: '{' }, { OBCF_D1: {} }),
        );
        expect(malformed.status).toBe(400);
        await expect(malformed.json()).resolves.toMatchObject({ code: 'INVALID_JSON' });

        const invalid = await handleBootstrapRoute(
            context('/__bootstrap__/api/create-owner', { method: 'POST', body: JSON.stringify({}) }, { OBCF_D1: {} }),
        );
        expect(invalid.status).toBe(422);
        await expect(invalid.json()).resolves.toMatchObject({
            code: 'VALIDATION_ERROR',
            fieldErrors: {
                email: ['Valid email address required'],
                password: [expect.any(String)],
            },
        });
    });

    it('marks successful secret-gated status responses non-cacheable', async () => {
        const ctx = context('/__bootstrap__/api/status', undefined, { ENVIRONMENT: 'production' });
        ctx.platformState = platformState({ state: 'READY', source: 'env' });

        const response = await handleBootstrapRoute(ctx);

        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-store');
    });

    it('uses the same opaque contract while intercepting unready API requests', async () => {
        const missingBinding = interceptIfNotReady(
            new Request('https://app.test/api/private'),
            new URL('https://app.test/api/private'),
            platformState(),
        );

        expect(missingBinding?.status).toBe(503);
        expect(missingBinding?.headers.get('cache-control')).toBe('no-store');
        await expect(missingBinding?.json()).resolves.toMatchObject({ code: 'MISSING_BINDING' });

        const notReady = interceptIfNotReady(
            new Request('https://app.test/api/private'),
            new URL('https://app.test/api/private'),
            platformState({ bindings: { d1: true, kv: false, r2: false, queue: false, assets: false } }),
        );
        await expect(notReady?.json()).resolves.toMatchObject({ code: 'PLATFORM_NOT_READY' });
    });
});
