/**
 * MediaPickerDialog: the one dialog for choosing media (editor tools via the
 * window-event bridge, blog hero image, photo journal). Full screen on phones,
 * a large sheet on desktop; the browser's bottom bar carries the confirm button.
 */

import { MediaLibraryBrowser } from '@/components/media-library/MediaLibraryBrowser';
import type { MediaKind, MediaSelectionPayload } from '@ottabase/medialibrary';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@ottabase/ui-shadcn';

export interface MediaPickerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    acceptKinds?: MediaKind[];
    /** Pick several, in tap order */
    multiple?: boolean;
    confirmLabel?: string;
    /** Receives the picks (one item unless `multiple`); the dialog closes after */
    onPick: (items: MediaSelectionPayload[]) => void;
}

export function MediaPickerDialog({
    open,
    onOpenChange,
    title,
    description,
    acceptKinds,
    multiple = false,
    confirmLabel = multiple ? 'Insert' : 'Use this',
    onPick,
}: MediaPickerDialogProps) {
    const pick = (items: MediaSelectionPayload[]) => {
        onPick(items);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[90vh] sm:max-w-6xl sm:rounded-xl">
                <DialogHeader className="border-b border-border px-4 py-3 pr-12 text-left sm:px-6 sm:py-4">
                    <DialogTitle>{title}</DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>
                {/* Scroll container: the browser's pick bar sticks to its bottom */}
                <div className="min-h-0 flex-1 overflow-y-auto">
                    {open && (
                        <MediaLibraryBrowser
                            mode="picker"
                            title={title}
                            description={description ?? ''}
                            emptyTitle="Nothing here yet"
                            emptyDescription="Upload a file, or drop one here, and it is ready to use."
                            acceptKinds={acceptKinds}
                            allowMultiselect={multiple}
                            allowDelete={false}
                            confirmLabel={confirmLabel}
                            onSelectItem={(item) => pick([item])}
                            onSelectItems={pick}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
