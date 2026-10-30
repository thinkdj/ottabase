import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { API } from '@editorjs/editorjs';
import LayoutTool, { type LayoutData } from './LayoutTool';

vi.mock('./LayoutTool.css', () => ({}));

// Nested editors are mocked: the unit tests cover the block's own DOM and data handling
vi.mock('@editorjs/editorjs', () => ({
    default: vi.fn().mockImplementation(() => ({
        isReady: Promise.resolve(),
        save: vi.fn().mockResolvedValue({ blocks: [] }),
        destroy: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
        render: vi.fn().mockResolvedValue(undefined),
    })),
}));
vi.mock('@editorjs/paragraph', () => ({ default: class {} }));
vi.mock('@editorjs/header', () => ({ default: class {} }));
vi.mock('@editorjs/delimiter', () => ({ default: class {} }));
vi.mock('@editorjs/nested-list', () => ({ default: class {} }));
vi.mock('@editorjs/checklist', () => ({ default: class {} }));
vi.mock('@editorjs/table', () => ({ default: class {} }));

const tools: LayoutTool[] = [];

function create(data: Partial<LayoutData> = {}) {
    const tool = new LayoutTool({
        data: data as LayoutData,
        config: {},
        api: {} as API,
        block: {} as never,
        readOnly: false,
    });
    tools.push(tool);
    return tool;
}

function mount(data: Partial<LayoutData> = {}) {
    const tool = create(data);
    const element = tool.render();
    document.body.appendChild(element);
    return { tool, element };
}

beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
});

afterEach(() => {
    tools.splice(0).forEach((t) => t.destroy());
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

describe('LayoutTool', () => {
    it('takes its toolbox entry from the registry', () => {
        expect(LayoutTool.toolbox.title).toBe('Columns');
        expect(LayoutTool.enableLineBreaks).toBe(true);
    });

    it('initialises presets and column counts, falling back to 50 / 50', async () => {
        expect(await create().save()).toMatchObject({ preset: '1-1', columns: [{}, {}] });
        expect(await create({ preset: '1-3', columns: [] }).save()).toMatchObject({ preset: '1-3' });
        expect((await create({ preset: '1-1-1', columns: [] }).save()).columns).toHaveLength(3);
        expect(
            mount({ preset: 'invalid-key' as LayoutPreset, columns: [] }).element.querySelectorAll('[data-col]').length,
        ).toBe(2);
    });

    it('renders the preset segment, headers, widths and clear buttons', () => {
        const { element } = mount({ preset: '1-3' } as LayoutData);
        expect(element.dataset.mode).toBe('edit');
        const presets = within(screen.getByRole('radiogroup', { name: 'Column layout' })).getAllByRole('radio');
        expect(presets).toHaveLength(6);
        expect(screen.getByRole('radio', { name: '25 / 75' }).getAttribute('aria-checked')).toBe('true');
        const cols = element.querySelectorAll<HTMLElement>('[data-col]');
        expect(cols[0].style.flexBasis).toBe('25%');
        expect(cols[1].style.flexBasis).toBe('75%');
        expect([...element.querySelectorAll('.oe-layout__col-label')].map((l) => l.textContent)).toEqual([
            'Column 1',
            'Column 2',
        ]);
        expect([...element.querySelectorAll('.oe-layout__col-width')].map((l) => l.textContent)).toEqual([
            '25%',
            '75%',
        ]);
        expect(screen.getAllByRole('button', { name: /clear column/i })).toHaveLength(2);
        expect(element.querySelectorAll('.oe-layout__col-placeholder')).toHaveLength(2);
    });

    it('sets widths for every preset', () => {
        const cases: Array<[LayoutPreset, string[]]> = [
            ['1-1', ['50%', '50%']],
            ['3-1', ['75%', '25%']],
            ['1-2', ['33%', '67%']],
            ['2-1', ['67%', '33%']],
            ['1-1-1', ['33%', '33%', '34%']],
        ];
        for (const [preset, widths] of cases) {
            const { element } = mount({ preset } as LayoutData);
            expect([...element.querySelectorAll<HTMLElement>('[data-col]')].map((c) => c.style.flexBasis)).toEqual(
                widths,
            );
            document.body.innerHTML = '';
        }
    });

    it('validates preset and column count', () => {
        const tool = create();
        const col = { content: { blocks: [] } };
        expect(tool.validate({ preset: '1-1', columns: [col, col] })).toBe(true);
        expect(tool.validate({ preset: '1-1', columns: [col] })).toBe(false);
        expect(tool.validate({ preset: '' as LayoutPreset, columns: [col, col] })).toBe(false);
        expect(tool.validate({ preset: '1-1-1', columns: [col, col] })).toBe(false);
        expect(tool.validate({ preset: '1-1-1', columns: [col, col, col] })).toBe(true);
        expect(tool.validate({ preset: 'unknown' as LayoutPreset, columns: [col, col] })).toBe(false);
        expect(tool.validate({ preset: '1-1', columns: 'not-an-array' as unknown as [] })).toBe(false);
    });

    it('saves a copy and clears one column without touching the other', async () => {
        const tool = create({
            preset: '1-1',
            columns: [
                { content: { blocks: [{ id: 'a', type: 'paragraph', data: { text: 'A' } }] } },
                { content: { blocks: [{ id: 'b', type: 'paragraph', data: { text: 'B' } }] } },
            ],
        });
        const first = await tool.save();
        expect(first).not.toBe(await tool.save());
        await (tool as unknown as { clearColumn: (i: number) => Promise<void> }).clearColumn(0);
        const saved = await tool.save();
        expect(saved.columns[0].content.blocks).toHaveLength(0);
        expect(saved.columns[1].content.blocks).toHaveLength(1);
    });

    it('exposes a nested tool set without the layout itself', () => {
        expect(Object.keys(LayoutTool.defaultNestedTools())).toEqual([
            'paragraph',
            'header',
            'delimiter',
            'list',
            'checklist',
            'table',
        ]);
    });

    it('destroys cleanly before and after render', () => {
        expect(() => create().destroy()).not.toThrow();
        const { tool } = mount();
        expect(() => tool.destroy()).not.toThrow();
    });
});

type LayoutPreset = LayoutData['preset'];
