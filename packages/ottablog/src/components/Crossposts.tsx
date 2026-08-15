import { sanitizeUrl } from '@ottabase/utils/sanitize';
import React from 'react';
import { crosspostLabel } from '../types';
import type { BlogPostData } from './blog-renderer-types';
import { BlurbTextLinksAllowed } from './BlurbText';

/**
 * One crosspost link.
 *
 * Degrades to plain text where anchors are not allowed: timeline cards are wrapped in a link by
 * their caller, so an `<a>` here would nest — the same constraint `BlurbText` reads from
 * `BlurbTextLinksAllowed`. The microformats classes make this machine-readable to the IndieWeb
 * tools that already understand the pattern: `u-url` for the copy this post was taken from,
 * `u-syndication` for copies pushed out from here.
 */
function CrosspostLink({ href, label, origin }: { href: string; label: string; origin: boolean }) {
    const linksAllowed = React.useContext(BlurbTextLinksAllowed);
    const className = `normal-case tracking-normal ${origin ? 'u-url' : 'u-syndication'}`;

    if (!linksAllowed) return <span className={className}>{label}</span>;
    return (
        <a
            href={href}
            target="_blank"
            rel={origin ? 'noopener noreferrer' : 'noopener noreferrer syndication'}
            className={`${className} underline decoration-border underline-offset-4 transition-colors hover:text-foreground`}
        >
            {label}
        </a>
    );
}

export interface CrosspostsProps {
    post: BlogPostData;
    /** Extra classes for the wrapper. Callers pass whatever their own byline uses. */
    className?: string;
}

/**
 * "originally on instagram.com · also on x.com · facebook.com"
 *
 * Split by direction on purpose. "Originally on" is attribution — this post is the copy — and
 * reads as part of the byline next to the author. "Also on" points outward at copies. One list
 * showing both undifferentiated would leave a reader unable to tell which link is the real home.
 *
 * Shared by every content type: an article, a photo journal, and a blurb all get the same row, so
 * a reader learns the vocabulary once. Renders nothing when the post has no usable links, which
 * is what makes it safe to drop unconditionally into any renderer.
 */
export function Crossposts({ post, className = '' }: CrosspostsProps) {
    // Sanitize and label once; anything that survives neither is dropped rather than rendered blank.
    const items = (post.crossposts ?? [])
        .map((item) => ({ ...item, href: sanitizeUrl(item.url), label: crosspostLabel(item.url) }))
        .filter((item) => item.href !== '#' && item.label);
    if (items.length === 0) return null;

    const origin = items.find((item) => item.origin);
    const syndicated = items.filter((item) => item !== origin);

    return (
        <>
            {origin && (
                <span className={`flex items-center gap-1 normal-case tracking-normal ${className}`.trim()}>
                    originally on <CrosspostLink href={origin.href} label={origin.label} origin />
                </span>
            )}
            {syndicated.length > 0 && (
                <span className={`flex flex-wrap items-center gap-1 normal-case tracking-normal ${className}`.trim()}>
                    also on{' '}
                    {syndicated.map((item, index) => (
                        <React.Fragment key={item.href}>
                            {index > 0 && <span aria-hidden="true">·</span>}
                            <CrosspostLink href={item.href} label={item.label} origin={false} />
                        </React.Fragment>
                    ))}
                </span>
            )}
        </>
    );
}

/**
 * The same links as their own row, for renderers that have no byline to join (articles and photo
 * journals, whose metadata line is owned by the theme). Renders nothing when there are no links.
 */
export function CrosspostsRow({ post, className = '' }: CrosspostsProps) {
    if (!post.crossposts?.length) return null;
    return (
        <div
            className={`blog-crossposts flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.6875rem] font-medium text-muted-foreground ${className}`.trim()}
        >
            <Crossposts post={post} />
        </div>
    );
}
