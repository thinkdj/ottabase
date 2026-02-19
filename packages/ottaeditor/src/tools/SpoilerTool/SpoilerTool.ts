import type { API, BlockTool, BlockToolConstructorOptions } from '@editorjs/editorjs';
import './SpoilerTool.css';

interface SpoilerConfig {
    placeholder?: string;
}

interface SpoilerData {
    text: string;
}

export default class SpoilerTool implements BlockTool {
    private api: API;
    private data: SpoilerData;
    private config: SpoilerConfig;
    private wrapper: HTMLElement | null = null;

    static get CSS() {
        return {
            baseClass: 'cdx-spoiler',
            wrapper: 'cdx-spoiler__wrapper',
            title: 'cdx-spoiler__title',
            textarea: 'cdx-spoiler__textarea',
        };
    }

    static get toolbox() {
        return {
            title: 'Spoiler',
            icon: '<svg width="17" height="17" viewBox="-80 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M285 221Q243 246 210 256 243 266 285 291L261 333Q215 305 193 286 200 317 200 368L152 368Q152 317 159 286 137 305 91 333L67 291Q109 266 142 256 109 246 67 221L91 179Q137 207 159 226 152 195 152 144L200 144Q200 195 193 226 215 207 261 179L285 221Z"/></svg>',
        };
    }

    static get enableLineBreaks() {
        return true;
    }

    constructor({ data, config, api }: BlockToolConstructorOptions<SpoilerData, SpoilerConfig>) {
        this.api = api;
        this.config = config || {};
        this.data = {
            text: data?.text || '',
        };
    }

    render(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.classList.add(SpoilerTool.CSS.baseClass, SpoilerTool.CSS.wrapper);

        // Add title
        const title = document.createElement('div');
        title.classList.add(SpoilerTool.CSS.title);
        title.textContent = 'Spoiler';
        wrapper.appendChild(title);

        const textarea = document.createElement('textarea');
        textarea.classList.add(SpoilerTool.CSS.textarea);
        textarea.placeholder = this.config.placeholder || 'Enter spoiler text...';
        textarea.value = this.data.text;
        textarea.rows = 3;

        textarea.addEventListener('input', (event) => {
            const target = event.target as HTMLTextAreaElement;
            this.data.text = target.value;
        });

        wrapper.appendChild(textarea);

        this.wrapper = wrapper;

        return wrapper;
    }

    save(): SpoilerData {
        return this.data;
    }

    validate(savedData: SpoilerData): boolean {
        return savedData.text.trim() !== '';
    }
}
