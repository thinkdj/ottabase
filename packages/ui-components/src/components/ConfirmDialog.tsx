'use client';

import * as React from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
    buttonVariants,
    cn,
} from '@ottabase/ui-shadcn';

export type ConfirmDialogTone = 'default' | 'destructive' | 'unsaved-changes';

export interface ConfirmDialogProps extends Omit<React.ComponentPropsWithoutRef<typeof AlertDialog>, 'children'> {
    title?: React.ReactNode;
    /**
     * Keeps a semantic title in the DOM for screen readers while hiding it visually.
     * Useful when the product design does not want a visible title.
     */
    hideTitle?: boolean;
    /**
     * Accessible fallback title when `title` is omitted. Defaults to "Confirm action".
     */
    a11yTitle?: React.ReactNode;
    description?: React.ReactNode;
    children?: React.ReactNode;
    trigger?: React.ReactElement;
    tone?: ConfirmDialogTone;
    primaryActionText?: React.ReactNode;
    secondaryActionText?: React.ReactNode;
    confirmLabel?: React.ReactNode;
    cancelLabel?: React.ReactNode;
    /**
     * Runs on confirm. Return a promise to keep the dialog open while it runs:
     * buttons disable, Escape/outside clicks are ignored, it closes on success
     * and shows the error inline (staying open) on failure.
     */
    onConfirm?: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
    onCancel?: React.MouseEventHandler<HTMLButtonElement>;
    contentProps?: React.ComponentPropsWithoutRef<typeof AlertDialogContent>;
    confirmProps?: Omit<React.ComponentPropsWithoutRef<typeof AlertDialogAction>, 'children' | 'onClick'>;
    cancelProps?: Omit<React.ComponentPropsWithoutRef<typeof AlertDialogCancel>, 'children' | 'onClick'>;
}

export function ConfirmDialog({
    title,
    hideTitle = false,
    a11yTitle,
    description,
    children,
    trigger,
    tone = 'default',
    primaryActionText,
    secondaryActionText,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
    contentProps,
    confirmProps,
    cancelProps,
    ...rootProps
}: ConfirmDialogProps) {
    const { open: openProp, defaultOpen, onOpenChange, ...restRootProps } = rootProps;
    const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false);
    const [pending, setPending] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const open = openProp ?? internalOpen;

    const setOpen = (next: boolean) => {
        if (pending) return; // stay put while the action runs
        if (next) setError(null);
        if (openProp === undefined) setInternalOpen(next);
        onOpenChange?.(next);
    };

    const handleConfirm = (event: React.MouseEvent<HTMLButtonElement>) => {
        const result = onConfirm?.(event);
        if (!(result instanceof Promise)) return; // sync: AlertDialogAction closes as before
        event.preventDefault();
        setPending(true);
        setError(null);
        result.then(
            () => {
                setPending(false);
                if (openProp === undefined) setInternalOpen(false);
                onOpenChange?.(false);
            },
            (cause: unknown) => {
                setPending(false);
                setError(cause instanceof Error && cause.message ? cause.message : 'Something went wrong. Try again.');
            },
        );
    };

    const isDestructiveTone = tone === 'destructive' || tone === 'unsaved-changes';
    const isUnsavedChangesTone = tone === 'unsaved-changes';
    const resolvedConfirmLabel =
        primaryActionText ?? confirmLabel ?? (isUnsavedChangesTone ? 'Leave without saving' : 'Confirm');
    const resolvedCancelLabel =
        secondaryActionText ?? cancelLabel ?? (isUnsavedChangesTone ? 'Stay and keep editing' : 'Cancel');
    const resolvedTitle = title ?? a11yTitle ?? 'Confirm action';
    const { className: contentClassName, ...restContentProps } = contentProps ?? {};
    const { className: confirmClassName, ...restConfirmProps } = confirmProps ?? {};
    const { className: cancelClassName, ...restCancelProps } = cancelProps ?? {};
    const confirmAction = (
        <AlertDialogAction
            className={cn(isDestructiveTone ? buttonVariants({ variant: 'destructive' }) : undefined, confirmClassName)}
            {...restConfirmProps}
            onClick={handleConfirm}
            disabled={pending || restConfirmProps.disabled}
            aria-busy={pending || undefined}
        >
            {pending ? (
                <span
                    aria-hidden="true"
                    className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
                />
            ) : null}
            {resolvedConfirmLabel}
        </AlertDialogAction>
    );
    const cancelAction = (
        <AlertDialogCancel
            className={cancelClassName}
            {...restCancelProps}
            onClick={onCancel}
            disabled={pending || restCancelProps.disabled}
        >
            {resolvedCancelLabel}
        </AlertDialogCancel>
    );

    return (
        <AlertDialog {...restRootProps} open={open} onOpenChange={setOpen}>
            {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
            <AlertDialogContent className={contentClassName} {...restContentProps}>
                <AlertDialogHeader>
                    <AlertDialogTitle className={hideTitle || !title ? 'sr-only' : undefined}>
                        {resolvedTitle}
                    </AlertDialogTitle>
                    {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
                </AlertDialogHeader>
                {children}
                {error ? (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                ) : null}
                <AlertDialogFooter>
                    {isUnsavedChangesTone ? (
                        <>
                            {confirmAction}
                            {cancelAction}
                        </>
                    ) : (
                        <>
                            {cancelAction}
                            {confirmAction}
                        </>
                    )}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
