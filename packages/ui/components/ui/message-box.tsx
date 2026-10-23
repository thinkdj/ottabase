import {
    CircleCheck,
    CircleHelp,
    CircleX,
    Info,
    LoaderCircle,
    Lock,
    TriangleAlert,
    WifiOff,
    type LucideIcon,
} from 'lucide-react';
import * as React from 'react';

import { cn } from '@ottabase/ui/lib/utils';
import { Spinner } from './spinner';

export type SkeletonType = 'spinner' | 'skeleton';

export type MessageTypes =
    | 'info'
    | 'error'
    | 'warning'
    | 'success'
    | 'help'
    | 'loginRequired'
    | 'disconnected'
    | 'loading';

export interface MessageBoxProps {
    isLoading?: boolean;
    loadingType?: SkeletonType;
    message?: React.ReactNode | Error | Record<string, unknown> | string;
    messageType?: MessageTypes;
    width?: string | number;
}

const MESSAGE_ICONS: Record<MessageTypes, { icon: LucideIcon; className: string }> = {
    info: { icon: Info, className: 'text-info' },
    error: { icon: CircleX, className: 'text-destructive' },
    warning: { icon: TriangleAlert, className: 'text-warning' },
    success: { icon: CircleCheck, className: 'text-success' },
    help: { icon: CircleHelp, className: 'text-primary' },
    loginRequired: { icon: Lock, className: 'text-muted-foreground' },
    disconnected: { icon: WifiOff, className: 'text-muted-foreground' },
    loading: { icon: LoaderCircle, className: 'text-primary' },
};

function Loading({ skeletonType = 'spinner', width }: { skeletonType?: SkeletonType; width?: string | number }) {
    if (skeletonType !== 'skeleton') {
        return <Spinner className="size-12 text-primary" />;
    }

    // Tailwind only generates classes it finds in source, so a runtime `w-[300px]` never
    // exists. CSS lengths (300, '300px', '50%', '20rem') go inline; anything else is
    // treated as a Tailwind class (e.g. 'w-96').
    const isLength = typeof width === 'number' || (typeof width === 'string' && /^[\d.]/.test(width));
    const widthClass = !width ? 'w-full' : isLength ? '' : width;
    const widthStyle = width && isLength ? { width: typeof width === 'number' ? `${width}px` : width } : undefined;

    return (
        <div
            className={cn('flex flex-col items-center gap-4', widthClass)}
            style={widthStyle}
            role="status"
            aria-live="polite"
        >
            {/* Icon placeholder */}
            <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-muted" />

            {/* Content area: a title line, four body lines and an action */}
            <div className={cn('flex w-full flex-col gap-3', !width && 'max-w-md')}>
                <div className="h-5 w-4/5 animate-pulse rounded bg-muted" />
                <div className="flex w-full flex-col gap-2">
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                </div>
                <div className="mt-2 h-8 w-32 animate-pulse rounded bg-muted" />
            </div>
        </div>
    );
}

/** Resolves the message to renderable content; an `Error` also forces the error type. */
function resolveMessage(
    message: MessageBoxProps['message'],
    messageType: MessageTypes,
): { content: React.ReactNode; type: MessageTypes } {
    if (React.isValidElement(message) || typeof message === 'string') {
        return { content: message, type: messageType };
    }
    if (message instanceof Error) {
        return { content: message.message || message.name, type: 'error' };
    }
    if (message && typeof message === 'object') {
        return {
            content: (
                <pre className="max-w-full whitespace-pre-wrap break-words text-left text-sm">
                    {JSON.stringify(message, null, 2)}
                </pre>
            ),
            type: messageType,
        };
    }
    return { content: 'An error has occurred.', type: messageType };
}

/**
 * A centered status panel: one icon and one message for an empty, failed, locked or loading
 * region. Accepts a string, a node, an `Error` (shown as an error) or a plain object (shown as
 * JSON). For an inline notice inside a form or card, use `Alert` instead.
 */
function MessageBox({ isLoading, loadingType, message, messageType = 'info', width }: MessageBoxProps) {
    if (isLoading) {
        return (
            <div
                data-slot="message-box"
                className="flex h-full min-h-32 w-full flex-col items-center justify-center rounded-md p-8 text-center"
            >
                <Loading skeletonType={loadingType} width={width} />
            </div>
        );
    }

    const { content, type } = resolveMessage(message, messageType);
    const { icon: Icon, className: iconClassName } = MESSAGE_ICONS[type] ?? MESSAGE_ICONS.info;

    return (
        <div
            role="status"
            data-slot="message-box"
            data-type={type}
            className={cn(
                'flex h-full min-h-32 w-full flex-col items-center justify-center rounded-md p-8 text-center',
                type === 'error' ? 'cursor-not-allowed' : 'cursor-default',
            )}
        >
            <Icon size={54} strokeWidth={1.25} className={cn('mb-2.5', iconClassName)} aria-hidden="true" />
            <div className="text-base text-foreground">{content}</div>
        </div>
    );
}

export { MessageBox };
