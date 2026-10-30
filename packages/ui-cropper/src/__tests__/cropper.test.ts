import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Cropper } from '../cropper';

/** An Image that "decodes" synchronously on src assignment with a fixed natural size. */
function stubImage(width: number, height: number, fail = false) {
    class FakeImage {
        naturalWidth = width;
        naturalHeight = height;
        crossOrigin = '';
        onload: null | (() => void) = null;
        onerror: null | (() => void) = null;
        set src(_v: string) {
            queueMicrotask(() => (fail ? this.onerror?.() : this.onload?.()));
        }
    }
    vi.stubGlobal('Image', FakeImage);
}

const tick = () => new Promise<void>((r) => queueMicrotask(r));

let el: HTMLDivElement;
beforeEach(() => {
    el = document.createElement('div');
    document.body.appendChild(el);
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:fake', revokeObjectURL: () => undefined });
});
afterEach(() => {
    el.remove();
    vi.unstubAllGlobals();
});

describe('Cropper', () => {
    it('mounts a stage, an empty state and a disabled toolbar', () => {
        const c = new Cropper(el);
        expect(el.classList.contains('ottacropper')).toBe(true);
        expect(el.classList.contains('ottacropper--empty')).toBe(true);
        expect(el.querySelector('[data-slot="cropper-stage"]')).toBeTruthy();
        expect(el.querySelector('[data-slot="cropper-empty"]')?.textContent).toContain('Drop a photo');
        expect(el.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe('Crop tools');
        expect(el.querySelectorAll('[role="radio"]').length).toBe(4);
        expect((el.querySelector('button[aria-label="Rotate right"]') as HTMLButtonElement).disabled).toBe(true);
        expect((el.querySelector('input[type="range"]') as HTMLInputElement).disabled).toBe(true);
        expect(c.hasImage()).toBe(false);
        c.destroy();
    });

    it('hides presets when asked and shows a straighten slider when asked', () => {
        const c = new Cropper(el, { aspectPresets: false, straighten: true });
        expect(el.querySelector('[role="radiogroup"]')).toBeNull();
        expect(el.querySelector('input[aria-label="Straighten"]')).toBeTruthy();
        c.destroy();
    });

    it('loads a photo, enables the toolbar and reports a covering home state', async () => {
        stubImage(1200, 800);
        const onImageLoad = vi.fn();
        const onChange = vi.fn();
        const c = new Cropper(el, { aspectRatio: 1, onImageLoad, onChange, transitions: false });
        c.loadFromUrl('https://example.com/photo.jpg');
        await tick();
        expect(c.hasImage()).toBe(true);
        expect(el.classList.contains('ottacropper--empty')).toBe(false);
        expect((el.querySelector('button[aria-label="Rotate right"]') as HTMLButtonElement).disabled).toBe(false);
        expect(onImageLoad).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalled();
        const s = c.getState();
        expect(s.zoom).toBe(1);
        expect(s.rotation).toBe(0);
        expect(s.dirty).toBe(false);
        expect(s.aspectRatio).toBeCloseTo(1);
        // 1:1 frame over a 1200x800 photo at cover: the output is the photo's height squared
        expect(s.output).toEqual({ width: 800, height: 800 });
        c.destroy();
    });

    it('zooms, rotates, flips and resets with correct state', async () => {
        stubImage(1200, 800);
        const c = new Cropper(el, { transitions: false });
        c.loadFromUrl('https://example.com/photo.jpg');
        await tick();
        c.setZoom(2);
        expect(c.getZoom()).toBeCloseTo(2);
        expect(c.getState().output).toEqual({ width: 400, height: 400 });
        c.setZoom(99);
        expect(c.getZoom()).toBe(4);
        c.rotate(90);
        expect(c.getState().rotation).toBe(90);
        c.rotate(-90);
        c.rotate(-90);
        expect(c.getState().rotation).toBe(270);
        c.flipHorizontal();
        expect(c.getState().flipX).toBe(true);
        expect(el.querySelector('button[aria-label="Flip horizontal"]')?.getAttribute('aria-pressed')).toBe('true');
        // a mirrored photo still rotates clockwise on screen
        c.rotate(90);
        expect(c.getState().rotation).toBe(0);
        expect(c.getState().dirty).toBe(true);
        expect((el.querySelector('button[aria-label="Reset"]') as HTMLButtonElement).hidden).toBe(false);
        c.reset();
        const s = c.getState();
        expect(s.dirty).toBe(false);
        expect(s.zoom).toBe(1);
        expect(s.flipX).toBe(false);
        expect((el.querySelector('button[aria-label="Reset"]') as HTMLButtonElement).hidden).toBe(true);
        c.destroy();
    });

    it('switches aspect from the toolbar and marks the preset checked', async () => {
        stubImage(1200, 800);
        const c = new Cropper(el, { transitions: false });
        c.loadFromUrl('https://example.com/photo.jpg');
        await tick();
        const wide = [...el.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find(
            (b) => b.textContent === '16:9',
        )!;
        wide.click();
        expect(wide.getAttribute('aria-checked')).toBe('true');
        expect(c.getState().aspectRatio).toBeCloseTo(16 / 9);
        const free = [...el.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find(
            (b) => b.textContent === 'Free',
        )!;
        free.click();
        expect(el.classList.contains('ottacropper--free')).toBe(true);
        c.destroy();
    });

    it('straightens within -45..45 and keeps the frame covered', async () => {
        stubImage(1200, 800);
        const c = new Cropper(el, { straighten: true, transitions: false });
        c.loadFromUrl('https://example.com/photo.jpg');
        await tick();
        c.setStraighten(20);
        expect(c.getState().straighten).toBe(20);
        expect(c.getState().zoom).toBe(1);
        expect(c.getState().output.width).toBeLessThan(800);
        c.setStraighten(90);
        expect(c.getState().straighten).toBe(45);
        c.destroy();
    });

    it('rejects a non-image file with a hint and onError', () => {
        const onError = vi.fn();
        const c = new Cropper(el, { onError });
        c.loadFromFile(new File(['x'], 'notes.txt', { type: 'text/plain' }));
        expect(onError).toHaveBeenCalledWith("That file isn't an image");
        expect(el.querySelector('.ottacropper-empty--error')?.textContent).toContain("isn't an image");
        c.destroy();
    });

    it('reports a decode failure without leaving the empty state', async () => {
        stubImage(0, 0, true);
        const onError = vi.fn();
        const c = new Cropper(el, { onError });
        c.loadFromFile(new File(['x'], 'broken.png', { type: 'image/png' }));
        await tick();
        expect(onError).toHaveBeenCalledWith("Couldn't open that image");
        expect(c.hasImage()).toBe(false);
        c.destroy();
    });

    it('getBlob refuses without a photo and destroy clears the container', async () => {
        const c = new Cropper(el);
        await expect(c.getBlob()).rejects.toThrow('No image loaded');
        c.destroy();
        expect(el.innerHTML).toBe('');
        expect(el.className).toBe('');
        expect(el.getAttribute('role')).toBeNull();
    });
});
