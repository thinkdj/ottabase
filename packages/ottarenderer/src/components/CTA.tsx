import { RenderFn } from 'editorjs-blocks-react-renderer';
import { useMemo } from 'react';

export interface CTAData {
    text?: string;
    url?: string;
    style?: 'primary' | 'secondary' | 'outline';
    openInNewTab?: boolean;
    icon?: string;
}

const CTA: RenderFn<CTAData> = ({ data, className = '' }) => {
    const buttonText = data?.text || 'Get Started';
    const url = data?.url || '#';
    const style = data?.style || 'primary';
    const openInNewTab = data?.openInNewTab ?? false;
    const icon = data?.icon;

    // Memoize button classes and inline styles
    const { buttonClasses, buttonStyle } = useMemo(() => {
        const baseClasses =
            'inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800';
        const styleClasses = {
            primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 shadow-md hover:shadow-lg',
            secondary: 'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500 shadow-md hover:shadow-lg',
            outline:
                'bg-transparent border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-400 dark:hover:text-gray-900 focus:ring-blue-500',
        };

        // Inline styles as fallback for when Tailwind isn't processed
        const inlineStyles: Record<string, React.CSSProperties> = {
            primary: {
                backgroundColor: '#2563eb',
                color: '#ffffff',
                borderColor: '#2563eb',
                borderWidth: '2px',
                borderStyle: 'solid',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            },
            secondary: {
                backgroundColor: '#4b5563',
                color: '#ffffff',
                borderColor: '#4b5563',
                borderWidth: '2px',
                borderStyle: 'solid',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            },
            outline: {
                backgroundColor: 'transparent',
                color: '#2563eb',
                borderColor: '#2563eb',
                borderWidth: '2px',
                borderStyle: 'solid',
            },
        };

        return {
            buttonClasses: `${baseClasses} ${styleClasses[style]}`,
            buttonStyle: inlineStyles[style],
        };
    }, [style]);

    // Generate structured data for SEO
    const structuredData = useMemo(() => {
        if (!url || url === '#') return null;
        return {
            '@context': 'https://schema.org',
            '@type': 'Action',
            name: buttonText,
            target: {
                '@type': 'EntryPoint',
                urlTemplate: url,
            },
        };
    }, [buttonText, url]);

    return (
        <>
            {/* Structured data for SEO */}
            {structuredData && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
                />
            )}
            <div className={`${className} my-6 flex justify-center cdc-content-cta`}>
                <a
                    href={url}
                    target={openInNewTab ? '_blank' : '_self'}
                    rel={openInNewTab ? 'noopener noreferrer' : ''}
                    className={buttonClasses}
                    style={buttonStyle}
                    itemScope
                    itemType="https://schema.org/Action"
                    itemProp="name"
                    aria-label={buttonText}
                >
                    {icon && <span className="mr-2" dangerouslySetInnerHTML={{ __html: icon }} aria-hidden="true" />}
                    {buttonText}
                </a>
            </div>
            {/* Noscript fallback for crawlers */}
            <noscript>
                <div className="my-6 flex justify-center">
                    <a
                        href={url}
                        className="inline-block px-6 py-3 rounded-lg font-semibold text-sm bg-blue-600 text-white"
                    >
                        {buttonText}
                    </a>
                </div>
            </noscript>
        </>
    );
};

export default CTA;
