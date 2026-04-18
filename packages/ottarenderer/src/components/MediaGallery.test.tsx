import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MediaGallery from './MediaGallery';

vi.mock('@ottabase/medialibrary', () => ({
    MediaPreview: ({ item, mode }: { item: { mediaKind: string; title: string | null }; mode: string }) => (
        <div data-testid="media-preview" data-kind={item.mediaKind} data-mode={mode}>
            {item.title ?? 'untitled'}
        </div>
    ),
    useMediaLightboxRegistration: () => ({
        open: vi.fn(),
        isEnabled: false,
    }),
}));

describe('MediaGallery Renderer', () => {
    it('should render nothing when data is missing', () => {
        const { container } = render(<MediaGallery data={null as any} />);
        expect(container.innerHTML).toBe('');
    });

    it('should render nothing when items are empty', () => {
        const { container } = render(<MediaGallery data={{ items: [] }} />);
        expect(container.innerHTML).toBe('');
    });

    it('should render all gallery items from items[]', () => {
        render(
            <MediaGallery
                data={{
                    title: 'Product Gallery',
                    items: [
                        { url: 'https://cdn.example.com/one.jpg', title: 'One', mediaKind: 'image' },
                        { url: 'https://cdn.example.com/two.mp4', title: 'Two', mediaKind: 'video' },
                    ],
                }}
            />,
        );

        const previews = screen.getAllByTestId('media-preview');
        expect(previews).toHaveLength(2);
        expect(screen.getByText('Product Gallery')).toBeTruthy();
        expect(previews[0].getAttribute('data-kind')).toBe('image');
        expect(previews[1].getAttribute('data-kind')).toBe('video');
    });

    it('should apply filmstrip layout classes', () => {
        render(
            <MediaGallery
                data={{
                    layout: 'filmstrip',
                    items: [{ url: 'https://cdn.example.com/song.mp3', title: 'Audio Preview', mediaKind: 'audio' }],
                }}
            />,
        );

        const grid = document.querySelector('.grid');
        expect(grid?.className).toContain('grid-flow-col');
    });

    it('should render figure caption when provided', () => {
        const { container } = render(
            <MediaGallery
                data={{
                    caption: 'Gallery caption',
                    items: [{ url: 'https://cdn.example.com/file.pdf', title: 'Doc', mediaKind: 'document' }],
                }}
            />,
        );

        const figcaption = container.querySelector('figcaption');
        expect(figcaption).toBeTruthy();
        expect(figcaption?.textContent).toBe('Gallery caption');
    });

    it('renders filmstrip scroll affordance (right-edge fade overlay)', () => {
        const { container } = render(
            <MediaGallery
                data={{
                    layout: 'filmstrip',
                    items: [
                        { url: 'https://cdn.example.com/a.jpg', title: 'A', mediaKind: 'image' },
                        { url: 'https://cdn.example.com/b.jpg', title: 'B', mediaKind: 'image' },
                    ],
                }}
            />,
        );

        // Positioned wrapper should exist for filmstrip
        const wrapper = container.querySelector('.relative');
        expect(wrapper).toBeTruthy();

        // Right-edge fade gradient overlay
        const fade = wrapper?.querySelector('[aria-hidden="true"]');
        expect(fade?.className).toContain('bg-gradient-to-l');

        // No scroll hint text (gradient provides the affordance)
        expect(container.textContent).not.toContain('scroll');
    });

    it('passes through className prop', () => {
        const { container } = render(
            <MediaGallery
                className="custom-gallery"
                data={{ items: [{ url: 'https://cdn.example.com/one.jpg', title: 'One', mediaKind: 'image' }] }}
            />,
        );

        const figure = container.querySelector('figure');
        expect(figure?.className).toContain('custom-gallery');
    });
});
