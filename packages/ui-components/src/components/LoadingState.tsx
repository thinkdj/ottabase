import { cn, Skeleton } from '@ottabase/ui-shadcn';

export interface LoadingStateProps {
    /**
     * blocks: stacked tiles standing in for list rows or cards (default).
     * text: a few lines of copy. table: a header row plus rows. form: labels with fields.
     */
    kind?: 'blocks' | 'text' | 'table' | 'form';
    /** Blocks, lines, rows or fields to draw */
    count?: number;
    /** Tailwind height of each block, e.g. "h-12" (blocks only) */
    height?: string;
    /** Columns per row (table only) */
    columns?: number;
    label?: string;
    className?: string;
}

const tile = 'rounded-xl bg-muted/40';

/** The one loading placeholder: announced once to screen readers, drawn as muted pulsing tiles */
export function LoadingState({
    kind = 'blocks',
    count = 3,
    height = 'h-28',
    columns = 4,
    label = 'Loading',
    className,
}: LoadingStateProps) {
    const items = Array.from({ length: count }, (_, i) => i);
    return (
        <div
            role="status"
            aria-label={label}
            aria-busy="true"
            className={cn(kind === 'form' ? 'space-y-5' : 'space-y-3', className)}
        >
            {kind === 'blocks' && items.map((i) => <Skeleton key={i} className={cn(tile, height)} />)}
            {kind === 'text' &&
                items.map((i) => (
                    <Skeleton key={i} className={cn(tile, 'h-4', i === items.length - 1 ? 'w-2/3' : 'w-full')} />
                ))}
            {kind === 'table' && (
                <>
                    <div className="flex gap-3">
                        {Array.from({ length: columns }, (_, c) => (
                            <Skeleton key={c} className={cn(tile, 'h-4 flex-1')} />
                        ))}
                    </div>
                    {items.map((i) => (
                        <Skeleton key={i} className={cn(tile, 'h-10')} />
                    ))}
                </>
            )}
            {kind === 'form' &&
                items.map((i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className={cn(tile, 'h-3 w-24')} />
                        <Skeleton className={cn(tile, 'h-10')} />
                    </div>
                ))}
        </div>
    );
}
