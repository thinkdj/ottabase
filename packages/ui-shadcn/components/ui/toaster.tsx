'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Toaster as Sonner } from 'sonner';

export type ToasterProps = React.ComponentProps<typeof Sonner>;

export function Toaster({ style, ...props }: ToasterProps) {
    const toastStyle = {
        zIndex: 'var(--z-toast, 100)',
        '--normal-bg': 'hsl(var(--background) / 0.96)',
        '--normal-border': 'hsl(var(--border))',
        '--normal-text': 'hsl(var(--foreground))',
        '--success-bg': 'hsl(var(--success) / 0.96)',
        '--success-border': 'hsl(var(--success) / 0.96)',
        '--success-text': 'hsl(var(--success-foreground))',
        '--error-bg': 'hsl(var(--destructive) / 0.96)',
        '--error-border': 'hsl(var(--destructive) / 0.96)',
        '--error-text': 'hsl(var(--destructive-foreground))',
        '--warning-bg': 'hsl(var(--warning) / 0.96)',
        '--warning-border': 'hsl(var(--warning) / 0.96)',
        '--warning-text': 'hsl(var(--warning-foreground))',
        '--info-bg': 'hsl(var(--info) / 0.96)',
        '--info-border': 'hsl(var(--info) / 0.96)',
        '--info-text': 'hsl(var(--info-foreground))',
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
            richColors
            style={toastStyle}
            toastOptions={{
                classNames: {
                    toast: 'group toast shadow-lg',
                    description: 'group-[.toast]:!text-current/80',
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
