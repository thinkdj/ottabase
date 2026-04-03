import { MediaLibraryBrowser } from '@/components/media-library/MediaLibraryBrowser';
import type { MediaKind, toMediaSelectionPayload } from '@ottabase/medialibrary';
import { Dialog, DialogContent } from '@ottabase/ui-shadcn';
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
    function dispatchSelected(payload: ReturnType<typeof toMediaSelectionPayload>) {
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
        <Dialog
            open={isOpen}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) closeAndReset();
            }}
        >
            <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
                <MediaLibraryBrowser
                    title="Media picker"
                    description="Search your uploads, inspect metadata, and insert the selected file into the editor."
                    emptyTitle="No matching media yet"
                    emptyDescription="Upload a file here to add it to the library and use it immediately."
                    acceptKinds={acceptKinds}
                    mode="picker"
                    allowMultiselect={allowMultiselect}
                    onSelectItem={(payload) => {
                        // Single-select path: fire once and close
                        dispatchSelected(payload);
                        closeAndReset();
                    }}
                    onSelectItems={(payloads) => {
                        // Multi-select path: fire for every selected item, then close
                        payloads.forEach(dispatchSelected);
                        closeAndReset();
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}
