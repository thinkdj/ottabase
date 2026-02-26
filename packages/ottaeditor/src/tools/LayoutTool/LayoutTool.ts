import EditorJS, {
    type API,
    type BlockTool,
    type BlockToolConstructorOptions,
    type OutputData,
} from '@editorjs/editorjs';
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
    tools?: Record<string, any>;
}

// Tabler icon: columns (layout-columns feel)
const TOOLBOX_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(3 3)"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/></g></svg>';

// Tabler icon: trash (clear column)
const TRASH_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

/**
 * LayoutTool – multi-column layout where each column contains a full
 * nested EditorJS instance. Supports presets 50/50, 25/75, 75/25,
 * 33/67, 67/33, and three equal columns.
 */
export default class LayoutTool implements BlockTool {
    private api: API;
    private data: LayoutData;
    private config: LayoutToolConfig;
    private wrapper: HTMLElement | null = null;
    /** Nested EditorJS instances keyed by column index */
    private nestedEditors: Map<number, EditorJS> = new Map();
    /** Block ID used to generate unique holder IDs */
    private blockId: string;

    static get CSS() {
        return {
            baseClass: 'cdx-layout',
            wrapper: 'cdx-layout__wrapper',
            toolbar: 'cdx-layout__toolbar',
            toolbarLabel: 'cdx-layout__toolbar-label',
            presetBtn: 'cdx-layout__preset-btn',
            presetBtnActive: 'cdx-layout__preset-btn--active',
            presetIcon: 'cdx-layout__preset-icon',
            columns: 'cdx-layout__columns',
            column: 'cdx-layout__column',
            colHeader: 'cdx-layout__col-header',
            colLabel: 'cdx-layout__col-label',
            colWidth: 'cdx-layout__col-width',
            colMeta: 'cdx-layout__col-meta',
            colClearBtn: 'cdx-layout__col-clear',
            colEditor: 'cdx-layout__col-editor',
            colPlaceholder: 'cdx-layout__col-placeholder',
        };
    }

    static get toolbox() {
        return {
            title: 'Layout',
            icon: TOOLBOX_ICON,
        };
    }

    static get enableLineBreaks() {
        return true;
    }

    constructor(options: BlockToolConstructorOptions<LayoutData, LayoutToolConfig>) {
        const { data, config, api } = options;
        const block = (options as any).block;
        this.api = api;
        this.config = config || {};
        this.blockId = block?.id || `layout-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const defaultPreset: LayoutPreset = '1-1';
        const preset: LayoutPreset = data?.preset || defaultPreset;
        const presetDef = PRESETS.find((p) => p.key === preset) || PRESETS[0];
        const columnCount = presetDef.widths.length;

        const columns: LayoutColumnData[] = [];
        for (let i = 0; i < columnCount; i++) {
            columns.push({
                content: data?.columns?.[i]?.content || { blocks: [] },
            });
        }

        this.data = { preset, columns };
    }

    render(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.classList.add(LayoutTool.CSS.baseClass, LayoutTool.CSS.wrapper);

        wrapper.appendChild(this.buildToolbar());
        wrapper.appendChild(this.buildColumns());

        this.wrapper = wrapper;

        requestAnimationFrame(() => this.initNestedEditors());

        return wrapper;
    }

    private buildToolbar(): HTMLElement {
        const toolbar = document.createElement('div');
        toolbar.classList.add(LayoutTool.CSS.toolbar);

        const label = document.createElement('span');
        label.classList.add(LayoutTool.CSS.toolbarLabel);
        label.textContent = 'Layout';
        toolbar.appendChild(label);

        PRESETS.forEach((preset) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.classList.add(LayoutTool.CSS.presetBtn);
            btn.title = preset.label;
            if (preset.key === this.data.preset) {
                btn.classList.add(LayoutTool.CSS.presetBtnActive);
            }

            btn.appendChild(this.buildPresetIcon(preset.widths));

            const btnLabel = document.createElement('span');
            btnLabel.textContent = preset.label;
            btn.appendChild(btnLabel);

            btn.addEventListener('click', () => this.switchPreset(preset.key));
            toolbar.appendChild(btn);
        });

        return toolbar;
    }

    private buildPresetIcon(widths: number[]): HTMLElement {
        const icon = document.createElement('span');
        icon.classList.add(LayoutTool.CSS.presetIcon);
        icon.setAttribute('aria-hidden', 'true');
        const total = widths.reduce((s, w) => s + w, 0);
        widths.forEach((w) => {
            const bar = document.createElement('span');
            bar.style.width = `${Math.round((w / total) * 20)}px`;
            icon.appendChild(bar);
        });
        return icon;
    }

    private buildColumns(): HTMLElement {
        const columnsEl = document.createElement('div');
        columnsEl.classList.add(LayoutTool.CSS.columns);
        columnsEl.setAttribute('data-key', 'columns');

        const presetDef = PRESETS.find((p) => p.key === this.data.preset) || PRESETS[0];

        presetDef.widths.forEach((width, idx) => {
            columnsEl.appendChild(this.buildColumn(idx, width));
        });

        return columnsEl;
    }

    private buildColumn(idx: number, width: number): HTMLElement {
        const col = document.createElement('div');
        col.classList.add(LayoutTool.CSS.column);
        col.style.flexBasis = `${width}%`;
        col.style.flexGrow = '0';
        col.style.flexShrink = '0';
        col.setAttribute('data-col', String(idx));

        const header = document.createElement('div');
        header.classList.add(LayoutTool.CSS.colHeader);

        const colLabel = document.createElement('span');
        colLabel.classList.add(LayoutTool.CSS.colLabel);
        colLabel.textContent = `Column ${idx + 1}`;

        const colMeta = document.createElement('div');
        colMeta.classList.add(LayoutTool.CSS.colMeta);

        const colWidth = document.createElement('span');
        colWidth.classList.add(LayoutTool.CSS.colWidth);
        colWidth.textContent = `${width}%`;
        colMeta.appendChild(colWidth);

        // Clear button with trash icon
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.classList.add(LayoutTool.CSS.colClearBtn);
        clearBtn.title = 'Clear column';
        clearBtn.setAttribute('aria-label', `Clear column ${idx + 1}`);
        clearBtn.innerHTML = TRASH_ICON;
        clearBtn.addEventListener('click', () => this.clearColumn(idx));
        colMeta.appendChild(clearBtn);

        header.appendChild(colLabel);
        header.appendChild(colMeta);
        col.appendChild(header);

        const editorHolder = document.createElement('div');
        editorHolder.classList.add(LayoutTool.CSS.colEditor);
        editorHolder.id = this.colHolderId(idx);

        const placeholder = document.createElement('div');
        placeholder.classList.add(LayoutTool.CSS.colPlaceholder);
        placeholder.textContent = 'Type or press / to add blocks…';
        editorHolder.appendChild(placeholder);

        col.appendChild(editorHolder);
        return col;
    }

    private colHolderId(idx: number): string {
        return `cdx-layout-col-${this.blockId}-${idx}`;
    }

    private async initNestedEditors(): Promise<void> {
        this.destroyNestedEditors();

        const presetDef = PRESETS.find((p) => p.key === this.data.preset) || PRESETS[0];

        for (let idx = 0; idx < presetDef.widths.length; idx++) {
            const holderId = this.colHolderId(idx);
            const holderEl = document.getElementById(holderId);
            if (!holderEl) continue;

            holderEl.innerHTML = '';

            const colData = this.data.columns[idx]?.content || { blocks: [] };

            try {
                const editor = new EditorJS({
                    holder: holderId,
                    data: colData,
                    tools: this.config.tools || this.buildDefaultTools(),
                    placeholder: 'Type or press / to add blocks…',
                    minHeight: 60,
                    logLevel: 'ERROR' as any,
                });

                await editor.isReady;
                this.nestedEditors.set(idx, editor);
            } catch {
                if (holderEl) {
                    const ph = document.createElement('div');
                    ph.classList.add(LayoutTool.CSS.colPlaceholder);
                    ph.textContent = 'Type or press / to add blocks…';
                    holderEl.appendChild(ph);
                }
            }
        }
    }

    /**
     * Default tools for nested editors.
     * Excludes Layout to prevent infinite nesting.
     */
    private buildDefaultTools(): Record<string, any> {
        const tools: Record<string, any> = {};
        const toolImports: Array<{ name: string; module: string; config?: Record<string, any> }> = [
            { name: 'paragraph', module: '@editorjs/paragraph' },
            { name: 'header', module: '@editorjs/header', config: { levels: [1, 2, 3, 4, 5, 6], defaultLevel: 2 } },
            { name: 'delimiter', module: '@editorjs/delimiter' },
            { name: 'list', module: '@editorjs/nested-list', config: { defaultStyle: 'unordered' } },
            { name: 'checklist', module: '@editorjs/checklist' },
            { name: 'table', module: '@editorjs/table', config: { rows: 2, cols: 3 } },
        ];

        for (const { name, module, config } of toolImports) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const Tool = require(module).default || require(module);
                tools[name] = config ? { class: Tool, config } : { class: Tool };
            } catch {
                // Tool not available – skip silently
            }
        }

        return tools;
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

        const editor = this.nestedEditors.get(idx) as any;
        if (editor) {
            try {
                await (editor.clear?.() ?? editor.render?.({ blocks: [] }));
            } catch {
                /* ignore editor clearing errors */
            }
        }

        const holderEl = document.getElementById(this.colHolderId(idx));
        if (holderEl && !editor) {
            holderEl.innerHTML = '';
            const placeholder = document.createElement('div');
            placeholder.classList.add(LayoutTool.CSS.colPlaceholder);
            placeholder.textContent = 'Type or press / to add blocks…';
            holderEl.appendChild(placeholder);
        }
    }

    private async switchPreset(preset: LayoutPreset): Promise<void> {
        if (preset === this.data.preset) return;

        await this.collectColumnData();

        const newPresetDef = PRESETS.find((p) => p.key === preset) || PRESETS[0];
        const newColumnCount = newPresetDef.widths.length;

        const newColumns: LayoutColumnData[] = [];
        for (let i = 0; i < newColumnCount; i++) {
            newColumns.push({
                content: this.data.columns[i]?.content || { blocks: [] },
            });
        }

        this.data.preset = preset;
        this.data.columns = newColumns;

        if (this.wrapper) {
            this.wrapper.querySelectorAll(`.${LayoutTool.CSS.presetBtn}`).forEach((btn, i) => {
                btn.classList.toggle(LayoutTool.CSS.presetBtnActive, PRESETS[i]?.key === preset);
            });
        }

        const columnsEl = this.wrapper?.querySelector('[data-key="columns"]') as HTMLElement | null;
        if (columnsEl) {
            columnsEl.innerHTML = '';
            newPresetDef.widths.forEach((width, idx) => {
                columnsEl.appendChild(this.buildColumn(idx, width));
            });
        }

        requestAnimationFrame(() => this.initNestedEditors());
    }

    private async collectColumnData(): Promise<void> {
        const savePromises: Array<Promise<void>> = [];
        this.nestedEditors.forEach((editor, idx) => {
            savePromises.push(
                editor
                    .save()
                    .then((outputData) => {
                        if (this.data.columns[idx]) {
                            this.data.columns[idx].content = outputData;
                        }
                    })
                    .catch(() => {}),
            );
        });
        await Promise.all(savePromises);
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
    }
}
