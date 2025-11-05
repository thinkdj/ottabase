/**
 * Images wrapper
 * Type-safe wrapper for Cloudflare Images
 *
 * @see https://developers.cloudflare.com/images/
 */

import { CloudflareError, type Result } from './types';

export interface ImagesConfig {
  /**
   * Account ID for Cloudflare Images
   */
  accountId: string;

  /**
   * API token with Images permissions
   */
  apiToken: string;
}

export interface ImageUploadOptions {
  /**
   * Custom ID for the image
   */
  id?: string;

  /**
   * Whether to require signed URLs
   */
  requireSignedURLs?: boolean;

  /**
   * Image metadata
   */
  metadata?: Record<string, string>;
}

export interface ImageVariant {
  id: string;
  width?: number;
  height?: number;
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  metadata?: 'keep' | 'copyright' | 'none';
}

export interface ImageDetails {
  id: string;
  filename: string;
  uploaded: string;
  requireSignedURLs: boolean;
  variants: string[];
  meta?: Record<string, string>;
}

/**
 * Type-safe Images wrapper
 */
export class ImagesClient {
  private accountId: string;
  private apiToken: string;
  private baseUrl: string;

  constructor(config: ImagesConfig) {
    if (!config.accountId || !config.apiToken) {
      throw new CloudflareError(
        'Images accountId and apiToken are required',
        'IMAGES_MISSING_CONFIG'
      );
    }
    this.accountId = config.accountId;
    this.apiToken = config.apiToken;
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1`;
  }

  /**
   * Upload an image
   */
  async upload(
    image: File | Blob | ArrayBuffer,
    options?: ImageUploadOptions
  ): Promise<Result<ImageDetails, Error>> {
    try {
      const formData = new FormData();

      if (image instanceof ArrayBuffer) {
        formData.append('file', new Blob([image]));
      } else {
        formData.append('file', image);
      }

      if (options?.id) {
        formData.append('id', options.id);
      }

      if (options?.requireSignedURLs !== undefined) {
        formData.append('requireSignedURLs', String(options.requireSignedURLs));
      }

      if (options?.metadata) {
        formData.append('metadata', JSON.stringify(options.metadata));
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new CloudflareError(
          `Upload failed: ${response.statusText}`,
          'IMAGES_UPLOAD_ERROR',
          { status: response.status }
        );
      }

      const data = await response.json() as any;

      return {
        success: true,
        data: data.result as ImageDetails,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get image details
   */
  async get(imageId: string): Promise<Result<ImageDetails, Error>> {
    try {
      const response = await fetch(`${this.baseUrl}/${imageId}`, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
      });

      if (!response.ok) {
        throw new CloudflareError(
          `Get image failed: ${response.statusText}`,
          'IMAGES_GET_ERROR',
          { status: response.status }
        );
      }

      const data = await response.json() as any;

      return {
        success: true,
        data: data.result as ImageDetails,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Delete an image
   */
  async delete(imageId: string): Promise<Result<void, Error>> {
    try {
      const response = await fetch(`${this.baseUrl}/${imageId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
      });

      if (!response.ok) {
        throw new CloudflareError(
          `Delete failed: ${response.statusText}`,
          'IMAGES_DELETE_ERROR',
          { status: response.status }
        );
      }

      return {
        success: true,
        data: undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get a delivery URL for an image
   */
  getDeliveryUrl(imageId: string, variant: string = 'public'): string {
    return `https://imagedelivery.net/${this.accountId}/${imageId}/${variant}`;
  }

  /**
   * List all images
   */
  async list(page: number = 1, perPage: number = 50): Promise<Result<{ images: ImageDetails[]; total: number }, Error>> {
    try {
      const response = await fetch(
        `${this.baseUrl}?page=${page}&per_page=${perPage}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new CloudflareError(
          `List failed: ${response.statusText}`,
          'IMAGES_LIST_ERROR',
          { status: response.status }
        );
      }

      const data = await response.json() as any;

      return {
        success: true,
        data: {
          images: data.result.images as ImageDetails[],
          total: data.result_info?.total_count || 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}

/**
 * Create an Images client instance
 */
export function createImagesClient(config: ImagesConfig): ImagesClient {
  return new ImagesClient(config);
}
