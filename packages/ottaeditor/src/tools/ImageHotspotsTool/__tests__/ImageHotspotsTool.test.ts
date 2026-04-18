import { describe, it, expect, beforeEach, vi } from 'vitest';
import ImageHotspotsTool from '../ImageHotspotsTool';

function createMockApi() {
    return {
        blocks: {
            getCurrentBlockIndex: vi.fn().mockReturnValue(0),
            getBlockByIndex: vi.fn().mockReturnValue({ call: vi.fn() }),
        },
        selection: { findParentTag: vi.fn() },
    };
}

describe('ImageHotspotsTool', () => {
    let tool: ImageHotspotsTool;
    const mockApi = createMockApi();

    beforeEach(() => {
        tool = new ImageHotspotsTool({
            data: {} as any,
            api: mockApi,
            config: {},
            block: {},
        });
    });

    /* ── Static ──────────────────────────────────────────────────────────── */

    it('should have correct toolbox title', () => {
        expect(ImageHotspotsTool.toolbox.title).toBe('Image Hotspots');
    });

    it('should have toolbox icon SVG', () => {
        expect(ImageHotspotsTool.toolbox.icon).toContain('<svg');
    });

    it('should have CSS class constants', () => {
        expect(ImageHotspotsTool.CSS.wrapper).toBe('cdx-image-hotspots');
        expect(ImageHotspotsTool.CSS.canvas).toBe('cdx-image-hotspots__canvas');
        expect(ImageHotspotsTool.CSS.dot).toBe('cdx-image-hotspots__dot');
    });

    /* ── Defaults ────────────────────────────────────────────────────────── */

    it('should initialise with default data', () => {
        const saved = tool.save();
        expect(saved.imageUrl).toBe('');
        expect(saved.alt).toBe('');
        expect(saved.caption).toBe('');
        expect(saved.hotspots).toEqual([]);
    });

    it('should accept custom initial data', () => {
        const hotspots = [
            { id: '1', x: 25, y: 30, title: 'Point A', content: 'Info A' },
            { id: '2', x: 75, y: 60, title: 'Point B', content: 'Info B' },
        ];
        const custom = new ImageHotspotsTool({
            data: {
                imageUrl: 'test.jpg',
                alt: 'Test',
                caption: 'My image',
                hotspots,
            } as any,
            api: mockApi,
            config: {},
            block: {},
        });
        const saved = custom.save();
        expect(saved.imageUrl).toBe('test.jpg');
        expect(saved.hotspots).toHaveLength(2);
        expect(saved.hotspots[0].title).toBe('Point A');
    });

    it('should handle missing hotspots array', () => {
        const t = new ImageHotspotsTool({
            data: { imageUrl: 'x.jpg' } as any,
            api: mockApi,
            config: {},
            block: {},
        });
        expect(t.save().hotspots).toEqual([]);
    });

    /* ── Rendering ───────────────────────────────────────────────────────── */

    it('should render a wrapper element with ob-plugin class', () => {
        const el = tool.render();
        expect(el).toBeInstanceOf(HTMLElement);
        expect(el.classList.contains('ob-plugin')).toBe(true);
        expect(el.classList.contains('cdx-image-hotspots')).toBe(true);
    });

    it('should render URL input field', () => {
        const el = tool.render();
        const inputs = el.querySelectorAll('.ob-input');
        expect(inputs.length).toBeGreaterThanOrEqual(2); // image url, alt
    });

    it('should not render canvas when no image URL', () => {
        const el = tool.render();
        expect(el.querySelector('.cdx-image-hotspots__canvas')).toBeNull();
    });

    it('should render canvas when image URL is provided', () => {
        const t = new ImageHotspotsTool({
            data: { imageUrl: 'photo.jpg', alt: '', caption: '', hotspots: [] } as any,
            api: mockApi,
            config: {},
            block: {},
        });
        const el = t.render();
        expect(el.querySelector('.cdx-image-hotspots__canvas')).toBeTruthy();
    });

    it('should render hotspot dots on canvas', () => {
        const t = new ImageHotspotsTool({
            data: {
                imageUrl: 'photo.jpg',
                alt: '',
                caption: '',
                hotspots: [
                    { id: 'a', x: 10, y: 20, title: 'A', content: '' },
                    { id: 'b', x: 50, y: 50, title: 'B', content: '' },
                ],
            } as any,
            api: mockApi,
            config: {},
            block: {},
        });
        const el = t.render();
        const dots = el.querySelectorAll('.cdx-image-hotspots__dot');
        expect(dots.length).toBe(2);
    });

    /* ── Validation ──────────────────────────────────────────────────────── */

    it('should validate when imageUrl is present', () => {
        expect(tool.validate({ imageUrl: 'x.jpg', alt: '', caption: '', hotspots: [] })).toBe(true);
    });

    it('should reject when imageUrl is empty', () => {
        expect(tool.validate({ imageUrl: '', alt: '', caption: '', hotspots: [] })).toBe(false);
    });

    /* ── Save returns deep copy ──────────────────────────────────────────── */

    it('should return deep copy of hotspots on save', () => {
        const t = new ImageHotspotsTool({
            data: {
                imageUrl: 'x.jpg',
                alt: '',
                caption: '',
                hotspots: [{ id: 'a', x: 10, y: 20, title: 'A', content: 'C' }],
            } as any,
            api: mockApi,
            config: {},
            block: {},
        });
        const saved = t.save();
        saved.hotspots[0].title = 'MUTATED';
        expect(t.save().hotspots[0].title).toBe('A'); // original unchanged
    });

    /* ── Destroy ─────────────────────────────────────────────────────────── */

    it('should destroy cleanly', () => {
        tool.render();
        expect(() => tool.destroy()).not.toThrow();
    });
});
