'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Toaster as Sonner } from 'sonner';

export type ToasterProps = React.ComponentProps<typeof Sonner>;

/*
 * Design System v1 toast: one dark surface (the page's ink, so it flips to a
 * light toast in dark mode), white text, and the tone carried by the icon
 * alone — green for done, red for failed, amber for a warning, blue for info.
 * Never a loud coloured block; the word says what happened.
 */
export function Toaster({ style, ...props }: ToasterProps) {
    const toastStyle = {
        zIndex: 'var(--z-toast, 100)',
        '--normal-bg': 'hsl(var(--foreground))',
        '--normal-border': 'hsl(var(--foreground))',
        '--normal-text': 'hsl(var(--background))',
        '--border-radius': 'var(--radius-lg, var(--radius))',
        ...style,
    } as React.CSSProperties;

    const toaster = (
        <Sonner
            className="toaster group"
            position="top-right"
            expand
            // Belt-and-suspenders z-index: sonner injects its own stylesheet
            // (z-index: 999999999) but apps can accidentally override the
            // [data-sonner-toaster] rule, so we set it inline too. Callers can
            // still override via the `style` prop.
            style={toastStyle}
            toastOptions={{
                classNames: {
                    toast: 'group toast !border-0 !shadow-md',
                    title: 'font-medium',
                    description: 'group-[.toast]:!text-current/70',
                    success: '[&_[data-icon]]:text-success',
                    error: '[&_[data-icon]]:text-destructive',
                    warning: '[&_[data-icon]]:text-warning',
                    info: '[&_[data-icon]]:text-info',
                    actionButton: '!bg-transparent !font-semibold !text-success',
                    cancelButton: '!bg-transparent !text-current/70',
                },
            }}
            {...props}
        />
    );

    // Render the toaster as a direct child of <body>. Sonner mounts its toast container inline
    // where <Toaster /> sits in the tree, so any ancestor that creates a stacking context
    // (transform, filter, backdrop-blur-sm, isolate, etc. on an app-shell/provider wrapper) traps it.
    // Radix Dialog/Sheet portal to <body> at z-50, so a trapped toaster (even at z-index
    // 999999999) paints behind them, because z-index cannot cross stacking contexts. Portaling to
    // <body> lifts it out so its z-index wins.
    return typeof document === 'undefined' ? toaster : createPortal(toaster, document.body);
}
