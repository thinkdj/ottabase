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
});
