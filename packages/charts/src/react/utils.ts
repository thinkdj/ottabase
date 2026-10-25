import { useEffect, useRef, useState, type RefObject } from 'react';

/** The corner radius scale behind every chart's `radius` prop: use it on custom marks so they match. */
export { MARK_RADII } from '../shape';

/** Join class names, skipping falsy ones. */
export function cx(...classes: (string | false | null | undefined)[]): string {
    return classes.filter(Boolean).join(' ');
}

/**
 * Track an element's content width. Charts draw in real pixels (no viewBox scaling),
 * so 2px lines stay 2px and labels stay 10px at every size. `fixed` skips measuring,
 * for SSR, tests and fixed-size slots.
 */
export function useElementWidth<T extends HTMLElement>(fixed?: number): [RefObject<T | null>, number] {
    const ref = useRef<T | null>(null);
    const [width, setWidth] = useState(fixed ?? 0);
    useEffect(() => {
        if (fixed !== undefined) {
            setWidth(fixed);
            return;
        }
        const el = ref.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        setWidth(el.clientWidth);
        const observer = new ResizeObserver((entries) => {
            const w = entries[0]?.contentRect.width;
            if (w !== undefined) setWidth(Math.floor(w));
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [fixed]);
    return [ref, width];
}

/**
 * False on the first paint, true one frame later: marks transition from their hidden
 * state to their drawn one. Durations are the design-system tokens, which collapse
 * to 0.01ms under `prefers-reduced-motion`.
 */
export function useReveal(enabled = true): boolean {
    const [shown, setShown] = useState(!enabled);
    useEffect(() => {
        if (!enabled) return;
        const id = requestAnimationFrame(() => setShown(true));
        return () => cancelAnimationFrame(id);
    }, [enabled]);
    return shown;
}

/** Shared tick-label styling: 10px mono in the recessive label colour (Design System v1). */
export const TICK_CLASS = 'fill-chart-label font-mono text-[10px]';

/** Data labels next to marks: 10px mono in the readable foreground. */
export const VALUE_LABEL_CLASS = 'fill-foreground font-mono text-[10px] font-medium';

/** Resolve a row position given as an index number or as an index-column value. */
export function rowIndexOf(data: Record<string, unknown>[], index: string, at: number | string): number {
    if (typeof at === 'number') return at;
    return data.findIndex((row) => String(row[index] ?? '') === at);
}
