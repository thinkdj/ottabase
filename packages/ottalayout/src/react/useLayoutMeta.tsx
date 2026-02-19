// ---------------------------------------------------------------------------
// @ottabase/ottalayout/react – Page-level layout hints (useLayoutMeta)
//
// Allows individual pages to override layout config fields for their route.
// The layout component reads overrides via useResolvedLayoutMeta() and merges
// them with the route-level config.
//
// Usage:
//   // In a page component:
//   useLayoutMeta({ navigation: 'none', centerContent: true, contentWidth: 'xs' });
//
//   // In the layout component:
//   const overrides = useResolvedLayoutMeta();
//   const effective = mergeLayoutConfig(overrides, routeConfig);
// ---------------------------------------------------------------------------

'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { LayoutConfig } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

/** Partial layout overrides a page can set */
export type LayoutMeta = Partial<LayoutConfig>;

interface LayoutMetaContextValue {
    /** Current page-level layout overrides (null = no overrides) */
    meta: LayoutMeta | null;
    /** Set layout overrides for the current page */
    setMeta: (meta: LayoutMeta | null) => void;
}

// ── Context ────────────────────────────────────────────────────────────────

const LayoutMetaContext = createContext<LayoutMetaContextValue>({
    meta: null,
    setMeta: () => {},
});

// ── Provider ───────────────────────────────────────────────────────────────

/**
 * Provides the layout meta context to the layout tree.
 * Wrap this above or alongside the layout component.
 */
export function LayoutMetaProvider({ children }: { children: React.ReactNode }) {
    const [meta, setMeta] = useState<LayoutMeta | null>(null);

    const setMetaStable = useCallback((m: LayoutMeta | null) => {
        setMeta(m);
    }, []);

    const value = useMemo(() => ({ meta, setMeta: setMetaStable }), [meta, setMetaStable]);

    return <LayoutMetaContext.Provider value={value}>{children}</LayoutMetaContext.Provider>;
}

// ── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Set page-level layout overrides. Overrides are applied on mount and
 * cleared automatically on unmount (page navigation).
 *
 * ```tsx
 * function LoginPage() {
 *   useLayoutMeta({ navigation: 'none', centerContent: true, contentWidth: 'xs' });
 *   return <LoginForm />;
 * }
 * ```
 */
export function useLayoutMeta(overrides: LayoutMeta): void {
    const { setMeta } = useContext(LayoutMetaContext);

    // Stable serialization for dependency tracking
    const serialized = JSON.stringify(overrides);

    useEffect(() => {
        setMeta(JSON.parse(serialized) as LayoutMeta);
        return () => setMeta(null);
    }, [serialized, setMeta]);
}

/**
 * Read the current page-level layout overrides.
 * Used by layout components to merge page hints into the resolved config.
 */
export function useResolvedLayoutMeta(): LayoutMeta | null {
    return useContext(LayoutMetaContext).meta;
}
