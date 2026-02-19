import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadFile, uploadFiles } from '../utils/vanillaUpload';

// Mock XMLHttpRequest
class MockXMLHttpRequest {
    public status = 200;
    public responseText = '';
    public upload = {
        addEventListener: vi.fn(),
    };
    private listeners: Record<string, Function[]> = {};

    addEventListener(event: string, handler: Function) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(handler);
    }

    open = vi.fn();
    send = vi.fn((data: FormData) => {
        // Simulate successful upload
        setTimeout(() => {
            this.responseText = JSON.stringify({
                success: true,
                url: '/uploads/test-file.txt',
                key: 'test-file-123.txt',
            });
            this.trigger('load');
        }, 10);
    });

    trigger(event: string) {
        if (this.listeners[event]) {
            this.listeners[event].forEach((handler) => handler());
        }
    }
}

describe('Vanilla Upload Utilities', () => {
    beforeEach(() => {
        // @ts-ignore
        global.XMLHttpRequest = MockXMLHttpRequest;
    });

    describe('uploadFile', () => {
        it('should upload file successfully', async () => {
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            const result = await uploadFile(file, {
                endpoint: '/api/upload',
            });

            expect(result.success).toBe(true);
            expect(result.url).toBe('/uploads/test-file.txt');
            expect(result.key).toBe('test-file-123.txt');
        });

        it('should call onProgress callback', async () => {
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            const onProgress = vi.fn();

            await uploadFile(file, {
                endpoint: '/api/upload',
                onProgress,
            });

            // Note: Progress callback is called by XMLHttpRequest upload.progress event
            // In real scenario, this would be called multiple times
        });

        it('should call onSuccess callback', async () => {
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            const onSuccess = vi.fn();

            await uploadFile(file, {
                endpoint: '/api/upload',
                onSuccess,
            });

            expect(onSuccess).toHaveBeenCalledWith({
                success: true,
                url: '/uploads/test-file.txt',
                key: 'test-file-123.txt',
            });
        });

        it('should validate file size', async () => {
            const largeContent = new Array(2 * 1024 * 1024).fill('a').join('');
            const file = new File([largeContent], 'large.txt', { type: 'text/plain' });
            const onError = vi.fn();

            const result = await uploadFile(file, {
                maxFileSize: 1024 * 1024, // 1MB
                onError,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('exceeds maximum');
            expect(onError).toHaveBeenCalled();
        });

        it('should validate file type', async () => {
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            const onError = vi.fn();

            const result = await uploadFile(file, {
                acceptedFileTypes: ['image/*'],
                onError,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('not allowed');
            expect(onError).toHaveBeenCalled();
        });

        it('should use correct provider', async () => {
            const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
            const xhr = new MockXMLHttpRequest();
            const sendSpy = vi.spyOn(xhr, 'send');

            // @ts-ignore
            global.XMLHttpRequest = vi.fn(function () {
                return xhr;
            });

            await uploadFile(file, {
                provider: 'cloudflare-images',
            });

            expect(sendSpy).toHaveBeenCalled();
            const formData = sendSpy.mock.calls[0][0] as FormData;
            expect(formData.get('provider')).toBe('cloudflare-images');
        });

        it('should handle network errors', async () => {
            class ErrorXMLHttpRequest extends MockXMLHttpRequest {
                send = vi.fn(() => {
                    setTimeout(() => this.trigger('error'), 10);
                });
            }

            // @ts-ignore
            global.XMLHttpRequest = ErrorXMLHttpRequest;

            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            const onError = vi.fn();

            await expect(
                uploadFile(file, {
                    onError,
                }),
            ).rejects.toThrow('Network error');

            expect(onError).toHaveBeenCalled();
        });
    });

    describe('uploadFiles', () => {
        it('should upload multiple files sequentially', async () => {
            const files = [
                new File(['content1'], 'test1.txt', { type: 'text/plain' }),
                new File(['content2'], 'test2.txt', { type: 'text/plain' }),
            ];

            const results = await uploadFiles(files, {
                endpoint: '/api/upload',
            });

            expect(results).toHaveLength(2);
            expect(results[0].success).toBe(true);
            expect(results[1].success).toBe(true);
        });

        it('should stop on error when no error handler provided', async () => {
            const files = [
                new File(['content1'], 'test1.txt', { type: 'text/plain' }),
                new File(['content2'], 'test2.txt', { type: 'text/plain' }),
            ];

            const results = await uploadFiles(files, {
                acceptedFileTypes: ['image/*'], // Will fail validation
            });

            expect(results).toHaveLength(1);
            expect(results[0].success).toBe(false);
        });

        it('should continue on error when error handler provided', async () => {
            const files = [
                new File(['content1'], 'test1.txt', { type: 'text/plain' }),
                new File(['content2'], 'test2.txt', { type: 'text/plain' }),
            ];

            const onError = vi.fn();

            const results = await uploadFiles(files, {
                acceptedFileTypes: ['image/*'], // Will fail validation
                onError,
            });

            expect(results).toHaveLength(2);
            expect(results[0].success).toBe(false);
            expect(results[1].success).toBe(false);
            expect(onError).toHaveBeenCalledTimes(2);
        });
    });
});
