import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFileUpload } from '../hooks/useFileUpload';
import { useDragAndDrop } from '../hooks/useDragAndDrop';

describe('useFileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty files array', () => {
    const { result } = renderHook(() => useFileUpload());

    expect(result.current.files).toEqual([]);
    expect(result.current.isUploading).toBe(false);
  });

  it('should add files to the queue', () => {
    const { result } = renderHook(() => useFileUpload({ maxFiles: 5 }));

    const file1 = new File(['test1'], 'test1.txt', { type: 'text/plain' });
    const file2 = new File(['test2'], 'test2.txt', { type: 'text/plain' });

    act(() => {
      result.current.addFiles([file1, file2]);
    });

    expect(result.current.files).toHaveLength(2);
    expect(result.current.files[0].file).toBe(file1);
    expect(result.current.files[1].file).toBe(file2);
  });

  it('should validate max files limit', () => {
    const onUploadError = vi.fn();
    const { result } = renderHook(() =>
      useFileUpload({ maxFiles: 2, onUploadError })
    );

    const files = [
      new File(['test1'], 'test1.txt', { type: 'text/plain' }),
      new File(['test2'], 'test2.txt', { type: 'text/plain' }),
      new File(['test3'], 'test3.txt', { type: 'text/plain' }),
    ];

    act(() => {
      result.current.addFiles(files);
    });

    expect(onUploadError).toHaveBeenCalled();
    expect(result.current.files).toHaveLength(0);
  });

  it('should validate file size', () => {
    const onUploadError = vi.fn();
    const { result } = renderHook(() =>
      useFileUpload({
        maxFileSize: 1024, // 1KB
        onUploadError,
      })
    );

    const largeContent = new Array(2048).fill('a').join('');
    const file = new File([largeContent], 'large.txt', { type: 'text/plain' });

    act(() => {
      result.current.addFiles([file]);
    });

    expect(onUploadError).toHaveBeenCalled();
    expect(result.current.files).toHaveLength(0);
  });

  it('should validate file types', () => {
    const onUploadError = vi.fn();
    const { result } = renderHook(() =>
      useFileUpload({
        acceptedFileTypes: ['image/*'],
        onUploadError,
      })
    );

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });

    act(() => {
      result.current.addFiles([file]);
    });

    expect(onUploadError).toHaveBeenCalled();
    expect(result.current.files).toHaveLength(0);
  });

  it('should remove file from queue', () => {
    const { result } = renderHook(() => useFileUpload());

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });

    act(() => {
      result.current.addFiles([file]);
    });

    const fileId = result.current.files[0].id;

    act(() => {
      result.current.removeFile(fileId);
    });

    expect(result.current.files).toHaveLength(0);
  });

  it('should clear all files', () => {
    const { result } = renderHook(() => useFileUpload());

    const files = [
      new File(['test1'], 'test1.txt', { type: 'text/plain' }),
      new File(['test2'], 'test2.txt', { type: 'text/plain' }),
    ];

    act(() => {
      result.current.addFiles(files);
    });

    expect(result.current.files).toHaveLength(2);

    act(() => {
      result.current.clearFiles();
    });

    expect(result.current.files).toHaveLength(0);
  });

  it('should use specified provider', () => {
    const { result } = renderHook(() =>
      useFileUpload({ provider: 'cloudflare-images' })
    );

    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    act(() => {
      result.current.addFiles([file]);
    });

    expect(result.current.files).toHaveLength(1);
  });

  it('should default to r2 provider', () => {
    const { result } = renderHook(() => useFileUpload());

    expect(result.current).toBeDefined();
  });
});

describe('useDragAndDrop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with isDragging false', () => {
    const onFilesDropped = vi.fn();
    const { result } = renderHook(() => useDragAndDrop({ onFilesDropped }));

    expect(result.current.isDragging).toBe(false);
  });

  it('should set isDragging to true on drag enter', () => {
    const onFilesDropped = vi.fn();
    const { result } = renderHook(() => useDragAndDrop({ onFilesDropped }));

    const event = new Event('dragenter') as any;
    event.preventDefault = vi.fn();
    event.stopPropagation = vi.fn();
    event.dataTransfer = { types: ['Files'] };

    act(() => {
      result.current.dragHandlers.onDragEnter(event);
    });

    expect(result.current.isDragging).toBe(true);
  });

  it('should set isDragging to false on drag leave', () => {
    const onFilesDropped = vi.fn();
    const { result } = renderHook(() => useDragAndDrop({ onFilesDropped }));

    const enterEvent = new Event('dragenter') as any;
    enterEvent.preventDefault = vi.fn();
    enterEvent.stopPropagation = vi.fn();
    enterEvent.dataTransfer = { types: ['Files'] };

    act(() => {
      result.current.dragHandlers.onDragEnter(enterEvent);
    });

    expect(result.current.isDragging).toBe(true);

    const leaveEvent = new Event('dragleave') as any;
    leaveEvent.preventDefault = vi.fn();
    leaveEvent.stopPropagation = vi.fn();

    act(() => {
      result.current.dragHandlers.onDragLeave(leaveEvent);
    });

    expect(result.current.isDragging).toBe(false);
  });

  it('should call onFilesDropped with valid files on drop', () => {
    const onFilesDropped = vi.fn();
    const { result } = renderHook(() => useDragAndDrop({ onFilesDropped }));

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const dropEvent = new Event('drop') as any;
    dropEvent.preventDefault = vi.fn();
    dropEvent.stopPropagation = vi.fn();
    dropEvent.dataTransfer = {
      files: [file],
    };

    act(() => {
      result.current.dragHandlers.onDrop(dropEvent);
    });

    expect(onFilesDropped).toHaveBeenCalledWith([file]);
    expect(result.current.isDragging).toBe(false);
  });

  it('should filter files by accepted types on drop', () => {
    const onFilesDropped = vi.fn();
    const { result } = renderHook(() =>
      useDragAndDrop({
        onFilesDropped,
        acceptedFileTypes: ['image/*'],
      })
    );

    const imageFile = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
    const textFile = new File(['text'], 'test.txt', { type: 'text/plain' });

    const dropEvent = new Event('drop') as any;
    dropEvent.preventDefault = vi.fn();
    dropEvent.stopPropagation = vi.fn();
    dropEvent.dataTransfer = {
      files: [imageFile, textFile],
    };

    act(() => {
      result.current.dragHandlers.onDrop(dropEvent);
    });

    expect(onFilesDropped).toHaveBeenCalledWith([imageFile]);
  });

  it('should provide drag handlers', () => {
    const onFilesDropped = vi.fn();
    const { result } = renderHook(() => useDragAndDrop({ onFilesDropped }));

    expect(result.current.dragHandlers.onDragEnter).toBeDefined();
    expect(result.current.dragHandlers.onDragLeave).toBeDefined();
    expect(result.current.dragHandlers.onDragOver).toBeDefined();
    expect(result.current.dragHandlers.onDrop).toBeDefined();
  });

  it('should prevent default on drag over', () => {
    const onFilesDropped = vi.fn();
    const { result } = renderHook(() => useDragAndDrop({ onFilesDropped }));

    const event = new Event('dragover') as any;
    event.preventDefault = vi.fn();
    event.stopPropagation = vi.fn();
    event.dataTransfer = { dropEffect: '' };

    act(() => {
      result.current.dragHandlers.onDragOver(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
  });
});
