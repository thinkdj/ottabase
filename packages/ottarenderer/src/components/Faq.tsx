import { sanitizeJsonForScript } from '@ottabase/utils/sanitize';
import type { BlockRenderer } from '../types';

export interface FaqItem {
    question?: string;
    answer?: string;
}

export interface FaqData {
    items?: FaqItem[];
    style?: 'accordion' | 'flat';
}

/**
 * FAQ block renderer.
 *
 * - `accordion` style (default): renders each Q&A as a native `<details>`/`<summary>` element.
 *   This is fully accessible out of the box (keyboard, screen-reader) and works without JS.
 * - `flat` style: renders all answers always visible for quick scanning.
 *
 * The block also emits `application/ld+json` structured data (FAQPage schema) when there is
 * at least one valid item, helping Google display rich FAQ results in search.
 */
const Faq: BlockRenderer<FaqData> = ({ data, className = '' }) => {
    const style = data?.style ?? 'accordion';
    const items = (data?.items ?? [])
        .map((item) => ({
            question: item?.question?.trim() ?? '',
            answer: item?.answer?.trim() ?? '',
        }))
        .filter((item) => item.question !== '');

    if (!items.length) {
        return null;
    }

    // FAQPage structured data for Google rich results
    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer,
            },
        })),
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: sanitizeJsonForScript(structuredData) }}
            />
            <section className={`${className} not-prose otta-faq`} aria-label="Frequently asked questions">
                {style === 'accordion' ? (
                    <div className="otta-faq-accordion" role="list">
                        {items.map((item, index) => (
                            <details key={`${item.question}-${index}`} className="otta-faq-item" role="listitem">
                                <summary className="otta-faq-question">
                                    <span className="otta-faq-question-text">{item.question}</span>
                                    <span className="otta-faq-chevron" aria-hidden="true">
                                        {/* CSS-only rotate chevron */}
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="m6 9 6 6 6-6" />
                                        </svg>
                                    </span>
                                </summary>
                                {item.answer && <p className="otta-faq-answer">{item.answer}</p>}
                            </details>
                        ))}
                    </div>
                ) : (
                    /* Flat style: all answers always visible */
                    <div className="otta-faq-flat" role="list">
                        {items.map((item, index) => (
                            <div
                                key={`${item.question}-${index}`}
                                className="otta-faq-item otta-faq-item--flat"
                                role="listitem"
                            >
                                <h3 className="otta-faq-question otta-faq-question--flat">{item.question}</h3>
                                {item.answer && <p className="otta-faq-answer">{item.answer}</p>}
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </>
    );
};

export default Faq;
