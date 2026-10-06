import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MediaViewerItem } from '../../types';
import { MediaLightbox } from '../MediaLightbox';

const items: MediaViewerItem[] = [
    { id: 'a', url: 'https://example.com/a.jpg', title: 'A', mediaKind: 'image' },
    { id: 'b', url: 'https://example.com/b.jpg', title: 'B', mediaKind: 'image' },
];

const handlers = () => ({ onClose: vi.fn(), onPrevious: vi.fn(), onNext: vi.fn(), onSelectIndex: vi.fn() });

function Page({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    return (
        <>
            <button type="button">Opener</button>
            <MediaLightbox items={items} activeIndex={0} isOpen={isOpen} {...handlers()} onClose={onClose} />
        </>
    );
}

describe('the lightbox dialog', () => {
    it('is a labelled modal that takes focus, locks the page, and gives both back on close', async () => {
        const { getByRole, getByText, rerender } = render(<Page isOpen={false} onClose={vi.fn()} />);
        getByText('Opener').focus();

        rerender(<Page isOpen onClose={vi.fn()} />);
        const dialog = getByRole('dialog');
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        expect(dialog.getAttribute('aria-label')).toBe('Media viewer');
        expect(document.activeElement).toBe(dialog);
        expect(document.body.style.overflow).toBe('hidden');

        rerender(<Page isOpen={false} onClose={vi.fn()} />);
        await Promise.resolve();
        expect(document.activeElement).toBe(getByText('Opener'));
        expect(document.body.style.overflow).toBe('');
    });

    it('closes on Escape and on a backdrop click, not on a click inside', () => {
        const onClose = vi.fn();
        const { getByRole, getByLabelText } = render(<Page isOpen onClose={onClose} />);

        fireEvent.click(getByLabelText('Next media item'));
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.click(getByRole('dialog'));
        expect(onClose).toHaveBeenCalledTimes(1);
        fireEvent.keyDown(getByRole('dialog'), { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('moves with the arrow keys unless a player or a field owns them', () => {
        const props = handlers();
        const { getByRole } = render(<MediaLightbox items={items} activeIndex={0} isOpen {...props} />);
        const dialog = getByRole('dialog');

        fireEvent.keyDown(dialog, { key: 'ArrowRight' });
        fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
        expect(props.onNext).toHaveBeenCalledTimes(1);
        expect(props.onPrevious).toHaveBeenCalledTimes(1);

        const video = document.createElement('video');
        dialog.append(video);
        fireEvent.keyDown(video, { key: 'ArrowRight' });
        expect(props.onNext).toHaveBeenCalledTimes(1);
    });

    it('marks the thumbnail of the item on show', () => {
        const { getByLabelText } = render(<MediaLightbox items={items} activeIndex={1} isOpen {...handlers()} />);
        expect(getByLabelText('View B').getAttribute('aria-current')).toBe('true');
        expect(getByLabelText('View A').getAttribute('aria-current')).toBeNull();
    });
});
