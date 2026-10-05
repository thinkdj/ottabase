/**
 * AuthShell: the frame every sign-in page shares (app mark, heading, one line
 * of context, the page content, and an optional footer line under it).
 */

import { APP_META } from '@/ottabase/config';
import { Alert, Card } from '@ottabase/ui-shadcn';
import type { ReactNode } from 'react';

interface AuthShellProps {
    title: string;
    subtitle?: ReactNode;
    /** Shown above the content, e.g. "Password changed" after a reset */
    notice?: ReactNode;
    /** One line under the content, e.g. "New here? Create an account" */
    footer?: ReactNode;
    children: ReactNode;
}

export function AuthShell({ title, subtitle, notice, footer, children }: AuthShellProps) {
    return (
        <div className="flex min-h-[80vh] items-center justify-center py-8">
            <div className="w-full max-w-md space-y-6">
                <div className="flex flex-col items-center gap-4 text-center">
                    <span
                        aria-hidden="true"
                        className="flex h-12 w-12 items-center justify-center rounded-xl bg-background text-lg font-bold text-foreground ring-1 ring-border"
                    >
                        {APP_META.appName.charAt(0)}
                    </span>
                    <div className="space-y-1.5">
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
                        {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
                    </div>
                </div>

                {notice && <Alert variant="success">{notice}</Alert>}

                {children}

                {footer && <p className="text-center text-sm text-muted-foreground">{footer}</p>}
            </div>
        </div>
    );
}

/** Plain content card for pages that don't render a package form card */
export function AuthCard({ children }: { children: ReactNode }) {
    return <Card className="space-y-4 p-6 text-sm">{children}</Card>;
}
