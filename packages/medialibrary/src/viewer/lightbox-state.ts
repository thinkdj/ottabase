import type { MediaLightboxOptions, MediaViewerItem } from '../types';

export interface MediaLightboxState {
    currentItem: MediaViewerItem | null;
    activeIndex: number;
    canGoPrevious: boolean;
    canGoNext: boolean;
}

export function clampMediaIndex(index: number, total: number): number {
    if (total <= 0) {
        return 0;
    }

    if (index < 0) {
        return 0;
    }

    if (index >= total) {
        return total - 1;
    }

    return index;
}

export function getAdjacentMediaIndex(
    currentIndex: number,
    total: number,
    direction: 'previous' | 'next',
    options?: MediaLightboxOptions,
): number {
    if (total <= 0) {
        return 0;
    }

    const loop = options?.loop ?? true;
    const delta = direction === 'next' ? 1 : -1;
    const rawIndex = currentIndex + delta;

    if (loop) {
        return (rawIndex + total) % total;
    }

    return clampMediaIndex(rawIndex, total);
}

export function createMediaLightboxState(
    items: MediaViewerItem[],
    activeIndex: number,
    options?: MediaLightboxOptions,
): MediaLightboxState {
    if (items.length === 0) {
        return {
            currentItem: null,
            activeIndex: 0,
            canGoNext: false,
            canGoPrevious: false,
        };
    }

    const loop = options?.loop ?? true;
    const resolvedIndex = clampMediaIndex(activeIndex, items.length);

    return {
        currentItem: items[resolvedIndex] ?? null,
        activeIndex: resolvedIndex,
        canGoPrevious: loop || resolvedIndex > 0,
        canGoNext: loop || resolvedIndex < items.length - 1,
    };
}
