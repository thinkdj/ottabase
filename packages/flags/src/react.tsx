// ============================================================
// React Integration for Feature Flags
// ============================================================

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const OVERRIDES_STORAGE_KEY = 'ottabase_flag_overrides';

interface FlagContextValue {
    flags: Record<string, boolean>;
    overrides: Record<string, boolean>;
    loading: boolean;
    refresh: () => Promise<void>;
    setOverride: (key: string, value: boolean) => void;
    clearOverride: (key: string) => void;
    clearAllOverrides: () => void;
    hasOverrides: boolean;
}

const FlagContext = createContext<FlagContextValue>({
    flags: {},
    overrides: {},
    loading: true,
    refresh: async () => {},
    setOverride: () => {},
    clearOverride: () => {},
    clearAllOverrides: () => {},
    hasOverrides: false,
});

interface FlagProviderProps {
    /** API endpoint that returns evaluated flags. Defaults to "/api/flags/evaluate" */
    endpoint?: string;
    children: ReactNode;
}

// ============================================================
// Override helpers
// ============================================================

function loadOverrides(): Record<string, boolean> {
    try {
        const stored = localStorage.getItem(OVERRIDES_STORAGE_KEY);
        if (stored) return JSON.parse(stored);
    } catch {
        // ignore
    }
    return {};
}

function saveOverrides(overrides: Record<string, boolean>) {
    try {
        if (Object.keys(overrides).length === 0) {
            localStorage.removeItem(OVERRIDES_STORAGE_KEY);
        } else {
            localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
        }
    } catch {
        // ignore
    }
}

/** Parse URL params like ?flags=billing.invoices:true,ai.assist:false */
function parseUrlOverrides(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    try {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get('flags');
        if (!raw) return result;
        for (const pair of raw.split(',')) {
            const [key, val] = pair.split(':');
            if (key && val !== undefined) {
                result[key.trim()] = val.trim() === 'true' || val.trim() === '1';
            }
        }
    } catch {
        // ignore
    }
    return result;
}

/**
 * Provider that fetches evaluated flags from the server and makes them
 * available via useFlag() / useFlags() hooks.
 *
 * Supports flag overrides via:
 * - URL params: `?flags=billing.invoices:true,ai.assist:false`
 * - localStorage: set programmatically via `setOverride()` or FlagDevTools
 *
 * Overrides take priority over server-evaluated flags.
 *
 * @example
 * ```tsx
 * <FlagProvider>
 *   <App />
 * </FlagProvider>
 * ```
 */
export function FlagProvider({ endpoint = '/api/flags/evaluate', children }: FlagProviderProps) {
    const [serverFlags, setServerFlags] = useState<Record<string, boolean>>({});
    const [overrides, setOverrides] = useState<Record<string, boolean>>(() => {
        // Merge localStorage overrides with URL param overrides (URL takes priority)
        return { ...loadOverrides(), ...parseUrlOverrides() };
    });
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const res = await fetch(endpoint, { credentials: 'include' });
            if (res.ok) {
                const data = (await res.json()) as { flags: Record<string, boolean> };
                setServerFlags(data.flags ?? {});
            }
        } catch {
            // Silently fail — flags default to false
        } finally {
            setLoading(false);
        }
    }, [endpoint]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    // Persist URL overrides to localStorage on first load
    useEffect(() => {
        const urlOverrides = parseUrlOverrides();
        if (Object.keys(urlOverrides).length > 0) {
            const merged = { ...loadOverrides(), ...urlOverrides };
            saveOverrides(merged);
            setOverrides(merged);
        }
    }, []);

    const setOverride = useCallback((key: string, value: boolean) => {
        setOverrides((prev) => {
            const next = { ...prev, [key]: value };
            saveOverrides(next);
            return next;
        });
    }, []);

    const clearOverride = useCallback((key: string) => {
        setOverrides((prev) => {
            const next = { ...prev };
            delete next[key];
            saveOverrides(next);
            return next;
        });
    }, []);

    const clearAllOverrides = useCallback(() => {
        setOverrides({});
        saveOverrides({});
    }, []);

    // Merge: overrides take priority over server flags
    const flags = { ...serverFlags, ...overrides };
    const hasOverrides = Object.keys(overrides).length > 0;

    return (
        <FlagContext.Provider
            value={{ flags, overrides, loading, refresh, setOverride, clearOverride, clearAllOverrides, hasOverrides }}
        >
            {children}
        </FlagContext.Provider>
    );
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
 * Get the full evaluated flags map, loading state, and override controls.
 *
 * @example
 * ```tsx
 * const { flags, loading, refresh, setOverride, clearAllOverrides } = useFlags();
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

/**
 * Floating dev tools panel for managing flag overrides during development/QA.
 * Shows all flags with their current state, allows toggling overrides.
 * Only renders when there are flags available.
 *
 * @example
 * ```tsx
 * {process.env.NODE_ENV !== 'production' && <FlagDevTools />}
 * ```
 */
export function FlagDevTools() {
    const { flags, overrides, setOverride, clearOverride, clearAllOverrides, hasOverrides, loading } = useFlags();
    const [open, setOpen] = useState(false);

    if (loading) return null;

    const allKeys = Object.keys(flags).sort();
    if (allKeys.length === 0) return null;

    return (
        <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 99999 }}>
            {!open ? (
                <button
                    onClick={() => setOpen(true)}
                    style={{
                        background: hasOverrides ? '#f59e0b' : '#6b7280',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 12px',
                        fontSize: 13,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    }}
                    title="Feature Flag Dev Tools"
                >
                    {hasOverrides ? `Flags (${Object.keys(overrides).length} overrides)` : 'Flags'}
                </button>
            ) : (
                <div
                    style={{
                        background: '#1f2937',
                        color: '#e5e7eb',
                        borderRadius: 12,
                        padding: 16,
                        width: 320,
                        maxHeight: 420,
                        overflow: 'auto',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                        fontSize: 13,
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 12,
                        }}
                    >
                        <strong style={{ fontSize: 14 }}>Flag Overrides</strong>
                        <button
                            onClick={() => setOpen(false)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#9ca3af',
                                cursor: 'pointer',
                                fontSize: 18,
                            }}
                        >
                            x
                        </button>
                    </div>
                    {hasOverrides && (
                        <button
                            onClick={clearAllOverrides}
                            style={{
                                background: '#374151',
                                color: '#f87171',
                                border: '1px solid #4b5563',
                                borderRadius: 6,
                                padding: '4px 10px',
                                fontSize: 12,
                                cursor: 'pointer',
                                marginBottom: 10,
                                width: '100%',
                            }}
                        >
                            Clear all overrides
                        </button>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {allKeys.map((key) => {
                            const isOverridden = key in overrides;
                            const value = flags[key];
                            return (
                                <div
                                    key={key}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '6px 8px',
                                        borderRadius: 6,
                                        background: isOverridden ? '#292524' : 'transparent',
                                        border: isOverridden ? '1px solid #f59e0b44' : '1px solid transparent',
                                    }}
                                >
                                    <span style={{ flex: 1, wordBreak: 'break-all' }}>
                                        <code style={{ fontSize: 12 }}>{key}</code>
                                        {isOverridden && (
                                            <span
                                                style={{
                                                    fontSize: 10,
                                                    color: '#f59e0b',
                                                    marginLeft: 6,
                                                    cursor: 'pointer',
                                                }}
                                                onClick={() => clearOverride(key)}
                                                title="Remove override"
                                            >
                                                (override - click to reset)
                                            </span>
                                        )}
                                    </span>
                                    <button
                                        onClick={() => setOverride(key, !value)}
                                        style={{
                                            background: value ? '#22c55e' : '#6b7280',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: 10,
                                            padding: '2px 10px',
                                            fontSize: 11,
                                            cursor: 'pointer',
                                            minWidth: 36,
                                            marginLeft: 8,
                                        }}
                                    >
                                        {value ? 'ON' : 'OFF'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ marginTop: 10, fontSize: 11, color: '#6b7280' }}>
                        Tip: <code style={{ fontSize: 11 }}>?flags=key:true,key2:false</code>
                    </div>
                </div>
            )}
        </div>
    );
}
