import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  makeSlug,
  getSegment,
  getDomainName,
  joinPaths,
  getBaseUrl,
  prependBaseUrlForRelativePath,
  isValidUrl,
  replaceDoubleSlashes,
  getSearchParam,
} from '../url';

describe('URL Utilities', () => {
  describe('makeSlug', () => {
    it('should convert string to slug', () => {
      expect(makeSlug('Hello World')).toBe('hello-world');
      expect(makeSlug('Hello World!')).toBe('hello-world');
      expect(makeSlug('Hello  World')).toBe('hello-world');
    });

    it('should use custom separator', () => {
      expect(makeSlug('Hello World', '_')).toBe('hello_world');
      expect(makeSlug('Test Article', '.')).toBe('test.article');
    });

    it('should handle unicode characters', () => {
      expect(makeSlug('Café résumé')).toBe('cafe-resume');
      expect(makeSlug('niño año')).toBe('nino-ano');
    });

    it('should handle special characters', () => {
      expect(makeSlug('a/b/c')).toBe('abc'); // Slashes are replaced, then collapsed
      expect(makeSlug('test@#$%^&*()')).toBe('test');
    });

    it('should truncate to 256 characters', () => {
      const longString = 'a'.repeat(300);
      const slug = makeSlug(longString);
      expect(slug.length).toBeLessThanOrEqual(256);
    });

    it('should handle empty string', () => {
      expect(makeSlug('')).toBe('');
    });
  });

  describe('getSegment', () => {
    it('should extract segment from path', () => {
      expect(getSegment('path/to/resource', '/', 1)).toBe('path');
      expect(getSegment('path/to/resource', '/', 2)).toBe('to');
      expect(getSegment('path/to/resource', '/', 3)).toBe('resource');
    });

    it('should work with custom separator', () => {
      expect(getSegment('a-b-c', '-', 1)).toBe('a');
      expect(getSegment('a-b-c', '-', 2)).toBe('b');
      expect(getSegment('a-b-c', '-', 3)).toBe('c');
    });

    it('should return null for invalid segment number', () => {
      expect(getSegment('a/b/c', '/', 10)).toBeNull();
      expect(getSegment('a/b/c', '/', 0)).toBeNull();
    });

    it('should handle null input', () => {
      expect(getSegment(null, '/', 1)).toBeNull();
    });
  });

  describe('getDomainName', () => {
    it('should extract domain from URL', () => {
      expect(getDomainName('https://example.com/path')).toBe('example.com');
      expect(getDomainName('https://subdomain.example.com')).toBe(
        'subdomain.example.com',
      );
    });

    it('should remove www by default', () => {
      expect(getDomainName('https://www.example.com')).toBe('example.com');
    });

    it('should optionally keep www', () => {
      expect(getDomainName('https://www.example.com', false)).toBe(
        'www.example.com',
      );
    });

    it('should handle invalid URLs', () => {
      expect(getDomainName('not-a-url')).toBeNull();
      expect(getDomainName('')).toBeNull();
    });
  });

  describe('joinPaths', () => {
    it('should join paths correctly', () => {
      expect(joinPaths('api', 'v1', 'users')).toBe('api/v1/users');
      expect(joinPaths('/api', 'v1', 'users')).toBe('/api/v1/users');
    });

    it('should handle paths with slashes', () => {
      expect(joinPaths('/api/', '/v1/', '/users/')).toBe('/api/v1/users');
      expect(joinPaths('api/', 'v1/', 'users/')).toBe('api/v1/users');
    });

    it('should handle multiple slashes', () => {
      expect(joinPaths('api//v1', 'users')).toBe('api/v1/users');
    });

    it('should preserve protocol slashes', () => {
      expect(joinPaths('https://example.com', 'api', 'users')).toBe(
        'https://example.com/api/users',
      );
    });

    it('should handle empty inputs', () => {
      expect(joinPaths()).toBe('');
      expect(joinPaths('', '', '')).toBe('');
      expect(joinPaths('api', '', 'users')).toBe('api/users');
    });

    it('should handle single slash', () => {
      expect(joinPaths('/')).toBe('/');
    });
  });

  describe('getBaseUrl', () => {
    it('should return empty string in Node.js environment', () => {
      expect(getBaseUrl()).toBe('');
    });

    it('should return window.location.origin in browser', () => {
      // Mock window object
      const mockWindow = {
        location: {
          origin: 'https://example.com',
        },
      };
      global.window = mockWindow as any;

      expect(getBaseUrl()).toBe('https://example.com');

      // Clean up
      delete (global as any).window;
    });
  });

  describe('prependBaseUrlForRelativePath', () => {
    it('should prepend base URL to relative paths', () => {
      expect(prependBaseUrlForRelativePath('/api/users', 'https://api.example.com')).toBe(
        'https://api.example.com/api/users',
      );
    });

    it('should not prepend to absolute URLs', () => {
      expect(
        prependBaseUrlForRelativePath('https://other.com/path', 'https://api.example.com'),
      ).toBe('https://other.com/path');
      expect(
        prependBaseUrlForRelativePath('//cdn.example.com/asset', 'https://api.example.com'),
      ).toBe('//cdn.example.com/asset');
    });

    it('should use process.env.BASE_URL as fallback', () => {
      const originalEnv = process.env.BASE_URL;
      process.env.BASE_URL = 'https://default.com';

      expect(prependBaseUrlForRelativePath('/api/users')).toBe(
        'https://default.com/api/users',
      );

      process.env.BASE_URL = originalEnv;
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('https://example.com/path?query=value')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('example.com')).toBe(false); // missing protocol
    });
  });

  describe('replaceDoubleSlashes', () => {
    it('should replace multiple slashes with single slash', () => {
      expect(replaceDoubleSlashes('https://example.com//path')).toBe(
        'https://example.com/path',
      );
      expect(replaceDoubleSlashes('path///to////resource')).toBe(
        'path/to/resource',
      );
    });

    it('should preserve protocol slashes', () => {
      expect(replaceDoubleSlashes('https://example.com')).toBe(
        'https://example.com',
      );
      expect(replaceDoubleSlashes('http://localhost:3000//api')).toBe(
        'http://localhost:3000/api',
      );
    });

    it('should handle empty string', () => {
      expect(replaceDoubleSlashes('')).toBe('');
    });
  });

  describe('getSearchParam', () => {
    it('should get search param from URL string', () => {
      expect(
        getSearchParam('error', undefined, 'https://example.com?error=404'),
      ).toBe('404');
      expect(
        getSearchParam('name', undefined, 'https://example.com?name=John'),
      ).toBe('John');
    });

    it('should return default value if param not found', () => {
      expect(
        getSearchParam('missing', 'default', 'https://example.com'),
      ).toBe('default');
    });

    it('should handle multiple params', () => {
      const url = 'https://example.com?foo=bar&baz=qux';
      expect(getSearchParam('foo', undefined, url)).toBe('bar');
      expect(getSearchParam('baz', undefined, url)).toBe('qux');
    });

    it('should decode URL-encoded values', () => {
      expect(
        getSearchParam('message', undefined, 'https://example.com?message=Hello%20World'),
      ).toBe('Hello World');
    });

    it('should handle empty param name', () => {
      expect(getSearchParam('', undefined, 'https://example.com?error=404')).toBeNull();
    });

    it('should return null for missing param without default', () => {
      expect(
        getSearchParam('missing', undefined, 'https://example.com'),
      ).toBeNull();
    });

    it('should return default value in Node.js when no URL provided', () => {
      expect(getSearchParam('test', 'default')).toBe('default');
    });
  });
});
