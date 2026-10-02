import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MediaPreview } from '../MediaPreview';

describe('MediaPreview immersive mode', () => {
    it('renders immersive mode without the default lightbox shell styles', () => {
        const markup = renderToStaticMarkup(
            <MediaPreview
                item={{
                    id: 'media-1',
                    url: 'https://example.com/image-1.jpg',
                    previewUrl: 'https://example.com/image-1.jpg',
                    thumbnailUrl: 'https://example.com/image-1-thumb.jpg',
                    title: 'First image',
                    originalName: 'image-1.jpg',
                    altText: 'First image alt',
                    mimeType: 'image/jpeg',
                    mediaKind: 'image',
                }}
                mode="immersive"
                fit="contain"
            />,
        );

        // Immersive mode uses a subtle muted background, not the opaque lightbox style
        expect(markup).toContain('bg-muted/5');
        expect(markup).not.toContain('rounded-2xl bg-black/20');
        expect(markup).toContain('object-contain');
        expect(markup.match(/border-radius:var\(--radius, 0\.75rem\)/g)?.length).toBe(2);
    });

    it('renders ZoomableImage in lightbox mode for images', () => {
        const markup = renderToStaticMarkup(
            <MediaPreview
                item={{
                    id: 'media-2',
                    url: 'https://example.com/image-2.jpg',
                    previewUrl: 'https://example.com/image-2.jpg',
                    title: 'Second image',
                    originalName: 'image-2.jpg',
                    mimeType: 'image/jpeg',
                    mediaKind: 'image',
                }}
                mode="lightbox"
                fit="contain"
            />,
        );

        // Lightbox mode wraps images with ZoomableImage (overflow-hidden container + cursor class)
        expect(markup).toContain('overflow-hidden');
        expect(markup).toContain('cursor-zoom-in');
        expect(markup).toContain('object-contain');
        expect(markup.match(/border-radius:var\(--radius, 0\.75rem\)/g)?.length).toBe(2);
    });

    it('applies the runtime theme radius to lightbox video media', () => {
        const markup = renderToStaticMarkup(
            <MediaPreview
                item={{
                    id: 'media-video',
                    url: 'https://example.com/video.mp4',
                    previewUrl: 'https://example.com/video.mp4',
                    title: 'Video',
                    originalName: 'video.mp4',
                    mimeType: 'video/mp4',
                    mediaKind: 'video',
                }}
                mode="lightbox"
            />,
        );

        expect(markup.match(/border-radius:var\(--radius, 0\.75rem\)/g)?.length).toBe(2);
        expect(markup).toContain('<video');
    });

    it('loads an inactive immersive neighbour EAGERLY, without zoom affordances', () => {
        // Neighbours are mounted so they are decoded before they are swiped in; a lazy image
        // one viewport off-screen would only start loading once the drag reveals it.
        const markup = renderToStaticMarkup(
            <MediaPreview
                item={{
                    id: 'media-2-neighbor',
                    url: 'https://example.com/neighbor.jpg',
                    mimeType: 'image/jpeg',
                    mediaKind: 'image',
                }}
                mode="immersive"
                fit="contain"
                interactive={false}
            />,
        );

        expect(markup).toContain('loading="eager"');
        expect(markup).not.toContain('cursor-zoom-in');
    });

    it('shows a placeholder, not an embedded PDF, for an inactive neighbour', () => {
        const pdf = {
            id: 'doc-1',
            url: 'https://example.com/doc.pdf',
            mimeType: 'application/pdf',
            mediaKind: 'document' as const,
            originalName: 'doc.pdf',
        };
        expect(renderToStaticMarkup(<MediaPreview item={pdf} mode="immersive" />)).toContain('<iframe');
        expect(renderToStaticMarkup(<MediaPreview item={pdf} mode="immersive" interactive={false} />)).not.toContain(
            '<iframe',
        );
    });

    it('renders plain img in tile mode (no zoom wrapper)', () => {
        const markup = renderToStaticMarkup(
            <MediaPreview
                item={{
                    id: 'media-3',
                    url: 'https://example.com/image-3.jpg',
                    previewUrl: 'https://example.com/image-3.jpg',
                    title: 'Third image',
                    originalName: 'image-3.jpg',
                    mimeType: 'image/jpeg',
                    mediaKind: 'image',
                }}
                mode="tile"
                fit="cover"
            />,
        );

        // Tile mode uses a plain img tag, not ZoomableImage
        expect(markup).not.toContain('cursor-zoom-in');
        expect(markup).toContain('object-cover');
    });
});
