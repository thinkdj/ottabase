import { z } from 'zod';

/**
 * File upload validation schemas using Zod
 */

/**
 * Maximum file size (100MB)
 */
const MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * Common file type MIME types
 */
export const FILE_TYPES = {
    // Images
    IMAGE_ALL: 'image/*',
    IMAGE_JPEG: 'image/jpeg',
    IMAGE_PNG: 'image/png',
    IMAGE_GIF: 'image/gif',
    IMAGE_WEBP: 'image/webp',
    IMAGE_SVG: 'image/svg+xml',

    // Documents
    PDF: 'application/pdf',
    DOC: 'application/msword',
    DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    XLS: 'application/vnd.ms-excel',
    XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    PPT: 'application/vnd.ms-powerpoint',
    PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

    // Text
    TEXT: 'text/plain',
    CSV: 'text/csv',
    JSON: 'application/json',
    XML: 'text/xml',

    // Archives
    ZIP: 'application/zip',
    RAR: 'application/x-rar-compressed',
    TAR: 'application/x-tar',
    GZIP: 'application/gzip',

    // Video
    VIDEO_ALL: 'video/*',
    MP4: 'video/mp4',
    WEBM: 'video/webm',
    OGG: 'video/ogg',

    // Audio
    AUDIO_ALL: 'audio/*',
    MP3: 'audio/mpeg',
    WAV: 'audio/wav',
    OGA: 'audio/ogg',
} as const;

/**
 * File upload configuration schema
 */
export const uploadConfigSchema = z.object({
    maxFiles: z.number().min(1).max(100).default(1),
    maxFileSize: z.number().min(1).max(MAX_FILE_SIZE).optional(),
    acceptedFileTypes: z.array(z.string()).optional(),
    uploadEndpoint: z.string().optional(),
    autoUpload: z.boolean().default(false),
});

/**
 * File metadata schema
 */
export const fileMetadataSchema = z.object({
    id: z.string(),
    key: z.string(),
    filename: z.string(),
    size: z.number().positive(),
    contentType: z.string(),
    url: z.string().url(),
    uploadedAt: z.number(),
    userId: z.string().optional(),
});

/**
 * Upload response schema
 */
export const uploadResponseSchema = z.object({
    success: z.boolean(),
    // Allow both absolute URLs (http/https) and relative URLs starting with '/'
    url: z
        .string()
        .regex(/^(https?:\/\/|\/)/, 'Invalid URL format')
        .optional(),
    key: z.string().optional(),
    error: z.string().optional(),
});

/**
 * Validate file size
 */
export function validateFileSize(file: File, maxSize?: number): boolean {
    if (!maxSize) return true;
    return file.size <= maxSize;
}

/**
 * Validate file type against accepted types
 */
export function validateFileType(file: File, acceptedTypes?: string[]): boolean {
    if (!acceptedTypes || acceptedTypes.length === 0) return true;

    return acceptedTypes.some((type) => {
        // Handle wildcard types (e.g., 'image/*')
        if (type.endsWith('/*')) {
            const baseType = type.split('/')[0];
            return file.type.startsWith(baseType + '/');
        }

        // Exact match
        return file.type === type;
    });
}

/**
 * Validate multiple files
 */
export function validateFiles(
    files: File[],
    config: {
        maxFiles?: number;
        maxFileSize?: number;
        acceptedFileTypes?: string[];
    },
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check file count
    if (config.maxFiles && files.length > config.maxFiles) {
        errors.push(`Maximum ${config.maxFiles} file${config.maxFiles > 1 ? 's' : ''} allowed`);
    }

    // Validate each file
    files.forEach((file, index) => {
        // Check file size
        if (config.maxFileSize && !validateFileSize(file, config.maxFileSize)) {
            errors.push(`File "${file.name}" exceeds maximum size of ${formatFileSize(config.maxFileSize)}`);
        }

        // Check file type
        if (config.acceptedFileTypes && !validateFileType(file, config.acceptedFileTypes)) {
            errors.push(`File "${file.name}" has invalid type. Accepted types: ${config.acceptedFileTypes.join(', ')}`);
        }
    });

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Format file size to human-readable string
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Generate unique file key
 */
export function generateFileKey(file: File, prefix?: string): string {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const ext = file.name.split('.').pop();
    const baseName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-z0-9]/gi, '-')
        .toLowerCase();

    return prefix
        ? `${prefix}/${baseName}-${timestamp}-${randomStr}.${ext}`
        : `${baseName}-${timestamp}-${randomStr}.${ext}`;
}
