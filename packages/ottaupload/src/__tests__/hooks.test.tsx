import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { useFileUpload } from '../hooks/useFileUpload';

describe('React Hooks', () => {
    describe('useFileUpload', () => {
        it('should initialize with empty files', () => {
            const { result } = renderHook(() => useFileUpload());

            expect(result.current.files).toEqual([]);
            expect(result.current.isUploading).toBe(false);
        });

        it('should add files to queue', () => {
            const { result } = renderHook(() => useFileUpload({ maxFiles: 5 }));

            const file = new File(['content'], 'test.txt', { type: 'text/plain' });

            act(() => {
                result.current.addFiles([file]);
            });

            expect(result.current.files).toHaveLength(1);
            expect(result.current.files[0].file).toBe(file);
            expect(result.current.files[0].status).toBe('pending');
            expect(result.current.files[0].progress).toBe(0);
        });

        it('should validate max files', () => {
            const onUploadError = vi.fn();
            const { result } = renderHook(() => useFileUpload({ maxFiles: 2, onUploadError }));

            const files = [new File(['1'], 'test1.txt'), new File(['2'], 'test2.txt'), new File(['3'], 'test3.txt')];

            act(() => {
                result.current.addFiles(files);
            });

            expect(result.current.files).toHaveLength(0);
            expect(onUploadError).toHaveBeenCalled();
        });

        it('should validate file size', () => {
            const onUploadError = vi.fn();
            const { result } = renderHook(() =>
                useFileUpload({
                    maxFileSize: 100, // 100 bytes
                    onUploadError,
                }),
            );

            const largeContent = new Array(200).fill('a').join('');
            const file = new File([largeContent], 'large.txt', {
                type: 'text/plain',
            });

            act(() => {
                result.current.addFiles([file]);
            });

            expect(result.current.files).toHaveLength(0);
            expect(onUploadError).toHaveBeenCalled();
        });

        it('should validate file type', () => {
            const onUploadError = vi.fn();
            const { result } = renderHook(() =>
                useFileUpload({
                    acceptedFileTypes: ['image/*'],
                    onUploadError,
                }),
            );

            const file = new File(['content'], 'test.txt', { type: 'text/plain' });

            act(() => {
                result.current.addFiles([file]);
            });

            expect(result.current.files).toHaveLength(0);
            expect(onUploadError).toHaveBeenCalled();
        });

        it('should remove file from queue', () => {
            const { result } = renderHook(() => useFileUpload());

            const file = new File(['content'], 'test.txt', { type: 'text/plain' });

            act(() => {
                result.current.addFiles([file]);
            });

            expect(result.current.files).toHaveLength(1);

            const fileId = result.current.files[0].id;

            act(() => {
                result.current.removeFile(fileId);
            });

            expect(result.current.files).toHaveLength(0);
        });

        it('should clear all files', () => {
            const { result } = renderHook(() => useFileUpload({ maxFiles: 5 }));

            const files = [new File(['1'], 'test1.txt'), new File(['2'], 'test2.txt')];

            act(() => {
                result.current.addFiles(files);
            });

            expect(result.current.files).toHaveLength(2);

            act(() => {
                result.current.clearFiles();
            });

            expect(result.current.files).toHaveLength(0);
        });

        it('should auto-upload when enabled', async () => {
            const { result } = renderHook(() =>
                useFileUpload({
                    autoUpload: true,
                    uploadEndpoint: '/api/upload',
                }),
            );

            const file = new File(['content'], 'test.txt', { type: 'text/plain' });

            act(() => {
                result.current.addFiles([file]);
            });

            await waitFor(() => {
                expect(result.current.files[0].status).toBe('uploading');
            });
        });

        it('should call onUploadComplete callback', async () => {
            const onUploadComplete = vi.fn();
            const { result } = renderHook(() =>
                useFileUpload({
                    uploadEndpoint: '/api/upload',
                    onUploadComplete,
                }),
            );

            const file = new File(['content'], 'test.txt', { type: 'text/plain' });

            act(() => {
                result.current.addFiles([file]);
            });

            await act(async () => {
                await result.current.uploadAll();
            });

            await waitFor(() => {
                expect(onUploadComplete).toHaveBeenCalled();
            });
        });
    });

    describe('useDragAndDrop', () => {
        it('should initialize with isDragging false', () => {
            const { result } = renderHook(() => useDragAndDrop({ onDrop: vi.fn() }));

            expect(result.current.isDragging).toBe(false);
        });

        it('should set isDragging on drag enter', () => {
            const { result } = renderHook(() => useDragAndDrop({ onDrop: vi.fn() }));

            const event = new Event('dragenter') as any;
            event.dataTransfer = { types: ['Files'], items: [{ kind: 'file' }] };
            event.preventDefault = vi.fn();

            act(() => {
                result.current.handleDragEnter(event);
            });

            expect(result.current.isDragging).toBe(true);
        });

        it('should unset isDragging on drag leave', () => {
            const { result } = renderHook(() => useDragAndDrop({ onDrop: vi.fn() }));

            const enterEvent = new Event('dragenter') as any;
            enterEvent.dataTransfer = { types: ['Files'], items: [{ kind: 'file' }] };
            enterEvent.preventDefault = vi.fn();

            act(() => {
                result.current.handleDragEnter(enterEvent);
            });

            expect(result.current.isDragging).toBe(true);

            const leaveEvent = new Event('dragleave') as any;
            leaveEvent.preventDefault = vi.fn();

            act(() => {
                result.current.handleDragLeave(leaveEvent);
            });

            expect(result.current.isDragging).toBe(false);
        });

        it('should prevent default on drag over', () => {
            const { result } = renderHook(() => useDragAndDrop({ onDrop: vi.fn() }));

            const event = new Event('dragover') as any;
            event.dataTransfer = { dropEffect: 'none' };
            event.preventDefault = vi.fn();

            act(() => {
                result.current.handleDragOver(event);
            });

            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('should call onDrop with files', () => {
            const onDrop = vi.fn();
            const { result } = renderHook(() => useDragAndDrop({ onDrop }));

            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            const event = new Event('drop') as any;
            event.dataTransfer = {
                files: [file],
            };
            event.preventDefault = vi.fn();

            act(() => {
                result.current.handleDrop(event);
            });

            expect(onDrop).toHaveBeenCalledWith([file]);
            expect(result.current.isDragging).toBe(false);
        });

        it('should respect disabled state', () => {
            const onDrop = vi.fn();
            const { result } = renderHook(() => useDragAndDrop({ onDrop, disabled: true }));

            const event = new Event('dragenter') as any;
            event.dataTransfer = { types: ['Files'] };
            event.preventDefault = vi.fn();

            act(() => {
                result.current.handleDragEnter(event);
            });

            expect(result.current.isDragging).toBe(false);
        });

        it('should filter files by accept types', () => {
            const onDrop = vi.fn();
            const { result } = renderHook(() =>
                useDragAndDrop({
                    onDrop,
                    accept: ['image/*'],
                }),
            );

            const imageFile = new File(['img'], 'image.jpg', { type: 'image/jpeg' });
            const textFile = new File(['txt'], 'text.txt', { type: 'text/plain' });

            const event = new Event('drop') as any;
            event.dataTransfer = {
                files: [imageFile, textFile],
            };
            event.preventDefault = vi.fn();

            act(() => {
                result.current.handleDrop(event);
            });

            // Should only pass the image file
            expect(onDrop).toHaveBeenCalledWith([imageFile]);
        });

        it('should respect multiple flag', () => {
            const onDrop = vi.fn();
            const { result } = renderHook(() =>
                useDragAndDrop({
                    onDrop,
                    multiple: false,
                }),
            );

            const file1 = new File(['1'], 'test1.txt', { type: 'text/plain' });
            const file2 = new File(['2'], 'test2.txt', { type: 'text/plain' });

            const event = new Event('drop') as any;
            event.dataTransfer = {
                files: [file1, file2],
            };
            event.preventDefault = vi.fn();

            act(() => {
                result.current.handleDrop(event);
            });

            // Should only pass the first file
            expect(onDrop).toHaveBeenCalledWith([file1]);
        });
    });
});
