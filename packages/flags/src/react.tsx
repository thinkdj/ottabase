// ============================================================
// React Integration for Feature Flags
// ============================================================

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface FlagContextValue {
    flags: Record<string, boolean>;
    loading: boolean;
    refresh: () => Promise<void>;
}

const FlagContext = createContext<FlagContextValue>({
    flags: {},
    loading: true,
    refresh: async () => {},
});

interface FlagProviderProps {
    /** API endpoint that returns evaluated flags. Defaults to "/api/flags/evaluate" */
    endpoint?: string;
    children: ReactNode;
}

/**
 * Provider that fetches evaluated flags from the server and makes them
 * available via useFlag() / useFlags() hooks.
 *
 * Place this near the root of your app, after auth context is established.
 *
 * @example
 * ```tsx
 * <FlagProvider>
 *   <App />
 * </FlagProvider>
 * ```
 */
export function FlagProvider({ endpoint = '/api/flags/evaluate', children }: FlagProviderProps) {
    const [flags, setFlags] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);

    const refresh = async () => {
        try {
            const res = await fetch(endpoint, { credentials: 'include' });
            if (res.ok) {
                const data = (await res.json()) as { flags: Record<string, boolean> };
                setFlags(data.flags ?? {});
            }
        } catch {
            // Silently fail — flags default to false
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, [endpoint]);

    return <FlagContext.Provider value={{ flags, loading, refresh }}>{children}</FlagContext.Provider>;
}

/**
 * Check if a single feature flag is enabled for the current user.
 *
 * @example
 * ```tsx
 * function BillingPage() {
 *   const invoicesEnabled = useFlag("billing.invoices");
 *   if (!invoicesEnabled) return <UpgradeBanner />;
 *   return <InvoiceList />;
 * }
 * ```
 */
export function useFlag(key: string): boolean {
    const { flags } = useContext(FlagContext);
    return flags[key] ?? false;
}

/**
 * Get the full evaluated flags map and loading state.
 *
 * @example
 * ```tsx
 * const { flags, loading, refresh } = useFlags();
 * ```
 */
export function useFlags() {
    return useContext(FlagContext);
}

/**
 * Conditionally render children based on a feature flag.
 *
 * @example
 * ```tsx
 * <Feature flag="ai.assist">
 *   <AIAssistButton />
 * </Feature>
 *
 * <Feature flag="ai.assist" fallback={<UpgradePrompt />}>
 *   <AIAssistButton />
 * </Feature>
 * ```
 */
export function Feature({
    flag,
    fallback = null,
    children,
}: {
    flag: string;
    fallback?: ReactNode;
    children: ReactNode;
}) {
    const enabled = useFlag(flag);
    return <>{enabled ? children : fallback}</>;
}
