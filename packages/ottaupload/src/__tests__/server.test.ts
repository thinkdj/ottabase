import { describe, expect, it } from 'vitest';
import { createFileMetadata, createUploadFormData, parseFormDataFiles } from '../server';

describe('Server Utilities', () => {
    describe('createFileMetadata', () => {
        it('should create file metadata with all fields', () => {
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            const key = 'uploads/test-123.txt';
            const url = '/api/files/test-123.txt';
            const userId = 'user-456';

            const metadata = createFileMetadata(key, file, url, userId);

            expect(metadata.id).toBeDefined();
            expect(metadata.key).toBe(key);
            expect(metadata.filename).toBe('test.txt');
            expect(metadata.size).toBe(file.size);
            expect(metadata.contentType).toBe('text/plain');
            expect(metadata.url).toBe(url);
            expect(metadata.userId).toBe(userId);
            expect(metadata.uploadedAt).toBeInstanceOf(Date);
        });

        it('should create metadata without userId', () => {
            const file = new File(['content'], 'image.jpg', { type: 'image/jpeg' });
            const metadata = createFileMetadata('key', file, '/url');

            expect(metadata.userId).toBeUndefined();
            expect(metadata.filename).toBe('image.jpg');
            expect(metadata.contentType).toBe('image/jpeg');
        });

        it('should generate unique IDs', () => {
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            const metadata1 = createFileMetadata('key1', file, '/url1');
            const metadata2 = createFileMetadata('key2', file, '/url2');

            expect(metadata1.id).not.toBe(metadata2.id);
        });
    });

    describe('parseFormDataFiles', () => {
        it('should extract files from FormData', () => {
            const formData = new FormData();
            const file1 = new File(['content1'], 'test1.txt', { type: 'text/plain' });
            const file2 = new File(['content2'], 'test2.txt', { type: 'text/plain' });

            formData.append('file1', file1);
            formData.append('file2', file2);
            formData.append('text', 'some text');

            const files = parseFormDataFiles(formData);

            expect(files).toHaveLength(2);
            expect(files[0]).toBe(file1);
            expect(files[1]).toBe(file2);
        });

        it('should return empty array when no files', () => {
            const formData = new FormData();
            formData.append('text', 'some text');
            formData.append('number', '123');

            const files = parseFormDataFiles(formData);

            expect(files).toHaveLength(0);
        });

        it('should handle empty FormData', () => {
            const formData = new FormData();
            const files = parseFormDataFiles(formData);

            expect(files).toHaveLength(0);
        });
    });

    describe('createUploadFormData', () => {
        it('should create FormData with file', () => {
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            const formData = createUploadFormData(file);

            expect(formData.get('file')).toBe(file);
        });

        it('should include additional data', () => {
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            const additionalData = {
                userId: 'user-123',
                folder: 'uploads',
                public: 'true',
            };

            const formData = createUploadFormData(file, additionalData);

            expect(formData.get('file')).toBe(file);
            expect(formData.get('userId')).toBe('user-123');
            expect(formData.get('folder')).toBe('uploads');
            expect(formData.get('public')).toBe('true');
        });

        it('should work without additional data', () => {
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            const formData = createUploadFormData(file);

            expect(formData.get('file')).toBe(file);
            // Should only have the file
            let count = 0;
            for (const _ of formData.entries()) {
                count++;
            }
            expect(count).toBe(1);
        });
    });
});
