/**
 * File upload types and interfaces
 */

/**
 * Upload status for tracking file upload progress
 */
export type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';

/**
 * File upload item with metadata and progress
 */
export interface UploadFile {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  error?: string;
  url?: string;
  key?: string;
}

/**
 * Upload configuration options
 */
export interface UploadConfig {
  /**
   * Maximum number of files allowed
   * @default 1
   */
  maxFiles?: number;

  /**
   * Maximum file size in bytes
   * @default undefined (no limit)
   */
  maxFileSize?: number;

  /**
   * Accepted MIME types (e.g., ['image/*', 'application/pdf'])
   * @default undefined (all types)
   */
  acceptedFileTypes?: string[];

  /**
   * API endpoint for file upload
   * @default '/api/upload'
   */
  uploadEndpoint?: string;

  /**
   * Auto-upload files on selection
   * @default false
   */
  autoUpload?: boolean;
}

/**
 * File uploader variant
 */
export type FileUploaderVariant = 'dropzone' | 'button';

/**
 * File uploader props
 */
export interface FileUploaderProps extends UploadConfig {
  /**
   * Upload handler
   */
  onUpload?: (files: File[]) => Promise<void> | void;

  /**
   * Upload complete callback
   */
  onUploadComplete?: (files: UploadFile[]) => void;

  /**
   * Upload error callback
   */
  onUploadError?: (error: Error) => void;

  /**
   * Upload progress callback
   */
  onUploadProgress?: (progress: number, file: UploadFile) => void;

  /**
   * UI variant
   * @default 'dropzone'
   */
  variant?: FileUploaderVariant;

  /**
   * Disabled state
   * @default false
   */
  disabled?: boolean;

  /**
   * Custom class name
   */
  className?: string;
}

/**
 * File upload response from server
 */
export interface UploadResponse {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

/**
 * File metadata stored in database
 */
export interface FileMetadata {
  id: string;
  key: string;
  filename: string;
  size: number;
  contentType: string;
  url: string;
  uploadedAt: Date;
  userId?: string;
}

/**
 * Upload server options
 */
export interface UploadServerOptions {
  /**
   * Maximum file size in bytes
   */
  maxFileSize?: number;

  /**
   * Allowed MIME types
   */
  allowedTypes?: string[];

  /**
   * R2 bucket name
   */
  bucket?: string;

  /**
   * Custom key generator
   */
  generateKey?: (file: File) => string;
}
