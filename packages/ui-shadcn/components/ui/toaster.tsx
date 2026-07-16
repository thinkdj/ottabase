'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Toaster as Sonner } from 'sonner';

export type ToasterProps = React.ComponentProps<typeof Sonner>;

const TOAST_VARIANTS = {
    base: 'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
    success:
        'data-[type=success]:!bg-success/10 data-[type=success]:!text-success data-[type=success]:!border-success/30',
    error: 'data-[type=error]:!bg-destructive/10 data-[type=error]:!text-destructive data-[type=error]:!border-destructive/30',
    warning:
        'data-[type=warning]:!bg-warning/10 data-[type=warning]:!text-warning data-[type=warning]:!border-warning/30',
    info: 'data-[type=info]:!bg-info/10 data-[type=info]:!text-info data-[type=info]:!border-info/30',
};

export function Toaster({ style, ...props }: ToasterProps) {
    const toaster = (
        <Sonner
            className="toaster group"
            position="top-right"
            expand
            // Belt-and-suspenders z-index: sonner injects its own stylesheet
            // (z-index: 999999999) but apps can accidentally override the
            // [data-sonner-toaster] rule, so we set it inline too. Callers can
            // still override via the `style` prop.
            style={{ zIndex: 'var(--z-toast, 100)', ...style }}
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

    // Render the toaster as a direct child of <body>. Sonner mounts its toast container inline
    // where <Toaster /> sits in the tree, so any ancestor that creates a stacking context
    // (transform, filter, backdrop-blur, isolate, etc. on an app-shell/provider wrapper) traps it.
    // Radix Dialog/Sheet portal to <body> at z-50, so a trapped toaster (even at z-index
    // 999999999) paints behind them, because z-index cannot cross stacking contexts. Portaling to
    // <body> lifts it out so its z-index wins.
    return typeof document === 'undefined' ? toaster : createPortal(toaster, document.body);
}
