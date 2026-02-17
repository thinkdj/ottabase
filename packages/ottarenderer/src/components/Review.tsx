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
const getRatingColor = (rating: number, maxStars: number) => {
    const percentage = (rating / maxStars) * 100;
    if (percentage >= 80) return 'from-success to-success/80';
    if (percentage >= 60) return 'from-info to-info/80';
    if (percentage >= 40) return 'from-warning to-warning/80';
    return 'from-destructive to-destructive/80';
};

// Shared rating badge — yellow circle with white text
const RatingBadge = ({ rating, maxStars, size = 'lg' }: { rating: number; maxStars: number; size?: 'sm' | 'lg' }) => {
    const display = rating.toFixed(rating % 1 !== 0 ? 1 : 0);
    const isLarge = size === 'lg';
    return (
        <div
            className={`inline-flex flex-col items-center justify-center bg-primary text-primary-foreground rounded-full shadow-md ${
                isLarge ? 'w-24 h-24' : 'w-12 h-12'
            }`}
        >
            <span className={`font-bold leading-none ${isLarge ? 'text-3xl' : 'text-md'}`}>{display}</span>
            <span className={`leading-none opacity-90 ${isLarge ? 'text-[14px]' : 'text-[10px]'}`}>/{maxStars}</span>
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

    const accentGradient = getRatingColor(rating, maxStars);

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
                    className={`not-prose ${className} my-4 rounded-lg overflow-hidden bg-card border border-border shadow-sm hover:shadow-md transition-shadow cdc-content-review cdc-content-review--compact`}
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
                    className={`not-prose ${className} my-5 rounded-xl overflow-hidden bg-card border border-border shadow-md hover:shadow-lg transition-shadow cdc-content-review`}
                    itemScope
                    itemType="https://schema.org/Review"
                >
                    {/* Header with image */}
                    <div className="relative overflow-hidden">
                        {image ? (
                            <div className="relative overflow-hidden">
                                <img
                                    src={image}
                                    alt={title}
                                    className="w-full h-full object-cover"
                                    itemProp="image"
                                    loading="lazy"
                                />
                                {/* Gradient overlay with rating badge */}
                                <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/40" />
                                {rating > 0 && (
                                    <div className="absolute top-3 right-3 transform transition-transform hover:scale-105">
                                        <RatingBadge rating={rating} maxStars={maxStars} size="lg" />
                                    </div>
                                )}
                            </div>
                        ) : rating > 0 ? (
                            <div className="bg-muted h-32 flex items-center justify-center relative">
                                <div className="text-foreground text-center flex items-center gap-2">
                                    <RatingBadge rating={rating} maxStars={maxStars} size="lg" />
                                    <span className="text-muted-foreground font-medium text-sm">out of {maxStars}</span>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* Content */}
                    <div className="px-5 py-4 sm:px-6 sm:py-5">
                        {/* Title */}
                        <h3
                            className="text-xl sm:text-2xl font-bold text-card-foreground leading-tight mb-1 mt-0"
                            itemProp="name"
                        >
                            {title}
                        </h3>

                        {/* Star rating inline (if image exists) */}
                        {image && rating > 0 && (
                            <div className="flex items-center gap-2 mb-3">
                                <div itemProp="reviewRating" itemScope itemType="https://schema.org/Rating">
                                    <meta itemProp="ratingValue" content={String(rating)} />
                                    <meta itemProp="bestRating" content={String(maxStars)} />
                                    <StarRating rating={rating} maxStars={maxStars} size="md" />
                                </div>
                                <span className="text-sm font-medium text-muted-foreground">
                                    {rating}/{maxStars}
                                </span>
                            </div>
                        )}

                        {/* Content paragraph */}
                        {content && (
                            <p className="text-muted-foreground text-sm leading-relaxed mb-4" itemProp="reviewBody">
                                {content}
                            </p>
                        )}

                        {/* Pros & Cons Grid */}
                        {(pros.length > 0 || cons.length > 0) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                {pros.length > 0 && (
                                    <div className="bg-success/10 rounded-lg p-3 border border-success/20">
                                        <h4 className="text-xs font-bold text-success mb-2 flex items-center gap-1.5 uppercase tracking-wide">
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                <path
                                                    fillRule="evenodd"
                                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                            Pros
                                        </h4>
                                        <ul className="list-none m-0 p-0 space-y-2">
                                            {pros.map((pro, i) => (
                                                <li
                                                    key={i}
                                                    className="text-sm text-foreground flex items-start gap-2.5"
                                                >
                                                    <span className="text-success font-bold mt-0.5 flex-shrink-0">
                                                        •
                                                    </span>
                                                    <span>{pro}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {cons.length > 0 && (
                                    <div className="bg-destructive/10 rounded-lg p-3 border border-destructive/20">
                                        <h4 className="text-xs font-bold text-destructive mb-2 flex items-center gap-1.5 uppercase tracking-wide">
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                <path
                                                    fillRule="evenodd"
                                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                            Cons
                                        </h4>
                                        <ul className="list-none m-0 p-0 space-y-2">
                                            {cons.map((con, i) => (
                                                <li
                                                    key={i}
                                                    className="text-sm text-foreground flex items-start gap-2.5"
                                                >
                                                    <span className="text-destructive font-bold mt-0.5 flex-shrink-0">
                                                        •
                                                    </span>
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
                                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-white bg-gradient-to-r ${accentGradient} hover:shadow-lg transition-all transform hover:scale-105`}
                                >
                                    {linkLabel}
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                        {/* Verdict/Summary */}
                        {summary && (
                            <div className={`bg-gradient-to-r ${accentGradient} rounded-lg p-4 border-0`}>
                                <h4 className="font-bold text-xs mb-1.5 mt-0 flex items-center gap-1.5 text-gray-900 dark:text-white">
                                    <svg
                                        className="w-5 h-5"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
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
