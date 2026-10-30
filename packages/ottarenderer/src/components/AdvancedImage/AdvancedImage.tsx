import { useMediaLightboxRegistration } from '@ottabase/medialibrary/react';
import { sanitizeUrl } from '@ottabase/utils/sanitize';
import { safeUrl } from '../../inline';
import type { BlockRenderer } from '../../types';
import React from 'react';
import { AdvancedImageData } from './advancedimage.types';

/**
 * Image (advancedImage, and @editorjs/image's `file.url` shape). The stylesheet owns every
 * look: the figure shrink-wraps the image so a frame or tint hugs it, the modifiers
 * (`--with-border`, `--with-background`, `--featured`, `--stretched`, `--aspect-*`) compose,
 * and "featured" is a presentation (lead image, full column, shadow, caption bar), not a badge.
 */
const AdvancedImageBlock: BlockRenderer<AdvancedImageData> = ({ data, className = '' }) => {
    const resolvedUrl = safeUrl(data?.url || data?.file?.url) ?? '';
    const {
        caption,
        withBorder,
        withBackground,
        stretched,
        alt,
        linkUrl,
        width,
        height,
        featuredImage,
        aspectRatio = 'original',
        mediaId,
        mimeType,
    } = data;

    const lightboxItem = React.useMemo(
        () => ({
            id: mediaId || resolvedUrl,
            url: resolvedUrl,
            previewUrl: resolvedUrl,
            thumbnailUrl: resolvedUrl,
            title: caption || alt || null,
            originalName: alt || caption || resolvedUrl.substring(resolvedUrl.lastIndexOf('/') + 1),
            altText: alt || caption || null,
            caption: caption || null,
            mimeType: mimeType || null,
            mediaKind: 'image' as const,
            width: width || null,
            height: height || null,
        }),
        [alt, caption, height, mediaId, mimeType, resolvedUrl, width],
    );
    const { open: openLightbox, isEnabled: hasLightbox } = useMediaLightboxRegistration(
        mediaId || resolvedUrl,
        linkUrl ? null : lightboxItem,
    );

    if (!resolvedUrl) return null;

    const fileStem = resolvedUrl
        .split('/')
        .pop()
        ?.replace(/\.[^.]+$/, '');
    const altFinal = alt || caption || fileStem || 'Image';
    const ratio = aspectRatio !== 'original' ? aspectRatio.replace(':', '-') : null;
    const classes = [
        className,
        'otta-image',
        stretched && 'otta-image--stretched',
        withBorder && 'otta-image--with-border',
        withBackground && 'otta-image--with-background',
        featuredImage && 'otta-image--featured',
        ratio && `otta-image--aspect-${ratio}`,
    ]
        .filter(Boolean)
        .join(' ');
    const zoomable = !linkUrl && hasLightbox;

    const image = (
        <img
            src={resolvedUrl}
            alt={altFinal}
            width={width || undefined}
            height={height || undefined}
            loading="lazy"
            decoding="async"
            className="otta-image__img"
            data-zoom={zoomable || undefined}
            onClick={zoomable ? () => openLightbox() : undefined}
        />
    );

    return (
        <figure className={classes}>
            {linkUrl ? (
                <a
                    href={sanitizeUrl(linkUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="otta-image__link"
                    aria-label={caption || altFinal}
                >
                    {image}
                </a>
            ) : (
                image
            )}
            {caption && <figcaption className="otta-caption">{caption}</figcaption>}
        </figure>
    );
};

export default AdvancedImageBlock;
