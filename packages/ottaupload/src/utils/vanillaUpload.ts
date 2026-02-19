/**
 * Vanilla JS upload utility for non-React contexts (e.g., EditorJS tools)
 * Provides the same functionality as React hooks but without React dependencies
 */

import type { UploadResponse, UploadProvider } from '../types';
import { validateFileSize, validateFileType, formatFileSize } from '../validation';

export interface VanillaUploadOptions {
    endpoint?: string;
    maxFileSize?: number;
    acceptedFileTypes?: string[];
    provider?: UploadProvider;
    onProgress?: (progress: number) => void;
    onSuccess?: (response: UploadResponse) => void;
    onError?: (error: Error) => void;
}

/**
 * Upload a file using XMLHttpRequest with progress tracking
 * Compatible with vanilla JavaScript (no React dependencies)
 */
export async function uploadFile(file: File, options: VanillaUploadOptions = {}): Promise<UploadResponse> {
    const {
        endpoint = '/api/upload',
        maxFileSize,
        acceptedFileTypes,
        provider = 'r2',
        onProgress,
        onSuccess,
        onError,
    } = options;

    try {
        // Validate file size
        if (maxFileSize && !validateFileSize(file, maxFileSize)) {
            const error = new Error(`File size exceeds maximum of ${formatFileSize(maxFileSize)}`);
            onError?.(error);
            return {
                success: false,
                error: error.message,
            };
        }

        // Validate file type
        if (acceptedFileTypes && !validateFileType(file, acceptedFileTypes)) {
            const error = new Error(`File type not allowed. Accepted types: ${acceptedFileTypes.join(', ')}`);
            onError?.(error);
            return {
                success: false,
                error: error.message,
            };
        }

        // Create form data
        const formData = new FormData();
        formData.append('file', file);
        formData.append('provider', provider);

        // Upload with progress tracking
        return new Promise<UploadResponse>((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            // Progress handler
            if (onProgress) {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const progress = Math.round((e.loaded / e.total) * 100);
                        onProgress(progress);
                    }
                });
            }

            // Success handler
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText) as UploadResponse;

                        if (response.success) {
                            onSuccess?.(response);
                            resolve(response);
                        } else {
                            const error = new Error(response.error || 'Upload failed');
                            onError?.(error);
                            resolve(response);
                        }
                    } catch (parseError) {
                        const error = new Error('Failed to parse response');
                        onError?.(error);
                        reject(error);
                    }
                } else {
                    const error = new Error(`Upload failed with status ${xhr.status}`);
                    onError?.(error);
                    reject(error);
                }
            });

            // Error handler
            xhr.addEventListener('error', () => {
                const error = new Error('Network error during upload');
                onError?.(error);
                reject(error);
            });

            // Abort handler
            xhr.addEventListener('abort', () => {
                const error = new Error('Upload aborted');
                onError?.(error);
                reject(error);
            });

            xhr.open('POST', endpoint);
            xhr.send(formData);
        });
    } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        onError?.(err);
        return {
            success: false,
            error: err.message,
        };
    }
}

/**
 * Upload multiple files sequentially
 */
export async function uploadFiles(files: File[], options: VanillaUploadOptions = {}): Promise<UploadResponse[]> {
    const results: UploadResponse[] = [];

    for (const file of files) {
        const result = await uploadFile(file, options);
        results.push(result);

        // Stop if upload fails and no error handler provided
        if (!result.success && !options.onError) {
            break;
        }
    }

    return results;
}
