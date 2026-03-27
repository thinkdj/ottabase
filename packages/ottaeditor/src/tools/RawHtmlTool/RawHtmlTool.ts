import type { API, BlockTool, BlockToolConstructorOptions } from '@editorjs/editorjs';
import { sanitizeRawHtml } from './RawHtmlSanitizer';
import './RawHtmlTool.css';

interface RawHtmlToolConfig {
    placeholder?: string;
}

interface RawHtmlToolData {
    html: string;
}

export default class RawHtmlTool implements BlockTool {
    private api: API;
    private config: RawHtmlToolConfig;
    private data: RawHtmlToolData;
    private textarea: HTMLTextAreaElement | null = null;

    static get CSS() {
        return {
            baseClass: 'cdx-raw-html',
            wrapper: 'cdx-raw-html__wrapper',
            form: 'cdx-raw-html__form',
            inputGroup: 'cdx-raw-html__input-group',
            label: 'cdx-raw-html__label',
            textarea: 'cdx-raw-html__textarea',
            hint: 'cdx-raw-html__hint',
        };
    }

    static get toolbox() {
        return {
            title: 'Raw HTML',
            icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 8L4 12L9 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 8L20 12L15 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.5 5L10.5 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        };
    }

    static get enableLineBreaks() {
        return true;
    }

    constructor({ data, config, api }: BlockToolConstructorOptions<RawHtmlToolData, RawHtmlToolConfig>) {
        this.api = api;
        this.config = config || {};
        this.data = {
            html: data?.html || '',
        };
    }

    render(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.classList.add(RawHtmlTool.CSS.baseClass, RawHtmlTool.CSS.wrapper, 'ob-plugin');

        const form = document.createElement('div');
        form.classList.add(RawHtmlTool.CSS.form, 'ob-form');

        const inputGroup = document.createElement('div');
        inputGroup.classList.add(RawHtmlTool.CSS.inputGroup, 'ob-input-group');

        const label = document.createElement('label');
        label.classList.add(RawHtmlTool.CSS.label, 'ob-label');
        label.textContent = 'Raw HTML';

        inputGroup.appendChild(label);

        const textarea = document.createElement('textarea');
        textarea.classList.add(RawHtmlTool.CSS.textarea, 'ob-textarea');
        textarea.placeholder = this.config.placeholder || 'Enter raw HTML...';
        textarea.rows = 8;
        textarea.spellcheck = false;
        textarea.value = this.data.html;
        textarea.addEventListener('input', () => {
            this.data.html = textarea.value;
        });
        inputGroup.appendChild(textarea);

        const hint = document.createElement('p');
        hint.classList.add(RawHtmlTool.CSS.hint, 'ob-hint');
        hint.textContent = 'Unsafe wrapper and executable tags are removed when this block is saved.';
        inputGroup.appendChild(hint);

        form.appendChild(inputGroup);
        wrapper.appendChild(form);

        this.textarea = textarea;
        return wrapper;
    }

    save(): RawHtmlToolData {
        const html = this.textarea?.value ?? this.data.html;
        return {
            html: sanitizeRawHtml(html),
        };
    }

    validate(savedData: RawHtmlToolData): boolean {
        return savedData.html.trim() !== '';
    }
}
