'use client';

// ============================================================
// @ottabase/premium/react — provider + the request seam
// ============================================================
// TAILWIND SETUP CHECKLIST (this fails with NO ERROR): a consuming app must add
//     '../../packages/premium/src/**/*.{js,ts,jsx,tsx}'
// to its Tailwind `content` array, or these components render structurally correct
// and completely unstyled.
// ============================================================

import { createContext, useContext, useMemo, type ReactNode } from 'react';

/** A thrown request failure, carrying the server's machine-readable code. */
export class PremiumRequestError extends Error {
    readonly code?: string;
    readonly status?: number;

    constructor(message: string, options?: { code?: string; status?: number }) {
        super(message);
        this.name = 'PremiumRequestError';
        this.code = options?.code;
        this.status = options?.status;
    }
}

/** The JSON-level request seam. Resolves the UNWRAPPED payload (the handlers' `data`). */
export type PremiumRequest = <T>(path: string, init?: { method?: string; body?: unknown }) => Promise<T>;

export interface PremiumClientConfig {
    /** Where the control-plane routes are mounted. Default `/api/premium`. */
    basePath?: string;
    /**
     * ADAPT THE APP'S API CLIENT HERE.
     *
     * The app client is what attaches `X-Org-Id` and `X-App-Id`; the bare-`fetch` default
     * below resolves in whatever scope the session happens to default to, which is the
     * wrong answer for anyone who has switched workspace.
     *
     * @example
     * request: (path, init) => api<{ data: unknown }>(path, init).then((r) => r?.data)
     */
    request?: PremiumRequest;
}

interface PremiumContextValue {
    basePath: string;
    /** Paths are resolved against `basePath` — use for the `/api/premium` control plane. */
    request: PremiumRequest;
    /**
     * The same seam WITHOUT the base-path prefix, for a paid package's own namespace
     * (`/api/webhooks/...`).
     *
     * Sharing one transport is the point: a package that built its own client would send
     * different `X-Org-Id`/`X-App-Id` headers than the entitlement calls beside it, and
     * the gate and the data would answer for two different tenants.
     */
    requestAbsolute: PremiumRequest;
    /** True when a provider is actually mounted. Read by the fail-closed hooks. */
    mounted: boolean;
}

function createFetchRequest(basePath: string): PremiumRequest {
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
            const body = payload as { error?: string; code?: string } | null;
            throw new PremiumRequestError(body?.error ?? `Request failed (${response.status})`, {
                code: body?.code,
                status: response.status,
            });
        }

        return (payload as { data: T })?.data as T;
    };
}

const FALLBACK_BASE_PATH = '/api/premium';

const PremiumContext = createContext<PremiumContextValue>({
    basePath: FALLBACK_BASE_PATH,
    request: createFetchRequest(FALLBACK_BASE_PATH),
    requestAbsolute: createFetchRequest(''),
    mounted: false,
});

export function PremiumProvider({ children, basePath, request }: PremiumClientConfig & { children: ReactNode }) {
    const value = useMemo<PremiumContextValue>(() => {
        const resolvedBase = basePath ?? FALLBACK_BASE_PATH;
        const absolute = (request ?? createFetchRequest('')) as PremiumRequest;
        const prefixed = <T,>(path: string, init?: { method?: string; body?: unknown }) =>
            absolute<T>(`${resolvedBase}${path}`, init);
        return {
            basePath: resolvedBase,
            request: prefixed as PremiumRequest,
            requestAbsolute: absolute,
            mounted: true,
        };
    }, [basePath, request]);

    return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremiumClient(): PremiumContextValue {
    return useContext(PremiumContext);
}
