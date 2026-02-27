/**
 * Avatar Edit Modal
 * Uses @ottabase/ui-cropper to crop image, uploads via /api/upload, updates user profile.
 */

import { api } from '@/lib/api';
import { Cropper } from '@ottabase/ui-cropper';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@ottabase/ui-shadcn';
import { IconLoader2 } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface AvatarEditModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: (imageUrl: string) => void;
    onError?: (message: string) => void;
}

export function AvatarEditModal({ open, onOpenChange, onSuccess, onError }: AvatarEditModalProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const cropperRef = useRef<Cropper | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Reset when modal closes
    useEffect(() => {
        if (!open) {
            setSelectedFile(null);
            cropperRef.current?.destroy();
            cropperRef.current = null;
        }
    }, [open]);

    // Create cropper when we have a file and container
    useEffect(() => {
        if (!open || !containerRef.current || !selectedFile) return;

        cropperRef.current = new Cropper(containerRef.current, {
            aspectRatio: 1,
            shape: 'circle',
            maxHeight: 320,
            transitions: true,
            aspectPresets: false,
        });

        cropperRef.current.loadFromFile(selectedFile);

        return () => {
            cropperRef.current?.destroy();
            cropperRef.current = null;
        };
    }, [open, selectedFile]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.match(/^image\/(png|jpeg|jpg)$/)) {
            setSelectedFile(file);
        }
        // Reset input so same file can be selected again
        e.target.value = '';
    }, []);

    const handleChooseImage = () => fileInputRef.current?.click();

    const handleSave = async () => {
        const cropper = cropperRef.current;
        if (!cropper || !selectedFile) return;

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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit profile picture</DialogTitle>
                    <DialogDescription>
                        Crop your image. Square or circular crop will be used for your avatar.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={handleFileSelect}
                        className="hidden"
                        aria-hidden
                    />

                    {!selectedFile ? (
                        <div
                            className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-6 transition-colors hover:border-muted-foreground/50 hover:bg-muted/50 dark:bg-muted/10"
                            onClick={handleChooseImage}
                            onKeyDown={(e) => e.key === 'Enter' && handleChooseImage()}
                            role="button"
                            tabIndex={0}
                            aria-label="Choose image"
                        >
                            <p className="text-sm text-muted-foreground">Click to choose an image</p>
                            <p className="text-xs text-muted-foreground">PNG or JPEG</p>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleChooseImage();
                                }}
                            >
                                Choose image
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Cropper container - hide built-in file input */}
                            <div
                                ref={containerRef}
                                className="[&>input[type=file]]:hidden rounded-lg border bg-muted/30 p-4 dark:bg-muted/10"
                                style={{ minHeight: 120 }}
                            />
                            <Button type="button" variant="outline" size="sm" onClick={handleChooseImage}>
                                Change image
                            </Button>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={!selectedFile || isUploading}>
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
    );
}
