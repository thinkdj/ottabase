import type { API, BlockTool } from '@editorjs/editorjs';
import './FaqTool.css';

// ─── Types ─────────────────────────────────────────────────────────────────

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

// ─── SVG icons ──────────────────────────────────────────────────────────────

const PLUS_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';

const DRAG_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>';

const DELETE_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></svg>';

const FAQ_TOOLBOX_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>';

// ─── Tool ───────────────────────────────────────────────────────────────────

export default class FaqTool implements BlockTool {
    private api: API;
    private data: FaqData;
    private config: FaqToolConfig;
    private wrapper: HTMLElement | null = null;
    private listEl: HTMLElement | null = null;

    // ── Static EditorJS metadata ────────────────────────────────────────────

    static get toolbox() {
        return {
            title: 'FAQ',
            icon: FAQ_TOOLBOX_ICON,
        };
    }

    static get enableLineBreaks() {
        return true;
    }

    // ── Constructor ─────────────────────────────────────────────────────────

    constructor({ data, config, api }: { data?: Partial<FaqData>; config?: FaqToolConfig; api: API }) {
        this.api = api;
        this.config = config || {};

        const defaultStyle = this.config.defaultStyle ?? 'accordion';
        const rawItems = data?.items ?? [];
        const validItems = rawItems
            .filter((it): it is FaqItem => typeof it === 'object' && it !== null)
            .map((it) => ({
                question: String(it.question ?? ''),
                answer: String(it.answer ?? ''),
            }));

        this.data = {
            items: validItems.length ? validItems : [{ question: '', answer: '' }],
            style: data?.style ?? defaultStyle,
        };
    }

    // ── render ──────────────────────────────────────────────────────────────

    render(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.classList.add('cdx-faq', 'cdx-faq__wrapper', 'ob-plugin');

        // Toolbar row: label + style toggle
        wrapper.appendChild(this.createToolbar());

        // Item list
        const list = document.createElement('div');
        list.classList.add('cdx-faq__list');
        this.listEl = list;
        wrapper.appendChild(list);

        // Footer: add button
        const footer = document.createElement('div');
        footer.classList.add('cdx-faq__footer');
        footer.appendChild(this.createAddButton());
        wrapper.appendChild(footer);

        this.wrapper = wrapper;
        this.renderItems();

        return wrapper;
    }

    // ── Toolbar (label + style select) ──────────────────────────────────────

    private createToolbar(): HTMLElement {
        const toolbar = document.createElement('div');
        toolbar.classList.add('cdx-faq__toolbar');

        const label = document.createElement('span');
        label.classList.add('cdx-faq__toolbar-label', 'ob-section-label');
        label.textContent = 'FAQ Block';
        toolbar.appendChild(label);

        const styleGroup = document.createElement('div');
        styleGroup.classList.add('cdx-faq__style-group');

        const styleLabel = document.createElement('span');
        styleLabel.classList.add('cdx-faq__style-label', 'ob-label');
        styleLabel.textContent = 'Style:';
        styleGroup.appendChild(styleLabel);

        const styleSelect = document.createElement('select');
        styleSelect.classList.add('cdx-faq__style-select', 'ob-select');
        styleSelect.title = 'Display style';

        const options: { value: FaqData['style']; label: string }[] = [
            { value: 'accordion', label: 'Accordion (expandable)' },
            { value: 'flat', label: 'Flat (always open)' },
        ];
        options.forEach(({ value, label }) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            opt.selected = value === this.data.style;
            styleSelect.appendChild(opt);
        });
        styleSelect.addEventListener('change', () => {
            this.data.style = styleSelect.value as FaqData['style'];
        });
        styleGroup.appendChild(styleSelect);
        toolbar.appendChild(styleGroup);

        return toolbar;
    }

    // ── Item list rendering ──────────────────────────────────────────────────

    private renderItems(): void {
        if (!this.listEl) return;
        this.listEl.innerHTML = '';
        this.data.items.forEach((_, index) => {
            this.listEl!.appendChild(this.createItemEl(index));
        });
    }

    private createItemEl(index: number): HTMLElement {
        const item = this.data.items[index];

        const row = document.createElement('div');
        row.classList.add('cdx-faq__item');
        row.dataset.index = String(index);

        // Drag handle
        const drag = document.createElement('div');
        drag.classList.add('cdx-faq__drag');
        drag.innerHTML = DRAG_ICON;
        drag.title = 'Drag to reorder';
        row.appendChild(drag);

        // Card: number badge + question + answer
        const card = document.createElement('div');
        card.classList.add('cdx-faq__card', 'ob-form');

        const badge = document.createElement('div');
        badge.classList.add('cdx-faq__badge');
        badge.textContent = String(index + 1);
        card.appendChild(badge);

        const fields = document.createElement('div');
        fields.classList.add('cdx-faq__fields');

        // Question input
        const qGroup = document.createElement('div');
        qGroup.classList.add('ob-input-group');
        const qLabel = document.createElement('label');
        qLabel.classList.add('ob-label');
        qLabel.textContent = 'Question';
        const qInput = document.createElement('input');
        qInput.type = 'text';
        qInput.classList.add('ob-input', 'cdx-faq__question-input');
        qInput.placeholder = this.config.questionPlaceholder ?? 'Enter the question...';
        qInput.value = item.question;
        qInput.addEventListener('input', () => {
            this.data.items[index].question = qInput.value;
        });
        qGroup.appendChild(qLabel);
        qGroup.appendChild(qInput);

        // Answer textarea
        const aGroup = document.createElement('div');
        aGroup.classList.add('ob-input-group');
        const aLabel = document.createElement('label');
        aLabel.classList.add('ob-label');
        aLabel.textContent = 'Answer';
        const aInput = document.createElement('textarea');
        aInput.classList.add('ob-textarea', 'cdx-faq__answer-input');
        aInput.placeholder = this.config.answerPlaceholder ?? 'Enter the answer...';
        aInput.value = item.answer;
        aInput.rows = 3;
        aInput.addEventListener('input', () => {
            this.data.items[index].answer = aInput.value;
        });
        aGroup.appendChild(aLabel);
        aGroup.appendChild(aInput);

        fields.appendChild(qGroup);
        fields.appendChild(aGroup);
        card.appendChild(fields);
        row.appendChild(card);

        // Delete button
        const del = document.createElement('button');
        del.type = 'button';
        del.classList.add('cdx-faq__delete');
        del.innerHTML = DELETE_ICON;
        del.title = 'Remove item';
        del.setAttribute('aria-label', 'Remove this FAQ item');
        del.addEventListener('click', () => {
            if (this.data.items.length === 1) return; // keep at least one
            this.data.items.splice(index, 1);
            this.renderItems();
        });
        row.appendChild(del);

        return row;
    }

    private createAddButton(): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.classList.add('cdx-faq__add-button', 'ob-button');
        btn.innerHTML = `${PLUS_ICON}<span>Add Question</span>`;
        btn.setAttribute('aria-label', 'Add a new FAQ item');
        btn.addEventListener('click', () => {
            this.data.items.push({ question: '', answer: '' });
            this.renderItems();
            // Focus the newly added question input
            const inputs = this.listEl?.querySelectorAll<HTMLInputElement>('.cdx-faq__question-input');
            inputs?.[inputs.length - 1]?.focus();
        });
        return btn;
    }

    // ── save ─────────────────────────────────────────────────────────────────

    save(): FaqData {
        return {
            style: this.data.style,
            items: this.data.items
                .map((item) => ({
                    question: item.question.trim(),
                    answer: item.answer.trim(),
                }))
                .filter((item) => item.question !== '' || item.answer !== ''),
        };
    }

    // ── validate ─────────────────────────────────────────────────────────────

    validate(data: FaqData): boolean {
        return Array.isArray(data.items) && data.items.some((it) => it.question.trim() !== '');
    }
}
