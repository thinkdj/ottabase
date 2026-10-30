import type { API, BlockTool, BlockToolConstructorOptions } from '@editorjs/editorjs';
import { toolboxEntry } from '../../blocks';
import { addButton, field, row, segment, sortableList, stack, textInput } from '../../ui/kit';
import { BlockShell } from '../../ui/shell';

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

function generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const emptyItem = (): ReferenceItem => ({
    id: generateId(),
    url: '',
    title: '',
    authors: '',
    year: '',
    accessedDate: '',
    note: '',
});

/** References block: a sortable list of sources; preview is the renderer's bibliography. */
export default class ReferencesTool implements BlockTool {
    private readonly api: API;
    private readonly config: ReferencesToolConfig;
    private data: ReferencesData;
    private shell: BlockShell | null = null;
    private list: ReturnType<typeof sortableList<ReferenceItem>> | null = null;

    static get toolbox() {
        return toolboxEntry('references');
    }

    static get enableLineBreaks() {
        return true;
    }

    constructor({ data, config, api }: BlockToolConstructorOptions<Partial<ReferencesData>, ReferencesToolConfig>) {
        this.api = api;
        this.config = config || {};
        const items = (data?.items ?? [])
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
            items: items.length ? items : [emptyItem()],
            style: data?.style ?? this.config.defaultStyle ?? 'numbered',
        };
    }

    render(): HTMLElement {
        const shell = new BlockShell({
            type: 'references',
            hasContent: this.save().items.length > 0,
            summary: this.summary(),
        });
        this.shell = shell;

        const style = segment<NonNullable<ReferencesData['style']>>({
            value: this.data.style ?? 'numbered',
            ariaLabel: 'References style',
            options: [
                { value: 'numbered', label: 'Numbered' },
                { value: 'footnote', label: 'Footnotes' },
            ],
            onChange: (v) => {
                this.data.style = v;
                this.changed();
            },
        });

        const input = (
            item: ReferenceItem,
            key: Exclude<keyof ReferenceItem, 'id'>,
            label: string,
            placeholder: string,
            index: number,
            type: 'text' | 'url' = 'text',
        ) =>
            textInput({
                value: item[key] ?? '',
                placeholder,
                type,
                ariaLabel: `${label} ${index + 1}`,
                onInput: (v) => {
                    item[key] = v;
                    this.changed();
                },
            });

        this.list = sortableList<ReferenceItem>({
            items: this.data.items,
            min: 1,
            rowLabel: (_, i) => `reference ${i + 1}`,
            confirmRemove: (item) => (item.url || item.title ? 'Remove this reference?' : null),
            onChange: () => this.changed(),
            renderRow: (item, { index }) =>
                stack(
                    row(
                        field({
                            label: 'URL',
                            control: input(item, 'url', 'URL', 'https://example.com/article', index, 'url'),
                            grow: true,
                        }),
                        field({
                            label: 'Title',
                            control: input(item, 'title', 'Title', 'Page or article title', index),
                            grow: true,
                        }),
                    ),
                    row(
                        field({
                            label: 'Authors',
                            control: input(item, 'authors', 'Authors', 'Author name(s)', index),
                        }),
                        field({ label: 'Year', control: input(item, 'year', 'Year', '2024', index) }),
                        field({
                            label: 'Accessed',
                            control: input(item, 'accessedDate', 'Accessed', 'YYYY-MM-DD', index),
                        }),
                    ),
                    field({ label: 'Note', control: input(item, 'note', 'Note', 'Optional annotation', index) }),
                ),
        });

        const add = addButton('Add reference', () => {
            this.data.items.push(emptyItem());
            this.list?.refresh();
            this.changed();
            const inputs = shell.fields.querySelectorAll<HTMLInputElement>('input[type=url]');
            inputs[inputs.length - 1]?.focus();
        });

        shell.fields.append(stack(field({ label: 'Style', control: style }), this.list.element, add));
        shell.preview(this.previewData());
        return shell.element;
    }

    private changed() {
        this.shell?.setSummary(this.summary());
        this.shell?.preview(this.previewData());
    }

    private summary(): string {
        const n = this.save().items.length;
        const style = this.data.style === 'footnote' ? 'footnotes' : 'numbered';
        return n === 0 ? style : `${n} ${n === 1 ? 'source' : 'sources'} · ${style}`;
    }

    private previewData(): Record<string, unknown> {
        const saved = this.save();
        return saved.items.length
            ? { ...saved }
            : { style: saved.style, items: [{ id: 'x', url: 'https://example.com', title: 'Your first source' }] };
    }

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
                .filter((item) => item.url !== ''),
        };
    }

    validate(data: ReferencesData): boolean {
        return Array.isArray(data.items) && data.items.length > 0 && data.items.some((it) => it.url.trim() !== '');
    }

    destroy(): void {
        this.shell?.destroy();
        this.shell = null;
    }
}
