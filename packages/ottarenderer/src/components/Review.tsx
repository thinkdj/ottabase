import { RenderFn } from 'editorjs-blocks-react-renderer';
import { useMemo } from 'react';

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
}

const StarRating = ({ rating = 0, maxStars = 5 }: { rating: number; maxStars: number }) => {
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

    return (
        <div className="flex items-center gap-0.5" role="img" aria-label={`Rating: ${rating} out of ${maxStars} stars`}>
            {stars.map((type, i) => (
                <span
                    key={i}
                    className={`text-lg leading-none ${
                        type === 'empty' ? 'text-gray-300 dark:text-gray-600' : 'text-amber-400'
                    }`}
                    style={type === 'half' ? { opacity: 0.5 } : undefined}
                >
                    ★
                </span>
            ))}
            <span className="ml-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                {rating}/{maxStars}
            </span>
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

    if (!title) return null;

    const structuredData = useMemo(() => {
        if (!title) return null;
        const schema: Record<string, any> = {
            '@context': 'https://schema.org',
            '@type': 'Review',
            name: title,
            reviewBody: content,
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
            <div
                className={`${className} my-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden shadow-sm cdc-content-review`}
                itemScope
                itemType="https://schema.org/Review"
            >
                {/* Image */}
                {image && (
                    <div className="w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                        <img
                            src={image}
                            alt={title}
                            className="w-full h-auto max-h-80 object-cover"
                            itemProp="image"
                            loading="lazy"
                        />
                    </div>
                )}

                <div className="p-5 sm:p-6">
                    {/* Title + Rating */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 m-0" itemProp="name">
                            {title}
                        </h3>
                        {rating > 0 && (
                            <div itemProp="reviewRating" itemScope itemType="https://schema.org/Rating">
                                <meta itemProp="ratingValue" content={String(rating)} />
                                <meta itemProp="bestRating" content={String(maxStars)} />
                                <StarRating rating={rating} maxStars={maxStars} />
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    {content && (
                        <p
                            className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-4"
                            itemProp="reviewBody"
                        >
                            {content}
                        </p>
                    )}

                    {/* Link */}
                    {linkUrl && (
                        <div className="mb-4">
                            <a
                                href={linkUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
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

                    {/* Pros & Cons */}
                    {(pros.length > 0 || cons.length > 0) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            {pros.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2 flex items-center gap-1">
                                        <span>✓</span> Pros
                                    </h4>
                                    <ul className="list-none m-0 p-0 space-y-1">
                                        {pros.map((pro, i) => (
                                            <li
                                                key={i}
                                                className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-1.5"
                                            >
                                                <span className="text-green-500 mt-0.5 flex-shrink-0">+</span>
                                                {pro}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {cons.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                                        <span>✗</span> Cons
                                    </h4>
                                    <ul className="list-none m-0 p-0 space-y-1">
                                        {cons.map((con, i) => (
                                            <li
                                                key={i}
                                                className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-1.5"
                                            >
                                                <span className="text-red-500 mt-0.5 flex-shrink-0">−</span>
                                                {con}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Summary */}
                    {summary && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 italic m-0">
                                <span className="font-semibold not-italic">Verdict: </span>
                                {summary}
                            </p>
                        </div>
                    )}
                </div>
            </div>

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
