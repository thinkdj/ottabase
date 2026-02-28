/**
 * Avatar Edit Modal
 * Shows cropper directly – user picks or changes image via the cropper's built-in "Choose image" button.
 * Supports pre-loading the current avatar (URL, base64, or blob).
 */

import { api } from '@/lib/api';
import { Cropper } from '@ottabase/ui-cropper';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@ottabase/ui-shadcn';
import { IconLoader2, IconTrash } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';

interface AvatarEditModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: (imageUrl: string) => void;
    onRemove?: () => void;
    onError?: (message: string) => void;
    /** When true, shows "Remove current photo" option */
    hasImage?: boolean;
    /** Current avatar URL/base64 – pre-loaded into cropper when modal opens */
    currentImageUrl?: string | null;
}

export function AvatarEditModal({
    open,
    onOpenChange,
    onSuccess,
    onRemove,
    onError,
    hasImage,
    currentImageUrl,
}: AvatarEditModalProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const cropperRef = useRef<Cropper | null>(null);
    /** Tracks whether the user has loaded any image (via file picker or pre-load) */
    const [hasLoadedImage, setHasLoadedImage] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

    // Mount cropper when modal opens; destroy on close
    useEffect(() => {
        if (!open) {
            setHasLoadedImage(false);
            cropperRef.current?.destroy();
            cropperRef.current = null;
            return;
        }

        // Wait one tick for the dialog DOM to render
        const raf = requestAnimationFrame(() => {
            if (!containerRef.current) return;

            cropperRef.current = new Cropper(containerRef.current, {
                aspectRatio: 1,
                shape: 'circle',
                maxHeight: 320,
                transitions: true,
                aspectPresets: false,
                // Fires when any image is loaded (file picker or pre-load URL)
                onImageLoad: () => setHasLoadedImage(true),
            });

            // Pre-load current avatar if available
            if (currentImageUrl) {
                cropperRef.current.loadFromUrl(currentImageUrl);
            }
        });

        return () => {
            cancelAnimationFrame(raf);
            cropperRef.current?.destroy();
            cropperRef.current = null;
        };
    }, [open, currentImageUrl]);

    const handleRemove = async () => {
        if (!hasImage || !onRemove) return;
        setIsRemoving(true);
        try {
            // Send null image to clear profile picture server-side
            await api('/api/users/me', {
                method: 'PATCH',
                body: { image: null },
            });
            // Close dialogs first, then notify parent
            setRemoveConfirmOpen(false);
            onRemove();
            onOpenChange(false);
        } catch (err) {
            console.error('Avatar remove failed:', err);
            setRemoveConfirmOpen(false);
            onError?.(err instanceof Error ? err.message : 'Failed to remove profile picture');
        } finally {
            setIsRemoving(false);
        }
    };

    const handleSave = async () => {
        const cropper = cropperRef.current;
        if (!cropper || !hasLoadedImage) return;

        setIsUploading(true);
        try {
            // PNG for circular crop (transparent corners); JPEG would render them black
            const blob = await cropper.getBlob('image/png');
            const file = new File([blob], 'avatar.png', { type: 'image/png' });

            const formData = new FormData();
            formData.append('file', file);
            formData.append('provider', 'r2');
            formData.append('key', 'avatar'); // Fixed key {userId}/avatar.png - overwrites on each upload

            const uploadRes = await api<{ success: boolean; url?: string; key?: string }>('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!uploadRes?.success || !uploadRes.url) {
                throw new Error('Upload failed');
            }

            // Make URL absolute if relative (e.g. /api/upload/file/xyz)
            const imageUrl = uploadRes.url.startsWith('http')
                ? uploadRes.url
                : `${window.location.origin}${uploadRes.url}`;

            const patchRes = await api<Record<string, any>>('/api/users/me', {
                method: 'PATCH',
                body: { image: imageUrl },
            });

            const updatedUser =
                patchRes && typeof patchRes === 'object' && 'data' in patchRes
                    ? (patchRes as { data?: Record<string, any> }).data
                    : patchRes;
            if (updatedUser?.image) {
                onSuccess(updatedUser.image);
            } else {
                onSuccess(imageUrl);
            }

            onOpenChange(false);
        } catch (err) {
            console.error('Avatar upload failed:', err);
            onError?.(err instanceof Error ? err.message : 'Failed to update profile picture');
            throw err;
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit profile picture</DialogTitle>
                        <DialogDescription>
                            {currentImageUrl
                                ? 'Re-crop or choose a new image for your avatar.'
                                : 'Choose an image and crop it for your avatar.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Cropper renders its own "Choose image" button + filename label */}
                        <div
                            ref={containerRef}
                            className="rounded-lg border bg-muted/30 p-4 dark:bg-muted/10"
                            style={{ minHeight: 120 }}
                        />

                        {hasImage && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setRemoveConfirmOpen(true)}
                                disabled={isRemoving}
                            >
                                {isRemoving ? (
                                    <>
                                        <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Removing...
                                    </>
                                ) : (
                                    <>
                                        <IconTrash className="mr-2 h-4 w-4" />
                                        Remove current photo
                                    </>
                                )}
                            </Button>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={!hasLoadedImage || isUploading}>
                            {isUploading ? (
                                <>
                                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove profile picture?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove your profile picture? You can add a new one anytime.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
                        {/* Prevent Radix auto-close so the loading state is visible
                            while the async PATCH completes. Close manually on success. */}
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleRemove();
                            }}
                            disabled={isRemoving}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isRemoving ? (
                                <>
                                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Removing...
                                </>
                            ) : (
                                'Remove'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
