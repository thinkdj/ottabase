import { useMediaLightboxRegistration } from '@ottabase/medialibrary/react';
import { safeImageProps, sanitizeUrl } from '@ottabase/utils/sanitize';
import { useLinkRel } from '../../inline';
import { IMAGE_SIZES, safeSource, sourceId, viewerUrls } from '../../media';
import type { BlockRenderer } from '../../types';
import { AdvancedImageData } from './advancedimage.types';

/**
 * Image (advancedImage). The stylesheet owns every look: the figure shrink-wraps the image so a
 * frame or tint hugs it, the modifiers (`--with-border`, `--with-background`, `--featured`,
 * `--stretched`, `--aspect-*`) compose, and "featured" is a presentation (lead image, full
 * column, shadow, caption bar), not a badge. A stored image offers its renditions through
 * `srcSet`, with `sizes` following the modifier: 34rem plain, the column featured, full bleed
 * stretched.
 */
const AdvancedImageBlock: BlockRenderer<AdvancedImageData> = ({ data, className = '' }) => {
    const linkRel = useLinkRel();
    const source = safeSource(data?.image);
    const {
        caption,
        withBorder,
        withBackground,
        stretched,
        alt,
        linkUrl,
        featuredImage,
        aspectRatio = 'original',
    } = data ?? {};
    const id = source ? sourceId(source) : '';
    const urls = source ? viewerUrls(source) : null;
    const fileName = urls ? urls.url.substring(urls.url.lastIndexOf('/') + 1) : '';

    // The registration keys on the item's JSON, so a fresh object per render is fine.
    const lightboxItem = urls && {
        id,
        ...urls,
        title: caption || alt || null,
        originalName: alt || caption || fileName,
        altText: alt || caption || null,
        caption: caption || null,
        mediaKind: 'image' as const,
    };
    const { open: openLightbox, isEnabled: hasLightbox } = useMediaLightboxRegistration(
        id,
        linkUrl ? null : lightboxItem,
    );

    const sizes = stretched ? IMAGE_SIZES.bleed : featuredImage ? IMAGE_SIZES.column : IMAGE_SIZES.image;
    const props = safeImageProps(source, sizes);
    if (!props) return null;

    // An outside address's file name is a fair last-resort alt; a stored key's is an id, never shown.
    const stem = typeof source === 'string' ? fileName.replace(/\.[^.]+$/, '') : '';
    const altFinal = alt || caption || stem || 'Image';
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
            {...props}
            alt={altFinal}
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
                    rel={linkRel(true)}
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
