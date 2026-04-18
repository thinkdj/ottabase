import { RenderFn } from 'editorjs-blocks-react-renderer';
import { useId, useMemo } from 'react';

/** NOTE: Do not remove `not-prose` class from the component. It is used to prevent the component from being styled by the parent prose class.  */

export interface ReviewData {
    image?: string;
    title?: string;
    content?: string;
    linkUrl?: string;
    linkLabel?: string;
    pros?: string[];
    cons?: string[];
    rating?: number;
    maxStars?: 5 | 10;
    allowHalfStars?: boolean;
    summary?: string;
    compact?: boolean;
}

// SVG Star Icons for clean rendering with rounded edges
const FullStar = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            strokeLinejoin="round"
            strokeLinecap="round"
        />
    </svg>
);

const HalfStar = ({ className }: { className?: string }) => {
    const clipId = useId();
    return (
        <svg className={className} viewBox="0 0 24 24">
            {/* Background empty star */}
            <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                className="text-muted-foreground"
            />
            {/* Half filled star using clip */}
            <clipPath id={clipId}>
                <rect x="0" y="0" width="12" height="24" />
            </clipPath>
            <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                fill="currentColor"
                clipPath={`url(#${clipId})`}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    );
};

const EmptyStar = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            strokeLinejoin="round"
            strokeLinecap="round"
        />
    </svg>
);

const StarRating = ({
    rating = 0,
    maxStars = 5,
    size = 'md',
}: {
    rating: number;
    maxStars: number;
    size?: 'sm' | 'md' | 'lg';
}) => {
    const stars = useMemo(() => {
        const result: Array<'full' | 'half' | 'empty'> = [];
        for (let i = 1; i <= maxStars; i++) {
            if (i <= Math.floor(rating)) {
                result.push('full');
            } else if (i - 0.5 <= rating) {
                result.push('half');
            } else {
                result.push('empty');
            }
        }
        return result;
    }, [rating, maxStars]);

    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-7 h-7',
    };

    return (
        <div className="flex items-center gap-0.5" role="img" aria-label={`Rating: ${rating} out of ${maxStars} stars`}>
            {stars.map((type, i) => {
                const starClass = sizeClasses[size];
                if (type === 'full') return <FullStar key={i} className={`${starClass} text-warning`} />;
                if (type === 'half') return <HalfStar key={i} className={`${starClass} text-warning`} />;
                return <EmptyStar key={i} className={`${starClass} text-muted-foreground`} />;
            })}
        </div>
    );
};

// Determine accent color based on rating percentage
const getRatingColor = (rating: number, maxStars: number): string => {
    const percentage = (rating / maxStars) * 100;
    if (percentage >= 80) return 'bg-emerald-600';
    if (percentage >= 60) return 'bg-sky-600';
    if (percentage >= 40) return 'bg-amber-500';
    return 'bg-red-500';
};

// Rating badge — circular, clean
const RatingBadge = ({ rating, maxStars, size = 'lg' }: { rating: number; maxStars: number; size?: 'sm' | 'lg' }) => {
    const display = rating.toFixed(rating % 1 !== 0 ? 1 : 0);
    const colorClass = getRatingColor(rating, maxStars);
    const isLarge = size === 'lg';
    return (
        <div
            className={`inline-flex flex-col items-center justify-center ${colorClass} text-white rounded-full ${
                isLarge ? 'w-16 h-16' : 'w-10 h-10'
            }`}
        >
            <span className={`font-bold leading-none ${isLarge ? 'text-xl' : 'text-sm'}`}>{display}</span>
            <span className={`leading-none opacity-80 ${isLarge ? 'text-xs' : 'text-[9px]'}`}>/{maxStars}</span>
        </div>
    );
};

const Review: RenderFn<ReviewData> = ({ data, className = '' }) => {
    const title = data?.title || '';
    const content = data?.content || '';
    const image = data?.image;
    const linkUrl = data?.linkUrl;
    const linkLabel = data?.linkLabel || 'Learn more';
    const pros = data?.pros?.filter((p) => p.trim()) || [];
    const cons = data?.cons?.filter((c) => c.trim()) || [];
    const rating = data?.rating ?? 0;
    const maxStars = data?.maxStars || 5;
    const summary = data?.summary;
    const compact = data?.compact ?? false;

    if (!title) return null;

    const structuredData = useMemo(() => {
        if (!title) return null;
        const schema: Record<string, any> = {
            '@context': 'https://schema.org',
            '@type': 'Review',
            name: title,
            reviewBody: content,
            itemReviewed: {
                '@type': 'Thing',
                name: title,
            },
        };
        if (rating > 0) {
            schema.reviewRating = {
                '@type': 'Rating',
                ratingValue: rating,
                bestRating: maxStars,
            };
        }
        if (image) {
            schema.image = image;
        }
        return schema;
    }, [title, content, rating, maxStars, image]);

    return (
        <>
            {structuredData && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
                />
            )}

            {compact ? (
                /* ── Compact layout: stamp image left, content right, summary bottom ── */
                <div
                    className={`not-prose ${className} my-4 rounded-lg overflow-hidden border border-border cdc-content-review cdc-content-review--compact`}
                    itemScope
                    itemType="https://schema.org/Review"
                >
                    <div className="flex">
                        {/* Stamp-like image */}
                        {image && (
                            <div className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 overflow-hidden">
                                <img
                                    src={image}
                                    alt={title}
                                    className="w-full h-full object-cover"
                                    itemProp="image"
                                    loading="lazy"
                                />
                            </div>
                        )}

                        {/* Right content */}
                        <div className="flex-1 px-3 py-2 flex flex-col justify-center min-w-0">
                            <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                    <h3
                                        className="text-sm sm:text-base font-semibold text-card-foreground leading-tight truncate m-0"
                                        itemProp="name"
                                    >
                                        {linkUrl ? (
                                            <a
                                                href={linkUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="hover:underline text-inherit"
                                            >
                                                {title}
                                            </a>
                                        ) : (
                                            title
                                        )}
                                    </h3>

                                    {/* Star row */}
                                    {rating > 0 && (
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <div itemProp="reviewRating" itemScope itemType="https://schema.org/Rating">
                                                <meta itemProp="ratingValue" content={String(rating)} />
                                                <meta itemProp="bestRating" content={String(maxStars)} />
                                                <StarRating rating={rating} maxStars={maxStars} size="sm" />
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                {rating}/{maxStars}
                                            </span>
                                        </div>
                                    )}

                                    {/* Content snippet */}
                                    {content && (
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1 m-0">{content}</p>
                                    )}
                                </div>

                                {/* Rating badge */}
                                {rating > 0 && (
                                    <div className="flex-shrink-0">
                                        <RatingBadge rating={rating} maxStars={maxStars} size="sm" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bottom summary bar */}
                    {summary && (
                        <div className="px-3 py-1.5 border-t border-border bg-muted/50">
                            <p className="text-xs text-muted-foreground m-0 line-clamp-1" itemProp="reviewBody">
                                <span className="font-medium text-foreground">Verdict:</span> {summary}
                            </p>
                        </div>
                    )}
                </div>
            ) : (
                /* ── Full layout ── */
                <div
                    className={`not-prose ${className} my-5 rounded-lg overflow-hidden border border-border cdc-content-review`}
                    itemScope
                    itemType="https://schema.org/Review"
                >
                    {/* Header image */}
                    {image && (
                        <div className="relative overflow-hidden">
                            <img
                                src={image}
                                alt={title}
                                className="w-full h-auto object-cover"
                                itemProp="image"
                                loading="lazy"
                            />
                            {rating > 0 && (
                                <div className="absolute top-3 right-3">
                                    <RatingBadge rating={rating} maxStars={maxStars} size="lg" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Content area */}
                    <div className="px-5 py-4 sm:px-6 sm:py-5">
                        {/* No-image rating badge */}
                        {!image && rating > 0 && (
                            <div className="flex items-center gap-3 mb-3">
                                <RatingBadge rating={rating} maxStars={maxStars} size="lg" />
                                <span className="text-sm text-muted-foreground">out of {maxStars}</span>
                            </div>
                        )}

                        {/* Title */}
                        <h3 className="text-lg font-semibold text-foreground leading-snug mb-1 mt-0" itemProp="name">
                            {title}
                        </h3>

                        {/* Star rating */}
                        {rating > 0 && (
                            <div className="flex items-center gap-2 mb-3">
                                <div itemProp="reviewRating" itemScope itemType="https://schema.org/Rating">
                                    <meta itemProp="ratingValue" content={String(rating)} />
                                    <meta itemProp="bestRating" content={String(maxStars)} />
                                    <StarRating rating={rating} maxStars={maxStars} size="md" />
                                </div>
                                <span className="text-sm text-muted-foreground">
                                    {rating}/{maxStars}
                                </span>
                            </div>
                        )}

                        {/* Description */}
                        {content && (
                            <p
                                className="text-sm text-muted-foreground leading-relaxed mb-4 mt-0"
                                itemProp="reviewBody"
                            >
                                {content}
                            </p>
                        )}

                        {/* Pros & Cons */}
                        {(pros.length > 0 || cons.length > 0) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                {pros.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5 uppercase tracking-wide mt-0">
                                            Pros
                                        </h4>
                                        <ul className="list-none m-0 p-0 space-y-1">
                                            {pros.map((pro, i) => (
                                                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                                                    <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                    <span>{pro}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {cons.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5 uppercase tracking-wide mt-0">
                                            Cons
                                        </h4>
                                        <ul className="list-none m-0 p-0 space-y-1">
                                            {cons.map((con, i) => (
                                                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                                                    <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-400" />
                                                    <span>{con}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* CTA Link */}
                        {linkUrl && (
                            <div className="mb-4">
                                <a
                                    href={linkUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline underline-offset-4 decoration-muted-foreground/40 hover:decoration-foreground transition-colors"
                                >
                                    {linkLabel}
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                        />
                                    </svg>
                                </a>
                            </div>
                        )}

                        {/* Verdict */}
                        {summary && (
                            <div className="pt-3 border-t border-border">
                                <h4 className="font-semibold text-xs mb-1 mt-0 text-muted-foreground uppercase tracking-wide">
                                    Verdict
                                </h4>
                                <p className="text-sm text-foreground m-0 leading-relaxed">{summary}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Noscript fallback */}
            <noscript>
                <div className="my-6 p-4 border rounded">
                    <h3>{title}</h3>
                    {content && <p>{content}</p>}
                    {rating > 0 && (
                        <p>
                            Rating: {rating}/{maxStars}
                        </p>
                    )}
                </div>
            </noscript>
        </>
    );
};

export default Review;
