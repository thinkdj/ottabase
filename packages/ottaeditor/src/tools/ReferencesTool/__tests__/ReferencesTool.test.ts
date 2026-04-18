import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReferencesTool, { type ReferencesData } from '../ReferencesTool';

// Mock CSS import
vi.mock('../ReferencesTool.css', () => ({}));

const createMockAPI = () => ({
    blocks: {
        getCurrentBlockIndex: vi.fn(() => 0),
    },
});

describe('ReferencesTool', () => {
    let mockAPI: ReturnType<typeof createMockAPI>;

    beforeEach(() => {
        mockAPI = createMockAPI();
    });

    // ── Static metadata ──────────────────────────────────────────────────────

    describe('Toolbox', () => {
        it('should have correct toolbox title and icon', () => {
            expect(ReferencesTool.toolbox.title).toBe('References');
            expect(ReferencesTool.toolbox.icon).toContain('svg');
        });
    });

    describe('enableLineBreaks', () => {
        it('should allow line breaks', () => {
            expect(ReferencesTool.enableLineBreaks).toBe(true);
        });
    });

    // ── Constructor / defaults ────────────────────────────────────────────────

    describe('Constructor defaults', () => {
        it('should start with one empty item when no data provided', () => {
            const tool = new ReferencesTool({ api: mockAPI as any, config: {} });
            const saved = tool.save();
            // Empty items (no url) are filtered on save, so expect empty array
            expect(saved.items).toHaveLength(0);
            expect(saved.style).toBe('numbered');
        });

        it('should accept defaultStyle from config', () => {
            const tool = new ReferencesTool({
                api: mockAPI as any,
                config: { defaultStyle: 'footnote' },
            });
            expect(tool.save().style).toBe('footnote');
        });

        it('should preserve provided data', () => {
            const initialData: ReferencesData = {
                style: 'footnote',
                items: [
                    { id: '1', url: 'https://example.com', title: 'Example', authors: 'Jane Doe', year: '2024' },
                    { id: '2', url: 'https://editorjs.io', title: 'EditorJS', year: '2023' },
                ],
            };
            const tool = new ReferencesTool({ api: mockAPI as any, config: {}, data: initialData });
            const saved = tool.save();
            expect(saved.style).toBe('footnote');
            expect(saved.items).toHaveLength(2);
            expect(saved.items[0].url).toBe('https://example.com');
            expect(saved.items[1].title).toBe('EditorJS');
        });
    });

    // ── save ──────────────────────────────────────────────────────────────────

    describe('save()', () => {
        it('should return items array with correct structure', () => {
            const tool = new ReferencesTool({
                api: mockAPI as any,
                config: {},
                data: {
                    style: 'numbered',
                    items: [{ id: '1', url: 'https://example.com', title: 'Example', authors: 'Author', year: '2024' }],
                },
            });
            const saved = tool.save();
            expect(saved.items).toHaveLength(1);
            expect(saved.items[0].url).toBe('https://example.com');
            expect(saved.items[0].title).toBe('Example');
            expect(saved.items[0].authors).toBe('Author');
            expect(saved.items[0].year).toBe('2024');
        });

        it('should filter out items where url is empty', () => {
            const tool = new ReferencesTool({
                api: mockAPI as any,
                config: {},
                data: {
                    style: 'numbered',
                    items: [
                        { id: '1', url: '', title: 'No URL item' },
                        { id: '2', url: 'https://example.com', title: 'Has URL' },
                    ],
                },
            });
            const saved = tool.save();
            expect(saved.items).toHaveLength(1);
            expect(saved.items[0].url).toBe('https://example.com');
        });

        it('should trim whitespace from saved items', () => {
            const tool = new ReferencesTool({
                api: mockAPI as any,
                config: {},
                data: {
                    style: 'numbered',
                    items: [{ id: '1', url: '  https://example.com  ', title: '  Trimmed  ' }],
                },
            });
            const saved = tool.save();
            expect(saved.items[0].url).toBe('https://example.com');
            expect(saved.items[0].title).toBe('Trimmed');
        });

        it('should omit optional fields that are empty strings', () => {
            const tool = new ReferencesTool({
                api: mockAPI as any,
                config: {},
                data: {
                    style: 'numbered',
                    items: [{ id: '1', url: 'https://example.com', title: '', authors: '', year: '' }],
                },
            });
            const saved = tool.save();
            expect(saved.items[0].title).toBeUndefined();
            expect(saved.items[0].authors).toBeUndefined();
            expect(saved.items[0].year).toBeUndefined();
        });
    });

    // ── validate ──────────────────────────────────────────────────────────────

    describe('validate()', () => {
        it('should return false for empty items array', () => {
            const tool = new ReferencesTool({ api: mockAPI as any, config: {} });
            expect(tool.validate({ style: 'numbered', items: [] })).toBe(false);
        });

        it('should return false when no item has a url', () => {
            const tool = new ReferencesTool({ api: mockAPI as any, config: {} });
            expect(
                tool.validate({
                    style: 'numbered',
                    items: [{ id: '1', url: '', title: 'No URL' }],
                }),
            ).toBe(false);
        });

        it('should return true when at least one item has a url', () => {
            const tool = new ReferencesTool({ api: mockAPI as any, config: {} });
            expect(
                tool.validate({
                    style: 'numbered',
                    items: [{ id: '1', url: 'https://example.com' }],
                }),
            ).toBe(true);
        });

        it('should return true when some items have urls and some do not', () => {
            const tool = new ReferencesTool({ api: mockAPI as any, config: {} });
            expect(
                tool.validate({
                    style: 'numbered',
                    items: [
                        { id: '1', url: '' },
                        { id: '2', url: 'https://example.com' },
                    ],
                }),
            ).toBe(true);
        });
    });

    // ── DOM rendering ──────────────────────────────────────────────────────────

    describe('render()', () => {
        it('should return an HTMLElement', () => {
            const tool = new ReferencesTool({
                api: mockAPI as any,
                config: {},
                data: {
                    style: 'numbered',
                    items: [{ id: '1', url: 'https://example.com' }],
                },
            });
            const el = tool.render();
            expect(el).toBeInstanceOf(HTMLElement);
            expect(el.classList.contains('cdx-references__wrapper')).toBe(true);
        });

        it('should render one card per item', () => {
            const tool = new ReferencesTool({
                api: mockAPI as any,
                config: {},
                data: {
                    style: 'numbered',
                    items: [
                        { id: '1', url: 'https://example.com', title: 'First' },
                        { id: '2', url: 'https://editorjs.io', title: 'Second' },
                    ],
                },
            });
            const el = tool.render();
            const cards = el.querySelectorAll('.cdx-references__card');
            expect(cards).toHaveLength(2);
        });

        it('should populate url inputs from data', () => {
            const tool = new ReferencesTool({
                api: mockAPI as any,
                config: {},
                data: {
                    style: 'numbered',
                    items: [{ id: '1', url: 'https://example.com/article', title: 'My Article' }],
                },
            });
            const el = tool.render();
            const urlInput = el.querySelector<HTMLInputElement>('.cdx-references__url-input');
            expect(urlInput?.value).toBe('https://example.com/article');
        });

        it('should render style select with correct selected option', () => {
            const tool = new ReferencesTool({
                api: mockAPI as any,
                config: {},
                data: {
                    style: 'footnote',
                    items: [{ id: '1', url: 'https://example.com' }],
                },
            });
            const el = tool.render();
            const select = el.querySelector<HTMLSelectElement>('select');
            expect(select?.value).toBe('footnote');
        });
    });
});
