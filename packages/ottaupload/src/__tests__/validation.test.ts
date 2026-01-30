import { describe, expect, it } from 'vitest';
import {
    FILE_TYPES,
    formatFileSize,
    generateFileKey,
    validateFileSize,
    validateFileType,
    validateFiles,
} from '../validation';

describe('Validation Utilities', () => {
    describe('validateFileSize', () => {
        it('should validate file size within limit', () => {
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            const maxSize = 1024 * 1024; // 1MB
            expect(validateFileSize(file, maxSize)).toBe(true);
        });

        it('should reject file size exceeding limit', () => {
            const largeContent = new Array(2 * 1024 * 1024).fill('a').join('');
            const file = new File([largeContent], 'large.txt', { type: 'text/plain' });
            const maxSize = 1024 * 1024; // 1MB
            expect(validateFileSize(file, maxSize)).toBe(false);
        });

        it('should return true when no max size specified', () => {
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            expect(validateFileSize(file)).toBe(true);
        });
    });

    describe('validateFileType', () => {
        it('should validate exact MIME type match', () => {
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            expect(validateFileType(file, ['text/plain'])).toBe(true);
        });

        it('should validate wildcard MIME type', () => {
            const file = new File(['content'], 'image.jpg', { type: 'image/jpeg' });
            expect(validateFileType(file, ['image/*'])).toBe(true);
        });

        it('should reject non-matching MIME type', () => {
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            expect(validateFileType(file, ['image/*'])).toBe(false);
        });

        it('should return true when no accepted types specified', () => {
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            expect(validateFileType(file)).toBe(true);
            expect(validateFileType(file, [])).toBe(true);
        });

        it('should validate against multiple accepted types', () => {
            const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
            expect(validateFileType(file, ['image/*', 'application/pdf'])).toBe(true);
        });
    });

    describe('validateFiles', () => {
        it('should validate multiple files successfully', () => {
            const files = [
                new File(['content1'], 'test1.txt', { type: 'text/plain' }),
                new File(['content2'], 'test2.txt', { type: 'text/plain' }),
            ];

            const result = validateFiles(files, {
                maxFiles: 5,
                maxFileSize: 1024 * 1024,
                acceptedFileTypes: ['text/plain'],
            });

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject when exceeding max files', () => {
            const files = [new File(['1'], 'test1.txt'), new File(['2'], 'test2.txt'), new File(['3'], 'test3.txt')];

            const result = validateFiles(files, { maxFiles: 2 });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Maximum 2 files allowed');
        });

        it('should reject files exceeding size limit', () => {
            const largeContent = new Array(2 * 1024 * 1024).fill('a').join('');
            const files = [new File([largeContent], 'large.txt', { type: 'text/plain' })];

            const result = validateFiles(files, {
                maxFileSize: 1024 * 1024, // 1MB
            });

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('exceeds maximum size');
        });

        it('should reject files with invalid types', () => {
            const files = [new File(['content'], 'test.txt', { type: 'text/plain' })];

            const result = validateFiles(files, {
                acceptedFileTypes: ['image/*'],
            });

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('invalid type');
        });
    });

    describe('formatFileSize', () => {
        it('should format bytes correctly', () => {
            expect(formatFileSize(0)).toBe('0 Bytes');
            expect(formatFileSize(1024)).toBe('1 KB');
            expect(formatFileSize(1048576)).toBe('1 MB');
            expect(formatFileSize(1073741824)).toBe('1 GB');
        });

        it('should handle decimal values', () => {
            expect(formatFileSize(1536)).toBe('1.5 KB');
            expect(formatFileSize(5242880)).toBe('5 MB');
        });
    });

    describe('generateFileKey', () => {
        it('should generate unique file key', () => {
            const file = new File(['content'], 'test-file.txt', { type: 'text/plain' });
            const key = generateFileKey(file);

            expect(key).toContain('test-file');
            expect(key).toContain('.txt');
            expect(key.length).toBeGreaterThan(20);
        });

        it('should generate key with prefix', () => {
            const file = new File(['content'], 'image.jpg', { type: 'image/jpeg' });
            const key = generateFileKey(file, 'uploads');

            expect(key).toContain('uploads/');
            expect(key).toContain('image');
            expect(key).toContain('.jpg');
        });

        it('should sanitize filename', () => {
            const file = new File(['content'], 'Test File!@#$.txt', { type: 'text/plain' });
            const key = generateFileKey(file);

            expect(key).toContain('test-file');
            expect(key).not.toContain('!');
            expect(key).not.toContain('@');
            expect(key).not.toContain('#');
        });

        it('should generate different keys for same file', () => {
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            const key1 = generateFileKey(file);
            const key2 = generateFileKey(file);

            expect(key1).not.toBe(key2);
        });
    });

    describe('FILE_TYPES', () => {
        it('should have image types', () => {
            expect(FILE_TYPES.IMAGE_ALL).toBe('image/*');
            expect(FILE_TYPES.IMAGE_JPEG).toBe('image/jpeg');
            expect(FILE_TYPES.IMAGE_PNG).toBe('image/png');
            expect(FILE_TYPES.IMAGE_WEBP).toBe('image/webp');
        });

        it('should have document types', () => {
            expect(FILE_TYPES.PDF).toBe('application/pdf');
            expect(FILE_TYPES.DOCX).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        });

        it('should have archive types', () => {
            expect(FILE_TYPES.ZIP).toBe('application/zip');
            expect(FILE_TYPES.GZIP).toBe('application/gzip');
        });

        it('should have video and audio types', () => {
            expect(FILE_TYPES.VIDEO_ALL).toBe('video/*');
            expect(FILE_TYPES.AUDIO_ALL).toBe('audio/*');
            expect(FILE_TYPES.MP4).toBe('video/mp4');
            expect(FILE_TYPES.MP3).toBe('audio/mpeg');
        });
    });
});
