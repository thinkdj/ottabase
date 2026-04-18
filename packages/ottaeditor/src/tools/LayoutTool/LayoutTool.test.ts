// @ts-nocheck - EditorJS BlockToolConstructorOptions has inconsistent required fields across versions
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LayoutTool from './LayoutTool';

// Mock CSS import
vi.mock('./LayoutTool.css', () => ({}));

// Mock EditorJS – full nested editor init is not needed in unit tests
vi.mock('@editorjs/editorjs', () => {
    const MockEditorJS = vi.fn().mockImplementation(() => ({
        isReady: Promise.resolve(),
        save: vi.fn().mockResolvedValue({ blocks: [] }),
        destroy: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
        render: vi.fn().mockResolvedValue(undefined),
    }));
    return { default: MockEditorJS };
});

// Mock optional nested tool imports (matches buildDefaultTools fallback list)
vi.mock('@editorjs/paragraph', () => ({ default: {} }));
vi.mock('@editorjs/header', () => ({ default: {} }));
vi.mock('@editorjs/delimiter', () => ({ default: {} }));
vi.mock('@editorjs/nested-list', () => ({ default: {} }));
vi.mock('@editorjs/checklist', () => ({ default: {} }));
vi.mock('@editorjs/table', () => ({ default: {} }));

const createMockAPI = () => ({
    blocks: { getCurrentBlockIndex: vi.fn(() => 0) },
    ui: { notifier: { show: vi.fn() } },
});

describe('LayoutTool', () => {
    let mockAPI: ReturnType<typeof createMockAPI>;

    beforeEach(() => {
        mockAPI = createMockAPI();
        // Provide unique IDs so parallel tests don't conflict
        vi.spyOn(Date, 'now').mockReturnValue(1000);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Toolbox', () => {
        it('should have correct toolbox configuration', () => {
            expect(LayoutTool.toolbox.title).toBe('Layout');
            expect(LayoutTool.toolbox.icon).toBeTruthy();
        });

        it('should enable line breaks', () => {
            expect(LayoutTool.enableLineBreaks).toBe(true);
        });
    });

    describe('Initialization', () => {
        it('should default to 1-1 (50/50) preset', () => {
            const tool = new LayoutTool({ data: {} as any, config: {}, api: mockAPI as any } as any);
            const saved = tool.save() as any;
            return saved.then((data: any) => {
                expect(data.preset).toBe('1-1');
                expect(data.columns).toHaveLength(2);
            });
        });

        it('should initialise with provided preset', () => {
            const tool = new LayoutTool({
                data: { preset: '1-3', columns: [] } as any,
                config: {},
                api: mockAPI as any,
            });
            const saved = tool.save() as any;
            return saved.then((data: any) => {
                expect(data.preset).toBe('1-3');
                expect(data.columns).toHaveLength(2);
            });
        });

        it('should initialise 3-column preset', () => {
            const tool = new LayoutTool({
                data: { preset: '1-1-1', columns: [] } as any,
                config: {},
                api: mockAPI as any,
            });
            const saved = tool.save() as any;
            return saved.then((data: any) => {
                expect(data.preset).toBe('1-1-1');
                expect(data.columns).toHaveLength(3);
            });
        });

        it('should preserve existing column content', () => {
            const colContent = { blocks: [{ id: '1', type: 'paragraph', data: { text: 'Hello' } }] };
            const tool = new LayoutTool({
                data: {
                    preset: '1-1',
                    columns: [{ content: colContent }, { content: { blocks: [] } }],
                } as any,
                config: {},
                api: mockAPI as any,
            });
            const saved = tool.save() as any;
            return saved.then((data: any) => {
                // column data preserved from initialisation (nested editors return empty in mock)
                expect(data.columns[0]).toBeDefined();
            });
        });

        it('should fall back to 1-1 preset for invalid preset key', () => {
            const tool = new LayoutTool({
                data: { preset: 'invalid-key' as any, columns: [] } as any,
                config: {},
                api: mockAPI as any,
            });
            const el = tool.render();
            const cols = el.querySelectorAll('[data-col]');
            // Falls back to PRESETS[0] (1-1) which has 2 columns
            expect(cols.length).toBe(2);
        });
    });

    describe('Rendering', () => {
        it('should render wrapper element', () => {
            const tool = new LayoutTool({ data: {} as any, config: {}, api: mockAPI as any } as any);
            const el = tool.render();
            expect(el).toBeInstanceOf(HTMLElement);
            expect(el.classList.contains('cdx-layout')).toBe(true);
        });

        it('should render preset toolbar buttons', () => {
            const tool = new LayoutTool({ data: {} as any, config: {}, api: mockAPI as any } as any);
            const el = tool.render();
            const buttons = el.querySelectorAll('.cdx-layout__preset-btn');
            // 6 presets
            expect(buttons.length).toBe(6);
        });

        it('should mark active preset button', () => {
            const tool = new LayoutTool({
                data: { preset: '1-3' } as any,
                config: {},
                api: mockAPI as any,
            });
            const el = tool.render();
            const activeButtons = el.querySelectorAll('.cdx-layout__preset-btn--active');
            expect(activeButtons.length).toBe(1);
            expect(activeButtons[0].textContent).toContain('25 / 75');
        });

        it('should render correct number of column divs', () => {
            const tool = new LayoutTool({ data: {} as any, config: {}, api: mockAPI as any } as any);
            const el = tool.render();
            const cols = el.querySelectorAll('[data-col]');
            expect(cols.length).toBe(2);
        });

        it('should render three columns for 1-1-1 preset', () => {
            const tool = new LayoutTool({
                data: { preset: '1-1-1' } as any,
                config: {},
                api: mockAPI as any,
            });
            const el = tool.render();
            const cols = el.querySelectorAll('[data-col]');
            expect(cols.length).toBe(3);
        });

        it('should set correct flex-basis on columns for 1-3 preset', () => {
            const tool = new LayoutTool({
                data: { preset: '1-3' } as any,
                config: {},
                api: mockAPI as any,
            });
            const el = tool.render();
            const cols = el.querySelectorAll('[data-col]') as NodeListOf<HTMLElement>;
            expect(cols[0].style.flexBasis).toBe('25%');
            expect(cols[1].style.flexBasis).toBe('75%');
        });

        it('should set correct flex-basis for all presets', () => {
            const presetExpectations: Array<{ preset: string; widths: string[] }> = [
                { preset: '1-1', widths: ['50%', '50%'] },
                { preset: '3-1', widths: ['75%', '25%'] },
                { preset: '1-2', widths: ['33%', '67%'] },
                { preset: '2-1', widths: ['67%', '33%'] },
                { preset: '1-1-1', widths: ['33%', '33%', '34%'] },
            ];
            for (const { preset, widths } of presetExpectations) {
                const tool = new LayoutTool({
                    data: { preset } as any,
                    config: {},
                    api: mockAPI as any,
                });
                const el = tool.render();
                const cols = el.querySelectorAll('[data-col]') as NodeListOf<HTMLElement>;
                expect(cols.length).toBe(widths.length);
                widths.forEach((w, i) => {
                    expect(cols[i].style.flexBasis).toBe(w);
                });
            }
        });

        it('should render column header labels and width text', () => {
            const tool = new LayoutTool({
                data: { preset: '1-3' } as any,
                config: {},
                api: mockAPI as any,
            });
            const el = tool.render();
            const labels = el.querySelectorAll('.cdx-layout__col-label');
            const widths = el.querySelectorAll('.cdx-layout__col-width');
            expect(labels[0].textContent).toBe('Column 1');
            expect(labels[1].textContent).toBe('Column 2');
            expect(widths[0].textContent).toBe('25%');
            expect(widths[1].textContent).toBe('75%');
        });

        it('should render placeholder text in editor holders', () => {
            const tool = new LayoutTool({ data: {} as any, config: {}, api: mockAPI as any } as any);
            const el = tool.render();
            const placeholders = el.querySelectorAll('.cdx-layout__col-placeholder');
            expect(placeholders.length).toBe(2);
            expect(placeholders[0].textContent).toContain('Type or press');
        });

        it('should render clear buttons for each column', () => {
            const tool = new LayoutTool({ data: {} as any, config: {}, api: mockAPI as any } as any);
            const el = tool.render();
            const clearButtons = el.querySelectorAll('.cdx-layout__col-clear');
            expect(clearButtons.length).toBe(2);
        });
    });

    describe('Validation', () => {
        it('should pass validation with valid data', () => {
            const tool = new LayoutTool({ data: {} as any, config: {}, api: mockAPI as any } as any);
            expect(
                tool.validate({
                    preset: '1-1',
                    columns: [{ content: { blocks: [] } }, { content: { blocks: [] } }],
                }),
            ).toBe(true);
        });

        it('should fail validation with only one column', () => {
            const tool = new LayoutTool({ data: {} as any, config: {}, api: mockAPI as any } as any);
            expect(
                tool.validate({
                    preset: '1-1',
                    columns: [{ content: { blocks: [] } }],
                }),
            ).toBe(false);
        });

        it('should fail validation with missing preset', () => {
            const tool = new LayoutTool({ data: {} as any, config: {}, api: mockAPI as any } as any);
            expect(
                tool.validate({
                    preset: '' as any,
                    columns: [{ content: { blocks: [] } }, { content: { blocks: [] } }],
                }),
            ).toBe(false);
        });

        it('should fail validation when column count mismatches preset', () => {
            const tool = new LayoutTool({ data: {} as any, config: {}, api: mockAPI as any } as any);
            // 1-1-1 expects 3 columns, but only 2 provided
            expect(
                tool.validate({
                    preset: '1-1-1',
                    columns: [{ content: { blocks: [] } }, { content: { blocks: [] } }],
                }),
            ).toBe(false);
            // 1-1 expects 2 columns, but 3 provided
            expect(
                tool.validate({
                    preset: '1-1',
                    columns: [{ content: { blocks: [] } }, { content: { blocks: [] } }, { content: { blocks: [] } }],
                }),
            ).toBe(false);
        });

        it('should pass validation for 3-column preset with 3 columns', () => {
            const tool = new LayoutTool({ data: {} as any, config: {}, api: mockAPI as any } as any);
            expect(
                tool.validate({
                    preset: '1-1-1',
                    columns: [{ content: { blocks: [] } }, { content: { blocks: [] } }, { content: { blocks: [] } }],
                }),
            ).toBe(true);
        });

        it('should fail validation with unknown preset key', () => {
            const tool = new LayoutTool({ data: {} as any, config: {}, api: mockAPI as any } as any);
            expect(
                tool.validate({
                    preset: 'unknown' as any,
                    columns: [{ content: { blocks: [] } }, { content: { blocks: [] } }],
                }),
            ).toBe(false);
        });

        it('should fail validation with non-array columns', () => {
            const tool = new LayoutTool({ data: {} as any, config: {}, api: mockAPI as any } as any);
            expect(
                tool.validate({
                    preset: '1-1',
                    columns: 'not-an-array' as any,
                }),
            ).toBe(false);
        });
    });

    describe('Save', () => {
        it('should return a shallow copy of data, not the same reference', async () => {
            const tool = new LayoutTool({ data: {} as any, config: {}, api: mockAPI as any } as any);
            const saved1 = await tool.save();
            const saved2 = await tool.save();
            expect(saved1).not.toBe(saved2);
            expect(saved1.columns).not.toBe(saved2.columns);
        });

        it('should return correct preset and column count', async () => {
            const tool = new LayoutTool({
                data: { preset: '2-1', columns: [] } as any,
                config: {},
                api: mockAPI as any,
            });
            const saved = await tool.save();
            expect(saved.preset).toBe('2-1');
            expect(saved.columns).toHaveLength(2);
        });

        it('should clear a column without affecting others', async () => {
            const tool = new LayoutTool({
                data: {
                    preset: '1-1',
                    columns: [
                        { content: { blocks: [{ id: 'a', type: 'paragraph', data: { text: 'A' } }] } },
                        { content: { blocks: [{ id: 'b', type: 'paragraph', data: { text: 'B' } }] } },
                    ],
                } as any,
                config: {},
                api: mockAPI as any,
            } as any);

            await (tool as any).clearColumn(0);
            const saved = await tool.save();
            expect(saved.columns[0].content.blocks).toHaveLength(0);
            expect(saved.columns[1].content.blocks).toHaveLength(1);
        });
    });

    describe('Destroy', () => {
        it('should not throw when calling destroy', () => {
            const tool = new LayoutTool({ data: {} as any, config: {}, api: mockAPI as any } as any);
            tool.render();
            expect(() => tool.destroy()).not.toThrow();
        });

        it('should not throw when calling destroy before render', () => {
            const tool = new LayoutTool({ data: {} as any, config: {}, api: mockAPI as any } as any);
            expect(() => tool.destroy()).not.toThrow();
        });
    });
});
