import { Inline } from '../inline';
import type { BlockRenderer } from '../types';

export interface QuoteData {
    text?: string;
    caption?: string;
    alignment?: 'left' | 'center' | 'right';
}

/** A pull quote: larger, lighter text on a hairline rule, attribution as a micro-label. */
const Quote: BlockRenderer<QuoteData> = ({ data }) => {
    if (!data?.text && !data?.caption) return null;
    const align = data.alignment === 'center' || data.alignment === 'right' ? data.alignment : 'left';
    return (
        <blockquote className="otta-quote" data-align={align}>
            {data.text && (
                <p className="otta-quote__text">
                    <Inline html={data.text} />
                </p>
            )}
            {data.caption && (
                <footer className="otta-quote__caption">
                    <cite>
                        <Inline html={data.caption} />
                    </cite>
                </footer>
            )}
        </blockquote>
    );
};

export default Quote;
