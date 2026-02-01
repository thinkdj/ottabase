import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SEOHead } from '../SEOHead';

describe('SEOHead', () => {
    beforeEach(() => {
        // Clear existing meta tags before each test
        document.head.querySelectorAll('meta, link[rel="canonical"]').forEach((el) => el.remove());
        document.title = '';
    });

    afterEach(() => {
        cleanup();
        // Clean up meta tags after each test
        document.head.querySelectorAll('meta, link[rel="canonical"]').forEach((el) => el.remove());
        document.title = '';
    });

    describe('Basic meta tags', () => {
        it('should set document title', () => {
            render(<SEOHead title="Test Page Title" />);

            expect(document.title).toBe('Test Page Title');
        });

        it('should set description meta tag', () => {
            render(<SEOHead description="Test description for SEO" />);

            const meta = document.querySelector('meta[name="description"]');
            expect(meta?.getAttribute('content')).toBe('Test description for SEO');
        });

        it('should set keywords meta tag', () => {
            const keywords = ['react', 'seo', 'testing'];
            render(<SEOHead keywords={keywords} />);

            const meta = document.querySelector('meta[name="keywords"]');
            expect(meta?.getAttribute('content')).toBe('react,seo,testing');
        });

        it('should set canonical URL', () => {
            render(<SEOHead canonicalUrl="https://example.com/blog/post" />);

            const link = document.querySelector('link[rel="canonical"]');
            expect(link?.getAttribute('href')).toBe('https://example.com/blog/post');
        });
    });

    describe('Open Graph tags', () => {
        it('should set Open Graph title', () => {
            render(<SEOHead title="OG Test Title" />);

            const meta = document.querySelector('meta[property="og:title"]');
            expect(meta?.getAttribute('content')).toBe('OG Test Title');
        });

        it('should set Open Graph description', () => {
            render(<SEOHead description="OG description" />);

            const meta = document.querySelector('meta[property="og:description"]');
            expect(meta?.getAttribute('content')).toBe('OG description');
        });

        it('should set Open Graph image', () => {
            render(<SEOHead ogImage="https://example.com/image.jpg" />);

            const meta = document.querySelector('meta[property="og:image"]');
            expect(meta?.getAttribute('content')).toBe('https://example.com/image.jpg');
        });

        it('should set Open Graph type', () => {
            render(<SEOHead ogType="article" />);

            const meta = document.querySelector('meta[property="og:type"]');
            expect(meta?.getAttribute('content')).toBe('article');
        });

        it('should default og:type to website if not specified', () => {
            render(<SEOHead title="Test" />);

            const meta = document.querySelector('meta[property="og:type"]');
            expect(meta?.getAttribute('content')).toBe('website');
        });

        it('should set Open Graph URL from canonical', () => {
            render(<SEOHead canonicalUrl="https://example.com/page" />);

            const meta = document.querySelector('meta[property="og:url"]');
            expect(meta?.getAttribute('content')).toBe('https://example.com/page');
        });
    });

    describe('Twitter Card tags', () => {
        it('should set Twitter card type', () => {
            render(<SEOHead twitterCard="summary_large_image" />);

            const meta = document.querySelector('meta[name="twitter:card"]');
            expect(meta?.getAttribute('content')).toBe('summary_large_image');
        });

        it('should default twitter:card to summary if not specified', () => {
            render(<SEOHead title="Test" />);

            const meta = document.querySelector('meta[name="twitter:card"]');
            expect(meta?.getAttribute('content')).toBe('summary');
        });

        it('should set Twitter title', () => {
            render(<SEOHead title="Twitter Title" />);

            const meta = document.querySelector('meta[name="twitter:title"]');
            expect(meta?.getAttribute('content')).toBe('Twitter Title');
        });

        it('should set Twitter description', () => {
            render(<SEOHead description="Twitter description" />);

            const meta = document.querySelector('meta[name="twitter:description"]');
            expect(meta?.getAttribute('content')).toBe('Twitter description');
        });

        it('should set Twitter image from ogImage', () => {
            render(<SEOHead ogImage="https://example.com/twitter-image.jpg" />);

            const meta = document.querySelector('meta[name="twitter:image"]');
            expect(meta?.getAttribute('content')).toBe('https://example.com/twitter-image.jpg');
        });
    });

    describe('Article-specific tags', () => {
        it('should set article:published_time', () => {
            const publishedDate = '2024-01-15T10:00:00Z';
            render(<SEOHead publishedTime={publishedDate} />);

            const meta = document.querySelector('meta[property="article:published_time"]');
            expect(meta?.getAttribute('content')).toBe(publishedDate);
        });

        it('should set article:modified_time', () => {
            const modifiedDate = '2024-01-20T15:30:00Z';
            render(<SEOHead modifiedTime={modifiedDate} />);

            const meta = document.querySelector('meta[property="article:modified_time"]');
            expect(meta?.getAttribute('content')).toBe(modifiedDate);
        });

        it('should set article:author', () => {
            render(<SEOHead author="John Doe" />);

            const meta = document.querySelector('meta[property="article:author"]');
            expect(meta?.getAttribute('content')).toBe('John Doe');
        });

        it('should set article:tag for each tag', () => {
            const tags = ['react', 'typescript', 'testing'];
            render(<SEOHead tags={tags} />);

            const metaTags = document.querySelectorAll('meta[property="article:tag"]');
            expect(metaTags.length).toBe(3);
            expect(metaTags[0].getAttribute('content')).toBe('react');
            expect(metaTags[1].getAttribute('content')).toBe('typescript');
            expect(metaTags[2].getAttribute('content')).toBe('testing');
        });
    });

    describe('Robots directives', () => {
        it('should set noindex when specified', () => {
            render(<SEOHead noIndex={true} />);

            const meta = document.querySelector('meta[name="robots"]');
            const content = meta?.getAttribute('content');
            expect(content).toContain('noindex');
        });

        it('should set nofollow when specified', () => {
            render(<SEOHead noFollow={true} />);

            const meta = document.querySelector('meta[name="robots"]');
            const content = meta?.getAttribute('content');
            expect(content).toContain('nofollow');
        });

        it('should combine noindex and nofollow', () => {
            render(<SEOHead noIndex={true} noFollow={true} />);

            const meta = document.querySelector('meta[name="robots"]');
            const content = meta?.getAttribute('content');
            expect(content).toContain('noindex');
            expect(content).toContain('nofollow');
        });

        it('should not set robots tag when both are false', () => {
            render(<SEOHead noIndex={false} noFollow={false} />);

            const meta = document.querySelector('meta[name="robots"]');
            expect(meta).toBeNull();
        });
    });

    describe('Complete blog post example', () => {
        it('should set all meta tags for a blog post', () => {
            render(
                <SEOHead
                    title="Complete Guide to React Testing"
                    description="Learn how to test React components effectively with modern testing tools and best practices."
                    keywords={['react', 'testing', 'vitest', 'best-practices']}
                    canonicalUrl="https://example.com/blog/react-testing-guide"
                    ogImage="https://example.com/images/react-testing.jpg"
                    ogType="article"
                    twitterCard="summary_large_image"
                    publishedTime="2024-01-15T10:00:00Z"
                    modifiedTime="2024-01-20T15:30:00Z"
                    author="Jane Developer"
                    tags={['react', 'testing']}
                />,
            );

            // Verify title
            expect(document.title).toBe('Complete Guide to React Testing');

            // Verify basic meta tags
            expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
                'Learn how to test React components effectively with modern testing tools and best practices.',
            );
            expect(document.querySelector('meta[name="keywords"]')?.getAttribute('content')).toBe(
                'react,testing,vitest,best-practices',
            );

            // Verify canonical URL
            expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
                'https://example.com/blog/react-testing-guide',
            );

            // Verify Open Graph tags
            expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(
                'Complete Guide to React Testing',
            );
            expect(document.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('article');
            expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
                'https://example.com/images/react-testing.jpg',
            );

            // Verify Twitter tags
            expect(document.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe(
                'summary_large_image',
            );

            // Verify article tags
            expect(document.querySelector('meta[property="article:published_time"]')?.getAttribute('content')).toBe(
                '2024-01-15T10:00:00Z',
            );
            expect(document.querySelector('meta[property="article:author"]')?.getAttribute('content')).toBe(
                'Jane Developer',
            );

            const articleTags = document.querySelectorAll('meta[property="article:tag"]');
            expect(articleTags.length).toBe(2);
        });
    });

    describe('Cleanup on unmount', () => {
        it('should remove meta tags when component unmounts', () => {
            const { unmount } = render(
                <SEOHead title="Temporary Title" description="Temporary description" keywords={['temp', 'keywords']} />,
            );

            // Verify tags were added
            expect(document.querySelector('meta[name="description"]')).toBeTruthy();
            expect(document.querySelector('meta[name="keywords"]')).toBeTruthy();

            // Unmount component
            unmount();

            // Verify cleanup happened
            expect(document.querySelector('meta[name="description"]')).toBeNull();
            expect(document.querySelector('meta[name="keywords"]')).toBeNull();
        });

        it('should restore previous title on unmount', () => {
            document.title = 'Original Title';

            const { unmount } = render(<SEOHead title="New Title" />);

            expect(document.title).toBe('New Title');

            unmount();

            expect(document.title).toBe('Original Title');
        });
    });

    describe('Updates on prop changes', () => {
        it('should update meta tags when props change', () => {
            const { rerender } = render(<SEOHead title="First Title" description="First description" />);

            expect(document.title).toBe('First Title');
            expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
                'First description',
            );

            // Update props
            rerender(<SEOHead title="Second Title" description="Second description" />);

            expect(document.title).toBe('Second Title');
            expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
                'Second description',
            );
        });
    });
});
