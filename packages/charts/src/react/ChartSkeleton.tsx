import { cx } from './utils';

// Fixed heights, not random ones: the placeholder should not jump between renders.
const BARS = [42, 64, 52, 78, 58, 70, 46, 86, 62, 50, 74, 66];

export interface ChartSkeletonProps {
    /** Px. Default: fill the parent's height. */
    height?: number;
    className?: string;
}

/** A pulsing placeholder shaped like a chart: axis label stubs, grid lines and bars. Use it while data loads. */
export function ChartSkeleton({ height, className }: ChartSkeletonProps) {
    return (
        <div
            aria-hidden="true"
            data-slot="chart-skeleton"
            className={cx('flex h-full w-full animate-pulse flex-col gap-2', className)}
            style={height === undefined ? undefined : { height }}
        >
            <div className="flex min-h-0 flex-1 gap-2">
                <div className="flex w-6 shrink-0 flex-col justify-between py-0.5">
                    {Array.from({ length: 4 }, (_, i) => (
                        <div key={i} className="h-2 rounded-[2px] bg-muted" />
                    ))}
                </div>
                <div className="relative flex flex-1 items-end gap-[3%] border-b border-muted px-[2%]">
                    <div className="absolute inset-0 flex flex-col justify-between">
                        {Array.from({ length: 4 }, (_, i) => (
                            <div key={i} className="h-px bg-muted/60" />
                        ))}
                    </div>
                    {BARS.map((h, i) => (
                        <div key={i} className="relative flex-1 rounded-t-[2px] bg-muted" style={{ height: `${h}%` }} />
                    ))}
                </div>
            </div>
            <div className="ml-8 flex justify-between">
                {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="h-2 w-8 rounded-[2px] bg-muted" />
                ))}
            </div>
        </div>
    );
}
