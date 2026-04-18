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
