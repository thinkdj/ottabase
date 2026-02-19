import { describe, expect, it } from 'vitest';
import { fileMetadataSchema, uploadConfigSchema, uploadResponseSchema } from '../validation';

describe('Zod Schemas', () => {
    describe('uploadConfigSchema', () => {
        it('should validate valid upload config', () => {
            const config = {
                maxFiles: 5,
                maxFileSize: 10485760,
                acceptedFileTypes: ['image/*', 'application/pdf'],
                uploadEndpoint: '/api/upload',
                autoUpload: true,
            };

            const result = uploadConfigSchema.parse(config);

            expect(result.maxFiles).toBe(5);
            expect(result.maxFileSize).toBe(10485760);
            expect(result.acceptedFileTypes).toEqual(['image/*', 'application/pdf']);
            expect(result.uploadEndpoint).toBe('/api/upload');
            expect(result.autoUpload).toBe(true);
        });

        it('should apply default values', () => {
            const config = {};
            const result = uploadConfigSchema.parse(config);

            expect(result.maxFiles).toBe(1);
            expect(result.autoUpload).toBe(false);
        });

        it('should reject invalid maxFiles', () => {
            expect(() => uploadConfigSchema.parse({ maxFiles: 0 })).toThrow();
            expect(() => uploadConfigSchema.parse({ maxFiles: 101 })).toThrow();
            expect(() => uploadConfigSchema.parse({ maxFiles: -1 })).toThrow();
        });

        it('should reject invalid maxFileSize', () => {
            expect(() => uploadConfigSchema.parse({ maxFileSize: 0 })).toThrow();
            expect(() => uploadConfigSchema.parse({ maxFileSize: -100 })).toThrow();
        });

        it('should allow optional fields to be undefined', () => {
            const config = {
                maxFiles: 3,
            };

            const result = uploadConfigSchema.parse(config);

            expect(result.maxFileSize).toBeUndefined();
            expect(result.acceptedFileTypes).toBeUndefined();
            expect(result.uploadEndpoint).toBeUndefined();
        });
    });

    describe('fileMetadataSchema', () => {
        it('should validate valid file metadata', () => {
            const metadata = {
                id: 'file-123',
                key: 'uploads/test-456.txt',
                filename: 'test.txt',
                size: 1024,
                contentType: 'text/plain',
                url: 'https://example.com/files/test.txt',
                uploadedAt: Date.now(),
                userId: 'user-789',
            };

            const result = fileMetadataSchema.parse(metadata);

            expect(result.id).toBe('file-123');
            expect(result.key).toBe('uploads/test-456.txt');
            expect(result.filename).toBe('test.txt');
            expect(result.size).toBe(1024);
            expect(result.contentType).toBe('text/plain');
            expect(result.url).toBe('https://example.com/files/test.txt');
            expect(Number.isFinite(result.uploadedAt)).toBe(true);
            expect(result.userId).toBe('user-789');
        });

        it('should allow userId to be optional', () => {
            const metadata = {
                id: 'file-123',
                key: 'uploads/test.txt',
                filename: 'test.txt',
                size: 1024,
                contentType: 'text/plain',
                url: 'https://example.com/files/test.txt',
                uploadedAt: Date.now(),
            };

            const result = fileMetadataSchema.parse(metadata);

            expect(result.userId).toBeUndefined();
        });

        it('should reject invalid size', () => {
            const metadata = {
                id: 'file-123',
                key: 'key',
                filename: 'test.txt',
                size: 0,
                contentType: 'text/plain',
                url: 'https://example.com/test.txt',
                uploadedAt: Date.now(),
            };

            expect(() => fileMetadataSchema.parse(metadata)).toThrow();
        });

        it('should reject invalid URL', () => {
            const metadata = {
                id: 'file-123',
                key: 'key',
                filename: 'test.txt',
                size: 1024,
                contentType: 'text/plain',
                url: 'not-a-url',
                uploadedAt: Date.now(),
            };

            expect(() => fileMetadataSchema.parse(metadata)).toThrow();
        });

        it('should reject missing required fields', () => {
            const metadata = {
                id: 'file-123',
                filename: 'test.txt',
            };

            expect(() => fileMetadataSchema.parse(metadata)).toThrow();
        });
    });

    describe('uploadResponseSchema', () => {
        it('should validate successful response with absolute URL', () => {
            const response = {
                success: true,
                url: 'https://example.com/files/test.txt',
                key: 'uploads/test-123.txt',
            };

            const result = uploadResponseSchema.parse(response);

            expect(result.success).toBe(true);
            expect(result.url).toBe('https://example.com/files/test.txt');
            expect(result.key).toBe('uploads/test-123.txt');
        });

        it('should validate successful response with relative URL', () => {
            const response = {
                success: true,
                url: '/api/files/test.txt',
                key: 'test-123.txt',
            };

            const result = uploadResponseSchema.parse(response);

            expect(result.success).toBe(true);
            expect(result.url).toBe('/api/files/test.txt');
        });

        it('should validate error response', () => {
            const response = {
                success: false,
                error: 'File too large',
            };

            const result = uploadResponseSchema.parse(response);

            expect(result.success).toBe(false);
            expect(result.error).toBe('File too large');
            expect(result.url).toBeUndefined();
            expect(result.key).toBeUndefined();
        });

        it('should reject invalid URL format', () => {
            const response = {
                success: true,
                url: 'not-a-valid-url',
                key: 'test.txt',
            };

            expect(() => uploadResponseSchema.parse(response)).toThrow();
        });

        it('should allow optional fields', () => {
            const response = {
                success: true,
            };

            const result = uploadResponseSchema.parse(response);

            expect(result.success).toBe(true);
            expect(result.url).toBeUndefined();
            expect(result.key).toBeUndefined();
            expect(result.error).toBeUndefined();
        });

        it('should require success field', () => {
            const response = {
                url: 'https://example.com/test.txt',
            };

            expect(() => uploadResponseSchema.parse(response)).toThrow();
        });
    });
});
