import type { API, BlockTool, BlockToolConstructorOptions } from '@editorjs/editorjs';
import { toolboxEntry } from '../../blocks';
import { addButton, sortableList, stack, textInput, textarea } from '../../ui/kit';
import { BlockShell } from '../../ui/shell';

export interface StepsItem {
    title: string;
    content: string;
}

export interface StepsData {
    items: StepsItem[];
}

export interface StepsToolConfig {
    titlePlaceholder?: string;
    contentPlaceholder?: string;
    defaultItems?: StepsItem[];
}

/**
 * Steps block: a numbered walkthrough. Edit mode is a sortable list of title + description rows
 * (drag the handle, or use the arrows); preview is the renderer's timeline.
 */
export default class StepsTool implements BlockTool {
    private readonly api: API;
    private readonly config: StepsToolConfig;
    private data: StepsData;
    private shell: BlockShell | null = null;
    private list: ReturnType<typeof sortableList<StepsItem>> | null = null;

    static get toolbox() {
        return toolboxEntry('steps');
    }

    static get enableLineBreaks() {
        return true;
    }

    constructor({ data, config, api }: BlockToolConstructorOptions<Partial<StepsData>, StepsToolConfig>) {
        this.api = api;
        this.config = config || {};
        const initial = this.toEditableItems(data?.items);
        this.data = { items: initial.length ? initial : this.defaultItems() };
    }

    private defaultItems(): StepsItem[] {
        const configured = this.toEditableItems(this.config.defaultItems);
        return configured.length ? configured : [{ title: '', content: '' }];
    }

    private toEditableItems(items?: Array<Partial<StepsItem>>): StepsItem[] {
        return (items || []).map((item) => ({
            title: String(item?.title ?? ''),
            content: String(item?.content ?? ''),
        }));
    }

    render(): HTMLElement {
        const filled = this.savedItems();
        const shell = new BlockShell({ type: 'steps', hasContent: filled.length > 0, summary: this.summary() });
        this.shell = shell;

        this.list = sortableList<StepsItem>({
            items: this.data.items,
            min: 1,
            rowLabel: (_, i) => `step ${i + 1}`,
            confirmRemove: (item) => (item.title || item.content ? 'Remove this step?' : null),
            onChange: () => this.changed(),
            renderRow: (item, { index }) =>
                stack(
                    textInput({
                        value: item.title,
                        placeholder: this.config.titlePlaceholder || 'Step title',
                        ariaLabel: `Step ${index + 1} title`,
                        onInput: (v) => {
                            item.title = v;
                            this.changed();
                        },
                    }),
                    textarea({
                        value: item.content,
                        rows: 2,
                        placeholder: this.config.contentPlaceholder || 'What happens in this step',
                        ariaLabel: `Step ${index + 1} content`,
                        onInput: (v) => {
                            item.content = v;
                            this.changed();
                        },
                    }),
                ),
        });

        const add = addButton('Add step', () => {
            this.data.items.push({ title: '', content: '' });
            this.list?.refresh();
            this.changed();
            const inputs = shell.fields.querySelectorAll<HTMLInputElement>('input');
            inputs[inputs.length - 1]?.focus();
        });

        shell.fields.append(stack(this.list.element, add));
        shell.preview(this.previewData());
        return shell.element;
    }

    private changed() {
        this.shell?.setSummary(this.summary());
        this.shell?.preview(this.previewData());
    }

    private summary(): string {
        const n = this.savedItems().length;
        return n === 0 ? 'empty' : `${n} ${n === 1 ? 'step' : 'steps'}`;
    }

    private previewData(): Record<string, unknown> {
        const items = this.savedItems();
        return { items: items.length ? items : [{ title: 'First step', content: 'Describe it in the fields above.' }] };
    }

    private savedItems(): StepsItem[] {
        return this.data.items
            .map((item) => ({ title: item.title.trim(), content: item.content.trim() }))
            .filter((item) => item.title !== '' || item.content !== '');
    }

    save(): StepsData {
        return { items: this.savedItems() };
    }

    validate(savedData: StepsData): boolean {
        return (
            Array.isArray(savedData.items) && savedData.items.some((item) => item.title.trim() || item.content.trim())
        );
    }

    destroy(): void {
        this.shell?.destroy();
        this.shell = null;
    }
}
