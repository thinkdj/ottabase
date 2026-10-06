import { fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MediaViewerItem } from '../../types';
import { MediaLightboxProvider, useMediaLightboxRegistration } from '../MediaLightboxProvider';

const itemA: MediaViewerItem = {
    id: 'a',
    url: 'https://example.com/a.jpg',
    title: 'A',
    mediaKind: 'image',
};

const itemB: MediaViewerItem = {
    id: 'b',
    url: 'https://example.com/b.jpg',
    title: 'B',
    mediaKind: 'image',
};

function TestGallery() {
    const regA = useMediaLightboxRegistration('gallery-a', itemA);
    const regB = useMediaLightboxRegistration('gallery-b', itemB);

    return (
        <div>
            <button type="button" onClick={regA.open}>
                Open A
            </button>
            <button type="button" onClick={regB.open}>
                Open B
            </button>
        </div>
    );
}

describe('MediaLightboxProvider', () => {
    afterEach(() => {
        window.history.replaceState({}, '', '/');
    });

    it('emits open/navigate/close hooks and syncs URL when enabled', async () => {
        const onOpen = vi.fn();
        const onNavigate = vi.fn();
        const onClose = vi.fn();

        const { getByRole, getByText } = render(
            <MediaLightboxProvider syncWithUrl onOpen={onOpen} onNavigate={onNavigate} onClose={onClose}>
                <TestGallery />
            </MediaLightboxProvider>,
        );

        fireEvent.click(getByText('Open A'));

        await waitFor(() => {
            expect(onOpen).toHaveBeenCalledTimes(1);
            expect(onOpen.mock.calls[0][1]).toBe(0);
            expect(window.location.search).toContain('mgi=gallery-a');
        });

        fireEvent.keyDown(getByRole('dialog'), { key: 'ArrowRight' });

        await waitFor(() => {
            expect(onNavigate).toHaveBeenCalled();
            const lastCall = onNavigate.mock.calls.at(-1);
            expect(lastCall?.[1]).toBe(1);
            expect(lastCall?.[2]).toBe('next');
            expect(window.location.search).toContain('mgi=gallery-b');
        });

        fireEvent.keyDown(getByRole('dialog'), { key: 'Escape' });

        await waitFor(() => {
            expect(onClose).toHaveBeenCalledTimes(1);
            expect(window.location.search).toBe('');
        });
    });
});
