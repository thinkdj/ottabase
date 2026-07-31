import { useApiClient } from '@ottabase/ottaorm/client';

export interface ServerErrorData {
    error?: string;
    message?: string;
    errors?: Record<string, unknown>;
    fieldErrors?: Record<string, unknown>;
    [key: string]: unknown;
}

/**
 * Returns field-error metadata from the canonical API error without coupling
 * the rendered forms package to a concrete error class.
 */
export function getServerErrorData(error: unknown): ServerErrorData {
    if (error && typeof error === 'object') {
        return error as ServerErrorData;
    }

    return {};
}

/**
 * Framework request adapter for rendered OttaForms components.
 *
 * Rendered forms require the same provider client as the rest of OttaORM so
 * authentication, tenant scope, cancellation, and canonical errors cannot be
 * bypassed by a component-local fetch implementation.
 */
export function useFormRequest() {
    return useApiClient();
}
