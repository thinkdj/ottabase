import { describe, expect, it } from 'vitest';
import { clampMediaIndex, createMediaLightboxState, getAdjacentMediaIndex } from '../lightbox-state';

const mediaItems = [
    { id: '1', url: '/1.jpg' },
    { id: '2', url: '/2.jpg' },
    { id: '3', url: '/3.jpg' },
];

describe('media lightbox state helpers', () => {
    it('clamps indices to valid bounds', () => {
        expect(clampMediaIndex(-3, mediaItems.length)).toBe(0);
        expect(clampMediaIndex(1, mediaItems.length)).toBe(1);
        expect(clampMediaIndex(9, mediaItems.length)).toBe(2);
    });

    it('loops through the collection when loop is enabled', () => {
        expect(getAdjacentMediaIndex(0, mediaItems.length, 'previous', { loop: true })).toBe(2);
        expect(getAdjacentMediaIndex(2, mediaItems.length, 'next', { loop: true })).toBe(0);
    });

    it('stops at the bounds when loop is disabled', () => {
        expect(getAdjacentMediaIndex(0, mediaItems.length, 'previous', { loop: false })).toBe(0);
        expect(getAdjacentMediaIndex(2, mediaItems.length, 'next', { loop: false })).toBe(2);
    });

    it('derives navigation state for the current item', () => {
        const state = createMediaLightboxState(mediaItems, 1, { loop: false });

        expect(state.currentItem?.id).toBe('2');
        expect(state.canGoPrevious).toBe(true);
        expect(state.canGoNext).toBe(true);
    });
});
