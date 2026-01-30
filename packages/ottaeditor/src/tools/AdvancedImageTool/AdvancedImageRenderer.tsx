import React from 'react';

interface AdvancedImageRendererProps {
    url: string;
    caption?: string;
    withBorder?: boolean;
    withBackground?: boolean;
    stretched?: boolean;
    alt?: string;
    className?: string;
    onImageClick?: () => void;
    isEditor?: boolean;
}

const AdvancedImageRenderer: React.FC<AdvancedImageRendererProps> = ({
    url,
    caption,
    withBorder = false,
    withBackground = false,
    stretched = false,
    alt,
    className = '',
    onImageClick,
    isEditor = false,
}) => {
    // Base classes for the container
    let containerClasses = [
        isEditor ? 'advanced-image-container' : 'advanced-image-block',
        'relative',
        'my-4',
        'flex',
        'items-center',
        'justify-center',
        'flex-col',
        'box-border',
        'text-gray-700',
        'dark:text-gray-100',
    ];

    // Add conditional classes
    if (withBorder) {
        containerClasses.push(isEditor ? 'advanced-image-container--with-border' : 'advanced-image-block--with-border');
    }

    if (withBackground) {
        containerClasses.push(
            isEditor ? 'advanced-image-container--with-background' : 'advanced-image-block--with-background',
        );
    }

    if (stretched) {
        containerClasses.push(isEditor ? 'advanced-image-container--stretched' : 'advanced-image-block--stretched');
    }

    // Image classes
    const imageClasses = stretched
        ? 'w-full h-auto object-cover cursor-pointer'
        : 'w-full h-auto max-w-2xl mx-auto object-contain cursor-pointer';

    const combinedClassName = `${containerClasses.join(' ')} ${className}`.trim();

    return (
        <figure className={combinedClassName}>
            <img
                src={url}
                alt={alt || caption || 'Image'}
                className={imageClasses}
                onClick={onImageClick}
                style={{ borderRadius: 'inherit' }}
            />
            {caption && (
                <figcaption
                    className={
                        isEditor
                            ? 'advanced-image-caption mt-2 text-sm italic text-center text-gray-600 dark:text-gray-400'
                            : 'mt-2 text-sm italic text-center text-gray-600 dark:text-gray-400'
                    }
                >
                    {caption}
                </figcaption>
            )}
        </figure>
    );
};

export default AdvancedImageRenderer;
