import type { API, BlockTool } from '@editorjs/editorjs';
import './ReferencesTool.css';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ReferenceItem {
    /** Local uuid for keying list items */
    id: string;
    url: string;
    title?: string;
    authors?: string;
    /** 4-digit publication year */
    year?: string;
    /** Date accessed (for web sources) */
    accessedDate?: string;
    /** Optional annotation */
    note?: string;
}

export interface ReferencesData {
    items: ReferenceItem[];
    /** Display style used by the renderer; default 'numbered' */
    style?: 'numbered' | 'footnote';
}

export interface ReferencesToolConfig {
    defaultStyle?: ReferencesData['style'];
}

// ─── SVG icons ──────────────────────────────────────────────────────────────

const PLUS_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';

const REFERENCES_TOOLBOX_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function makeEmptyItem(): ReferenceItem {
    return { id: generateId(), url: '', title: '', authors: '', year: '', accessedDate: '', note: '' };
}

// ─── Tool ───────────────────────────────────────────────────────────────────

export default class ReferencesTool implements BlockTool {
    private api: API;
    private data: ReferencesData;
    private config: ReferencesToolConfig;
    private wrapper: HTMLElement | null = null;
    private listEl: HTMLElement | null = null;

    // ── Static EditorJS metadata ────────────────────────────────────────────

    static get toolbox() {
        return {
            title: 'References',
            icon: REFERENCES_TOOLBOX_ICON,
        };
    }

    static get enableLineBreaks() {
        return true;
    }

    // ── Constructor ─────────────────────────────────────────────────────────

    constructor({ data, config, api }: { data?: Partial<ReferencesData>; config?: ReferencesToolConfig; api: API }) {
        this.api = api;
        this.config = config || {};

        const rawItems = data?.items ?? [];
        const validItems = rawItems
            .filter((it): it is ReferenceItem => typeof it === 'object' && it !== null && 'url' in it)
            .map((it) => ({
                id: String(it.id ?? generateId()),
                url: String(it.url ?? ''),
                title: String(it.title ?? ''),
                authors: String(it.authors ?? ''),
                year: String(it.year ?? ''),
                accessedDate: String(it.accessedDate ?? ''),
                note: String(it.note ?? ''),
            }));

        this.data = {
            items: validItems.length ? validItems : [makeEmptyItem()],
            style: data?.style ?? this.config.defaultStyle ?? 'numbered',
        };
    }

    // ── render ──────────────────────────────────────────────────────────────

    render(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.classList.add('cdx-references__wrapper', 'ob-plugin');

        wrapper.appendChild(this.createToolbar());

        const list = document.createElement('div');
        list.classList.add('cdx-references__list');
        this.listEl = list;
        wrapper.appendChild(list);

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.classList.add('cdx-references__add-btn', 'ob-button');
        addBtn.innerHTML = `${PLUS_ICON}<span>Add Reference</span>`;
        addBtn.setAttribute('aria-label', 'Add a new reference');
        addBtn.addEventListener('click', () => {
            this.data.items.push(makeEmptyItem());
            this.renderItems();
            // Focus the URL input of the new item
            const urlInputs = this.listEl?.querySelectorAll<HTMLInputElement>('.cdx-references__url-input');
            urlInputs?.[urlInputs.length - 1]?.focus();
        });
        wrapper.appendChild(addBtn);

        this.wrapper = wrapper;
        this.renderItems();

        return wrapper;
    }

    // ── Toolbar (label + style selector) ────────────────────────────────────

    private createToolbar(): HTMLElement {
        const toolbar = document.createElement('div');
        toolbar.classList.add('cdx-references__toolbar');

        const label = document.createElement('span');
        label.classList.add('ob-section-label');
        label.textContent = 'References';
        toolbar.appendChild(label);

        const styleGroup = document.createElement('div');
        styleGroup.classList.add('cdx-references__style-group');

        const styleLabel = document.createElement('span');
        styleLabel.classList.add('ob-label', 'cdx-references__style-label');
        styleLabel.textContent = 'Style:';
        styleGroup.appendChild(styleLabel);

        const styleSelect = document.createElement('select');
        styleSelect.classList.add('ob-select');
        styleSelect.title = 'Display style';

        const options: { value: ReferencesData['style']; label: string }[] = [
            { value: 'numbered', label: 'Numbered [1], [2]…' },
            { value: 'footnote', label: 'Footnote ¹, ²…' },
        ];
        options.forEach(({ value, label }) => {
            const opt = document.createElement('option');
            opt.value = value!;
            opt.textContent = label;
            opt.selected = value === this.data.style;
            styleSelect.appendChild(opt);
        });
        styleSelect.addEventListener('change', () => {
            this.data.style = styleSelect.value as ReferencesData['style'];
        });
        styleGroup.appendChild(styleSelect);
        toolbar.appendChild(styleGroup);

        return toolbar;
    }

    // ── Item list rendering ──────────────────────────────────────────────────

    private renderItems(): void {
        if (!this.listEl) return;
        this.listEl.innerHTML = '';

        if (this.data.items.length === 0) {
            const empty = document.createElement('div');
            empty.classList.add('cdx-references__empty');
            empty.textContent = 'No references yet. Click "Add Reference" below.';
            this.listEl.appendChild(empty);
            return;
        }

        this.data.items.forEach((_, index) => {
            this.listEl!.appendChild(this.createItemEl(index));
        });
    }

    private createItemEl(index: number): HTMLElement {
        const item = this.data.items[index];

        const row = document.createElement('div');
        row.classList.add('cdx-references__item');
        row.dataset.index = String(index);

        // ── Drag handle (⠿) ──────────────────────────────────────────────
        const drag = document.createElement('div');
        drag.classList.add('cdx-references__drag-handle');
        drag.textContent = '⠿';
        drag.title = 'Drag to reorder';
        drag.draggable = true;

        drag.addEventListener('dragstart', (e) => {
            e.dataTransfer?.setData('text/plain', String(index));
            row.style.opacity = '0.5';
        });
        drag.addEventListener('dragend', () => {
            row.style.opacity = '';
        });

        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            row.style.borderTop = '2px solid hsl(var(--primary))';
        });
        row.addEventListener('dragleave', () => {
            row.style.borderTop = '';
        });
        row.addEventListener('drop', (e) => {
            e.preventDefault();
            row.style.borderTop = '';
            const fromIndex = parseInt(e.dataTransfer?.getData('text/plain') ?? '-1', 10);
            if (fromIndex === index || fromIndex < 0) return;
            const [moved] = this.data.items.splice(fromIndex, 1);
            const toIndex = fromIndex < index ? index - 1 : index;
            this.data.items.splice(toIndex, 0, moved);
            this.renderItems();
        });

        row.appendChild(drag);

        // ── Card ────────────────────────────────────────────────────────────
        const card = document.createElement('div');
        card.classList.add('cdx-references__card', 'ob-form');

        // Header: number badge + delete button
        const header = document.createElement('div');
        header.classList.add('cdx-references__item-header');

        const badge = document.createElement('div');
        badge.classList.add('cdx-references__number');
        badge.textContent = String(index + 1);

        const del = document.createElement('button');
        del.type = 'button';
        del.classList.add('cdx-references__delete');
        del.textContent = '×';
        del.title = 'Remove reference';
        del.setAttribute('aria-label', 'Remove this reference');
        del.addEventListener('click', () => {
            if (this.data.items.length === 1) {
                // Reset to empty rather than leaving zero items
                this.data.items[0] = makeEmptyItem();
                this.renderItems();
                return;
            }
            this.data.items.splice(index, 1);
            this.renderItems();
        });

        header.appendChild(badge);
        header.appendChild(del);
        card.appendChild(header);

        // Fields grid
        const fields = document.createElement('div');
        fields.classList.add('cdx-references__fields');

        // URL (full width)
        fields.appendChild(
            this.createField('URL *', 'url', 'https://example.com/article', item.url, true, (v) => {
                this.data.items[index].url = v;
            }),
        );

        // Title (full width)
        fields.appendChild(
            this.createField('Title', 'title', 'Page or article title', item.title ?? '', true, (v) => {
                this.data.items[index].title = v;
            }),
        );

        // Authors (half)
        fields.appendChild(
            this.createField('Authors', 'authors', 'Author name(s)', item.authors ?? '', false, (v) => {
                this.data.items[index].authors = v;
            }),
        );

        // Year (half)
        fields.appendChild(
            this.createField('Year', 'year', '2024', item.year ?? '', false, (v) => {
                this.data.items[index].year = v;
            }),
        );

        // Accessed Date (half)
        fields.appendChild(
            this.createField('Accessed', 'accessedDate', 'YYYY-MM-DD', item.accessedDate ?? '', false, (v) => {
                this.data.items[index].accessedDate = v;
            }),
        );

        // Note (full width)
        fields.appendChild(
            this.createField('Note', 'note', 'Optional annotation…', item.note ?? '', true, (v) => {
                this.data.items[index].note = v;
            }),
        );

        card.appendChild(fields);
        row.appendChild(card);

        return row;
    }

    /**
     * Creates a labelled text input group.
     * @param label  Field label
     * @param cssKey Key used for the input's CSS class suffix (e.g. "url" → cdx-references__url-input)
     * @param placeholder Placeholder text
     * @param value  Initial value
     * @param wide   Whether the field spans full width
     * @param onChange  Callback when input changes
     */
    private createField(
        label: string,
        cssKey: string,
        placeholder: string,
        value: string,
        wide: boolean,
        onChange: (v: string) => void,
    ): HTMLElement {
        const group = document.createElement('div');
        group.classList.add('ob-input-group', wide ? 'ob-input-group--wide' : 'ob-input-group--narrow');

        const lbl = document.createElement('label');
        lbl.classList.add('ob-label');
        lbl.textContent = label;

        const input = document.createElement('input');
        input.type = 'text';
        input.classList.add('ob-input', `cdx-references__${cssKey}-input`);
        input.placeholder = placeholder;
        input.value = value;
        input.addEventListener('input', () => onChange(input.value));

        group.appendChild(lbl);
        group.appendChild(input);
        return group;
    }

    // ── save ─────────────────────────────────────────────────────────────────

    save(): ReferencesData {
        return {
            style: this.data.style,
            items: this.data.items
                .map((item) => ({
                    id: item.id,
                    url: item.url.trim(),
                    title: item.title?.trim() || undefined,
                    authors: item.authors?.trim() || undefined,
                    year: item.year?.trim() || undefined,
                    accessedDate: item.accessedDate?.trim() || undefined,
                    note: item.note?.trim() || undefined,
                }))
                // Only keep items that have at least a URL
                .filter((item) => item.url !== ''),
        };
    }

    // ── validate ─────────────────────────────────────────────────────────────

    validate(data: ReferencesData): boolean {
        return Array.isArray(data.items) && data.items.length > 0 && data.items.some((it) => it.url.trim() !== '');
    }
}
