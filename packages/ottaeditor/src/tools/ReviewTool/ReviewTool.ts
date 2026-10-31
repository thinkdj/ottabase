import type { API, BlockTool, BlockToolConstructorOptions } from '@editorjs/editorjs';
import type { FileSource } from '@ottabase/utils/media';
import { toolboxEntry } from '../../blocks';
import './ReviewTool.css';
import {
    addButton,
    checkbox,
    field,
    h,
    mediaInput,
    row,
    sectionLabel,
    select,
    sortableList,
    stack,
    stars,
    textInput,
    textarea,
    toggle,
} from '../../ui/kit';
import { BlockShell } from '../../ui/shell';

export interface ReviewToolConfig {
    maxStars?: 5 | 10;
    allowHalfStars?: boolean;
}

export interface ReviewData {
    /** A stored file, or an outside address */
    image?: FileSource;
    title?: string;
    content?: string;
    linkUrl?: string;
    linkLabel?: string;
    pros?: string[];
    cons?: string[];
    rating?: number;
    maxStars?: 5 | 10;
    allowHalfStars?: boolean;
    summary?: string;
    compact?: boolean;
}

/** A pro or con; wrapped so the sortable list can hold a reference to it */
interface Point {
    text: string;
}

/**
 * Review block: title, image, body, link, rating, pros and cons, verdict. Preview is the
 * renderer's review card, compact or full.
 */
export default class ReviewTool implements BlockTool {
    private readonly api: API;
    private readonly config: ReviewToolConfig;
    private data: Required<Omit<ReviewData, 'image'>> & Pick<ReviewData, 'image'>;
    private shell: BlockShell | null = null;
    private cleanups: Array<() => void> = [];
    private pros: Point[];
    private cons: Point[];

    static get toolbox() {
        return toolboxEntry('review');
    }

    static get enableLineBreaks() {
        return true;
    }

    constructor({ data, config, api }: BlockToolConstructorOptions<Partial<ReviewData>, ReviewToolConfig>) {
        this.api = api;
        this.config = config || {};
        this.data = {
            image: data?.image || undefined,
            title: data?.title || '',
            content: data?.content || '',
            linkUrl: data?.linkUrl || '',
            linkLabel: data?.linkLabel || '',
            pros: data?.pros?.length ? [...data.pros] : [''],
            cons: data?.cons?.length ? [...data.cons] : [''],
            rating: data?.rating ?? 0,
            maxStars: data?.maxStars || this.config.maxStars || 5,
            allowHalfStars: data?.allowHalfStars ?? this.config.allowHalfStars ?? true,
            summary: data?.summary || '',
            compact: data?.compact ?? false,
        };
        this.pros = this.data.pros.map((text) => ({ text }));
        this.cons = this.data.cons.map((text) => ({ text }));
    }

    render(): HTMLElement {
        const shell = new BlockShell({
            type: 'review',
            hasContent: this.data.title.trim() !== '',
            summary: this.summary(),
        });
        this.shell = shell;

        const image = mediaInput({
            value: this.data.image,
            ariaLabel: 'Image',
            onChange: (value) => this.update({ image: value }),
        });
        this.cleanups.push(image.destroy);

        shell.fields.append(
            stack(
                row(
                    field({
                        label: 'Title',
                        control: textInput({
                            value: this.data.title,
                            placeholder: 'What is being reviewed',
                            onInput: (v) => this.update({ title: v }),
                        }),
                        grow: true,
                    }),
                    field({ label: 'Image', control: image.element, grow: true }),
                ),
                field({
                    label: 'Review',
                    control: textarea({
                        value: this.data.content,
                        rows: 4,
                        placeholder: 'Your experience with it',
                        onInput: (v) => this.update({ content: v }),
                    }),
                }),
                row(
                    field({
                        label: 'Link',
                        control: textInput({
                            value: this.data.linkUrl,
                            type: 'url',
                            placeholder: 'https://…',
                            onInput: (v) => this.update({ linkUrl: v }),
                        }),
                        grow: true,
                    }),
                    field({
                        label: 'Link label',
                        control: textInput({
                            value: this.data.linkLabel,
                            placeholder: 'Visit website',
                            onInput: (v) => this.update({ linkLabel: v }),
                        }),
                    }),
                ),
                this.ratingSection(),
                row(this.pointsColumn('pros', 'Pros'), this.pointsColumn('cons', 'Cons')),
                field({
                    label: 'Verdict',
                    control: textarea({
                        value: this.data.summary,
                        rows: 2,
                        placeholder: 'One-line summary',
                        onInput: (v) => this.update({ summary: v }),
                    }),
                }),
                toggle({
                    checked: this.data.compact,
                    label: 'Compact card',
                    hint: 'A smaller horizontal layout',
                    onChange: (v) => this.update({ compact: v }),
                }),
            ),
        );
        shell.preview(this.previewData());
        return shell.element;
    }

    /** Stars (whole numbers) beside an exact number input, a scale picker and the half-star option */
    private ratingSection(): HTMLElement {
        const host = h('div', { className: 'oe-stack' });
        const paint = () => {
            host.innerHTML = '';
            const number = textInput({
                value: String(this.data.rating),
                type: 'number',
                min: 0,
                max: this.data.maxStars,
                size: 'sm',
                ariaLabel: 'Rating value',
                onInput: (v) => {
                    const n = parseFloat(v);
                    if (Number.isFinite(n) && n >= 0 && n <= this.data.maxStars) {
                        this.data.rating = this.data.allowHalfStars ? Math.round(n * 2) / 2 : Math.round(n);
                        this.update({});
                        starsEl.replaceWith((starsEl = this.starsEl()));
                    }
                },
            });
            number.step = this.data.allowHalfStars ? '0.5' : '1';
            let starsEl = this.starsEl();
            host.append(
                sectionLabel('Rating'),
                row(
                    h('div', { className: 'oe-review__rating' }, starsEl, number),
                    field({
                        label: 'Scale',
                        control: select<'5' | '10'>({
                            value: String(this.data.maxStars) as '5' | '10',
                            size: 'sm',
                            ariaLabel: 'Max stars',
                            options: [
                                { value: '5', label: 'Out of 5' },
                                { value: '10', label: 'Out of 10' },
                            ],
                            onChange: (v) => {
                                this.data.maxStars = Number(v) as 5 | 10;
                                if (this.data.rating > this.data.maxStars) this.data.rating = this.data.maxStars;
                                this.update({});
                                paint();
                            },
                        }),
                    }),
                    checkbox({
                        checked: this.data.allowHalfStars,
                        label: 'Half stars',
                        onChange: (v) => {
                            this.data.allowHalfStars = v;
                            if (!v) this.data.rating = Math.round(this.data.rating);
                            this.update({});
                            paint();
                        },
                    }),
                ),
            );
        };
        paint();
        return host;
    }

    private starsEl(): HTMLElement {
        return stars({
            value: Math.floor(this.data.rating),
            max: this.data.maxStars,
            onChange: (v) => {
                this.data.rating = v;
                this.update({});
                const number = this.shell?.fields.querySelector<HTMLInputElement>('input[aria-label="Rating value"]');
                if (number) number.value = String(v);
            },
        });
    }

    private pointsColumn(key: 'pros' | 'cons', label: string): HTMLElement {
        const items = this[key];
        const list = sortableList<Point>({
            items,
            rowLabel: (_, i) => `${label.toLowerCase().slice(0, -1)} ${i + 1}`,
            emptyText: `No ${label.toLowerCase()} yet`,
            onChange: () => this.update({}),
            renderRow: (item, { index }) =>
                textInput({
                    value: item.text,
                    placeholder: key === 'pros' ? 'Something good' : 'Something to know',
                    ariaLabel: `${label.slice(0, -1)} ${index + 1}`,
                    onInput: (v) => {
                        item.text = v;
                        this.update({});
                    },
                }),
        });
        const add = addButton(`Add ${label.toLowerCase().slice(0, -1)}`, () => {
            items.push({ text: '' });
            list.refresh();
            this.update({});
            const inputs = list.element.querySelectorAll<HTMLInputElement>('input');
            inputs[inputs.length - 1]?.focus();
        });
        return h('div', { className: 'oe-stack oe-field--grow' }, sectionLabel(label), list.element, add);
    }

    private update(patch: Partial<ReviewData>) {
        this.data = {
            ...this.data,
            ...patch,
            pros: this.pros.map((p) => p.text),
            cons: this.cons.map((c) => c.text),
        } as Required<ReviewData>;
        this.shell?.setSummary(this.summary());
        this.shell?.preview(this.previewData());
    }

    private summary(): string {
        const rating = this.data.rating > 0 ? `${this.data.rating}/${this.data.maxStars}` : 'unrated';
        return this.data.compact ? `${rating} · compact` : rating;
    }

    private previewData(): Record<string, unknown> {
        const saved = this.save();
        return { ...saved, title: saved.title || 'Product name' };
    }

    save(): ReviewData {
        return {
            ...this.data,
            pros: this.pros.map((p) => p.text).filter((p) => p.trim() !== ''),
            cons: this.cons.map((c) => c.text).filter((c) => c.trim() !== ''),
        };
    }

    validate(savedData: ReviewData): boolean {
        return typeof savedData.title === 'string' && savedData.title.trim() !== '';
    }

    destroy(): void {
        this.cleanups.splice(0).forEach((fn) => fn());
        this.shell?.destroy();
        this.shell = null;
    }
}
