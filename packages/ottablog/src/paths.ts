import { sanitizeUrl } from '@ottabase/utils/sanitize';
import type { ContentType } from './types';

/** The public page for saved content: /blog/slug, /changelog/slug or /docs/slug */
export function getPublicContentPath(slug: string, contentType: ContentType): string {
    const encodedSlug = encodeURIComponent(slug);
    const path =
        contentType === 'changelog'
            ? `/changelog/${encodedSlug}`
            : contentType === 'docs'
              ? `/docs/${encodedSlug}`
              : `/blog/${encodedSlug}`;
    return sanitizeUrl(path);
}
