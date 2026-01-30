/**
 * Server-side utilities for file upload handling
 */

import type { R2Client } from '@ottabase/cf';
import type {
    UploadServerOptions,
    FileMetadata,
    UploadResponse,
    CloudflareImagesConfig,
    CloudflareImagesResponse,
} from '../types';
import { validateFileSize, validateFileType, generateFileKey, formatFileSize } from '../validation';

/**
 * Upload a file to R2 storage
 */
export async function uploadFileToR2(
    file: File,
    r2Client: R2Client,
    options: UploadServerOptions = {},
): Promise<UploadResponse> {
    try {
        // Validate file size
        if (options.maxFileSize && !validateFileSize(file, options.maxFileSize)) {
            return {
                success: false,
                error: `File size exceeds maximum of ${formatFileSize(options.maxFileSize)}`,
            };
        }

        // Validate file type
        if (options.allowedTypes && !validateFileType(file, options.allowedTypes)) {
            return {
                success: false,
                error: `File type not allowed. Accepted types: ${options.allowedTypes.join(', ')}`,
            };
        }

        // Generate unique key
        const key = options.generateKey ? options.generateKey(file) : generateFileKey(file);

        // Upload to R2
        const result = await r2Client.put(key, await file.arrayBuffer(), {
            httpMetadata: {
                contentType: file.type || 'application/octet-stream',
            },
            customMetadata: {
                originalName: file.name,
                size: file.size.toString(),
                uploadedAt: new Date().toISOString(),
            },
        });

        if (result.success) {
            // Generate public URL (adjust based on your R2 setup)
            const url = `/api/upload/file/${key}`;

            return {
                success: true,
                key,
                url,
            };
        } else {
            return {
                success: false,
                error: result.error?.message || 'Upload failed',
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Get file from R2 storage
 */
export async function getFileFromR2(
    key: string,
    r2Client: R2Client,
): Promise<{ success: boolean; data?: ArrayBuffer; metadata?: any; error?: string }> {
    try {
        const result = await r2Client.get(key);

        if (result.success && result.data) {
            const data = await result.data.arrayBuffer();
            return {
                success: true,
                data,
                metadata: {
                    contentType: result.data.httpMetadata?.contentType,
                    size: result.data.size,
                    ...result.data.customMetadata,
                },
            };
        } else {
            return {
                success: false,
                error: 'File not found',
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Delete file from R2 storage
 */
export async function deleteFileFromR2(key: string, r2Client: R2Client): Promise<{ success: boolean; error?: string }> {
    try {
        const result = await r2Client.delete(key);

        if (result.success) {
            return { success: true };
        } else {
            return {
                success: false,
                error: result.error?.message || 'Delete failed',
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * List files from R2 storage
 */
export async function listFilesFromR2(
    r2Client: R2Client,
    options: { prefix?: string; limit?: number; cursor?: string } = {},
): Promise<{
    success: boolean;
    files?: Array<{ key: string; size: number; uploaded: Date }>;
    cursor?: string;
    error?: string;
}> {
    try {
        const result = await r2Client.list({
            prefix: options.prefix,
            limit: options.limit,
            cursor: options.cursor,
        });

        if (result.success) {
            const files = result.data.objects.map((obj: any) => ({
                key: obj.key,
                size: obj.size,
                uploaded: obj.uploaded,
            }));

            return {
                success: true,
                files,
                cursor: result.data.cursor,
            };
        } else {
            return {
                success: false,
                error: result.error?.message || 'List failed',
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Create file metadata object
 */
export function createFileMetadata(key: string, file: File, url: string, userId?: string): FileMetadata {
    return {
        id: crypto.randomUUID(),
        key,
        filename: file.name,
        size: file.size,
        contentType: file.type,
        url,
        uploadedAt: new Date(),
        userId,
    };
}

/**
 * Parse FormData to get files
 */
export function parseFormDataFiles(formData: FormData): File[] {
    const files: File[] = [];

    for (const value of formData.values()) {
        if (value instanceof File) {
            files.push(value);
        }
    }

    return files;
}

/**
 * Create multipart form data for file upload
 */
export function createUploadFormData(file: File, additionalData?: Record<string, string>): FormData {
    const formData = new FormData();
    formData.append('file', file);

    if (additionalData) {
        for (const [key, value] of Object.entries(additionalData)) {
            formData.append(key, value);
        }
    }

    return formData;
}

/**
 * Upload a file to Cloudflare Images
 */
export async function uploadFileToCloudflareImages(
    file: File,
    config: CloudflareImagesConfig,
    options: UploadServerOptions = {},
): Promise<UploadResponse> {
    try {
        // Validate file size
        if (options.maxFileSize && !validateFileSize(file, options.maxFileSize)) {
            return {
                success: false,
                error: `File size exceeds maximum of ${formatFileSize(options.maxFileSize)}`,
            };
        }

        // Validate file type - Cloudflare Images only accepts images
        const imageTypes = ['image/*'];
        if (!validateFileType(file, imageTypes)) {
            return {
                success: false,
                error: 'Only image files are allowed for Cloudflare Images',
            };
        }

        // Create form data
        const formData = new FormData();
        formData.append('file', file);

        // Add optional custom ID
        if (config.customId) {
            formData.append('id', config.customId);
        }

        // Add metadata if provided
        if (config.metadata) {
            formData.append('metadata', JSON.stringify(config.metadata));
        }

        // Add requireSignedURLs flag
        if (config.requireSignedURLs) {
            formData.append('requireSignedURLs', 'true');
        }

        // Upload to Cloudflare Images API
        const uploadUrl = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/images/v1`;

        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.apiToken}`,
            },
            body: formData,
        });

        const result = (await response.json()) as {
            success: boolean;
            result?: CloudflareImagesResponse;
            errors?: Array<{ message: string }>;
        };

        if (!response.ok || !result.success) {
            const errorMessage = result.errors?.[0]?.message || 'Upload to Cloudflare Images failed';
            return {
                success: false,
                error: errorMessage,
            };
        }

        if (!result.result) {
            return {
                success: false,
                error: 'No result returned from Cloudflare Images',
            };
        }

        // Get the public variant URL (or first variant if public not available)
        const imageId = result.result.id;
        const variants = result.result.variants;

        // Cloudflare Images provides multiple variants, use 'public' variant by default
        const publicVariant = variants.find((v) => v.includes('/public')) || variants[0];

        return {
            success: true,
            key: imageId,
            url: publicVariant,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Get file from Cloudflare Images
 */
export async function getFileFromCloudflareImages(
    imageId: string,
    config: CloudflareImagesConfig,
): Promise<{ success: boolean; url?: string; metadata?: any; error?: string }> {
    try {
        const detailsUrl = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/images/v1/${imageId}`;

        const response = await fetch(detailsUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${config.apiToken}`,
            },
        });

        const result = (await response.json()) as {
            success: boolean;
            result?: CloudflareImagesResponse;
            errors?: Array<{ message: string }>;
        };

        if (!response.ok || !result.success) {
            return {
                success: false,
                error: result.errors?.[0]?.message || 'Failed to get image from Cloudflare Images',
            };
        }

        if (!result.result) {
            return {
                success: false,
                error: 'Image not found',
            };
        }

        const publicVariant = result.result.variants.find((v) => v.includes('/public')) || result.result.variants[0];

        return {
            success: true,
            url: publicVariant,
            metadata: {
                id: result.result.id,
                filename: result.result.filename,
                uploaded: result.result.uploaded,
                requireSignedURLs: result.result.requireSignedURLs,
                variants: result.result.variants,
            },
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Delete file from Cloudflare Images
 */
export async function deleteFileFromCloudflareImages(
    imageId: string,
    config: CloudflareImagesConfig,
): Promise<{ success: boolean; error?: string }> {
    try {
        const deleteUrl = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/images/v1/${imageId}`;

        const response = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${config.apiToken}`,
            },
        });

        const result = (await response.json()) as {
            success: boolean;
            errors?: Array<{ message: string }>;
        };

        if (!response.ok || !result.success) {
            return {
                success: false,
                error: result.errors?.[0]?.message || 'Failed to delete image from Cloudflare Images',
            };
        }

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
