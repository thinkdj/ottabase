import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ZoomableImage } from '../ZoomableImage';

describe('ZoomableImage', () => {
    it('renders an image with the given src and alt', () => {
        const markup = renderToStaticMarkup(<ZoomableImage src="https://example.com/photo.jpg" alt="A sample photo" />);

        expect(markup).toContain('src="https://example.com/photo.jpg"');
        expect(markup).toContain('alt="A sample photo"');
    });

    it('shows zoom indicator only when zoom > 1', () => {
        const markup = renderToStaticMarkup(<ZoomableImage src="https://example.com/photo.jpg" alt="Photo" />);

        // At default zoom (1x), the indicator should NOT be rendered
        expect(markup).not.toContain('tabular-nums');
        expect(markup).not.toContain('.0x');
    });

    it('resets zoom on src change', () => {
        const { rerender, container } = render(<ZoomableImage src="https://example.com/photo-a.jpg" alt="Photo A" />);

        // Initial render: no zoom indicator at 1x
        expect(container.querySelector('.tabular-nums')).toBeNull();

        // Change src — component should reset zoom back to 1x
        rerender(<ZoomableImage src="https://example.com/photo-b.jpg" alt="Photo B" />);

        // After src change, still at 1x — no zoom indicator
        expect(container.querySelector('.tabular-nums')).toBeNull();

        // Verify the new image src is rendered
        const img = container.querySelector('img');
        expect(img?.getAttribute('src')).toBe('https://example.com/photo-b.jpg');
        expect(img?.getAttribute('alt')).toBe('Photo B');
    });

    it('uses lightbox mode styling by default', () => {
        const markup = renderToStaticMarkup(<ZoomableImage src="https://example.com/photo.jpg" alt="Photo" />);

        // Default (lightbox) mode applies "h-full w-full object-contain" on the image
        expect(markup).toContain('h-full w-full object-contain');
    });

    it('uses immersive mode styling when specified', () => {
        const markup = renderToStaticMarkup(
            <ZoomableImage src="https://example.com/photo.jpg" alt="Photo" mode="immersive" />,
        );

        // Immersive mode applies "max-h-full max-w-full object-contain" on the image
        expect(markup).toContain('max-h-full max-w-full object-contain');
    });

    it('applies custom className to the container', () => {
        const markup = renderToStaticMarkup(
            <ZoomableImage src="https://example.com/photo.jpg" alt="Photo" className="my-custom-class" />,
        );

        expect(markup).toContain('my-custom-class');
    });

    it('renders with cursor-zoom-in at default zoom level', () => {
        const markup = renderToStaticMarkup(<ZoomableImage src="https://example.com/photo.jpg" alt="Photo" />);

        expect(markup).toContain('cursor-zoom-in');
    });

    it('sets draggable to false on the image', () => {
        const markup = renderToStaticMarkup(<ZoomableImage src="https://example.com/photo.jpg" alt="Photo" />);

        expect(markup).toContain('draggable="false"');
    });
});
