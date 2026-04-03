import { beforeEach, describe, expect, it, vi } from 'vitest';
import BeforeAfterTool from '../BeforeAfterTool';

function createMockApi() {
    return {
        blocks: {
            getCurrentBlockIndex: vi.fn().mockReturnValue(0),
            getBlockByIndex: vi.fn().mockReturnValue({ call: vi.fn() }),
        },
        selection: { findParentTag: vi.fn() },
    };
}

describe('BeforeAfterTool', () => {
    let tool: BeforeAfterTool;
    const mockApi = createMockApi();

    beforeEach(() => {
        tool = new BeforeAfterTool({
            data: {} as any,
            api: mockApi,
            config: {},
            block: {},
        });
    });

    /* ── Static ──────────────────────────────────────────────────────────── */

    it('should have correct toolbox title', () => {
        expect(BeforeAfterTool.toolbox.title).toBe('Before / After');
    });

    it('should have toolbox icon SVG', () => {
        expect(BeforeAfterTool.toolbox.icon).toContain('<svg');
    });

    it('should have CSS class constants', () => {
        expect(BeforeAfterTool.CSS.wrapper).toBe('cdx-before-after');
        expect(BeforeAfterTool.CSS.container).toBe('cdx-before-after__container');
        expect(BeforeAfterTool.CSS.handle).toBe('cdx-before-after__handle');
    });

    /* ── Defaults ────────────────────────────────────────────────────────── */

    it('should initialise with default data', () => {
        const saved = tool.save();
        expect(saved.beforeUrl).toBe('');
        expect(saved.afterUrl).toBe('');
        expect(saved.beforeLabel).toBe('Before');
        expect(saved.afterLabel).toBe('After');
        expect(saved.orientation).toBe('horizontal');
        expect(saved.sliderPosition).toBe(50);
        expect(saved.caption).toBe('');
    });

    it('should accept custom initial data', () => {
        const custom = new BeforeAfterTool({
            data: {
                beforeUrl: 'a.jpg',
                afterUrl: 'b.jpg',
                beforeLabel: 'Old',
                afterLabel: 'New',
                orientation: 'vertical',
                sliderPosition: 30,
                caption: 'Caption!',
            } as any,
            api: mockApi,
            config: {},
            block: {},
        });
        const saved = custom.save();
        expect(saved.beforeUrl).toBe('a.jpg');
        expect(saved.afterUrl).toBe('b.jpg');
        expect(saved.orientation).toBe('vertical');
        expect(saved.sliderPosition).toBe(30);
    });

    it('should apply config defaults', () => {
        const t = new BeforeAfterTool({
            data: {} as any,
            api: mockApi,
            config: { defaultOrientation: 'vertical', defaultPosition: 75 },
            block: {},
        });
        const s = t.save();
        expect(s.orientation).toBe('vertical');
        expect(s.sliderPosition).toBe(75);
    });

    /* ── Rendering ───────────────────────────────────────────────────────── */

    it('should render a wrapper element with ob-plugin class', () => {
        const el = tool.render();
        expect(el).toBeInstanceOf(HTMLElement);
        expect(el.classList.contains('ob-plugin')).toBe(true);
        expect(el.classList.contains('cdx-before-after')).toBe(true);
    });

    it('should render URL input fields', () => {
        const el = tool.render();
        const inputs = el.querySelectorAll('.ob-input');
        expect(inputs.length).toBeGreaterThanOrEqual(4); // before url, after url, before label, after label
    });

    it('should render orientation toggle buttons', () => {
        const el = tool.render();
        const toggle = el.querySelector('.cdx-before-after__orientation-toggle');
        expect(toggle).toBeTruthy();
        const buttons = toggle?.querySelectorAll('.cdx-before-after__orientation-btn');
        expect(buttons?.length).toBe(2); // horizontal and vertical
    });

    /* ── Validation ──────────────────────────────────────────────────────── */

    it('should validate when at least one URL is provided', () => {
        expect(
            tool.validate({
                beforeUrl: 'a.jpg',
                afterUrl: '',
                beforeLabel: '',
                afterLabel: '',
                orientation: 'horizontal',
                sliderPosition: 50,
                caption: '',
            }),
        ).toBe(true);
        expect(
            tool.validate({
                beforeUrl: '',
                afterUrl: 'b.jpg',
                beforeLabel: '',
                afterLabel: '',
                orientation: 'horizontal',
                sliderPosition: 50,
                caption: '',
            }),
        ).toBe(true);
    });

    it('should reject when both URLs are empty', () => {
        expect(
            tool.validate({
                beforeUrl: '',
                afterUrl: '',
                beforeLabel: '',
                afterLabel: '',
                orientation: 'horizontal',
                sliderPosition: 50,
                caption: '',
            }),
        ).toBe(false);
    });

    /* ── Destroy ─────────────────────────────────────────────────────────── */

    it('should destroy cleanly', () => {
        tool.render();
        expect(() => tool.destroy()).not.toThrow();
    });
});
