/**
 * The modal shell both lightboxes share: a native <dialog> opened with showModal(), so the browser
 * supplies the top layer, the focus trap and the inert page behind it. Focus moves into the dialog
 * on open and returns to the opener on close. Escape closes; the arrow keys move, unless a player
 * or a field has them.
 */
import { useEffect, useImperativeHandle, useRef, type ComponentProps, type KeyboardEvent, type Ref } from 'react';
import { createPortal } from 'react-dom';

export interface LightboxDialogProps extends Omit<ComponentProps<'dialog'>, 'open' | 'onClose' | 'onCancel' | 'ref'> {
    ref?: Ref<HTMLDialogElement>;
    /** Accessible name, announced when the dialog opens */
    label: string;
    onClose: () => void;
    /** Arrow keys; leave undefined when there is nowhere to go */
    onPrevious?: () => void;
    onNext?: () => void;
}

const ownsArrowKeys = (target: EventTarget | null) =>
    target instanceof Element && target.closest('video, audio, input, textarea, select') !== null;

export function LightboxDialog({
    ref,
    label,
    className,
    onClose,
    onPrevious,
    onNext,
    onKeyDown,
    onClick,
    children,
    ...rest
}: LightboxDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    /** What had focus before the dialog did; kept across StrictMode's re-run of the effect */
    const openerRef = useRef<Element | null>(null);
    useImperativeHandle(ref, () => dialogRef.current!, []);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return undefined;
        openerRef.current ??= document.activeElement;
        // jsdom and very old browsers have no showModal; a plain open dialog still renders
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
        dialog.focus();
        const { overflow } = document.body.style;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = overflow;
            // React removes the dialog after this runs, and nothing outside a modal can take focus
            // until then, so give it back once the removal has landed.
            queueMicrotask(() => {
                const opener = openerRef.current;
                if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
            });
        };
    }, []);

    const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === 'Escape') {
            // Handled here, so the browser must not also close the dialog underneath React
            event.preventDefault();
            onClose();
        } else if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !ownsArrowKeys(event.target)) {
            (event.key === 'ArrowLeft' ? onPrevious : onNext)?.();
        }
    };

    return createPortal(
        <dialog
            ref={dialogRef}
            tabIndex={-1}
            aria-modal="true"
            aria-label={label}
            data-medialightbox
            className={`fixed inset-0 m-0 h-full max-h-none w-full max-w-none border-0 p-0 outline-none ${className ?? ''}`}
            onKeyDown={handleKeyDown}
            onCancel={(event) => event.preventDefault()}
            onClose={onClose}
            onClick={(event) => {
                onClick?.(event);
                // The dialog itself is only hit where nothing covers it: the backdrop
                if (event.target === event.currentTarget) onClose();
            }}
            {...rest}
        >
            {children}
        </dialog>,
        document.body,
    );
}
