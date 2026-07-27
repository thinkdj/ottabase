'use client';

// ============================================================
// @ottabase/ottaai/react — provider + the request seam
// ============================================================
// `'use client'` matters only for a Next.js consumer; it is harmless elsewhere.
//
// TAILWIND SETUP CHECKLIST (this fails with NO ERROR): a consuming app must add
//     '../../packages/ottaai/src/**/*.{js,ts,jsx,tsx}'
// to its Tailwind `content` array, or these components render structurally
// correct and completely unstyled.
// ============================================================

import { createContext, useContext, useMemo, type ReactNode } from 'react';

/** A thrown request failure, carrying the server's machine-readable code. */
export class AiRequestError extends Error {
    readonly code?: string;
    readonly status?: number;
    readonly fieldErrors?: Record<string, string[]>;

    constructor(message: string, options?: { code?: string; status?: number; fieldErrors?: Record<string, string[]> }) {
        super(message);
        this.name = 'AiRequestError';
        this.code = options?.code;
        this.status = options?.status;
        this.fieldErrors = options?.fieldErrors;
    }
}

/**
 * The JSON-level request seam.
 *
 * Resolves to the UNWRAPPED payload (the handlers' `data` field) and throws
 * {@link AiRequestError} on failure.
 */
export type AiRequest = <T>(path: string, init?: { method?: string; body?: unknown }) => Promise<T>;

export interface AiProvisioningClientConfig {
    /** Where the credential handlers are mounted. Default `/api/ai`. */
    basePath?: string;
    /**
     * ADAPT THE APP'S API CLIENT HERE.
     *
     * In this framework the browser client is what attaches `X-Org-Id` and `X-App-Id`, and
     * those headers are what select the tenancy scope the server resolves against. The
     * bare-`fetch` default silently resolves in the session's DEFAULT org, which is the
     * wrong answer for anyone who has switched workspace.
     *
     * @example
     * request: (path, init) => api<{ data: unknown }>(path, init).then((r) => r.data)
     */
    request?: AiRequest;
}

interface AiProvisioningContextValue {
    basePath: string;
    request: AiRequest;
    /** True when a provider is actually mounted. Read by the fail-closed hooks. */
    mounted: boolean;
}

/** The default: bare `fetch`, unwrapping the `{ data }` envelope the handlers emit. */
function createFetchRequest(basePath: string): AiRequest {
    return async <T,>(path: string, init?: { method?: string; body?: unknown }): Promise<T> => {
        const response = await fetch(`${basePath}${path}`, {
            method: init?.method ?? 'GET',
            headers: {
                Accept: 'application/json',
                ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            },
            ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
        });

        const text = await response.text();
        let payload: unknown = null;
        if (text) {
            try {
                payload = JSON.parse(text);
            } catch {
                payload = null;
            }
        }

        if (!response.ok) {
            const body = payload as { error?: string; code?: string; fieldErrors?: Record<string, string[]> } | null;
            throw new AiRequestError(body?.error ?? `Request failed (${response.status})`, {
                code: body?.code,
                status: response.status,
                fieldErrors: body?.fieldErrors,
            });
        }

        return (payload as { data: T })?.data as T;
    };
}

const FALLBACK_BASE_PATH = '/api/ai';

const AiProvisioningContext = createContext<AiProvisioningContextValue>({
    basePath: FALLBACK_BASE_PATH,
    request: createFetchRequest(FALLBACK_BASE_PATH),
    mounted: false,
});

export function AiProvisioningProvider({
    children,
    basePath,
    request,
}: AiProvisioningClientConfig & { children: ReactNode }) {
    const value = useMemo<AiProvisioningContextValue>(() => {
        const resolvedBase = basePath ?? FALLBACK_BASE_PATH;
        const resolvedRequest = request
            ? <T,>(path: string, init?: { method?: string; body?: unknown }) =>
                  request<T>(`${resolvedBase}${path}`, init)
            : createFetchRequest(resolvedBase);
        return { basePath: resolvedBase, request: resolvedRequest as AiRequest, mounted: true };
    }, [basePath, request]);

    return <AiProvisioningContext.Provider value={value}>{children}</AiProvisioningContext.Provider>;
}

export function useAiProvisioningConfig(): AiProvisioningContextValue {
    return useContext(AiProvisioningContext);
}
