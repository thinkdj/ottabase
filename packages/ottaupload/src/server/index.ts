/**
 * Server-side utilities for file upload handling
 */

import type { R2Client } from '@ottabase/cf';
import type { UploadServerOptions, FileMetadata, UploadResponse } from '../types';
import {
  validateFileSize,
  validateFileType,
  generateFileKey,
  formatFileSize,
} from '../validation';

/**
 * Upload a file to R2 storage
 */
export async function uploadFileToR2(
  file: File,
  r2Client: R2Client,
  options: UploadServerOptions = {}
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
    const key = options.generateKey
      ? options.generateKey(file)
      : generateFileKey(file);

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
  r2Client: R2Client
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
export async function deleteFileFromR2(
  key: string,
  r2Client: R2Client
): Promise<{ success: boolean; error?: string }> {
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
  options: { prefix?: string; limit?: number; cursor?: string } = {}
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
export function createFileMetadata(
  key: string,
  file: File,
  url: string,
  userId?: string
): FileMetadata {
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

  for (const [key, value] of formData.entries()) {
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
