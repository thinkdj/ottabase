import { RenderFn } from 'editorjs-blocks-react-renderer';

export type TestimonialVariant = 'card' | 'minimal' | 'featured' | 'quote-bubble' | 'side-by-side';

export interface TestimonialData {
    quote?: string;
    authorName?: string;
    authorRole?: string;
    authorCompany?: string;
    authorAvatar?: string;
    companyLogo?: string;
    rating?: number;
    variant?: TestimonialVariant;
    /** URL to link the author name to */
    sourceUrl?: string;
    /** Whether to show a "Verified" badge next to author name */
    verified?: boolean;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Renders 0-5 filled / empty stars */
function StarRating({ rating }: { rating: number }) {
    const clamped = Math.min(5, Math.max(0, Math.round(rating)));
    return (
        <div className="cdc-testimonial-stars" aria-label={`Rated ${clamped} out of 5`} role="img">
            {Array.from({ length: 5 }, (_, i) => (
                <svg
                    key={i}
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill={i < clamped ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                    className={i < clamped ? 'cdc-testimonial-star--filled' : 'cdc-testimonial-star--empty'}
                >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
            ))}
        </div>
    );
}

/** Author attribution row — avatar + name + role + company */
function AuthorAttribution({
    authorName,
    authorRole,
    authorCompany,
    authorAvatar,
    sourceUrl,
    verified,
    compact = false,
}: {
    authorName: string;
    authorRole?: string;
    authorCompany?: string;
    authorAvatar?: string;
    sourceUrl?: string;
    verified?: boolean;
    compact?: boolean;
}) {
    const nameEl = sourceUrl ? (
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="cdc-testimonial-name">
            {authorName}
        </a>
    ) : (
        <span className="cdc-testimonial-name">{authorName}</span>
    );

    return (
        <div className={`cdc-testimonial-author${compact ? ' cdc-testimonial-author--compact' : ''}`}>
            {authorAvatar && (
                <img
                    src={authorAvatar}
                    alt={authorName}
                    className="cdc-testimonial-avatar"
                    width={40}
                    height={40}
                    loading="lazy"
                />
            )}
            <div className="cdc-testimonial-meta">
                <span>
                    {nameEl}
                    {verified && (
                        <span className="cdc-testimonial-verified" aria-label="Verified">
                            ✓ Verified
                        </span>
                    )}
                </span>
                {(authorRole || authorCompany) && (
                    <span className="cdc-testimonial-sub">
                        {[authorRole, authorCompany].filter(Boolean).join(' · ')}
                    </span>
                )}
            </div>
        </div>
    );
}

// ─── Renderer ────────────────────────────────────────────────────────────────

/**
 * Testimonial block renderer.
 *
 * Three variants:
 * - `card` (default): Bordered card with avatar, attribution, quote, stars.
 * - `minimal`: Clean inline quote with minimal attribution — no border.
 * - `featured`: Full-width hero-style testimonial with large quote and optional logo.
 *
 * Emits `application/ld+json` Review structured data when rating is provided.
 */
const Testimonial: RenderFn<TestimonialData> = ({ data, className = '' }) => {
    const quote = data?.quote?.trim() ?? '';
    const authorName = data?.authorName?.trim() ?? '';
    const authorRole = data?.authorRole?.trim() || undefined;
    const authorCompany = data?.authorCompany?.trim() || undefined;
    const authorAvatar = data?.authorAvatar?.trim() || undefined;
    const companyLogo = data?.companyLogo?.trim() || undefined;
    const rating = typeof data?.rating === 'number' && data.rating > 0 ? data.rating : undefined;
    const variant = data?.variant ?? 'card';
    const sourceUrl = data?.sourceUrl?.trim() || undefined;
    const verified = data?.verified ?? false;

    if (!quote || !authorName) {
        return null;
    }

    // Review structured data for Google rich results
    const structuredData = rating
        ? {
              '@context': 'https://schema.org',
              '@type': 'Review',
              reviewBody: quote,
              author: {
                  '@type': 'Person',
                  name: authorName,
                  jobTitle: authorRole,
              },
              reviewRating: {
                  '@type': 'Rating',
                  ratingValue: rating,
                  bestRating: 5,
              },
          }
        : null;

    return (
        <>
            {structuredData && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
                />
            )}

            {variant === 'card' && (
                <figure
                    className={`${className} my-6 not-prose cdc-content-testimonial cdc-testimonial-card`}
                    itemScope
                    itemType="https://schema.org/Review"
                >
                    {rating && <StarRating rating={rating} />}
                    <blockquote className="cdc-testimonial-quote" itemProp="reviewBody">
                        <p>{quote}</p>
                    </blockquote>
                    <figcaption>
                        <AuthorAttribution
                            authorName={authorName}
                            authorRole={authorRole}
                            authorCompany={authorCompany}
                            authorAvatar={authorAvatar}
                            sourceUrl={sourceUrl}
                            verified={verified}
                        />
                        {companyLogo && (
                            <img
                                src={companyLogo}
                                alt={authorCompany ? `${authorCompany} logo` : 'Company logo'}
                                className="cdc-testimonial-company-logo"
                                loading="lazy"
                            />
                        )}
                    </figcaption>
                </figure>
            )}

            {variant === 'minimal' && (
                <figure
                    className={`${className} my-6 not-prose cdc-content-testimonial cdc-testimonial-minimal`}
                    itemScope
                    itemType="https://schema.org/Review"
                >
                    <blockquote className="cdc-testimonial-quote" itemProp="reviewBody">
                        <p>{quote}</p>
                    </blockquote>
                    <figcaption>
                        <AuthorAttribution
                            authorName={authorName}
                            authorRole={authorRole}
                            authorCompany={authorCompany}
                            authorAvatar={authorAvatar}
                            sourceUrl={sourceUrl}
                            verified={verified}
                            compact
                        />
                    </figcaption>
                </figure>
            )}

            {variant === 'featured' && (
                <figure
                    className={`${className} my-8 not-prose cdc-content-testimonial cdc-testimonial-featured`}
                    itemScope
                    itemType="https://schema.org/Review"
                >
                    {/* Large open-quote decoration rendered via CSS ::before */}
                    <blockquote className="cdc-testimonial-quote cdc-testimonial-quote--large" itemProp="reviewBody">
                        <p>{quote}</p>
                    </blockquote>
                    <figcaption className="cdc-testimonial-featured-footer">
                        <AuthorAttribution
                            authorName={authorName}
                            authorRole={authorRole}
                            authorCompany={authorCompany}
                            authorAvatar={authorAvatar}
                            sourceUrl={sourceUrl}
                            verified={verified}
                        />
                        <div className="cdc-testimonial-featured-right">
                            {rating && <StarRating rating={rating} />}
                            {companyLogo && (
                                <img
                                    src={companyLogo}
                                    alt={authorCompany ? `${authorCompany} logo` : 'Company logo'}
                                    className="cdc-testimonial-company-logo"
                                    loading="lazy"
                                />
                            )}
                        </div>
                    </figcaption>
                </figure>
            )}

            {/* Speech-bubble variant — similar to minimal but with a bubble border + pointer */}
            {variant === 'quote-bubble' && (
                <figure
                    className={`${className} my-6 not-prose cdc-content-testimonial cdc-testimonial-bubble`}
                    itemScope
                    itemType="https://schema.org/Review"
                >
                    <blockquote className="cdc-testimonial-quote" itemProp="reviewBody">
                        <p>{quote}</p>
                    </blockquote>
                    <figcaption className="cdc-testimonial-author">
                        <AuthorAttribution
                            authorName={authorName}
                            authorRole={authorRole}
                            authorCompany={authorCompany}
                            authorAvatar={authorAvatar}
                            sourceUrl={sourceUrl}
                            verified={verified}
                            compact
                        />
                    </figcaption>
                </figure>
            )}

            {/* Side-by-side variant — avatar/author info on left, quote on right */}
            {variant === 'side-by-side' && (
                <figure
                    className={`${className} my-6 not-prose cdc-content-testimonial cdc-testimonial-side`}
                    itemScope
                    itemType="https://schema.org/Review"
                >
                    <div className="cdc-testimonial-side-left">
                        {authorAvatar && (
                            <img
                                src={authorAvatar}
                                alt={authorName}
                                className="cdc-testimonial-avatar"
                                width={56}
                                height={56}
                                loading="lazy"
                            />
                        )}
                        <div className="cdc-testimonial-meta">
                            {sourceUrl ? (
                                <a
                                    href={sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="cdc-testimonial-name"
                                >
                                    {authorName}
                                </a>
                            ) : (
                                <span className="cdc-testimonial-name">{authorName}</span>
                            )}
                            {verified && (
                                <span className="cdc-testimonial-verified" aria-label="Verified">
                                    ✓ Verified
                                </span>
                            )}
                            {(authorRole || authorCompany) && (
                                <span className="cdc-testimonial-sub">
                                    {[authorRole, authorCompany].filter(Boolean).join(' · ')}
                                </span>
                            )}
                        </div>
                        {rating && <StarRating rating={rating} />}
                    </div>
                    <div className="cdc-testimonial-side-right">
                        <blockquote className="cdc-testimonial-quote" itemProp="reviewBody">
                            <p>{quote}</p>
                        </blockquote>
                        {companyLogo && (
                            <img
                                src={companyLogo}
                                alt={authorCompany ? `${authorCompany} logo` : 'Company logo'}
                                className="cdc-testimonial-company-logo"
                                loading="lazy"
                            />
                        )}
                    </div>
                </figure>
            )}
        </>
    );
};

export default Testimonial;
