import React from 'react';
import { RenderFn } from 'editorjs-blocks-react-renderer';
import { AdvancedImageData } from './advancedimage.types';

const AdvancedImageBlock: RenderFn<AdvancedImageData> = ({ data, className = '' }) => {
    // Support both AdvancedImage (data.url) and legacy @editorjs/image (data.file.url)
    const resolvedUrl = data?.url || (data as any)?.file?.url;
    if (!resolvedUrl) {
        return <></>; // Return an empty fragment if no valid image data
    }

    const {
        caption,
        withBorder = false,
        withBackground = false,
        stretched = false,
        alt,
        linkUrl,
        width,
        height,
        featuredImage = false,
        aspectRatio = 'original',
    } = data;

    // Base Tailwind classes for the figure (includes image-block container styles)
    let figureTailwindClasses = [
        'my-4',
        'rounded',
        'flex',
        'items-center',
        'justify-center',
        'flex-col',
        'box-border',
        'text-gray-700',
        'dark:text-gray-100',
    ];

    // Add default width and centering if not stretched
    if (!stretched) {
        figureTailwindClasses.push('mx-auto', 'w-full', 'p-4', 'overflow-hidden');
    }

    // Conditional Tailwind classes based on data props
    if (withBorder) {
        figureTailwindClasses.push('border', 'border-gray-200', 'dark:border-gray-700', 'p-1');
    }
    if (withBackground) {
        figureTailwindClasses.push('bg-gray-100', 'dark:bg-slate-900', 'p-2');
    }
    if (stretched) {
        // For stretched images, we need special handling
        figureTailwindClasses.push('w-screen', 'relative', '-mx-4', 'md:-mx-8', 'lg:-mx-12', 'xl:-mx-16');
    }

    // Handle featured image styling
    if (
        featuredImage ||
        className.includes('advanced-image-block--featured-image') ||
        className.includes('image-block--featured-image')
    ) {
        figureTailwindClasses.push('shadow-lg', 'dark:shadow-gray-700/50', 'relative');
    }

    // Add feature classes to className for CSS targeting
    let modifiedClassName = className;
    if (stretched) {
        modifiedClassName += ' advanced-image-block--stretched';
    }
    if (withBorder) {
        modifiedClassName += ' advanced-image-block--with-border';
    }
    if (withBackground) {
        modifiedClassName += ' advanced-image-block--with-background';
    }
    if (featuredImage) {
        modifiedClassName += ' advanced-image-block--featured';
    }
    if (aspectRatio && aspectRatio !== 'original') {
        modifiedClassName += ` advanced-image-block--aspect-${aspectRatio.replace(':', '-')}`;
    }

    // The `className` prop from editorjs-blocks-react-renderer will contain non-Tailwind base classes
    // (e.g., 'cdc-content-block advanced-image-block cdc-content-advanced-image') and non-Tailwind action-specific marker classes (e.g., 'advanced-image-block--featured-image').
    const combinedClassName = `block ${figureTailwindClasses.join(' ')} ${modifiedClassName}`.trim();

    let altText = alt || caption;
    if (!altText && resolvedUrl) {
        try {
            const urlParts = resolvedUrl.substring(resolvedUrl.lastIndexOf('/') + 1).split('.');
            altText = urlParts.length > 1 ? urlParts.slice(0, -1).join('.') : urlParts[0];
        } catch (e) {
            altText = 'Image'; // Fallback if URL parsing fails
        }
    } else if (!altText) {
        altText = 'Image'; // Ultimate fallback
    }
    const altFinal: string = altText || 'Image';

    // Image classes based on stretched state and aspect ratio
    let imageClasses = stretched
        ? `w-full h-auto object-cover ${!linkUrl ? 'cursor-pointer' : ''}`
        : `w-full h-auto max-w-2xl mx-auto object-contain ${!linkUrl ? 'cursor-pointer' : ''}`;

    // Apply aspect ratio classes
    if (aspectRatio && aspectRatio !== 'original') {
        switch (aspectRatio) {
            case '16:9':
                imageClasses += ' aspect-video object-cover';
                break;
            case '4:3':
                imageClasses += ' aspect-[4/3] object-cover';
                break;
            case '1:1':
                imageClasses += ' aspect-square object-cover';
                break;
        }
    }

    const imageComponent = <img src={resolvedUrl} alt={altFinal} className={imageClasses} />;

    return (
        <>
            <figure className={combinedClassName}>
                {featuredImage && (
                    <div className="absolute top-2 right-2 z-10 bg-yellow-400 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md">
                        ★
                    </div>
                )}
                {linkUrl ? (
                    <a
                        href={linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block no-underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 rounded-sm"
                        aria-label={caption || altFinal}
                    >
                        {imageComponent}
                    </a>
                ) : (
                    imageComponent
                )}
                {caption && (
                    <figcaption className="mt-2 text-sm italic text-center text-gray-600 dark:text-gray-400">
                        {caption}
                    </figcaption>
                )}
            </figure>
        </>
    );
};

export default AdvancedImageBlock;
