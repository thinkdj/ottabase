import { RenderFn } from 'editorjs-blocks-react-renderer';

// Simple quote icon SVG component
const IconQuote = ({ className = '' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M10 8H7a1 1 0 00-1 1v4a1 1 0 001 1h3a1 1 0 001-1V9a1 1 0 00-1-1zm0 0V5a3 3 0 00-3-3m10 6h-3a1 1 0 00-1 1v4a1 1 0 001 1h3a1 1 0 001-1V9a1 1 0 00-1-1zm0 0V5a3 3 0 00-3-3" />
    </svg>
);

export interface QuoteData {
    text?: string;
    caption?: string;
    alignment?: 'left' | 'center' | 'right';
}

const Quote: RenderFn<QuoteData> = ({ data, className = '' }) => {
    const { text, caption, alignment = 'left' } = data || {};

    // Determine text alignment class based on alignment prop
    const alignmentClass =
        {
            left: 'text-left',
            center: 'text-center',
            right: 'text-right',
        }[alignment] || 'text-left';

    return (
        <div className={`${className} ${alignmentClass}`}>
            <blockquote className="relative group my-16">
                {/* Floating quote mark */}
                <div className="absolute -top-4 -left-2 text-6xl font-serif text-gray-200 dark:text-gray-800 leading-none select-none pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                    <IconQuote className="w-10 h-10" />
                </div>
                {/* QUOTE*/}
                {text && (
                    <div className="relative z-10 text-2xl font-light text-gray-900 dark:text-gray-100 leading-relaxed tracking-normal mb-4 pl-8">
                        {text}
                    </div>
                )}
                {/* Author / Caption */}
                {caption && (
                    <footer className="flex items-center justify-end">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-px bg-gradient-to-r from-transparent to-gray-400 dark:to-gray-600"></div>
                            <cite className="text-sm font-medium text-gray-600 dark:text-gray-400 not-italic tracking-wider uppercase">
                                {caption}
                            </cite>
                        </div>
                    </footer>
                )}

                {/* Subtle background accent */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-50/30 to-transparent dark:from-gray-900/20 rounded-2xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            </blockquote>
        </div>
    );
};

export default Quote;
