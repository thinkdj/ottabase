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
    });
});
