import { render, screen } from '@testing-library/react';
import { configureMedia } from '@ottabase/utils/media';
import { describe, expect, it, vi } from 'vitest';
import MediaGallery from './MediaGallery';

type PreviewItem = { mediaKind: string; title: string | null; previewUrl?: string; srcSet?: string | null };

vi.mock('@ottabase/medialibrary/react', () => ({
    MediaPreview: ({ item, mode }: { item: PreviewItem; mode: string }) => (
        <div
            data-testid="media-preview"
            data-kind={item.mediaKind}
            data-mode={mode}
            data-preview={item.previewUrl}
            data-srcset={item.srcSet ?? undefined}
        >
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
                        { media: 'https://cdn.example.com/one.jpg', title: 'One', mediaKind: 'image' },
                        { media: 'https://cdn.example.com/two.mp4', title: 'Two', mediaKind: 'video' },
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
                    items: [{ media: 'https://cdn.example.com/song.mp3', title: 'Audio Preview', mediaKind: 'audio' }],
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
                    items: [{ media: 'https://cdn.example.com/file.pdf', title: 'Doc', mediaKind: 'document' }],
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
                        { media: 'https://cdn.example.com/a.jpg', title: 'A', mediaKind: 'image' },
                        { media: 'https://cdn.example.com/b.jpg', title: 'B', mediaKind: 'image' },
                    ],
                }}
            />,
        );

        // Positioned wrapper should exist for filmstrip
        const wrapper = container.querySelector('.relative');
        expect(wrapper).toBeTruthy();

        // Right-edge fade gradient overlay
        const fade = wrapper?.querySelector('[aria-hidden="true"]');
        expect(fade?.className).toContain('bg-linear-to-l');

        // No scroll hint text (gradient provides the affordance)
        expect(container.textContent).not.toContain('scroll');
    });

    it('passes through className prop', () => {
        const { container } = render(
            <MediaGallery
                className="custom-gallery"
                data={{ items: [{ media: 'https://cdn.example.com/one.jpg', title: 'One', mediaKind: 'image' }] }}
            />,
        );

        const figure = container.querySelector('figure');
        expect(figure?.className).toContain('custom-gallery');
    });

    it('builds each stored item from the configured base and skips items that are not a source', () => {
        configureMedia({ publicUrl: 'https://files.test' });
        const key = 'app/media/0123456789abcdef0123456789abcdef.jpg';
        const stem = 'https://files.test/app/media/0123456789abcdef0123456789abcdef';
        render(
            <MediaGallery
                data={{
                    items: [
                        { media: { key, width: 2000, height: 1000, variants: ['thumb', 'card', 'full'] }, title: 'S' },
                        { media: { url: 'https://cdn.example.com/legacy.jpg' } as never, title: 'Bad' },
                        { media: 'javascript:alert(1)', title: 'Unsafe' },
                    ],
                }}
            />,
        );
        configureMedia({ publicUrl: null });

        const previews = screen.getAllByTestId('media-preview');
        expect(previews).toHaveLength(1);
        expect(previews[0].getAttribute('data-preview')).toBe(`${stem}/card.webp`);
        expect(previews[0].getAttribute('data-srcset')).toBe(
            `${stem}/thumb.webp 160w, ${stem}/card.webp 640w, ${stem}/full.webp 1600w`,
        );
    });
});
