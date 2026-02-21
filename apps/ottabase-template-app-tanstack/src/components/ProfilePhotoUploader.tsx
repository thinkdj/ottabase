/**
 * ProfilePhotoUploader
 *
 * Lets the user pick an image, crop it to a circle (1:1), and upload the result
 * to the configured storage backend via POST /api/upload.
 *
 * Uses:
 *  - @ottabase/cropper — zero-React vanilla image cropper
 *  - POST /api/upload  — existing upload endpoint (R2 / Cloudflare Images)
 */

import { Avatar, AvatarFallback, AvatarImage, Button } from '@ottabase/ui-shadcn';
import type { Cropper } from '@ottabase/cropper';
import { Loader2, Pencil, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface ProfilePhotoUploaderProps {
    /** Current avatar URL shown before any upload. */
    currentImageUrl?: string | null;
    /** User initials for the fallback avatar. */
    initials?: string;
    /** Called with the uploaded image URL on success. */
    onUploaded: (url: string) => void;
    /** Optionally override the upload endpoint (default: /api/upload). */
    uploadEndpoint?: string;
    /** Disable the component. */
    disabled?: boolean;
}

type Stage = 'idle' | 'cropping' | 'uploading';

export function ProfilePhotoUploader({
    currentImageUrl,
    initials = '?',
    onUploaded,
    uploadEndpoint = '/api/upload',
    disabled = false,
}: ProfilePhotoUploaderProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cropContainerRef = useRef<HTMLDivElement>(null);
    const cropperRef = useRef<Cropper | null>(null);
    // Pending file waiting for cropContainerRef to mount
    const pendingFileRef = useRef<File | null>(null);

    const [stage, setStage] = useState<Stage>('idle');
    const [error, setError] = useState<string | null>(null);

    // Destroy cropper on unmount
    useEffect(() => {
        return () => {
            cropperRef.current?.destroy();
            cropperRef.current = null;
        };
    }, []);

    const openFilePicker = () => {
        setError(null);
        fileInputRef.current?.click();
    };

    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input so picking the same file again triggers the event
        e.target.value = '';

        if (!file.type.startsWith('image/')) {
            setError('Please select an image file (PNG, JPEG, WebP).');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setError('Image must be smaller than 10 MB.');
            return;
        }

        // Destroy any previous cropper instance
        cropperRef.current?.destroy();
        cropperRef.current = null;

        // Store the file; the ref callback on the crop container will initialise
        // the cropper once the div is in the DOM.
        pendingFileRef.current = file;
        setStage('cropping');
    }, []);

    /**
     * Ref callback for the crop container div.
     * Called with the element when it mounts (stage === 'cropping') and with null on unmount.
     */
    const handleCropContainerMount = useCallback(async (el: HTMLDivElement | null) => {
        // Store for later use (confirm/cancel)
        (cropContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;

        if (!el || !pendingFileRef.current) return;

        const { Cropper: CropperClass } = await import('@ottabase/cropper');

        // Guard: component might have been unmounted by the time the import resolves
        if (!pendingFileRef.current) return;

        const file = pendingFileRef.current;
        pendingFileRef.current = null;

        const cropper = new CropperClass(el, {
            aspectRatio: 1,
            shape: 'circle',
            maxHeight: 320,
        });
        cropperRef.current = cropper;
        await cropper.loadFile(file);
    }, []);

    const handleCancelCrop = () => {
        cropperRef.current?.destroy();
        cropperRef.current = null;
        setStage('idle');
        setError(null);
    };

    const handleConfirmCrop = useCallback(async () => {
        const cropper = cropperRef.current;
        if (!cropper) return;

        setError(null);
        setStage('uploading');

        try {
            const blob = await cropper.getBlob('image/jpeg', 0.9);

            const formData = new FormData();
            formData.append('file', blob, 'avatar.jpg');

            const res = await fetch(uploadEndpoint, { method: 'POST', body: formData });

            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(text || `Upload failed (${res.status})`);
            }

            const json = (await res.json()) as { url?: string; key?: string; success?: boolean };
            const url = json.url;

            if (!url) throw new Error('Upload succeeded but no URL was returned.');

            cropper.destroy();
            cropperRef.current = null;

            onUploaded(url);
            setStage('idle');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
            setStage('cropping'); // Return to crop stage so user can retry
        }
    }, [onUploaded, uploadEndpoint]);

    return (
        <div className="flex flex-col items-start gap-3">
            {/* Avatar preview + edit button */}
            <div className="relative">
                <Avatar className="h-20 w-20">
                    <AvatarImage src={currentImageUrl || undefined} />
                    <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                </Avatar>

                {stage === 'idle' && !disabled && (
                    <button
                        type="button"
                        onClick={openFilePicker}
                        className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-muted transition-colors"
                        aria-label="Change profile photo"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={disabled}
            />

            {/* Cropper stage */}
            {stage === 'cropping' && (
                <div className="w-full space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Drag to reposition · scroll to zoom · use handles to resize
                    </p>

                    {/* The cropper mounts here; ref callback initialises it once in DOM */}
                    <div
                        ref={handleCropContainerMount}
                        className="rounded-lg border bg-muted/30 dark:bg-muted/10"
                        style={{ minHeight: 280 }}
                    />

                    <div className="flex gap-2">
                        <Button size="sm" onClick={handleConfirmCrop} className="gap-1.5">
                            <Upload className="h-4 w-4" />
                            Upload
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleCancelCrop} className="gap-1.5">
                            <X className="h-4 w-4" />
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {/* Uploading stage */}
            {stage === 'uploading' && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading…
                </div>
            )}

            {/* Idle change-photo link */}
            {stage === 'idle' && !disabled && (
                <button
                    type="button"
                    onClick={openFilePicker}
                    className="text-sm text-primary underline-offset-4 hover:underline"
                >
                    Change photo
                </button>
            )}

            {/* Error */}
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}
