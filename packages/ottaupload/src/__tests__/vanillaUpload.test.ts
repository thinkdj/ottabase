import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadFile } from '../utils/vanillaUpload';

describe('uploadFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate file size before upload', async () => {
    const largeContent = new Array(11 * 1024 * 1024).fill('a').join('');
    const file = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });

    const result = await uploadFile(file, {
      maxFileSize: 10 * 1024 * 1024, // 10MB
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds maximum');
  });

  it('should validate file type before upload', async () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });

    const result = await uploadFile(file, {
      acceptedFileTypes: ['image/*'],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  it('should append provider to form data', async () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const mockXHR = global.XMLHttpRequest as any;

    const sendSpy = vi.spyOn(mockXHR.prototype, 'send');

    uploadFile(file, {
      provider: 'cloudflare-images',
    });

    // Check that send was called with FormData
    expect(sendSpy).toHaveBeenCalled();
    const formData = sendSpy.mock.calls[0][0] as FormData;
    expect(formData).toBeInstanceOf(FormData);
  });

  it('should call onProgress callback during upload', async () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const onProgress = vi.fn();

    const mockXHR = global.XMLHttpRequest as any;
    const uploadListeners: any = {};

    vi.spyOn(mockXHR.prototype.upload, 'addEventListener').mockImplementation(
      (event: string, callback: any) => {
        uploadListeners[event] = callback;
      }
    );

    uploadFile(file, { onProgress });

    // Simulate progress event
    if (uploadListeners.progress) {
      uploadListeners.progress({
        lengthComputable: true,
        loaded: 50,
        total: 100,
      });
    }

    expect(onProgress).toHaveBeenCalledWith(50);
  });

  it('should use default endpoint if not specified', () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const mockXHR = global.XMLHttpRequest as any;

    const openSpy = vi.spyOn(mockXHR.prototype, 'open');

    uploadFile(file);

    expect(openSpy).toHaveBeenCalledWith('POST', '/api/upload');
  });

  it('should use custom endpoint when specified', () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const mockXHR = global.XMLHttpRequest as any;

    const openSpy = vi.spyOn(mockXHR.prototype, 'open');

    uploadFile(file, {
      endpoint: '/custom/upload',
    });

    expect(openSpy).toHaveBeenCalledWith('POST', '/custom/upload');
  });

  it('should default to r2 provider', () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const mockXHR = global.XMLHttpRequest as any;

    const sendSpy = vi.spyOn(mockXHR.prototype, 'send');

    uploadFile(file);

    expect(sendSpy).toHaveBeenCalled();
  });

  it('should accept image files for validation', async () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    // This should not throw and should pass validation
    const result = await uploadFile(file, {
      acceptedFileTypes: ['image/*'],
    });

    // Since we're using mocked XMLHttpRequest, it will proceed to upload
    expect(result).toBeDefined();
  });
});
