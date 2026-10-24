// A video that cannot play shows its poster, a plain message and a link, never the browser's own error text.
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { MediaPreview } from '../MediaPreview';

const VIDEO = {
    id: 'clip',
    url: 'https://example.com/clip.mp4',
    previewUrl: 'https://example.com/clip.mp4',
    thumbnailUrl: 'https://example.com/clip.jpg',
    title: 'Light across a wall',
    originalName: 'clip.mp4',
    mimeType: 'video/mp4',
    mediaKind: 'video' as const,
};

describe('MediaPreview video', () => {
    it('uses the thumbnail as the poster while the video loads', () => {
        const { container } = render(<MediaPreview item={VIDEO} mode="detail" />);
        const video = container.querySelector('video')!;
        expect(video.getAttribute('poster')).toBe(VIDEO.thumbnailUrl);
        expect(video.getAttribute('src')).toBe(VIDEO.previewUrl);
    });

    it('swaps to the poster, a message and a link to the file when the video cannot play', () => {
        const { container } = render(<MediaPreview item={VIDEO} mode="lightbox" />);
        fireEvent.error(container.querySelector('video')!);

        expect(container.querySelector('video')).toBeNull();
        expect(screen.getByText(/This browser can.t play Light across a wall/)).toBeTruthy();
        expect(screen.getByRole('link', { name: /Open the file/ }).getAttribute('href')).toBe(VIDEO.previewUrl);
        expect(container.querySelector('img')?.getAttribute('src')).toBe(VIDEO.thumbnailUrl);
    });

    it('keeps a thumb to its icon, and tries again for a different video', () => {
        const { container, rerender } = render(<MediaPreview item={VIDEO} mode="thumb" />);
        fireEvent.error(container.querySelector('video')!);
        expect(screen.queryByRole('link')).toBeNull();

        rerender(
            <MediaPreview item={{ ...VIDEO, id: 'other', previewUrl: 'https://example.com/other.mp4' }} mode="thumb" />,
        );
        expect(container.querySelector('video')?.getAttribute('src')).toBe('https://example.com/other.mp4');
    });
});
