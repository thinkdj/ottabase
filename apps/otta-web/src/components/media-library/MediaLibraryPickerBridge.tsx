import { MediaPickerDialog } from '@/components/media-library/MediaPickerDialog';
import type { MediaKind, MediaSelectionPayload } from '@ottabase/medialibrary';
import { useEffect, useRef, useState } from 'react';

interface MediaLibraryOpenDetail {
    acceptKinds?: MediaKind[];
    source?: string;
    /** When true the picker opens in multi-select mode; caller handles each payload */
    multiselect?: boolean;
    /** Optional field identifier for routing the selection back to the correct input */
    field?: string;
}

export function MediaLibraryPickerBridge() {
    const [isOpen, setIsOpen] = useState(false);
    const [acceptKinds, setAcceptKinds] = useState<MediaKind[] | undefined>(undefined);
    const [allowMultiselect, setAllowMultiselect] = useState(false);
    /** Store the field identifier from the open event to pass through on selection */
    const fieldRef = useRef<string | undefined>(undefined);

    /** Fires the shared window event for a single media selection payload. */
    function dispatchSelected(payload: MediaSelectionPayload) {
        window.dispatchEvent(
            new CustomEvent('media-library-selected-item', {
                detail: {
                    media: payload,
                    openedVia: 'programmatic',
                    field: fieldRef.current,
                },
            }),
        );
    }

    function closeAndReset() {
        setIsOpen(false);
        setAcceptKinds(undefined);
        setAllowMultiselect(false);
        fieldRef.current = undefined;
    }

    useEffect(() => {
        const handleOpen = (event: Event) => {
            const detail = (event as CustomEvent<MediaLibraryOpenDetail>).detail;
            setAcceptKinds(detail?.acceptKinds);
            setAllowMultiselect(Boolean(detail?.multiselect));
            fieldRef.current = detail?.field;
            setIsOpen(true);
        };

        window.addEventListener('media-library-open', handleOpen as EventListener);
        return () => {
            window.removeEventListener('media-library-open', handleOpen as EventListener);
        };
    }, []);

    return (
        <MediaPickerDialog
            open={isOpen}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) closeAndReset();
            }}
            title={allowMultiselect ? 'Insert media' : 'Insert a file'}
            acceptKinds={acceptKinds}
            multiple={allowMultiselect}
            // One event per item, in the order they were picked
            onPick={(payloads) => payloads.forEach(dispatchSelected)}
        />
    );
}
