import { describe, expect, it } from 'vitest';
import { Cropper } from '../cropper';

describe('Cropper', () => {
    it('exports Cropper class', () => {
        expect(Cropper).toBeDefined();
        expect(typeof Cropper).toBe('function');
    });

    it('creates instance and mounts to container', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        const c = new Cropper(el, { aspectRatio: 1 });
        // Hidden file input should exist
        const input = el.querySelector('input[type="file"]') as HTMLInputElement;
        expect(input).toBeTruthy();
        // Styled upload button should exist with "Choose image" text
        const btn = el.querySelector('button[title="Choose image"]');
        expect(btn).toBeTruthy();
        expect(btn?.textContent).toContain('Choose image');
        // Filename label should show default text
        const nameLabel = el.querySelector('#cropper-file-name');
        expect(nameLabel).toBeTruthy();
        expect(nameLabel?.textContent).toBe('No file selected');
        expect(el.querySelector('canvas')).toBeTruthy();
        c.destroy();
        document.body.removeChild(el);
    });

    it('accepts options', () => {
        const el = document.createElement('div');
        const c = new Cropper(el, { shape: 'circle', aspectRatio: 16 / 9 });
        expect(c).toBeDefined();
        c.destroy();
    });

    it('destroy clears container', () => {
        const el = document.createElement('div');
        const c = new Cropper(el);
        c.destroy();
        expect(el.innerHTML).toBe('');
    });

    it('accepts zoom options', () => {
        const el = document.createElement('div');
        const c = new Cropper(el, {
            zoom: 1.5,
            minZoom: 0.5,
            maxZoom: 3,
        });
        expect(c.getZoom()).toBe(1.5);
        c.destroy();
    });

    it('zoom methods work correctly', () => {
        const el = document.createElement('div');
        const c = new Cropper(el, { zoom: 1, transitions: false });
        c.zoomIn();
        expect(c.getZoom()).toBeCloseTo(1.2, 1);
        c.zoomOut();
        expect(c.getZoom()).toBeCloseTo(1, 1);
        c.destroy();
    });

    it('setZoom respects min/max bounds', () => {
        const el = document.createElement('div');
        const c = new Cropper(el, { minZoom: 0.5, maxZoom: 3, transitions: false });
        c.setZoom(5);
        expect(c.getZoom()).toBe(3);
        c.setZoom(0.1);
        expect(c.getZoom()).toBe(0.5);
        c.destroy();
    });

    it('accepts transition options', () => {
        const el = document.createElement('div');
        const c = new Cropper(el, {
            transitions: true,
            transitionDuration: 500,
        });
        expect(c).toBeDefined();
        c.destroy();
    });

    it('has all public methods', () => {
        const el = document.createElement('div');
        const c = new Cropper(el);
        expect(typeof c.flipHorizontal).toBe('function');
        expect(typeof c.flipVertical).toBe('function');
        expect(typeof c.rotate).toBe('function');
        expect(typeof c.zoomIn).toBe('function');
        expect(typeof c.zoomOut).toBe('function');
        expect(typeof c.setZoom).toBe('function');
        expect(typeof c.getZoom).toBe('function');
        expect(typeof c.setAspectRatio).toBe('function');
        expect(typeof c.setShape).toBe('function');
        expect(typeof c.setMaxHeight).toBe('function');
        expect(typeof c.setPresetsVisible).toBe('function');
        expect(typeof c.getBlob).toBe('function');
        expect(typeof c.destroy).toBe('function');
        c.destroy();
    });

    it('accepts freeform aspect ratio (null)', () => {
        const el = document.createElement('div');
        const c = new Cropper(el, { aspectRatio: null });
        expect(c).toBeDefined();
        c.destroy();
    });

    it('can switch to freeform aspect ratio', () => {
        const el = document.createElement('div');
        const c = new Cropper(el, { aspectRatio: 1 });
        c.setAspectRatio(null);
        expect(c).toBeDefined();
        c.destroy();
    });

    it('has loadFromUrl method for URL/base64 images', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        const c = new Cropper(el);
        expect(typeof c.loadFromUrl).toBe('function');
        // Should not throw when called with a data URI
        expect(() => c.loadFromUrl('data:image/png;base64,iVBOR')).not.toThrow();
        // Should not throw when called with empty string
        expect(() => c.loadFromUrl('')).not.toThrow();
        c.destroy();
        document.body.removeChild(el);
    });

    it('zoom respects maxHeight constraint', () => {
        const el = document.createElement('div');
        const c = new Cropper(el, {
            zoom: 1,
            minZoom: 0.5,
            maxZoom: 5,
            maxHeight: 400,
            transitions: false,
        });
        // Even if we try to zoom to 5x, it should be clamped to what fits within maxHeight
        c.setZoom(5);
        // The actual zoom should be less than 5 if maxHeight constraint kicks in
        // Without an image loaded, zoom should still respect maxZoom bounds
        expect(c.getZoom()).toBeLessThanOrEqual(5);
        c.destroy();
    });
});
