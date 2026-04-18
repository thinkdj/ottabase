import { RenderFn } from 'editorjs-blocks-react-renderer';
import { useMemo } from 'react';

export interface CTAData {
    text?: string;
    url?: string;
    style?: 'primary' | 'secondary' | 'outline' | 'ghost';
    alignment?: 'left' | 'center' | 'right';
    openInNewTab?: boolean;
    icon?: string;
}

const alignmentClass: Record<NonNullable<CTAData['alignment']>, string> = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
};

const buttonStyleClass: Record<NonNullable<CTAData['style']>, string> = {
    primary: 'bg-primary text-primary-foreground border-primary hover:opacity-90',
    secondary: 'bg-secondary text-secondary-foreground border-secondary hover:opacity-90',
    outline: 'bg-transparent text-primary border-primary hover:bg-muted/40',
    ghost: 'bg-transparent text-foreground border-border hover:bg-muted',
};

const CTA: RenderFn<CTAData> = ({ data, className = '' }) => {
    const buttonText = data?.text || 'Get Started';
    const url = data?.url || '#';
    const style = data?.style || 'primary';
    const alignment = data?.alignment || 'center';
    const openInNewTab = data?.openInNewTab ?? false;
    const icon = data?.icon;

    const justify = alignmentClass[alignment] ?? 'justify-center';

    const buttonClass = useMemo(() => {
        const baseClass =
            'inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md font-semibold text-sm no-underline border-2 transition-colors duration-200 leading-tight cursor-pointer';
        return `${baseClass} ${buttonStyleClass[style] ?? buttonStyleClass.primary}`;
    }, [style]);

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
            {structuredData && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
                />
            )}
            <div className={`${className} my-6 flex ${justify} cdc-content-cta`} data-alignment={alignment}>
                <a
                    href={url}
                    target={openInNewTab ? '_blank' : '_self'}
                    rel={openInNewTab ? 'noopener noreferrer' : undefined}
                    className={buttonClass}
                    itemScope
                    itemType="https://schema.org/Action"
                    itemProp="name"
                    aria-label={buttonText}
                >
                    {icon && <span dangerouslySetInnerHTML={{ __html: icon }} aria-hidden="true" />}
                    {buttonText}
                </a>
            </div>
            <noscript>
                <div className={`my-6 flex ${justify}`}>
                    <a href={url} className={buttonClass}>
                        {buttonText}
                    </a>
                </div>
            </noscript>
        </>
    );
};

export default CTA;
