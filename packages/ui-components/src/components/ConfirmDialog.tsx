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
    onConfirm?: React.MouseEventHandler<HTMLButtonElement>;
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
            onClick={onConfirm}
            {...restConfirmProps}
        >
            {resolvedConfirmLabel}
        </AlertDialogAction>
    );
    const cancelAction = (
        <AlertDialogCancel className={cancelClassName} onClick={onCancel} {...restCancelProps}>
            {resolvedCancelLabel}
        </AlertDialogCancel>
    );

    return (
        <AlertDialog {...rootProps}>
            {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
            <AlertDialogContent className={contentClassName} {...restContentProps}>
                <AlertDialogHeader>
                    <AlertDialogTitle className={hideTitle || !title ? 'sr-only' : undefined}>
                        {resolvedTitle}
                    </AlertDialogTitle>
                    {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
                </AlertDialogHeader>
                {children}
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
