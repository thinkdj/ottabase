import { ApiError } from '@ottabase/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { toastError } = vi.hoisted(() => ({
    toastError: vi.fn(),
}));

vi.mock('sonner', () => ({
    toast: {
        error: toastError,
    },
}));

import { globalStore, isAuthenticatedAtom } from '@/ottabase/state/appState';
import { reportApiError } from '../api';

describe('reportApiError', () => {
    beforeEach(() => {
        toastError.mockReset();
    });

    it('presents a terminal 403 through the app toast boundary', () => {
        reportApiError(
            new ApiError({
                error: 'Forbidden',
                code: 'FORBIDDEN',
                status: 403,
            }),
        );

        expect(toastError).toHaveBeenCalledTimes(1);
        expect(toastError).toHaveBeenCalledWith('Access denied', {
            description: 'Your account does not have permission to perform this action.',
        });
    });

    it('does not duplicate validation errors that forms present locally', () => {
        reportApiError(
            new ApiError({
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                status: 422,
            }),
        );

        expect(toastError).not.toHaveBeenCalled();
    });

    it('sends a revoked session to /login with the session-revoked notice, an expired one with session-expired', () => {
        const original = window.location;
        const fake = { pathname: '/admin', href: '/admin' };
        Object.defineProperty(window, 'location', { value: fake, writable: true, configurable: true });
        try {
            const revokedResponse = new Response(null, { status: 401, headers: { 'X-Session-Ended': 'revoked' } });
            globalStore.set(isAuthenticatedAtom, true);
            reportApiError(new ApiError({ error: 'Unauthorized', status: 401 }, revokedResponse));
            expect(fake.href).toBe('/login?notice=session-revoked');

            fake.href = '/admin';
            globalStore.set(isAuthenticatedAtom, true);
            reportApiError(new ApiError({ error: 'Unauthorized', status: 401 }, new Response(null, { status: 401 })));
            expect(fake.href).toBe('/login?notice=session-expired');
        } finally {
            Object.defineProperty(window, 'location', { value: original, writable: true, configurable: true });
        }
    });
});
