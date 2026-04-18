import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnnotationTool from '../AnnotationTool';

// Mock CSS import
vi.mock('../AnnotationTool.css', () => ({}));

const createMockAPI = () => ({
    selection: {
        findParentTag: vi.fn(() => null),
    },
    blocks: {
        getCurrentBlockIndex: vi.fn(() => 0),
        getBlockByIndex: vi.fn(() => ({ call: vi.fn() })),
    },
});

describe('AnnotationTool', () => {
    let mockAPI: ReturnType<typeof createMockAPI>;

    beforeEach(() => {
        mockAPI = createMockAPI();
    });

    // ── Static metadata ──────────────────────────────────────────────────────

    describe('isInline', () => {
        it('should return true indicating this is an inline tool', () => {
            expect(AnnotationTool.isInline).toBe(true);
        });
    });

    describe('title', () => {
        it('should have correct title', () => {
            expect(AnnotationTool.title).toBe('Annotation');
        });
    });

    describe('sanitize', () => {
        it('should return sanitize config allowing span with data attributes', () => {
            const sanitize = AnnotationTool.sanitize;
            expect(sanitize).toHaveProperty('span');
            expect(sanitize.span).toHaveProperty('class', 'cdx-annotation');
            expect(sanitize.span).toHaveProperty('data-annotation', true);
            expect(sanitize.span).toHaveProperty('data-title', true);
        });
    });

    // ── render() ─────────────────────────────────────────────────────────────

    describe('render()', () => {
        it('should return a button element', () => {
            const tool = new AnnotationTool({ api: mockAPI as any });
            const button = tool.render();
            expect(button).toBeInstanceOf(HTMLButtonElement);
        });

        it('should have ce-inline-tool class', () => {
            const tool = new AnnotationTool({ api: mockAPI as any });
            const button = tool.render();
            expect(button.classList.contains('ce-inline-tool')).toBe(true);
        });

        it('should contain an SVG icon', () => {
            const tool = new AnnotationTool({ api: mockAPI as any });
            const button = tool.render();
            expect(button.innerHTML).toContain('svg');
        });

        it('should have type="button"', () => {
            const tool = new AnnotationTool({ api: mockAPI as any });
            const button = tool.render();
            expect(button.type).toBe('button');
        });
    });

    // ── checkState() ─────────────────────────────────────────────────────────

    describe('checkState()', () => {
        it('should return false when no annotation tag is found', () => {
            mockAPI.selection.findParentTag.mockReturnValue(null);
            const tool = new AnnotationTool({ api: mockAPI as any });
            tool.render();
            expect(tool.checkState()).toBe(false);
        });

        it('should return true when annotation tag is found', () => {
            const mockSpan = document.createElement('span');
            mockSpan.classList.add('cdx-annotation');
            mockAPI.selection.findParentTag.mockReturnValue(mockSpan);

            const tool = new AnnotationTool({ api: mockAPI as any });
            tool.render();
            expect(tool.checkState()).toBe(true);
        });

        it('should add active class to button when annotation is selected', () => {
            const mockSpan = document.createElement('span');
            mockSpan.classList.add('cdx-annotation');
            mockAPI.selection.findParentTag.mockReturnValue(mockSpan);

            const tool = new AnnotationTool({ api: mockAPI as any });
            const button = tool.render();
            tool.checkState();
            expect(button.classList.contains('ce-inline-tool--active')).toBe(true);
        });

        it('should remove active class from button when no annotation is selected', () => {
            const tool = new AnnotationTool({ api: mockAPI as any });
            const button = tool.render();

            // First set it to active
            const mockSpan = document.createElement('span');
            mockAPI.selection.findParentTag.mockReturnValue(mockSpan);
            tool.checkState();

            // Then check with no annotation
            mockAPI.selection.findParentTag.mockReturnValue(null);
            tool.checkState();
            expect(button.classList.contains('ce-inline-tool--active')).toBe(false);
        });
    });

    // ── renderActions() ─────────────────────────────────────────────────────

    describe('renderActions()', () => {
        it('should return an element with edit button', () => {
            const tool = new AnnotationTool({ api: mockAPI as any });
            const actions = tool.renderActions();
            expect(actions).toBeInstanceOf(HTMLElement);
            expect(actions.classList.contains('cdx-annotation-actions')).toBe(true);
        });

        it('should have an edit button with correct text', () => {
            const tool = new AnnotationTool({ api: mockAPI as any });
            const actions = tool.renderActions();
            const editBtn = actions.querySelector('.cdx-annotation-actions__edit');
            expect(editBtn).not.toBeNull();
            expect(editBtn?.textContent).toContain('Edit annotation');
        });
    });

    // ── clear() ──────────────────────────────────────────────────────────────

    describe('clear()', () => {
        it('should not throw when called', () => {
            const tool = new AnnotationTool({ api: mockAPI as any });
            expect(() => tool.clear()).not.toThrow();
        });
    });
});
