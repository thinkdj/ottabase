import { cn } from '@ottabase/ui-shadcn';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
    /** An icon element (lucide or tabler), drawn muted above the title */
    icon?: ReactNode;
    title: ReactNode;
    description?: ReactNode;
    /** A button or link offering the obvious next step */
    action?: ReactNode;
    /** Tighter padding for small panels such as dialogs and sidebars */
    compact?: boolean;
    className?: string;
}

/** The one "nothing here" panel: muted tile, centred text, optional icon and next step */
export function EmptyState({ icon, title, description, action, compact = false, className }: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center rounded-xl bg-muted/40 px-6 text-center',
                compact ? 'py-8' : 'py-12',
                className,
            )}
        >
            {icon && (
                <span aria-hidden="true" className="mb-4 text-muted-foreground/50 [&>svg]:h-10 [&>svg]:w-10">
                    {icon}
                </span>
            )}
            <p className="text-sm font-medium text-foreground">{title}</p>
            {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
            {action && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{action}</div>}
        </div>
    );
}
