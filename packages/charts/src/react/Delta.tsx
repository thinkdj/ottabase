import { delta as computeDelta, formatDelta } from '../format';
import { cx } from './utils';

export interface DeltaProps {
    current: number;
    previous: number;
    /** Down is good (errors, latency, churn): flips the colours, not the arrow. */
    invert?: boolean;
    digits?: number;
    className?: string;
}

/** "▲ 12.5%" in the tone of the change. Fits a `Stat` tile's `foot`. */
export function Delta({ current, previous, invert = false, digits = 1, className }: DeltaProps) {
    const d = computeDelta(current, previous);
    const good = d.direction === 'flat' ? null : (d.direction === 'up') !== invert;
    const arrow = d.direction === 'up' ? '▲' : d.direction === 'down' ? '▼' : '';
    return (
        <span
            data-slot="delta"
            data-direction={d.direction}
            className={cx(
                'inline-flex items-center gap-1 text-xs font-medium tabular-nums',
                good === null ? 'text-muted-foreground' : good ? 'text-success-text' : 'text-destructive-text',
                className,
            )}
        >
            {arrow && (
                <span aria-hidden="true" className="text-[0.7em]">
                    {arrow}
                </span>
            )}
            {formatDelta(d, digits)}
        </span>
    );
}
