import { MediaPreview, useMediaLightboxRegistration } from '@ottabase/medialibrary';
import { RenderFn } from 'editorjs-blocks-react-renderer';
import React from 'react';

export interface MediaEmbedData {
    url: string;
    title?: string;
    caption?: string;
    mediaId?: string;
    mimeType?: string;
    mediaKind?: string;
    thumbnailUrl?: string;
    previewUrl?: string;
}

/**
 * Renderer for non-image media blocks (video, audio, PDF, document, archive).
 * Delegates presentation to MediaPreview which already handles all media kinds.
 */
const MediaEmbed: RenderFn<MediaEmbedData> = ({ data, className = '' }) => {
    if (!data?.url) {
        return <></>;
    }

    const { url, title, caption, mediaId, mimeType, mediaKind, thumbnailUrl, previewUrl } = data;

    const item = React.useMemo(
        () => ({
            id: mediaId || url,
            url,
            previewUrl: previewUrl || url,
            thumbnailUrl: thumbnailUrl || url,
            title: title || null,
            originalName: title || url.substring(url.lastIndexOf('/') + 1),
            altText: title || null,
            caption: caption || null,
            mimeType: mimeType || null,
            mediaKind: (mediaKind || 'other') as 'video' | 'audio' | 'document' | 'archive' | 'other',
        }),
        [caption, mediaId, mediaKind, mimeType, previewUrl, thumbnailUrl, title, url],
    );

    const { open: openLightbox, isEnabled: hasLightbox } = useMediaLightboxRegistration(mediaId || url, item as any);

    return (
        <figure className={`${className} my-6 overflow-hidden rounded-xl border border-border`}>
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
                <MediaPreview item={item} mode="detail" className="!border-0 !rounded-none" fit="contain" controls />
            </div>
            {caption && (
                <figcaption className="border-t border-border px-4 py-2 text-sm italic text-center text-muted-foreground">
                    {caption}
                </figcaption>
            )}
        </figure>
    );
};

export default MediaEmbed;
