import type { MediaKind } from '@ottabase/medialibrary';
import { MediaPreview, useMediaLightboxRegistration } from '@ottabase/medialibrary/react';
import type { FileSource } from '@ottabase/utils/media';
import { IMAGE_SIZES, safeSource, sourceId, viewerUrls } from '../media';
import type { BlockRenderer } from '../types';

export interface MediaEmbedData {
    /** A stored file, or an outside address */
    media?: FileSource;
    title?: string;
    caption?: string;
    mimeType?: string;
    mediaKind?: string;
}

/**
 * Renderer for non-image media blocks (video, audio, PDF, document, archive).
 * Delegates presentation to MediaPreview which already handles all media kinds.
 */
const MediaEmbed: BlockRenderer<MediaEmbedData> = ({ data, className = '' }) => {
    const { title, caption, mimeType, mediaKind } = data ?? {};
    const source = safeSource(data?.media);
    const id = source ? sourceId(source) : '';
    const urls = source ? viewerUrls(source) : null;

    // The registration keys on the item's JSON, so a fresh object per render is fine.
    const item = urls && {
        id,
        ...urls,
        title: title || null,
        originalName: title || urls.url.substring(urls.url.lastIndexOf('/') + 1),
        altText: title || null,
        caption: caption || null,
        mimeType: mimeType || null,
        mediaKind: (mediaKind || 'other') as MediaKind,
    };

    const { open: openLightbox, isEnabled: hasLightbox } = useMediaLightboxRegistration(id, item);

    if (!item) return null;

    return (
        <figure className={`${className} overflow-hidden rounded-xl border border-border/60`}>
            <div
                className={`min-h-[12rem] ${hasLightbox ? 'cursor-pointer' : ''}`}
                role={hasLightbox ? 'button' : undefined}
                tabIndex={hasLightbox ? 0 : -1}
                onClick={() => {
                    if (hasLightbox) {
                        openLightbox();
                    }
                }}
                onKeyDown={(event) => {
                    if (!hasLightbox) {
                        return;
                    }
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openLightbox();
                    }
                }}
            >
                {/* detail mode adds its own border+rounding; suppress to avoid double border */}
                <MediaPreview
                    item={item}
                    mode="detail"
                    sizes={IMAGE_SIZES.column}
                    className="!border-0 !rounded-none"
                    fit="contain"
                    controls
                />
            </div>
            {caption && (
                <figcaption className="border-t border-border/60 px-4 py-2 text-center text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                    {caption}
                </figcaption>
            )}
        </figure>
    );
};

export default MediaEmbed;
