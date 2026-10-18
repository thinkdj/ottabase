import * as React from 'react';

import { cn } from '@ottabase/ui-shadcn/lib/utils';

/*
 * The page head of Design System v1: a title, one line that says what the
 * page is for, and the actions on the right. One primary action per view.
 */
export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
    title: React.ReactNode;
    /** A short upper-case line above the title (a product area, a package group). */
    eyebrow?: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
}

export function PageHeader({ title, eyebrow, description, actions, className, children, ...props }: PageHeaderProps) {
    return (
        <header
            data-slot="page-header"
            className={cn('flex flex-wrap items-end justify-between gap-4', className)}
            {...props}
        >
            <div data-slot="page-header-text" className="flex min-w-0 flex-col gap-1">
                {eyebrow ? (
                    <span className="text-xs font-semibold uppercase tracking-[0.06em] text-accent-foreground">
                        {eyebrow}
                    </span>
                ) : null}
                <h1 className="flex items-center gap-2 text-2xl font-semibold leading-tight tracking-[-0.015em]">
                    {title}
                </h1>
                {description ? <p className="max-w-[68ch] text-sm text-subtle-foreground">{description}</p> : null}
                {children}
            </div>
            {actions ? (
                <div data-slot="page-header-actions" className="flex shrink-0 flex-wrap items-center gap-2">
                    {actions}
                </div>
            ) : null}
        </header>
    );
}
