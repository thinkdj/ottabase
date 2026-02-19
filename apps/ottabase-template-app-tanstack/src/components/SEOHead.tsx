/**
 * SEO Head Component
 *
 * Renders SEO meta tags in the document head for better search engine optimization.
 * Supports Open Graph and Twitter Card metadata.
 */
import { useEffect } from 'react';

export interface SEOHeadProps {
    /** Page title (without site name) */
    title?: string;
    /** Meta description */
    description?: string;
    /** Meta keywords */
    keywords?: string[];
    /** Canonical URL */
    canonicalUrl?: string;
    /** Open Graph image URL */
    ogImage?: string;
    /** Open Graph type (article, website, etc.) */
    ogType?: 'article' | 'website' | 'blog';
    /** Twitter Card type */
    twitterCard?: 'summary' | 'summary_large_image';
    /** Whether to prevent indexing */
    noIndex?: boolean;
    /** Whether to prevent following links */
    noFollow?: boolean;
    /** Article published date (ISO 8601) */
    publishedTime?: string;
    /** Article modified date (ISO 8601) */
    modifiedTime?: string;
    /** Article author */
    author?: string;
    /** Article tags */
    tags?: string[];
}

/**
 * SEOHead - Manages document head meta tags for SEO
 *
 * @example
 * ```tsx
 * <SEOHead
 *   title="Blog Post Title"
 *   description="Post excerpt or description"
 *   ogImage="https://example.com/image.jpg"
 *   ogType="article"
 *   publishedTime="2024-01-15T10:00:00Z"
 * />
 * ```
 */
export function SEOHead({
    title,
    description,
    keywords,
    canonicalUrl,
    ogImage,
    ogType = 'website',
    twitterCard = 'summary',
    noIndex = false,
    noFollow = false,
    publishedTime,
    modifiedTime,
    author,
    tags,
}: SEOHeadProps) {
    useEffect(() => {
        // Store original values to restore on unmount
        const originalTitle = document.title;
        const existingMetas = Array.from(document.querySelectorAll('meta[data-seo-managed]'));

        // Update document title
        if (title) {
            document.title = title;
        }

        // Helper to set or update meta tag
        const setMetaTag = (attributes: Record<string, string>, content: string) => {
            const selector = Object.entries(attributes)
                .map(([key, value]) => `[${key}="${value}"]`)
                .join('');

            let meta = document.querySelector<HTMLMetaElement>(selector);

            if (!meta) {
                meta = document.createElement('meta');
                Object.entries(attributes).forEach(([key, value]) => {
                    meta!.setAttribute(key, value);
                });
                meta.setAttribute('data-seo-managed', 'true');
                document.head.appendChild(meta);
            }

            meta.content = content;
        };

        // Helper to set or update link tag
        const setLinkTag = (attributes: Record<string, string>, href: string) => {
            const selector = Object.entries(attributes)
                .map(([key, value]) => `[${key}="${value}"]`)
                .join('');

            let link = document.querySelector<HTMLLinkElement>(selector);

            if (!link) {
                link = document.createElement('link');
                Object.entries(attributes).forEach(([key, value]) => {
                    link!.setAttribute(key, value);
                });
                link.setAttribute('data-seo-managed', 'true');
                document.head.appendChild(link);
            }

            link.href = href;
        };

        // Basic meta tags
        if (description) {
            setMetaTag({ name: 'description' }, description);
        }

        if (keywords && keywords.length > 0) {
            setMetaTag({ name: 'keywords' }, keywords.join(', '));
        }

        // Robots meta tag
        const robotsDirectives: string[] = [];
        if (noIndex) robotsDirectives.push('noindex');
        if (noFollow) robotsDirectives.push('nofollow');
        if (robotsDirectives.length > 0) {
            setMetaTag({ name: 'robots' }, robotsDirectives.join(', '));
        }

        // Canonical URL
        if (canonicalUrl) {
            setLinkTag({ rel: 'canonical' }, canonicalUrl);
        }

        // Open Graph meta tags
        if (title) {
            setMetaTag({ property: 'og:title' }, title);
        }

        if (description) {
            setMetaTag({ property: 'og:description' }, description);
        }

        if (ogType) {
            setMetaTag({ property: 'og:type' }, ogType);
        }

        if (ogImage) {
            setMetaTag({ property: 'og:image' }, ogImage);
        }

        if (canonicalUrl) {
            setMetaTag({ property: 'og:url' }, canonicalUrl);
        }

        // Twitter Card meta tags
        if (twitterCard) {
            setMetaTag({ name: 'twitter:card' }, twitterCard);
        }

        if (title) {
            setMetaTag({ name: 'twitter:title' }, title);
        }

        if (description) {
            setMetaTag({ name: 'twitter:description' }, description);
        }

        if (ogImage) {
            setMetaTag({ name: 'twitter:image' }, ogImage);
        }

        // Article-specific meta tags
        if (ogType === 'article') {
            if (publishedTime) {
                setMetaTag({ property: 'article:published_time' }, publishedTime);
            }

            if (modifiedTime) {
                setMetaTag({ property: 'article:modified_time' }, modifiedTime);
            }

            if (author) {
                setMetaTag({ property: 'article:author' }, author);
            }

            if (tags && tags.length > 0) {
                // Multiple article:tag tags (one per tag)
                tags.forEach((tag, index) => {
                    setMetaTag({ property: 'article:tag', 'data-tag-index': index.toString() }, tag);
                });
            }
        }

        // Cleanup on unmount
        return () => {
            document.title = originalTitle;

            // Remove all SEO-managed meta and link tags
            document.querySelectorAll('[data-seo-managed]').forEach((el) => {
                el.remove();
            });
        };
    }, [
        title,
        description,
        keywords,
        canonicalUrl,
        ogImage,
        ogType,
        twitterCard,
        noIndex,
        noFollow,
        publishedTime,
        modifiedTime,
        author,
        tags,
    ]);

    return null; // This component doesn't render anything
}

export default SEOHead;
