// ---------------------------------------------------------------------------
// Brand component registry + scope helper — the React-level theming escape
// hatches for design systems whose components need genuinely different DOM.
//
// Tier 1 (preferred, CSS): every primitive stamps data-slot (+ data-variant /
// data-size on CVA components); theme CSS targets [data-slot=button] etc. and
// wins by cascade order. Use this for 90% of "totally different" components.
//
// Tier 2 (this file, React): a fork registers replacement implementations for
// specific slots — <BrandComponentsProvider overrides={{ button: UppButton }}>.
// Primitives that support overriding resolve their implementation from this
// context, receiving the SAME props (variant, size, asChild, …). Zero cost
// when unused. Reserve it for components whose DOM must differ (extra shine
// layers, novel interaction models) — not for restyling.
// ---------------------------------------------------------------------------

'use client';

import * as React from 'react';

/** Slot name → replacement component. Keys match data-slot names. */
export type BrandComponentOverrides = Record<string, React.ComponentType<any>>;

const BrandComponentsContext = React.createContext<BrandComponentOverrides>({});

export interface BrandComponentsProviderProps {
    overrides: BrandComponentOverrides;
    children: React.ReactNode;
}

/** Provides replacement implementations for ui-shadcn primitives (per subtree). */
export function BrandComponentsProvider({ overrides, children }: BrandComponentsProviderProps) {
    // Merge with any outer provider so nested providers compose
    const parent = React.useContext(BrandComponentsContext);
    const merged = React.useMemo(() => ({ ...parent, ...overrides }), [parent, overrides]);
    return <BrandComponentsContext.Provider value={merged}>{children}</BrandComponentsContext.Provider>;
}

/**
 * Resolve a slot's override component, if any. Called unconditionally by
 * override-aware primitives (button, badge, card, input, …).
 */
export function useBrandComponent(slot: string): React.ComponentType<any> | undefined {
    return React.useContext(BrandComponentsContext)[slot];
}

// ---------------------------------------------------------------------------
// BrandScope — token "room" wrapper
// ---------------------------------------------------------------------------

export interface BrandScopeProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Scope name matching a `scopes.{name}` entry in the brand tokens */
    name: string;
    asChild?: never;
}

/**
 * Re-binds brand tokens for a subtree via `data-brand-scope` — the engine
 * emits `[data-brand-scope="name"] { --background: …; }` blocks for every
 * scope the theme defines (an always-dark hero chrome, a CRT "screen" room…).
 * Children need no props or dark: classes — they read the same semantic vars.
 */
export const BrandScope = React.forwardRef<HTMLDivElement, BrandScopeProps>(({ name, children, ...props }, ref) => (
    <div ref={ref} data-brand-scope={name} {...props}>
        {children}
    </div>
));
BrandScope.displayName = 'BrandScope';
