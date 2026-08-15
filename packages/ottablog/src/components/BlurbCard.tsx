import { sanitizeUrl } from '@ottabase/utils/sanitize';
import { formatDate as defaultFormatDate } from '../types';
import type { BlogPostData, BlurbRendererProps } from './blog-renderer-types';
import { BlurbText } from './BlurbText';
import { Crossposts } from './Crossposts';

export interface BlurbCardProps {
    post: BlogPostData;
    props: BlurbRendererProps;
    tone?: 'editorial' | 'minimal';
}

/**
 * A thought is not a short article, so it does not get the article card.
 *
 * `editorial` gives it a bound edge: a 2px accent rule down the left, squared on that side and
 * rounded on the other three. In a timeline of evenly rounded cards the asymmetric one reads as
 * a page held in a binding rather than one more feed item. `minimal` drops the container
 * entirely and separates entries with a hairline, matching that theme's flat register.
 *
 * Both tones lead with the words and put the byline under them: a blurb has no title, so
 * metadata above the text would be standing in for one. The date comes first in the byline
 * because a dated entry with no title is a journal entry, and the date is its identity.
 *
 * Crossposts land at the end of that byline, split by direction: "originally on x.com" is a
 * credit and belongs next to the author, "also on …" is a set of pointers outward.
 */
export function BlurbCard({ post, props, tone = 'editorial' }: BlurbCardProps) {
    const formatDate = props.formatDate || defaultFormatDate;
    const detail = props.variant === 'detail';
    const editorial = tone === 'editorial';

    const hasByline = Boolean(post.publishedAt || post.author?.name || post.crossposts?.length);

    const shell = editorial
        ? `rounded-l-sm rounded-r-2xl border border-l-2 border-border/60 border-l-primary/40 bg-card transition-colors duration-normal hover:border-l-primary ${
              detail ? 'px-6 py-8 sm:px-9 sm:py-10' : 'px-5 py-5 sm:px-6'
          }`
        : `last:border-b-0 ${detail ? 'py-10' : 'border-b border-border/60 py-6'}`;

    const text = editorial
        ? `${detail ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'} leading-relaxed text-foreground`
        : `${detail ? 'text-2xl sm:text-3xl' : 'text-lg'} font-light leading-relaxed text-foreground`;

    return (
        <div className={shell}>
            <BlurbText text={post.blurbText ?? post.excerpt ?? ''} className={`max-w-[54ch] ${text}`} />
            {hasByline && (
                <div
                    className={`mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 pt-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ${
                        editorial ? 'border-t border-border/40' : ''
                    }`}
                >
                    {post.publishedAt && (
                        <time dateTime={new Date(post.publishedAt).toISOString()}>{formatDate(post.publishedAt)}</time>
                    )}
                    {post.author?.name && (
                        <span className="flex items-center gap-2 normal-case tracking-normal">
                            {post.author.image && editorial && (
                                <img
                                    src={sanitizeUrl(post.author.image)}
                                    alt=""
                                    className="h-5 w-5 rounded-full object-cover ring-1 ring-border"
                                />
                            )}
                            {post.author.name}
                        </span>
                    )}
                    <Crossposts post={post} />
                </div>
            )}
        </div>
    );
}
