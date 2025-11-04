/**
 * R2 Object Storage wrapper
 * Type-safe wrapper for Cloudflare R2
 *
 * @see https://developers.cloudflare.com/r2/
 */

import type { R2Bucket, R2Object, R2MultipartUpload } from '@cloudflare/workers-types';
import { CloudflareError, type Result } from './types';

export interface R2Config {
  bucket: R2Bucket;
}

export interface R2GetOptions {
  onlyIf?: {
    etagMatches?: string;
    etagDoesNotMatch?: string;
    uploadedBefore?: Date;
    uploadedAfter?: Date;
  };
  range?: {
    offset: number;
    length?: number;
  };
}

export interface R2PutOptions {
  httpMetadata?: {
    contentType?: string;
    contentLanguage?: string;
    contentDisposition?: string;
    contentEncoding?: string;
    cacheControl?: string;
    cacheExpiry?: Date;
  };
  customMetadata?: Record<string, string>;
  md5?: ArrayBuffer | string;
}

export interface R2ListOptions {
  prefix?: string;
  delimiter?: string;
  cursor?: string;
  limit?: number;
  include?: Array<'httpMetadata' | 'customMetadata'>;
}

/**
 * Type-safe R2 storage wrapper
 */
export class R2Client {
  private bucket: R2Bucket;

  constructor(config: R2Config) {
    if (!config.bucket) {
      throw new CloudflareError(
        'R2 bucket binding is required',
        'R2_MISSING_BINDING'
      );
    }
    this.bucket = config.bucket;
  }

  /**
   * Get an object from R2
   */
  async get(
    key: string,
    options?: R2GetOptions
  ): Promise<Result<R2Object | null, Error>> {
    try {
      const object = await this.bucket.get(key, options);

      return {
        success: true,
        data: object,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Put an object to R2
   */
  async put(
    key: string,
    value: ReadableStream | ArrayBuffer | string | Blob,
    options?: R2PutOptions
  ): Promise<Result<R2Object, Error>> {
    try {
      const object = await this.bucket.put(key, value, options);

      return {
        success: true,
        data: object,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Delete an object from R2
   */
  async delete(key: string): Promise<Result<void, Error>> {
    try {
      await this.bucket.delete(key);

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
   * Delete multiple objects from R2
   */
  async deleteMultiple(keys: string[]): Promise<Result<void, Error>> {
    try {
      await this.bucket.delete(keys);

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
   * List objects in the bucket
   */
  async list(options?: R2ListOptions): Promise<Result<{ objects: R2Object[]; truncated: boolean; cursor?: string; delimitedPrefixes: string[] }, Error>> {
    try {
      const result = await this.bucket.list(options);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Head (check existence/metadata) of an object
   */
  async head(key: string): Promise<Result<R2Object | null, Error>> {
    try {
      const object = await this.bucket.head(key);

      return {
        success: true,
        data: object,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Create a multipart upload
   */
  async createMultipartUpload(
    key: string,
    options?: R2PutOptions
  ): Promise<Result<R2MultipartUpload, Error>> {
    try {
      const upload = await this.bucket.createMultipartUpload(key, options);

      return {
        success: true,
        data: upload,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Resume a multipart upload
   */
  resumeMultipartUpload(key: string, uploadId: string): R2MultipartUpload {
    return this.bucket.resumeMultipartUpload(key, uploadId);
  }

  /**
   * Get raw R2Bucket instance for advanced usage
   */
  getRaw(): R2Bucket {
    return this.bucket;
  }
}

/**
 * Create an R2 client instance
 */
export function createR2Client(config: R2Config): R2Client {
  return new R2Client(config);
}
