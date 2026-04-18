import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MediaEmbed from './MediaEmbed';

// Mock MediaPreview to avoid pulling in the full medialibrary
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

describe('MediaEmbed Renderer', () => {
    describe('Empty / missing data', () => {
        it('should render nothing when data has no url', () => {
            const { container } = render(<MediaEmbed data={{} as any} />);
            expect(container.innerHTML).toBe('');
        });

        it('should render nothing when data is null', () => {
            const { container } = render(<MediaEmbed data={null as any} />);
            expect(container.innerHTML).toBe('');
        });
    });

    describe('Basic rendering', () => {
        it('should render a figure with MediaPreview for video', () => {
            render(
                <MediaEmbed
                    data={{
                        url: 'https://cdn.example.com/clip.mp4',
                        title: 'Demo Video',
                        mediaKind: 'video',
                        mimeType: 'video/mp4',
                    }}
                />,
            );

            const preview = screen.getByTestId('media-preview');
            expect(preview.getAttribute('data-kind')).toBe('video');
            expect(preview.getAttribute('data-mode')).toBe('detail');
            expect(preview.textContent).toBe('Demo Video');
        });

        it('should render a figure with MediaPreview for audio', () => {
            render(
                <MediaEmbed
                    data={{
                        url: 'https://cdn.example.com/song.mp3',
                        title: 'My Song',
                        mediaKind: 'audio',
                        mimeType: 'audio/mpeg',
                    }}
                />,
            );

            const preview = screen.getByTestId('media-preview');
            expect(preview.getAttribute('data-kind')).toBe('audio');
        });

        it('should default mediaKind to "other" when not provided', () => {
            render(<MediaEmbed data={{ url: 'https://cdn.example.com/file.bin' }} />);

            const preview = screen.getByTestId('media-preview');
            expect(preview.getAttribute('data-kind')).toBe('other');
        });
    });

    describe('Caption', () => {
        it('should render a figcaption when caption is provided', () => {
            const { container } = render(
                <MediaEmbed
                    data={{
                        url: 'https://cdn.example.com/clip.mp4',
                        caption: 'A short clip',
                        mediaKind: 'video',
                    }}
                />,
            );

            const figcaption = container.querySelector('figcaption');
            expect(figcaption).toBeTruthy();
            expect(figcaption?.textContent).toBe('A short clip');
        });

        it('should not render a figcaption when caption is absent', () => {
            const { container } = render(
                <MediaEmbed data={{ url: 'https://cdn.example.com/clip.mp4', mediaKind: 'video' }} />,
            );

            expect(container.querySelector('figcaption')).toBeNull();
        });
    });

    describe('CSS classes', () => {
        it('should have border on the figure element', () => {
            const { container } = render(
                <MediaEmbed data={{ url: 'https://cdn.example.com/clip.mp4', mediaKind: 'video' }} />,
            );

            const figure = container.querySelector('figure');
            expect(figure?.className).toContain('border-border');
        });

        it('should pass through className prop', () => {
            const { container } = render(
                <MediaEmbed
                    data={{ url: 'https://cdn.example.com/clip.mp4', mediaKind: 'video' }}
                    className="custom-class"
                />,
            );

            const figure = container.querySelector('figure');
            expect(figure?.className).toContain('custom-class');
        });
    });
});
