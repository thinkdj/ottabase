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

/** Inline CSS-variable styles so the button respects the global theme without relying on specific Tailwind color values. */
const buttonStyles: Record<NonNullable<CTAData['style']>, React.CSSProperties> = {
    primary: {
        background: 'hsl(var(--primary))',
        color: 'hsl(var(--primary-foreground))',
        border: '2px solid hsl(var(--primary))',
    },
    secondary: {
        background: 'hsl(var(--secondary))',
        color: 'hsl(var(--secondary-foreground))',
        border: '2px solid hsl(var(--secondary))',
    },
    outline: {
        background: 'transparent',
        color: 'hsl(var(--primary))',
        border: '2px solid hsl(var(--primary))',
    },
    ghost: {
        background: 'transparent',
        color: 'hsl(var(--foreground))',
        border: '2px solid hsl(var(--border))',
    },
};

const CTA: RenderFn<CTAData> = ({ data, className = '' }) => {
    const buttonText = data?.text || 'Get Started';
    const url = data?.url || '#';
    const style = data?.style || 'primary';
    const alignment = data?.alignment || 'center';
    const openInNewTab = data?.openInNewTab ?? false;
    const icon = data?.icon;

    const justify = alignmentClass[alignment] ?? 'justify-center';

    const btnStyle = useMemo<React.CSSProperties>(
        () => ({
            ...(buttonStyles[style] ?? buttonStyles.primary),
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 22px',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '14px',
            textDecoration: 'none',
            transition: 'opacity 0.2s ease, background 0.2s ease',
            cursor: 'pointer',
            lineHeight: 1.25,
        }),
        [style],
    );

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
                    style={btnStyle}
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
                    <a
                        href={url}
                        style={{ padding: '10px 22px', borderRadius: '6px', fontWeight: 600, fontSize: '14px' }}
                    >
                        {buttonText}
                    </a>
                </div>
            </noscript>
        </>
    );
};

export default CTA;
