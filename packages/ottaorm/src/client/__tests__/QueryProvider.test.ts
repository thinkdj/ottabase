import { MutationObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    createQueryClient,
    createVisibilityScopeKey,
    defaultQueryConfig,
    isRetryableQueryError,
    queryRetryDelay,
    shouldRetryQuery,
} from '../QueryProvider';
import type { ApiClientError } from '../types';

afterEach(() => {
    vi.restoreAllMocks();
});

function apiError(
    status: number,
    options: {
        retryable?: boolean;
        code?: string;
        retryAfterMs?: number;
        response?: Response;
    } = {},
): ApiClientError {
    return Object.assign(new Error(`HTTP ${status}`), {
        name: 'ApiError' as const,
        status,
        messages: [`HTTP ${status}`],
        retryable: options.retryable ?? false,
        code: options.code,
        retryAfterMs: options.retryAfterMs,
        response: options.response,
    });
}

describe('OttaQueryProvider policy', () => {
    it.each([400, 401, 403, 404, 409, 422])('never retries deterministic HTTP %s failures', (status) => {
        expect(shouldRetryQuery(0, apiError(status, { retryable: true }))).toBe(false);
    });

    it.each([0, 408, 429, 502, 503, 504])(
        'retries explicitly retryable HTTP %s failures within a three-attempt budget',
        (status) => {
            const error = apiError(status, { retryable: true });
            expect(isRetryableQueryError(error)).toBe(true);
            expect(shouldRetryQuery(0, error)).toBe(true);
            expect(shouldRetryQuery(1, error)).toBe(true);
            expect(shouldRetryQuery(2, error)).toBe(false);
        },
    );

    it('does not retry a transient status unless the transport marked it safe', () => {
        expect(shouldRetryQuery(0, apiError(503, { retryable: false }))).toBe(false);
        expect(shouldRetryQuery(0, new Error('Codec failed'))).toBe(false);
    });

    it.each(['PLATFORM_NOT_READY', 'READONLY_MODE'])('does not retry the deterministic platform state %s', (code) => {
        expect(shouldRetryQuery(0, apiError(503, { retryable: true, code }))).toBe(false);
    });

    it('prefers transport retryAfterMs and otherwise uses full jitter', () => {
        expect(queryRetryDelay(0, apiError(429, { retryable: true, retryAfterMs: 1_750 }))).toBe(1_750);

        vi.spyOn(Math, 'random').mockReturnValueOnce(0.5);
        expect(queryRetryDelay(1, apiError(503, { retryable: true }))).toBe(500);
    });

    it('creates stable, authorization-aware visibility identities', () => {
        const first = createVisibilityScopeKey({
            appId: 'app',
            organizationId: 'org-a',
            principalId: 'user',
            authorizationVersion: 2,
        });
        const same = createVisibilityScopeKey({
            principalId: 'user',
            organizationId: 'org-a',
            appId: 'app',
            authorizationVersion: 2,
        });
        const changed = createVisibilityScopeKey({
            appId: 'app',
            organizationId: 'org-b',
            principalId: 'user',
            authorizationVersion: 2,
        });

        expect(first).toBe(same);
        expect(changed).not.toBe(first);
    });

    it('reports a terminal query error once after retries are exhausted', async () => {
        const error = apiError(503, { retryable: true });
        const reporter = vi.fn();
        const queryFn = vi.fn().mockRejectedValue(error);
        const client = createQueryClient(undefined, reporter);
        vi.spyOn(Math, 'random').mockReturnValue(0);

        await expect(client.fetchQuery({ queryKey: ['users'], queryFn })).rejects.toBe(error);

        expect(queryFn).toHaveBeenCalledTimes(3);
        expect(reporter).toHaveBeenCalledTimes(1);
        expect(reporter).toHaveBeenCalledWith(error, {
            source: 'query',
            meta: undefined,
        });
        client.clear();
    });

    it('reports a terminal mutation error once and never retries the write', async () => {
        const error = apiError(503, { retryable: false });
        const reporter = vi.fn();
        const mutationFn = vi.fn().mockRejectedValue(error);
        const client = createQueryClient(undefined, reporter);
        const observer = new MutationObserver(client, {
            mutationFn,
            meta: { operation: 'create-user' },
        });

        await expect(observer.mutate(undefined)).rejects.toBe(error);

        expect(mutationFn).toHaveBeenCalledTimes(1);
        expect(reporter).toHaveBeenCalledTimes(1);
        expect(reporter).toHaveBeenCalledWith(error, {
            source: 'mutation',
            meta: { operation: 'create-user' },
        });
        client.clear();
    });

    it('lets a consumer onError callback own mutation presentation', async () => {
        const error = apiError(403);
        const reporter = vi.fn();
        const localOnError = vi.fn();
        const client = createQueryClient(undefined, reporter);
        const observer = new MutationObserver(client, {
            mutationFn: vi.fn().mockRejectedValue(error),
            onError: localOnError,
        });

        await expect(observer.mutate(undefined)).rejects.toBe(error);

        expect(localOnError).toHaveBeenCalledTimes(1);
        expect(reporter).not.toHaveBeenCalled();
        client.clear();
    });

    it('reports a framework lifecycle error when metadata keeps presentation global', async () => {
        const error = apiError(403);
        const reporter = vi.fn();
        const lifecycleOnError = vi.fn();
        const client = createQueryClient(undefined, reporter);
        const observer = new MutationObserver(client, {
            mutationFn: vi.fn().mockRejectedValue(error),
            onError: lifecycleOnError,
            meta: { errorPresentation: 'global' },
        });

        await expect(observer.mutate(undefined)).rejects.toBe(error);

        expect(lifecycleOnError).toHaveBeenCalledTimes(1);
        expect(reporter).toHaveBeenCalledTimes(1);
        client.clear();
    });

    it('supports explicit local query presentation metadata', async () => {
        const error = apiError(403);
        const reporter = vi.fn();
        const client = createQueryClient(undefined, reporter);

        await expect(
            client.fetchQuery({
                queryKey: ['local-error'],
                queryFn: vi.fn().mockRejectedValue(error),
                meta: { errorPresentation: 'local' },
            }),
        ).rejects.toBe(error);

        expect(reporter).not.toHaveBeenCalled();
        client.clear();
    });

    it('does not retry mutations by default', () => {
        expect(defaultQueryConfig.defaultOptions?.mutations?.retry).toBe(false);
    });
});
