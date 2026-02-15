// ---------------------------------------------------------------------------
// @ottabase/ottalayout/react – Layout Slot System
//
// Allows pages to inject content into named zones defined by the layout.
//
// Usage:
//   // Layout component renders: <LayoutSlot name="toolbar" />
//   // Page component fills:     <SlotContent name="toolbar"><MyToolbar /></SlotContent>
//
// The slot provider should wrap the layout. Slots are auto-cleaned when the
// page that filled them unmounts.
// ---------------------------------------------------------------------------

'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * Well-known slot names used by the default layout shell.
 * Apps can use any string as a slot name for custom zones.
 */
export type BuiltInSlotName = 'announcement' | 'toolbar' | 'breadcrumbs' | 'sidebar-right' | 'footer';

interface LayoutSlotsContextValue {
    /** Current slot contents keyed by slot name */
    slots: Record<string, React.ReactNode>;
    /** Register content for a named slot */
    setSlot: (name: string, content: React.ReactNode) => void;
    /** Remove content from a named slot */
    clearSlot: (name: string) => void;
}

// ── Context ────────────────────────────────────────────────────────────────

const LayoutSlotsContext = createContext<LayoutSlotsContextValue>({
    slots: {},
    setSlot: () => {},
    clearSlot: () => {},
});

// ── Provider ───────────────────────────────────────────────────────────────

/**
 * Provides the slot registry to the layout tree.
 * Wrap this around the layout component so both the layout and pages
 * within it have access.
 */
export function LayoutSlotsProvider({ children }: { children: React.ReactNode }) {
    const [slots, setSlots] = useState<Record<string, React.ReactNode>>({});

    const setSlot = useCallback((name: string, content: React.ReactNode) => {
        setSlots((prev) => ({ ...prev, [name]: content }));
    }, []);

    const clearSlot = useCallback((name: string) => {
        setSlots((prev) => {
            const next = { ...prev };
            delete next[name];
            return next;
        });
    }, []);

    return <LayoutSlotsContext.Provider value={{ slots, setSlot, clearSlot }}>{children}</LayoutSlotsContext.Provider>;
}

// ── Consumer hook ──────────────────────────────────────────────────────────

/**
 * Read the slot registry directly (advanced use).
 * Most consumers should use `<LayoutSlot>` and `<SlotContent>` instead.
 */
export function useLayoutSlots() {
    return useContext(LayoutSlotsContext);
}

// ── LayoutSlot (render point) ──────────────────────────────────────────────

export interface LayoutSlotProps {
    /** Name of the slot to render */
    name: string;
    /** Optional fallback content when no page has filled this slot */
    fallback?: React.ReactNode;
    /** Optional className wrapper around the slot content */
    className?: string;
}

/**
 * Render point in the layout where a named slot's content appears.
 * If no page has filled this slot, the fallback is shown (or nothing).
 *
 * ```tsx
 * // Inside layout component:
 * <LayoutSlot name="toolbar" />
 * <LayoutSlot name="breadcrumbs" fallback={<DefaultBreadcrumbs />} />
 * ```
 */
export function LayoutSlot({ name, fallback, className }: LayoutSlotProps) {
    const { slots } = useContext(LayoutSlotsContext);
    const content = slots[name] ?? fallback ?? null;

    if (!content) return null;
    if (className) return <div className={className}>{content}</div>;
    return <>{content}</>;
}

// ── SlotContent (page fills a slot) ────────────────────────────────────────

export interface SlotContentProps {
    /** Name of the slot to fill */
    name: string;
    /** Content to inject into the slot */
    children: React.ReactNode;
}

/**
 * Declaratively fill a named layout slot from any page or component.
 * Content is registered on mount and cleared on unmount.
 *
 * ```tsx
 * // Inside a page component:
 * function DashboardPage() {
 *   return (
 *     <>
 *       <SlotContent name="toolbar">
 *         <DashboardFilters />
 *       </SlotContent>
 *       <div>Main content here</div>
 *     </>
 *   );
 * }
 * ```
 */
export function SlotContent({ name, children }: SlotContentProps) {
    const { setSlot, clearSlot } = useContext(LayoutSlotsContext);
    const childrenRef = useRef(children);

    // Keep ref in sync for the effect cleanup
    childrenRef.current = children;

    // Register on mount, clear on unmount
    useEffect(() => {
        setSlot(name, childrenRef.current);
        return () => clearSlot(name);
    }, [name, setSlot, clearSlot]);

    // Update slot when children change (re-renders from parent)
    useEffect(() => {
        setSlot(name, children);
    });

    // SlotContent doesn't render anything itself – content appears at the LayoutSlot
    return null;
}
