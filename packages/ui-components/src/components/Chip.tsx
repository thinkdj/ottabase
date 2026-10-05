import { cn } from '@ottabase/ui-shadcn';
import type { ReactNode } from 'react';

export type ChipTone = 'success' | 'warning' | 'destructive' | 'info' | 'muted';

export interface ChipProps {
    children: ReactNode;
    /** A coloured dot before the text, for states such as active, pending or suspended */
    dot?: ChipTone;
    className?: string;
}

const DOT: Record<ChipTone, string> = {
    success: 'bg-success',
    warning: 'bg-warning',
    destructive: 'bg-destructive',
    info: 'bg-info',
    muted: 'bg-muted-foreground/40',
};

/** The small uppercase label lists use for a status, plan or type */
export function Chip({ children, dot, className }: ChipProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-background px-2.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border',
                className,
            )}
        >
            {dot && <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT[dot])} />}
            {children}
        </span>
    );
}
