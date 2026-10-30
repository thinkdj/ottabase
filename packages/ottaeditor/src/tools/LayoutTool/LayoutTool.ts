import EditorJS, {
    type API,
    type BlockTool,
    type BlockToolConstructorOptions,
    type OutputData,
} from '@editorjs/editorjs';
import { officialBlockTools } from '../../official-tools';
import { toolboxEntry } from '../../blocks';
import { h, iconButton, segment } from '../../ui/kit';
import { BlockShell } from '../../ui/shell';
import './LayoutTool.css';

/** Column width preset keys */
export type LayoutPreset = '1-1' | '1-3' | '3-1' | '1-2' | '2-1' | '1-1-1';

interface PresetDef {
    key: LayoutPreset;
    label: string;
    /** Column widths as percentages, must sum to 100 */
    widths: number[];
}

const PRESETS: PresetDef[] = [
    { key: '1-1', label: '50 / 50', widths: [50, 50] },
    { key: '1-3', label: '25 / 75', widths: [25, 75] },
    { key: '3-1', label: '75 / 25', widths: [75, 25] },
    { key: '1-2', label: '33 / 67', widths: [33, 67] },
    { key: '2-1', label: '67 / 33', widths: [67, 33] },
    { key: '1-1-1', label: '33 / 33 / 33', widths: [33, 33, 34] },
];

export interface LayoutColumnData {
    content: OutputData;
}

export interface LayoutData {
    preset: LayoutPreset;
    columns: LayoutColumnData[];
}

export interface LayoutToolConfig {
    /** EditorJS tools to use inside nested column editors */
    tools?: Record<string, unknown>;
}

const PLACEHOLDER = 'Type or press / to add blocks…';

/**
 * Columns block: each column is a full nested Editor.js instance, so the columns themselves are
 * the editing surface. The shell has no preview mode here; the preset switch is a segment.
 */
export default class LayoutTool implements BlockTool {
    private readonly api: API;
    private readonly config: LayoutToolConfig;
    private data: LayoutData;
    private shell: BlockShell | null = null;
    private columnsEl: HTMLElement | null = null;
    /** Nested EditorJS instances keyed by column index */
    private nestedEditors: Map<number, EditorJS> = new Map();
    /** Block ID used to generate unique holder IDs */
    private readonly blockId: string;

    static get toolbox() {
        return toolboxEntry('layout');
    }

    static get enableLineBreaks() {
        return true;
    }

    constructor(options: BlockToolConstructorOptions<LayoutData, LayoutToolConfig>) {
        const { data, config, api, block } = options;
        this.api = api;
        this.config = config || {};
        this.blockId = block?.id || `layout-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const preset: LayoutPreset = data?.preset || '1-1';
        const presetDef = PRESETS.find((p) => p.key === preset) || PRESETS[0];
        this.data = {
            preset: presetDef.key,
            columns: presetDef.widths.map((_, i) => ({ content: data?.columns?.[i]?.content || { blocks: [] } })),
        };
    }

    render(): HTMLElement {
        const shell = new BlockShell({ type: 'layout', previewable: false, summary: this.summary() });
        this.shell = shell;

        const presets = segment<LayoutPreset>({
            value: this.data.preset,
            ariaLabel: 'Column layout',
            options: PRESETS.map((p) => ({ value: p.key, label: p.label })),
            onChange: (key) => void this.switchPreset(key),
        });
        this.columnsEl = h('div', { className: 'oe-layout__columns', dataset: { key: 'columns' } });
        this.buildColumns();

        shell.fields.append(h('div', { className: 'oe-layout__toolbar' }, presets), this.columnsEl);
        requestAnimationFrame(() => this.initNestedEditors());
        return shell.element;
    }

    private summary(): string {
        return PRESETS.find((p) => p.key === this.data.preset)?.label ?? this.data.preset;
    }

    private presetDef(): PresetDef {
        return PRESETS.find((p) => p.key === this.data.preset) || PRESETS[0];
    }

    private buildColumns(): void {
        if (!this.columnsEl) return;
        this.columnsEl.innerHTML = '';
        this.presetDef().widths.forEach((width, idx) => this.columnsEl!.appendChild(this.buildColumn(idx, width)));
    }

    private buildColumn(idx: number, width: number): HTMLElement {
        const header = h(
            'div',
            { className: 'oe-layout__col-header' },
            h('span', { className: 'oe-layout__col-label' }, `Column ${idx + 1}`),
            h(
                'div',
                { className: 'oe-layout__col-meta' },
                h('span', { className: 'oe-layout__col-width' }, `${width}%`),
                iconButton({
                    icon: 'trash',
                    label: `Clear column ${idx + 1}`,
                    danger: true,
                    onClick: () => void this.clearColumn(idx),
                }),
            ),
        );
        const holder = h('div', { className: 'oe-layout__col-editor', id: this.colHolderId(idx) }, this.placeholder());
        const col = h('div', { className: 'oe-layout__column', dataset: { col: String(idx) } }, header, holder);
        col.style.flexBasis = `${width}%`;
        col.style.flexGrow = '0';
        col.style.flexShrink = '0';
        return col;
    }

    private placeholder(): HTMLElement {
        return h('div', { className: 'oe-layout__col-placeholder' }, PLACEHOLDER);
    }

    private colHolderId(idx: number): string {
        return `oe-layout-col-${this.blockId}-${idx}`;
    }

    private async initNestedEditors(): Promise<void> {
        this.destroyNestedEditors();
        const widths = this.presetDef().widths;
        for (let idx = 0; idx < widths.length; idx++) {
            const holderId = this.colHolderId(idx);
            const holderEl = document.getElementById(holderId);
            if (!holderEl) continue;
            holderEl.innerHTML = '';
            try {
                const editor = new EditorJS({
                    holder: holderId,
                    data: this.data.columns[idx]?.content || { blocks: [] },
                    tools: (this.config.tools || LayoutTool.defaultNestedTools()) as never,
                    placeholder: PLACEHOLDER,
                    minHeight: 60,
                    logLevel: 'ERROR' as never,
                });
                await editor.isReady;
                this.nestedEditors.set(idx, editor);
            } catch {
                holderEl.appendChild(this.placeholder());
            }
        }
    }

    /** Tools for a column when the host passes none. Excludes Layout itself: no nesting columns in columns. */
    static defaultNestedTools(): Record<string, unknown> {
        return {
            paragraph: { class: officialBlockTools.Paragraph },
            header: { class: officialBlockTools.Header, config: { levels: [1, 2, 3, 4, 5, 6], defaultLevel: 2 } },
            delimiter: { class: officialBlockTools.Delimiter },
            list: { class: officialBlockTools.NestedList, config: { defaultStyle: 'unordered' } },
            checklist: { class: officialBlockTools.CheckList },
            table: { class: officialBlockTools.Table, config: { rows: 2, cols: 3 } },
        };
    }

    private destroyNestedEditors(): void {
        this.nestedEditors.forEach((editor) => {
            try {
                editor.destroy();
            } catch {
                // ignore errors during cleanup
            }
        });
        this.nestedEditors.clear();
    }

    private async clearColumn(idx: number): Promise<void> {
        if (!this.data.columns[idx]) return;
        this.data.columns[idx] = { content: { blocks: [] } };
        const editor = this.nestedEditors.get(idx) as (EditorJS & { clear?: () => Promise<void> }) | undefined;
        if (editor) {
            try {
                await (editor.clear?.() ?? editor.render?.({ blocks: [] }));
            } catch {
                /* ignore editor clearing errors */
            }
            return;
        }
        const holderEl = document.getElementById(this.colHolderId(idx));
        if (holderEl) {
            holderEl.innerHTML = '';
            holderEl.appendChild(this.placeholder());
        }
    }

    private async switchPreset(preset: LayoutPreset): Promise<void> {
        if (preset === this.data.preset) return;
        await this.collectColumnData();
        const next = PRESETS.find((p) => p.key === preset) || PRESETS[0];
        this.data.preset = next.key;
        this.data.columns = next.widths.map((_, i) => ({ content: this.data.columns[i]?.content || { blocks: [] } }));
        this.shell?.setSummary(this.summary());
        this.buildColumns();
        requestAnimationFrame(() => this.initNestedEditors());
    }

    private async collectColumnData(): Promise<void> {
        const saves: Array<Promise<void>> = [];
        this.nestedEditors.forEach((editor, idx) => {
            saves.push(
                editor
                    .save()
                    .then((outputData) => {
                        if (this.data.columns[idx]) this.data.columns[idx].content = outputData;
                    })
                    .catch(() => {}),
            );
        });
        await Promise.all(saves);
    }

    async save(): Promise<LayoutData> {
        await this.collectColumnData();
        return { ...this.data, columns: this.data.columns.map((c) => ({ ...c })) };
    }

    validate(savedData: LayoutData): boolean {
        const presetDef = PRESETS.find((p) => p.key === savedData.preset);
        return (
            typeof savedData.preset === 'string' &&
            !!presetDef &&
            Array.isArray(savedData.columns) &&
            savedData.columns.length === presetDef.widths.length
        );
    }

    destroy(): void {
        this.destroyNestedEditors();
        this.shell?.destroy();
        this.shell = null;
    }
}
