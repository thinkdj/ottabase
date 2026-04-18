import { useState, useCallback } from 'react';
import type { UploadFile, UploadConfig, UploadResponse } from '../types';
import { validateFiles } from '../validation';

export interface UseFileUploadOptions extends UploadConfig {
    onUploadComplete?: (files: UploadFile[]) => void;
    onUploadError?: (error: Error) => void;
    onUploadProgress?: (progress: number, file: UploadFile) => void;
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
    const [files, setFiles] = useState<UploadFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const {
        maxFiles = 1,
        maxFileSize,
        acceptedFileTypes,
        uploadEndpoint = '/api/upload',
        autoUpload = false,
        provider = 'r2',
        onUploadComplete,
        onUploadError,
        onUploadProgress,
    } = options;

    /**
     * Add files to upload queue
     */
    const addFiles = useCallback(
        (newFiles: File[]) => {
            // Validate files
            const validation = validateFiles(newFiles, {
                maxFiles: maxFiles - files.length,
                maxFileSize,
                acceptedFileTypes,
            });

            if (!validation.valid) {
                const error = new Error(validation.errors.join(', '));
                onUploadError?.(error);
                return;
            }

            // Create upload file objects
            const uploadFiles: UploadFile[] = newFiles.map((file) => ({
                id: crypto.randomUUID(),
                file,
                status: 'pending',
                progress: 0,
            }));

            setFiles((prev) => [...prev, ...uploadFiles]);

            // Auto-upload if enabled
            if (autoUpload) {
                uploadFiles.forEach((uploadFile) => {
                    uploadFile.status = 'uploading';
                    uploadSingleFile(uploadFile);
                });
            }
        },
        [files.length, maxFiles, maxFileSize, acceptedFileTypes, autoUpload, onUploadError],
    );

    /**
     * Upload a single file
     */
    const uploadSingleFile = async (uploadFile: UploadFile) => {
        try {
            // Update status
            setFiles((prev) =>
                prev.map((f) => (f.id === uploadFile.id ? { ...f, status: 'uploading', progress: 0 } : f)),
            );

            // Create form data
            const formData = new FormData();
            formData.append('file', uploadFile.file);
            formData.append('provider', provider);

            // Upload with progress tracking
            const xhr = new XMLHttpRequest();

            // Progress handler
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const progress = Math.round((e.loaded / e.total) * 100);
                    setFiles((prev) => prev.map((f) => (f.id === uploadFile.id ? { ...f, progress } : f)));
                    onUploadProgress?.(progress, uploadFile);
                }
            });

            // Response handler
            return new Promise<UploadResponse>((resolve, reject) => {
                xhr.addEventListener('load', () => {
                    // Wrap in try/catch: throwing inside an XHR async callback won't be caught
                    // by the Promise — we must call reject() explicitly.
                    try {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            const response = JSON.parse(xhr.responseText) as UploadResponse;

                            if (response.success) {
                                setFiles((prev) =>
                                    prev.map((f) =>
                                        f.id === uploadFile.id
                                            ? {
                                                  ...f,
                                                  status: 'success',
                                                  progress: 100,
                                                  url: response.url,
                                                  key: response.key,
                                              }
                                            : f,
                                    ),
                                );
                                resolve(response);
                            } else {
                                throw new Error(response.error || 'Upload failed');
                            }
                        } else {
                            // Parse server error message when available (e.g., 401 JSON body)
                            let message = `Upload failed with status ${xhr.status}`;
                            try {
                                const errBody = JSON.parse(xhr.responseText) as { error?: string; message?: string };
                                if (errBody.error || errBody.message) {
                                    message = errBody.error || errBody.message || message;
                                }
                            } catch {
                                // response was not JSON — keep default message
                            }
                            throw new Error(message);
                        }
                    } catch (err) {
                        const error = err instanceof Error ? err : new Error('Upload failed');
                        setFiles((prev) =>
                            prev.map((f) =>
                                f.id === uploadFile.id ? { ...f, status: 'error', error: error.message } : f,
                            ),
                        );
                        onUploadError?.(error);
                        reject(error);
                    }
                });

                xhr.addEventListener('error', () => {
                    const error = new Error('Network error during upload');
                    setFiles((prev) =>
                        prev.map((f) => (f.id === uploadFile.id ? { ...f, status: 'error', error: error.message } : f)),
                    );
                    onUploadError?.(error);
                    reject(error);
                });

                xhr.open('POST', uploadEndpoint);
                xhr.send(formData);
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Upload failed';
            setFiles((prev) =>
                prev.map((f) => (f.id === uploadFile.id ? { ...f, status: 'error', error: errorMessage } : f)),
            );
            onUploadError?.(error instanceof Error ? error : new Error(errorMessage));
            throw error;
        }
    };

    /**
     * Upload all pending files
     */
    const uploadAll = useCallback(async () => {
        setIsUploading(true);

        try {
            const pendingFiles = files.filter((f) => f.status === 'pending');

            if (pendingFiles.length === 0) {
                return;
            }

            // Upload all files
            await Promise.all(pendingFiles.map((file) => uploadSingleFile(file)));

            // Call completion callback
            const uploadedFiles = files.filter((f) => f.status === 'success');
            onUploadComplete?.(uploadedFiles);
        } catch (error) {
            onUploadError?.(error instanceof Error ? error : new Error('Upload failed'));
        } finally {
            setIsUploading(false);
        }
    }, [files, onUploadComplete, onUploadError]);

    /**
     * Remove a file from the upload queue
     */
    const removeFile = useCallback((fileId: string) => {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
    }, []);

    /**
     * Clear all files
     */
    const clearFiles = useCallback(() => {
        setFiles([]);
    }, []);

    /**
     * Retry failed upload
     */
    const retryUpload = useCallback(
        async (fileId: string) => {
            const file = files.find((f) => f.id === fileId);
            if (file && file.status === 'error') {
                await uploadSingleFile(file);
            }
        },
        [files],
    );

    return {
        files,
        isUploading,
        addFiles,
        uploadAll,
        removeFile,
        clearFiles,
        retryUpload,
    };
}
