import { describe, expect, it } from 'vitest';
import {
    blogArchivePath,
    blogBasePath,
    blogDateArchivePath,
    blogPostPath,
    parseBlogPath,
    parseBlogPostPath,
} from '../paths';

describe('blog paths', () => {
    it('builds the site blog and organization blog URLs', () => {
        expect(blogBasePath(null)).toBe('/blog');
        expect(blogBasePath('acme')).toBe('/blogs/acme');
        expect(blogPostPath(null, 'hello world')).toBe('/blog/hello%20world');
        expect(blogPostPath('acme', 'namaskaram', 'ml')).toBe('/blogs/acme/namaskaram?lang=ml');
        expect(blogArchivePath('acme', 'tag', 'travel')).toBe('/blogs/acme/tag/travel');
        expect(blogDateArchivePath(null, 2026, 8)).toBe('/blog/archive/2026/8');
        expect(blogDateArchivePath('acme', 2026)).toBe('/blogs/acme/archive/2026');
    });

    it('reads the blog and the rest back out of a document path', () => {
        expect(parseBlogPath('/blog')).toEqual({ blogSlug: null, rest: '' });
        expect(parseBlogPath('/blog/tag/x')).toEqual({ blogSlug: null, rest: 'tag/x' });
        expect(parseBlogPath('/blogs/acme')).toEqual({ blogSlug: 'acme', rest: '' });
        expect(parseBlogPath('/blogs/acme/my-post')).toEqual({ blogSlug: 'acme', rest: 'my-post' });
        expect(parseBlogPath('/blogs')).toBeNull();
        expect(parseBlogPath('/blogs/')).toBeNull();
        expect(parseBlogPath('/blogger')).toBeNull();
        expect(parseBlogPath('/other/hello')).toBeNull();
    });

    it('finds the post of a detail page only', () => {
        expect(parseBlogPostPath('/blog/hello%20world')).toEqual({ blogSlug: null, postSlug: 'hello world' });
        expect(parseBlogPostPath('/blogs/acme/my-post')).toEqual({ blogSlug: 'acme', postSlug: 'my-post' });
        for (const path of ['/blog', '/blog/', '/blog/tag/x', '/blogs/acme', '/blogs/acme/category/x', '/x/y']) {
            expect(parseBlogPostPath(path), path).toBeNull();
        }
    });

    it('treats malformed percent-encoding as not a blog page', () => {
        expect(parseBlogPostPath('/blog/%E0%A4%A')).toBeNull();
        expect(parseBlogPath('/blogs/%E0%A4%A/x')).toBeNull();
    });
});
