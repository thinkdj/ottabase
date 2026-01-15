import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  uploadFileToR2,
  uploadFileToCloudflareImages,
  createFileMetadata,
  parseFormDataFiles,
} from '../server';

// Mock R2 client
const mockR2Client = {
  put: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
};

describe('uploadFileToR2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should upload file successfully to R2', async () => {
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });

    mockR2Client.put.mockResolvedValue({
      success: true,
      data: {},
    });

    const result = await uploadFileToR2(file, mockR2Client as any);

    expect(result.success).toBe(true);
    expect(result.url).toBeDefined();
    expect(result.key).toBeDefined();
    expect(mockR2Client.put).toHaveBeenCalled();
  });

  it('should validate file size before upload', async () => {
    const largeContent = new Array(11 * 1024 * 1024).fill('a').join('');
    const file = new File([largeContent], 'large.txt', { type: 'text/plain' });

    const result = await uploadFileToR2(file, mockR2Client as any, {
      maxFileSize: 10 * 1024 * 1024,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds maximum');
    expect(mockR2Client.put).not.toHaveBeenCalled();
  });

  it('should validate file type before upload', async () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });

    const result = await uploadFileToR2(file, mockR2Client as any, {
      allowedTypes: ['image/*'],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not allowed');
    expect(mockR2Client.put).not.toHaveBeenCalled();
  });

  it('should handle R2 upload failure', async () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });

    mockR2Client.put.mockResolvedValue({
      success: false,
      error: { message: 'Upload failed' },
    });

    const result = await uploadFileToR2(file, mockR2Client as any);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should use custom key generator if provided', async () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const customKey = 'custom/path/test.txt';

    mockR2Client.put.mockResolvedValue({
      success: true,
      data: {},
    });

    const result = await uploadFileToR2(file, mockR2Client as any, {
      generateKey: () => customKey,
    });

    expect(result.success).toBe(true);
    expect(result.key).toBe(customKey);
  });
});

describe('uploadFileToCloudflareImages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('should upload image successfully to Cloudflare Images', async () => {
    const file = new File(['image content'], 'test.jpg', { type: 'image/jpeg' });

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        result: {
          id: 'test-image-id',
          filename: 'test.jpg',
          uploaded: new Date().toISOString(),
          requireSignedURLs: false,
          variants: [
            'https://imagedelivery.net/account/test-image-id/public',
            'https://imagedelivery.net/account/test-image-id/thumbnail',
          ],
        },
      }),
    });

    const config = {
      accountId: 'test-account',
      apiToken: 'test-token',
    };

    const result = await uploadFileToCloudflareImages(file, config);

    expect(result.success).toBe(true);
    expect(result.key).toBe('test-image-id');
    expect(result.url).toContain('public');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/test-account/images/v1',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
        },
      })
    );
  });

  it('should reject non-image files', async () => {
    const file = new File(['text'], 'test.txt', { type: 'text/plain' });

    const config = {
      accountId: 'test-account',
      apiToken: 'test-token',
    };

    const result = await uploadFileToCloudflareImages(file, config);

    expect(result.success).toBe(false);
    expect(result.error).toContain('image files');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should handle API errors', async () => {
    const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' });

    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        errors: [{ message: 'API error' }],
      }),
    });

    const config = {
      accountId: 'test-account',
      apiToken: 'test-token',
    };

    const result = await uploadFileToCloudflareImages(file, config);

    expect(result.success).toBe(false);
    expect(result.error).toContain('API error');
  });

  it('should include metadata when provided', async () => {
    const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' });

    let capturedFormData: FormData | null = null;
    (global.fetch as any).mockImplementation(async (url: string, options: any) => {
      capturedFormData = options.body;
      return {
        ok: true,
        json: async () => ({
          success: true,
          result: {
            id: 'test-id',
            filename: 'test.jpg',
            uploaded: new Date().toISOString(),
            requireSignedURLs: false,
            variants: ['https://example.com/test-id/public'],
          },
        }),
      };
    });

    const config = {
      accountId: 'test-account',
      apiToken: 'test-token',
      metadata: { userId: 'user-123' },
    };

    await uploadFileToCloudflareImages(file, config);

    expect(capturedFormData).toBeInstanceOf(FormData);
  });
});

describe('createFileMetadata', () => {
  it('should create file metadata object', () => {
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const key = 'files/test.pdf';
    const url = 'https://example.com/files/test.pdf';
    const userId = 'user-123';

    const metadata = createFileMetadata(key, file, url, userId);

    expect(metadata.id).toBeDefined();
    expect(metadata.key).toBe(key);
    expect(metadata.filename).toBe('test.pdf');
    expect(metadata.size).toBe(file.size);
    expect(metadata.contentType).toBe('application/pdf');
    expect(metadata.url).toBe(url);
    expect(metadata.userId).toBe(userId);
    expect(metadata.uploadedAt).toBeInstanceOf(Date);
  });

  it('should work without userId', () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const key = 'files/test.txt';
    const url = 'https://example.com/files/test.txt';

    const metadata = createFileMetadata(key, file, url);

    expect(metadata.userId).toBeUndefined();
  });
});

describe('parseFormDataFiles', () => {
  it('should extract files from FormData', () => {
    const formData = new FormData();
    const file1 = new File(['test1'], 'test1.txt', { type: 'text/plain' });
    const file2 = new File(['test2'], 'test2.txt', { type: 'text/plain' });

    formData.append('file1', file1);
    formData.append('file2', file2);
    formData.append('text', 'not a file');

    const files = parseFormDataFiles(formData);

    expect(files).toHaveLength(2);
    expect(files[0]).toBe(file1);
    expect(files[1]).toBe(file2);
  });

  it('should return empty array when no files', () => {
    const formData = new FormData();
    formData.append('text', 'just text');

    const files = parseFormDataFiles(formData);

    expect(files).toHaveLength(0);
  });
});
