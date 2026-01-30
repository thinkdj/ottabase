'use client';

import * as React from 'react';
import { Toaster as Sonner } from 'sonner';

export type ToasterProps = React.ComponentProps<typeof Sonner>;

const TOAST_VARIANTS = {
    base: 'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
    success:
        'data-[type=success]:!bg-green-50 data-[type=success]:!text-green-900 data-[type=success]:!border-green-200 dark:data-[type=success]:!bg-green-950 dark:data-[type=success]:!text-green-50 dark:data-[type=success]:!border-green-800',
    error: 'data-[type=error]:!bg-red-50 data-[type=error]:!text-red-900 data-[type=error]:!border-red-200 dark:data-[type=error]:!bg-red-950 dark:data-[type=error]:!text-red-50 dark:data-[type=error]:!border-red-800',
    warning:
        'data-[type=warning]:!bg-yellow-50 data-[type=warning]:!text-yellow-900 data-[type=warning]:!border-yellow-200 dark:data-[type=warning]:!bg-yellow-950 dark:data-[type=warning]:!text-yellow-50 dark:data-[type=warning]:!border-yellow-800',
    info: 'data-[type=info]:!bg-blue-50 data-[type=info]:!text-blue-900 data-[type=info]:!border-blue-200 dark:data-[type=info]:!bg-blue-950 dark:data-[type=info]:!text-blue-50 dark:data-[type=info]:!border-blue-800',
};

export function Toaster({ ...props }: ToasterProps) {
    return (
        <Sonner
            className="toaster group"
            position="top-right"
            expand
            toastOptions={{
                classNames: {
                    toast: Object.values(TOAST_VARIANTS).join(' '),
                    description: 'group-[.toast]:text-muted-foreground',
                    actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
                    cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
                },
            }}
            {...props}
        />
    );
}
