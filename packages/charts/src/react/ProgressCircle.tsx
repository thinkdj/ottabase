import { useId, type ReactNode } from 'react';
import { resolveColor } from '../color';
import { arcPath, MARK_RADII } from '../shape';
import type { ChartColor, MarkRadius } from '../types';
import { cx, useReveal } from './utils';

export interface ProgressCircleProps {
    /** The reading; clamped to [0, max]. */
    value: number;
    /** Default 100. */
    max?: number;
    /** Outer diameter, px. Default 96. */
    size?: number;
    /** Ring width, px. Default 10% of `size`. */
    thickness?: number;
    /** Default slot 1. A quota near its limit usually takes `warning`/`danger`. */
    color?: ChartColor;
    /** `half` draws a gauge: the top half only. Default `full`. */
    variant?: 'full' | 'half';
    /** Centre content. Default: the percentage. */
    children?: ReactNode;
    /** Reveal transition on mount. */
    animate?: boolean;
    /** Accessible name ("Storage used"). */
    /** Corner radius of the marks: `none` 0, `sm` 2px, `md` 4px, `lg` 8px. Default `sm`. */
    radius?: MarkRadius;
    title?: string;
    className?: string;
}

/** One value against its maximum: storage used, quota consumed, a goal's progress. */
export function ProgressCircle({
    value,
    max = 100,
    size = 96,
    thickness,
    color,
    variant = 'full',
    children,
    animate = true,
    radius = 'sm',
    title,
    className,
}: ProgressCircleProps) {
    const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
    const revealed = useReveal(animate);
    const id = useId();
    const shown = revealed || !animate ? ratio : 0;
    const width = thickness ?? Math.max(6, size * 0.1);
    const outer = size / 2 - 1;
    const inner = outer - width;
    const c = size / 2;
    const a0 = variant === 'half' ? -Math.PI / 2 : 0;
    const a1 = variant === 'half' ? Math.PI / 2 : Math.PI * 2;
    const height = variant === 'half' ? c + 1 : size;
    const fill = resolveColor(color, 1);
    const centerline = ringCenterline(c, outer, inner, a0, a1);

    return (
        <div
            data-slot="progress-circle"
            role="meter"
            aria-label={title}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={Math.min(Math.max(value, 0), max)}
            className={cx('relative inline-flex shrink-0', className)}
            style={{ width: size, height }}
        >
            <svg width={size} height={height} aria-hidden="true" className="block overflow-visible">
                <defs>
                    {/* A wide stroke along the centreline sweeps the value in by its dash offset (pathLength makes
                        it a ratio). It runs a hair past the value so its cut never lands on the rounded end. */}
                    <mask id={`${id}-sweep`} maskUnits="userSpaceOnUse">
                        <path
                            d={centerline}
                            fill="none"
                            stroke="white"
                            strokeWidth={width + 4}
                            pathLength={1}
                            strokeDasharray={1}
                            strokeDashoffset={shown > 0 ? 1 - Math.min(1, shown + 0.02) : 1}
                            className="transition-[stroke-dashoffset] duration-slow ease-theme"
                        />
                    </mask>
                </defs>
                {/* The track is the meter's own colour, faint: it reads as one object, not grey + colour. */}
                <path d={arcPath(c, c, outer, inner, a0, a1, MARK_RADII[radius])} style={{ fill }} fillOpacity={0.16} />
                <path
                    d={arcPath(c, c, outer, inner, a0, a0 + (a1 - a0) * ratio, MARK_RADII[radius])}
                    style={{ fill }}
                    mask={`url(#${id}-sweep)`}
                />
            </svg>
            <div
                className={cx(
                    'pointer-events-none absolute inset-x-0 flex flex-col items-center text-center',
                    variant === 'half' ? 'bottom-0 justify-end' : 'inset-y-0 justify-center',
                )}
            >
                {children ?? (
                    <span
                        className="font-semibold leading-none tracking-[-0.02em] tabular-nums"
                        style={{ fontSize: Math.max(12, size / 4.5) }}
                    >
                        {Math.round(ratio * 100)}
                        <span className="ml-px text-[0.55em] font-medium text-muted-foreground">%</span>
                    </span>
                )}
            </div>
        </div>
    );
}

/** The arc through the middle of the ring, as a stroke path. */
function ringCenterline(c: number, outer: number, inner: number, a0: number, a1: number): string {
    const r = (outer + inner) / 2;
    const p = (a: number) => `${(c + r * Math.sin(a)).toFixed(2)} ${(c - r * Math.cos(a)).toFixed(2)}`;
    const span = a1 - a0;
    if (span >= Math.PI * 2 - 1e-6) {
        const mid = a0 + Math.PI;
        return `M${p(a0)}A${r} ${r} 0 1 1 ${p(mid)}A${r} ${r} 0 1 1 ${p(a0 + Math.PI * 2)}`;
    }
    return `M${p(a0)}A${r} ${r} 0 ${span > Math.PI ? 1 : 0} 1 ${p(a1)}`;
}
