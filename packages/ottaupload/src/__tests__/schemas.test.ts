import { describe, expect, it } from 'vitest';
import { uploadConfigSchema } from '../validation';

describe('Zod Schemas', () => {
    describe('uploadConfigSchema', () => {
        it('should validate valid upload config', () => {
            const config = {
                maxFiles: 5,
                maxFileSize: 10485760,
                acceptedFileTypes: ['image/*', 'application/pdf'],
                uploadEndpoint: '/api/files',
                autoUpload: true,
            };

            const result = uploadConfigSchema.parse(config);

            expect(result.maxFiles).toBe(5);
            expect(result.maxFileSize).toBe(10485760);
            expect(result.acceptedFileTypes).toEqual(['image/*', 'application/pdf']);
            expect(result.uploadEndpoint).toBe('/api/files');
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
});
