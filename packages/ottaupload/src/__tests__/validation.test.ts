import { describe, it, expect } from 'vitest';
import {
  validateFileSize,
  validateFileType,
  validateFiles,
  formatFileSize,
  generateFileKey,
} from '../validation';

describe('validateFileSize', () => {
  it('should return true for files within size limit', () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const maxSize = 1024 * 1024; // 1MB
    expect(validateFileSize(file, maxSize)).toBe(true);
  });

  it('should return false for files exceeding size limit', () => {
    const largeContent = new Array(2 * 1024 * 1024).fill('a').join('');
    const file = new File([largeContent], 'large.txt', { type: 'text/plain' });
    const maxSize = 1024 * 1024; // 1MB
    expect(validateFileSize(file, maxSize)).toBe(false);
  });

  it('should return true when no max size is specified', () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    expect(validateFileSize(file, undefined)).toBe(true);
  });
});

describe('validateFileType', () => {
  it('should return true for matching MIME type', () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    expect(validateFileType(file, ['text/plain'])).toBe(true);
  });

  it('should return true for wildcard MIME type match', () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    expect(validateFileType(file, ['image/*'])).toBe(true);
  });

  it('should return false for non-matching MIME type', () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    expect(validateFileType(file, ['image/*'])).toBe(false);
  });

  it('should return true when no types are specified', () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    expect(validateFileType(file, [])).toBe(true);
    expect(validateFileType(file, undefined)).toBe(true);
  });

  it('should handle multiple accepted types', () => {
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    expect(validateFileType(file, ['image/*', 'application/pdf'])).toBe(true);
  });
});

describe('validateFiles', () => {
  it('should validate multiple files successfully', () => {
    const files = [
      new File(['test1'], 'test1.txt', { type: 'text/plain' }),
      new File(['test2'], 'test2.txt', { type: 'text/plain' }),
    ];

    const result = validateFiles(files, {
      maxFiles: 5,
      maxFileSize: 1024 * 1024,
      acceptedFileTypes: ['text/plain'],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail validation when exceeding max files', () => {
    const files = [
      new File(['test1'], 'test1.txt', { type: 'text/plain' }),
      new File(['test2'], 'test2.txt', { type: 'text/plain' }),
      new File(['test3'], 'test3.txt', { type: 'text/plain' }),
    ];

    const result = validateFiles(files, {
      maxFiles: 2,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Too many files. Maximum 2 files allowed.');
  });

  it('should fail validation for oversized files', () => {
    const largeContent = new Array(2 * 1024 * 1024).fill('a').join('');
    const files = [
      new File([largeContent], 'large.txt', { type: 'text/plain' }),
    ];

    const result = validateFiles(files, {
      maxFileSize: 1024 * 1024, // 1MB
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should fail validation for wrong file types', () => {
    const files = [
      new File(['test'], 'test.txt', { type: 'text/plain' }),
    ];

    const result = validateFiles(files, {
      acceptedFileTypes: ['image/*'],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('formatFileSize', () => {
  it('should format bytes correctly', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('should format kilobytes correctly', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('should format megabytes correctly', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB');
  });

  it('should format gigabytes correctly', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
  });

  it('should handle zero bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });
});

describe('generateFileKey', () => {
  it('should generate a key with date prefix', () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const key = generateFileKey(file);

    // Should match format: YYYY/MM/DD/uuid-filename
    expect(key).toMatch(/^\d{4}\/\d{2}\/\d{2}\/.+-test\.jpg$/);
  });

  it('should include file extension', () => {
    const file = new File(['test'], 'document.pdf', { type: 'application/pdf' });
    const key = generateFileKey(file);

    expect(key).toContain('.pdf');
  });

  it('should handle files without extensions', () => {
    const file = new File(['test'], 'testfile', { type: 'text/plain' });
    const key = generateFileKey(file);

    expect(key).toMatch(/^\d{4}\/\d{2}\/\d{2}\/.+-testfile$/);
  });

  it('should generate unique keys for same file', () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const key1 = generateFileKey(file);
    const key2 = generateFileKey(file);

    expect(key1).not.toBe(key2);
  });
});
