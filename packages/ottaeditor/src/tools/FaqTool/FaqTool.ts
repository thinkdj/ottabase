import type { API, BlockTool, BlockToolConstructorOptions } from '@editorjs/editorjs';
import { toolboxEntry } from '../../blocks';
import { addButton, field, segment, sortableList, stack, textInput, textarea } from '../../ui/kit';
import { BlockShell } from '../../ui/shell';

export interface FaqItem {
    question: string;
    answer: string;
}

export interface FaqData {
    items: FaqItem[];
    /** Display style in the renderer */
    style: 'accordion' | 'flat';
}

export interface FaqToolConfig {
    questionPlaceholder?: string;
    answerPlaceholder?: string;
    defaultStyle?: FaqData['style'];
}

/** FAQ block: a sortable list of question + answer rows; preview is the renderer's accordion. */
export default class FaqTool implements BlockTool {
    private readonly api: API;
    private readonly config: FaqToolConfig;
    private data: FaqData;
    private shell: BlockShell | null = null;
    private list: ReturnType<typeof sortableList<FaqItem>> | null = null;

    static get toolbox() {
        return toolboxEntry('faq');
    }

    static get enableLineBreaks() {
        return true;
    }

    constructor({ data, config, api }: BlockToolConstructorOptions<Partial<FaqData>, FaqToolConfig>) {
        this.api = api;
        this.config = config || {};
        const items = (data?.items ?? [])
            .filter((it): it is FaqItem => typeof it === 'object' && it !== null)
            .map((it) => ({ question: String(it.question ?? ''), answer: String(it.answer ?? '') }));
        this.data = {
            items: items.length ? items : [{ question: '', answer: '' }],
            style: data?.style ?? this.config.defaultStyle ?? 'accordion',
        };
    }

    render(): HTMLElement {
        const shell = new BlockShell({
            type: 'faq',
            hasContent: this.savedItems().length > 0,
            summary: this.summary(),
        });
        this.shell = shell;

        const style = segment<FaqData['style']>({
            value: this.data.style,
            ariaLabel: 'FAQ style',
            options: [
                { value: 'accordion', label: 'Accordion' },
                { value: 'flat', label: 'Flat' },
            ],
            onChange: (v) => {
                this.data.style = v;
                this.changed();
            },
        });

        this.list = sortableList<FaqItem>({
            items: this.data.items,
            min: 1,
            rowLabel: (_, i) => `question ${i + 1}`,
            confirmRemove: (item) => (item.question || item.answer ? 'Remove this question?' : null),
            onChange: () => this.changed(),
            renderRow: (item, { index }) =>
                stack(
                    textInput({
                        value: item.question,
                        placeholder: this.config.questionPlaceholder ?? 'Question',
                        ariaLabel: `Question ${index + 1}`,
                        onInput: (v) => {
                            item.question = v;
                            this.changed();
                        },
                    }),
                    textarea({
                        value: item.answer,
                        rows: 2,
                        placeholder: this.config.answerPlaceholder ?? 'Answer',
                        ariaLabel: `Answer ${index + 1}`,
                        onInput: (v) => {
                            item.answer = v;
                            this.changed();
                        },
                    }),
                ),
        });

        const add = addButton('Add question', () => {
            this.data.items.push({ question: '', answer: '' });
            this.list?.refresh();
            this.changed();
            const inputs = shell.fields.querySelectorAll<HTMLInputElement>('input');
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
        const n = this.savedItems().length;
        const style = this.data.style === 'flat' ? 'flat' : 'accordion';
        return n === 0 ? style : `${n} ${n === 1 ? 'question' : 'questions'} · ${style}`;
    }

    private previewData(): Record<string, unknown> {
        const items = this.savedItems();
        return {
            style: this.data.style,
            items: items.length ? items : [{ question: 'Your first question', answer: 'Fill in the fields above.' }],
        };
    }

    private savedItems(): FaqItem[] {
        return this.data.items
            .map((item) => ({ question: item.question.trim(), answer: item.answer.trim() }))
            .filter((item) => item.question !== '' || item.answer !== '');
    }

    save(): FaqData {
        return { style: this.data.style, items: this.savedItems() };
    }

    validate(data: FaqData): boolean {
        return Array.isArray(data.items) && data.items.some((it) => it.question.trim() !== '');
    }

    destroy(): void {
        this.shell?.destroy();
        this.shell = null;
    }
}
