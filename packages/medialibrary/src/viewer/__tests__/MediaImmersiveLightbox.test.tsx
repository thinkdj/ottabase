import { act, fireEvent, render } from '@testing-library/react';
import { useState, type ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaViewerItem } from '../../types';
import { MediaImmersiveLightbox } from '../MediaImmersiveLightbox';

const items: MediaViewerItem[] = [
    { id: 'one', url: 'https://example.com/one.jpg', mediaKind: 'image' },
    { id: 'two', url: 'https://example.com/two.jpg', mediaKind: 'image' },
];

const threeItems: MediaViewerItem[] = [
    ...items,
    { id: 'three', url: 'https://example.com/three.jpg', mediaKind: 'image' },
];

type LightboxProps = ComponentProps<typeof MediaImmersiveLightbox>;

function renderLightbox(overrides: Partial<LightboxProps> = {}) {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    const onClose = vi.fn();
    const onSelectIndex = vi.fn();
    const result = render(
        <MediaImmersiveLightbox
            items={items}
            activeIndex={0}
            isOpen
            canGoPrevious={false}
            canGoNext
            onClose={onClose}
            onNext={onNext}
            onPrevious={onPrevious}
            onSelectIndex={onSelectIndex}
            {...overrides}
        />,
    );
    return { ...result, onClose, onNext, onPrevious, onSelectIndex };
}

/** A parent that actually moves `activeIndex`, the way MediaLightboxProvider does. */
function ControlledGallery({ list, loop = true }: { list: MediaViewerItem[]; loop?: boolean }) {
    const [index, setIndex] = useState(0);
    const last = list.length - 1;
    return (
        <MediaImmersiveLightbox
            items={list}
            activeIndex={index}
            isOpen
            loop={loop}
            canGoPrevious={loop || index > 0}
            canGoNext={loop || index < last}
            onClose={() => {}}
            onNext={() => setIndex((i) => (i === last ? 0 : i + 1))}
            onPrevious={() => setIndex((i) => (i === 0 ? last : i - 1))}
            onSelectIndex={setIndex}
        />
    );
}

interface PointerInit {
    clientX: number;
    clientY: number;
    pointerId?: number;
    isPrimary?: boolean;
    pointerType?: 'mouse' | 'touch';
    /** Primary button held. Defaults to pressed for down/move, released for up. */
    buttons?: number;
}

function firePointer(node: Element, type: string, init: PointerInit) {
    const { pointerId = 1, isPrimary = true, pointerType = 'mouse', ...coordinates } = init;
    const buttons = init.buttons ?? (type === 'pointerup' || type === 'pointercancel' ? 0 : 1);
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, buttons, ...coordinates });
    Object.defineProperty(event, 'pointerId', { value: pointerId });
    Object.defineProperty(event, 'isPrimary', { value: isPrimary });
    Object.defineProperty(event, 'pointerType', { value: pointerType });
    fireEvent(node, event);
}

/** A complete left drag from x=240 to x=240-distance. */
function dragLeft(node: Element, distance = 130) {
    firePointer(node, 'pointerdown', { clientX: 240, clientY: 120 });
    firePointer(node, 'pointermove', { clientX: 240 - distance, clientY: 124 });
    firePointer(node, 'pointerup', { clientX: 240 - distance, clientY: 124 });
}

const query = <T extends Element = HTMLElement>(selector: string) => document.body.querySelector<T>(selector);
const viewport = () => query('[data-medialightbox-viewport]')!;
const container = () => viewport().parentElement!;
const offset = () => container().style.getPropertyValue('--media-drag-offset');
const slide = (name: 'previous' | 'active' | 'next') => query(`[data-medialightbox-slide="${name}"]`);
const activeSrc = () => query<HTMLImageElement>('[data-medialightbox-slide="active"] img')?.getAttribute('src');

/** Settle a committed drag (220ms) and the snap frame that follows it. */
function settle() {
    act(() => {
        vi.advanceTimersByTime(220);
    });
    act(() => {
        vi.advanceTimersByTime(20);
    });
}

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('MediaImmersiveLightbox drag navigation', () => {
    it('navigates to the next item after a left mouse drag, keeping the dragged-in DOM node', () => {
        const { onNext } = renderLightbox();
        const nextSlide = slide('next')!;
        const nextImage = nextSlide.querySelector('img');

        firePointer(viewport(), 'pointerdown', { clientX: 240, clientY: 120 });
        firePointer(viewport(), 'pointermove', { clientX: 110, clientY: 124 });
        expect(offset()).toBe('-130px');

        firePointer(viewport(), 'pointerup', { clientX: 110, clientY: 124 });
        // jsdom reports clientWidth 0, so the slide width falls back to the window width.
        expect(offset()).toBe('-1024px');
        expect(onNext).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(220);
        });
        expect(slide('active')).toBe(nextSlide);
        expect(slide('active')?.querySelector('img')).toBe(nextImage);
        // The rotation commit zeroes the offset and suppresses transitions in the same commit.
        expect(offset()).toBe('0px');
        expect(nextSlide.style.transition).toBe('none');
        expect(onNext).toHaveBeenCalledTimes(1);

        act(() => {
            vi.advanceTimersByTime(20);
        });
        expect(nextSlide.style.transition).not.toBe('none');
    });

    it('commits by the SLIDE width, not the padded container width', () => {
        renderLightbox();
        // The container carries px-14 / md:px-20 of padding the slides do not span.
        Object.defineProperty(container(), 'clientWidth', { configurable: true, value: 960 });
        Object.defineProperty(viewport(), 'clientWidth', { configurable: true, value: 800 });

        dragLeft(viewport());
        expect(offset()).toBe('-800px');
    });

    it('resists an out-of-bounds drag and does not navigate', () => {
        const { onPrevious } = renderLightbox();

        firePointer(viewport(), 'pointerdown', { clientX: 100, clientY: 120 });
        firePointer(viewport(), 'pointermove', { clientX: 180, clientY: 124 });
        expect(offset()).toBe('19.2px');

        firePointer(viewport(), 'pointerup', { clientX: 180, clientY: 124 });
        expect(onPrevious).not.toHaveBeenCalled();
        expect(offset()).toBe('0px');
    });

    it('retains the incoming slide DOM node in a two-item loop', () => {
        const { onNext } = renderLightbox({ canGoPrevious: true, loop: true });
        const nextSlide = slide('next');

        dragLeft(viewport());
        act(() => {
            vi.advanceTimersByTime(220);
        });

        expect(slide('active')).toBe(nextSlide);
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('does not move ANY slide when a button navigates after a drag', () => {
        render(<ControlledGallery list={threeItems} />);
        dragLeft(viewport());
        settle();
        expect(activeSrc()).toBe('https://example.com/two.jpg');

        const nodes = ['previous', 'active', 'next'].map((name) => slide(name as 'active')!);
        const transforms = nodes.map((node) => node.style.transform);

        fireEvent.click(document.body.querySelector('[aria-label="Next"]')!);

        // Content swaps in place: the same three nodes hold the same positions, so nothing
        // sweeps across the viewport — the bug was slots springing back to a default order.
        expect(['previous', 'active', 'next'].map((name) => slide(name as 'active'))).toEqual(nodes);
        expect(nodes.map((node) => node.style.transform)).toEqual(transforms);
        expect(activeSrc()).toBe('https://example.com/three.jpg');
    });

    it('keeps neighbours correct through repeated drags in both directions', () => {
        render(<ControlledGallery list={threeItems} />);
        const srcOf = (name: 'previous' | 'active' | 'next') => slide(name)?.querySelector('img')?.getAttribute('src');

        dragLeft(viewport());
        settle();
        expect([srcOf('previous'), srcOf('active'), srcOf('next')]).toEqual([
            'https://example.com/one.jpg',
            'https://example.com/two.jpg',
            'https://example.com/three.jpg',
        ]);

        firePointer(viewport(), 'pointerdown', { clientX: 100, clientY: 120 });
        firePointer(viewport(), 'pointermove', { clientX: 230, clientY: 124 });
        firePointer(viewport(), 'pointerup', { clientX: 230, clientY: 124 });
        settle();
        expect([srcOf('previous'), srcOf('active'), srcOf('next')]).toEqual([
            'https://example.com/three.jpg',
            'https://example.com/one.jpg',
            'https://example.com/two.jpg',
        ]);
    });

    it('does not show a wrapped neighbour unless `loop` is set', () => {
        renderLightbox({ items: threeItems, activeIndex: 2, canGoPrevious: true, canGoNext: true });
        expect(slide('next')).toBeNull();
    });

    it('cancels a pending drag navigation when the gallery closes', () => {
        const { onClose, onNext } = renderLightbox();

        dragLeft(viewport());
        fireEvent.keyDown(window, { key: 'Escape' });
        act(() => {
            vi.advanceTimersByTime(220);
        });

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onNext).not.toHaveBeenCalled();
    });

    it('lets an external index change win over a drag still settling', () => {
        const props = {
            items: threeItems,
            isOpen: true,
            loop: true,
            onClose: vi.fn(),
            onPrevious: vi.fn(),
            onSelectIndex: vi.fn(),
        };
        const onNext = vi.fn();
        const { rerender } = render(<MediaImmersiveLightbox {...props} activeIndex={0} onNext={onNext} />);

        dragLeft(viewport());
        // e.g. the URL changed while the slide was still travelling
        rerender(<MediaImmersiveLightbox {...props} activeIndex={2} onNext={onNext} />);
        settle();

        expect(onNext).not.toHaveBeenCalled();
        expect(activeSrc()).toBe('https://example.com/three.jpg');
        expect(offset()).toBe('0px');
    });

    it('ignores keyboard navigation until a committed drag has settled', () => {
        const { onNext } = renderLightbox();

        dragLeft(viewport());
        fireEvent.keyDown(window, { key: 'ArrowRight' });
        act(() => {
            vi.advanceTimersByTime(220);
        });

        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('locks buttons and thumbnails until a committed drag has settled', () => {
        const { getByLabelText, onNext, onSelectIndex } = renderLightbox();

        dragLeft(viewport());

        const nextButton = getByLabelText('Next') as HTMLButtonElement;
        const secondThumbnail = getByLabelText('View image 2') as HTMLButtonElement;
        expect(nextButton.disabled).toBe(true);
        expect(secondThumbnail.disabled).toBe(true);
        fireEvent.click(nextButton);
        fireEvent.click(secondThumbnail);

        act(() => {
            vi.advanceTimersByTime(220);
        });

        expect(onNext).toHaveBeenCalledTimes(1);
        expect(onSelectIndex).not.toHaveBeenCalled();
    });

    it('keeps a stationary click available for image zoom', () => {
        const { onClose } = renderLightbox();
        const zoomTarget = query('.cursor-zoom-in')!;

        firePointer(zoomTarget, 'pointerdown', { clientX: 240, clientY: 120 });
        firePointer(zoomTarget, 'pointerup', { clientX: 240, clientY: 120 });
        fireEvent.click(zoomTarget, { clientX: 240, clientY: 120 });

        expect(zoomTarget.getAttribute('style')).toContain('scale(2)');
        expect(onClose).not.toHaveBeenCalled();
    });

    it('treats a few pixels of wobble as a click, not a drag', () => {
        renderLightbox();
        firePointer(viewport(), 'pointerdown', { clientX: 240, clientY: 120 });
        firePointer(viewport(), 'pointermove', { clientX: 234, clientY: 121 });
        expect(offset()).toBe('');
    });

    it('does not close when clicking the media surface outside fitted image pixels', () => {
        const { onClose } = renderLightbox();
        fireEvent.click(viewport(), { clientX: 0, clientY: 0 });
        expect(onClose).not.toHaveBeenCalled();
    });

    it('takes neighbour slides out of the tab order and the accessibility tree', () => {
        renderLightbox({ canGoPrevious: true, loop: true });
        expect(slide('next')?.hasAttribute('inert')).toBe(true);
        expect(slide('previous')?.hasAttribute('inert')).toBe(true);
        expect(slide('active')?.hasAttribute('inert')).toBe(false);
    });
});

describe('MediaImmersiveLightbox gesture conflicts', () => {
    it('a second finger (pinch) never becomes a gallery swipe', () => {
        const { onNext } = renderLightbox();
        const touch = { pointerType: 'touch' as const };

        firePointer(viewport(), 'pointerdown', { ...touch, clientX: 240, clientY: 120 });
        firePointer(viewport(), 'pointerdown', {
            ...touch,
            pointerId: 2,
            isPrimary: false,
            clientX: 300,
            clientY: 140,
        });
        firePointer(viewport(), 'pointermove', { ...touch, clientX: 100, clientY: 122 });
        firePointer(viewport(), 'pointerup', { ...touch, clientX: 100, clientY: 122 });
        act(() => {
            vi.advanceTimersByTime(300);
        });

        // Never moved: the second pointerdown abandoned the pending swipe before any travel.
        expect(['', '0px']).toContain(offset());
        expect(onNext).not.toHaveBeenCalled();
    });

    it('a second finger landing mid-swipe springs the swipe back', () => {
        const { onNext } = renderLightbox();
        const touch = { pointerType: 'touch' as const };

        firePointer(viewport(), 'pointerdown', { ...touch, clientX: 240, clientY: 120 });
        firePointer(viewport(), 'pointermove', { ...touch, clientX: 180, clientY: 121 });
        expect(offset()).toBe('-60px');

        firePointer(viewport(), 'pointerdown', {
            ...touch,
            pointerId: 2,
            isPrimary: false,
            clientX: 300,
            clientY: 140,
        });
        expect(offset()).toBe('0px');
        firePointer(viewport(), 'pointerup', { ...touch, clientX: 60, clientY: 121 });
        act(() => {
            vi.advanceTimersByTime(300);
        });
        expect(onNext).not.toHaveBeenCalled();
    });

    it("never starts a swipe on a video's control bar", () => {
        const { onNext } = renderLightbox({
            items: [{ id: 'clip', url: 'https://example.com/clip.mp4', mediaKind: 'video' }, items[1]!],
        });
        const video = query('[data-medialightbox-slide="active"] video')!;
        vi.spyOn(video, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 400 } as DOMRect);

        // Scrubbing: a horizontal drag starting 20px above the video's bottom edge.
        firePointer(video, 'pointerdown', { clientX: 240, clientY: 380 });
        firePointer(video, 'pointermove', { clientX: 100, clientY: 381 });
        firePointer(video, 'pointerup', { clientX: 100, clientY: 381 });
        settle();
        expect(onNext).not.toHaveBeenCalled();

        // The picture itself still swipes.
        firePointer(video, 'pointerdown', { clientX: 240, clientY: 150 });
        firePointer(video, 'pointermove', { clientX: 100, clientY: 151 });
        expect(offset()).toBe('-140px');
    });

    it('keeps tracking a swipe once it has started, however diagonal it gets', () => {
        renderLightbox();
        firePointer(viewport(), 'pointerdown', { clientX: 240, clientY: 120 });
        firePointer(viewport(), 'pointermove', { clientX: 200, clientY: 122 });
        firePointer(viewport(), 'pointermove', { clientX: 180, clientY: 220 });
        expect(offset()).toBe('-60px');
    });

    it('a gesture that starts vertical never becomes a swipe', () => {
        renderLightbox();
        firePointer(viewport(), 'pointerdown', { clientX: 240, clientY: 120 });
        firePointer(viewport(), 'pointermove', { clientX: 238, clientY: 160 });
        firePointer(viewport(), 'pointermove', { clientX: 100, clientY: 170 });
        expect(offset()).toBe('');
    });

    it('drops a mouse drag whose button was released outside the window', () => {
        renderLightbox();
        firePointer(viewport(), 'pointerdown', { clientX: 240, clientY: 120 });
        firePointer(viewport(), 'pointermove', { clientX: 200, clientY: 120 });
        // Hovering back in with no button held must not resume the drag.
        firePointer(viewport(), 'pointermove', { clientX: 100, clientY: 120, buttons: 0 });
        expect(offset()).toBe('0px');
    });
});

describe('MediaImmersiveLightbox fling', () => {
    function flingFrom(timeline: Array<[number, number]>) {
        let now = 0;
        vi.spyOn(performance, 'now').mockImplementation(() => now);
        const [[startX], ...moves] = timeline.map(([x, t]) => [x, t] as const);
        firePointer(viewport(), 'pointerdown', { clientX: startX, clientY: 120 });
        for (const [x, t] of moves) {
            now = t;
            firePointer(viewport(), 'pointermove', { clientX: x, clientY: 120 });
        }
        const [endX] = timeline.at(-1)!;
        firePointer(viewport(), 'pointerup', { clientX: endX, clientY: 120 });
    }

    it('commits a short, fast flick', () => {
        const { onNext } = renderLightbox();
        flingFrom([
            [240, 0],
            [220, 20],
            [195, 40],
        ]);
        settle();
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('uses RELEASE speed: a slow drag that only flicks at the end still commits', () => {
        const { onNext } = renderLightbox();
        flingFrom([
            [240, 0],
            [235, 400],
            [230, 800],
            [225, 1200],
            [195, 1250],
        ]);
        settle();
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('does not commit a short, slow drag', () => {
        const { onNext } = renderLightbox();
        flingFrom([
            [240, 0],
            [220, 400],
            [195, 900],
        ]);
        settle();
        expect(onNext).not.toHaveBeenCalled();
    });
});

describe('MediaImmersiveLightbox reduced motion', () => {
    afterEach(() => {
        document.documentElement.style.removeProperty('--motion-duration-normal');
    });

    it('commits a drag instantly and never animates slides when the brand kit disables animations', () => {
        // What brand-engine emits for a kit with "Disable animations" on
        document.documentElement.style.setProperty('--motion-duration-normal', '0s');
        const { onNext } = renderLightbox();
        const activeSlide = slide('active')!;

        expect(activeSlide.style.transition).toBe('none');

        dragLeft(viewport());
        act(() => {
            vi.advanceTimersByTime(0);
        });
        expect(onNext).toHaveBeenCalledTimes(1);
        act(() => {
            vi.advanceTimersByTime(20);
        });
        expect(activeSlide.style.transition).toBe('none');
    });
});
