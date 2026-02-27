import type { API, BlockTool } from '@editorjs/editorjs';
import './CodeTool.css';

const LANGUAGE_OPTIONS = [
    { value: 'plaintext', label: 'Plain' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'jsx', label: 'JSX' },
    { value: 'tsx', label: 'TSX' },
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'scss', label: 'SCSS' },
    { value: 'json', label: 'JSON' },
    { value: 'bash', label: 'Bash' },
    { value: 'sql', label: 'SQL' },
    { value: 'python', label: 'Python' },
    { value: 'markdown', label: 'Markdown' },
    { value: 'toml', label: 'TOML' },
    { value: '__custom__', label: 'Custom' },
] as const;

const PREDEFINED_LANGS: Set<string> = new Set(
    LANGUAGE_OPTIONS.filter((o) => o.value !== '__custom__').map((o) => o.value),
);

const TAB_OPTIONS = [2, 4, 8] as const;

/** Valid: number optionally followed by px, em, rem */
function isValidMaxHeight(s: string): boolean {
    const t = s.trim();
    if (!t) return true;
    return /^\d+(\.\d+)?\s*(px|em|rem)?$/i.test(t);
}

/** Valid: comma/semicolon separated N or N-N (e.g. 3,5-7,9) */
function isValidHighlightLines(s: string): boolean {
    const t = s.trim();
    if (!t) return true;
    return /^(\d+(-\d+)?)(\s*[,;]\s*\d+(-\d+)?)*$/.test(t);
}

interface CodeToolConfig {
    placeholder?: string;
}

export interface CodeToolData {
    code: string;
    language?: string;
    showLineNumbers?: boolean;
    lineNumberStart?: number;
    maxHeight?: string;
    wrapLongLines?: boolean;
    hideHeader?: boolean;
    hideCopyButton?: boolean;
    highlightLines?: string;
    tabSize?: number;
    collapsible?: boolean;
    collapsibleThreshold?: number;
}

export default class CodeTool implements BlockTool {
    private api: API;
    private data: CodeToolData;
    private config: CodeToolConfig;
    private wrapper: HTMLElement | null = null;
    private langInput: HTMLInputElement | null = null;

    static get CSS() {
        return {
            baseClass: 'cdx-code',
            wrapper: 'cdx-code__wrapper',
            header: 'cdx-code__header',
            headerLabel: 'cdx-code__header-label',
            optionsRow: 'cdx-code__options-row',
            opt: 'cdx-code__opt',
            optGroup: 'cdx-code__opt-group',
            optLabel: 'cdx-code__opt-label',
            optDesc: 'cdx-code__opt-desc',
            optInput: 'cdx-code__opt-input',
            optSelect: 'cdx-code__opt-select',
            optToggle: 'cdx-code__opt-toggle',
            langSelect: 'cdx-code__lang-select',
            langInput: 'cdx-code__lang-input',
            textarea: 'cdx-code__textarea',
        };
    }

    static get toolbox() {
        return {
            title: 'Code',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(3 3)"><polyline points="17 18 23 12 17 6"/><polyline points="7 6 1 12 7 18"/><line x1="15" y1="4" x2="9" y2="20"/></g></svg>',
        };
    }

    static get enableLineBreaks() {
        return true;
    }

    constructor({ data, config, api }: { data?: Partial<CodeToolData>; config?: CodeToolConfig; api: API }) {
        this.api = api;
        this.config = config || {};
        this.data = {
            code: data?.code || '',
            language: data?.language || 'plaintext',
            showLineNumbers: data?.showLineNumbers ?? false,
            lineNumberStart: Math.max(1, Math.floor(Number(data?.lineNumberStart)) || 1),
            maxHeight: data?.maxHeight || '',
            wrapLongLines: data?.wrapLongLines ?? false,
            hideHeader: data?.hideHeader ?? false,
            hideCopyButton: data?.hideCopyButton ?? false,
            highlightLines: data?.highlightLines || '',
            tabSize: data?.tabSize ?? 4,
            collapsible: data?.collapsible ?? false,
            collapsibleThreshold: data?.collapsibleThreshold ?? 20,
        };
    }

    private isCustomLang(): boolean {
        return !PREDEFINED_LANGS.has(this.data.language || '');
    }

    private createToggle(
        label: string,
        checked: boolean,
        onChange: (v: boolean) => void,
        title?: string,
    ): HTMLSpanElement {
        const wrap = document.createElement('span');
        wrap.classList.add(CodeTool.CSS.opt, CodeTool.CSS.optToggle);
        if (title) wrap.title = title;
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = checked;
        cb.classList.add(CodeTool.CSS.optInput);
        cb.setAttribute('aria-label', label);
        cb.addEventListener('change', () => onChange(cb.checked));
        const lb = document.createElement('label');
        lb.classList.add(CodeTool.CSS.optLabel);
        lb.textContent = label;
        lb.addEventListener('click', () => {
            cb.checked = !cb.checked;
            onChange(cb.checked);
        });
        wrap.appendChild(cb);
        wrap.appendChild(lb);
        return wrap;
    }

    private createLabeledInput(
        label: string,
        description: string,
        input: HTMLInputElement | HTMLSelectElement,
    ): HTMLDivElement {
        const group = document.createElement('div');
        group.classList.add(CodeTool.CSS.optGroup);
        group.title = description;
        const lb = document.createElement('span');
        lb.classList.add(CodeTool.CSS.optLabel);
        lb.textContent = label;
        group.appendChild(lb);
        group.appendChild(input);
        return group;
    }

    render(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.classList.add(CodeTool.CSS.baseClass, CodeTool.CSS.wrapper);

        // Row 1: Language (label + dropdown + file type)
        const header = document.createElement('div');
        header.classList.add(CodeTool.CSS.header);

        const langLabel = document.createElement('span');
        langLabel.classList.add(CodeTool.CSS.optLabel);
        langLabel.textContent = 'Language';
        langLabel.title = 'Syntax highlighting language';
        header.appendChild(langLabel);

        const langSelect = document.createElement('select');
        langSelect.classList.add(CodeTool.CSS.langSelect);
        for (const opt of LANGUAGE_OPTIONS) {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.label;
            const isCustom = this.isCustomLang();
            if (opt.value === '__custom__' && isCustom) o.selected = true;
            else if (opt.value === this.data.language && !isCustom) o.selected = true;
            langSelect.appendChild(o);
        }

        const langInput = document.createElement('input');
        langInput.type = 'text';
        langInput.classList.add(CodeTool.CSS.langInput);
        const customMode = this.isCustomLang();
        langInput.disabled = !customMode;
        langInput.placeholder = customMode ? 'e.g. rust, go, kotlin' : '';
        langInput.title = customMode
            ? 'Custom file type / language identifier for syntax highlighting'
            : 'Current language (select Custom above to type your own)';
        langInput.setAttribute('aria-label', customMode ? 'Custom file type' : 'File type');
        langInput.value = customMode ? this.data.language || '' : this.data.language || 'plaintext';
        this.langInput = langInput;

        langSelect.addEventListener('change', () => {
            if (langSelect.value === '__custom__') {
                this.data.language = langInput.value || 'plaintext';
                langInput.disabled = false;
                langInput.placeholder = 'e.g. rust, go, kotlin';
            } else {
                this.data.language = langSelect.value;
                langInput.disabled = true;
                langInput.placeholder = '';
                langInput.value = langSelect.value;
            }
        });
        langInput.addEventListener('input', () => {
            if (langSelect.value === '__custom__') this.data.language = langInput.value || 'plaintext';
        });

        header.appendChild(langSelect);
        header.appendChild(langInput);
        wrapper.appendChild(header);

        // Row 2: Compact options
        const optionsRow = document.createElement('div');
        optionsRow.classList.add(CodeTool.CSS.optionsRow);

        optionsRow.appendChild(
            this.createToggle(
                'Lines',
                this.data.showLineNumbers ?? false,
                (v) => {
                    this.data.showLineNumbers = v;
                },
                'Show line numbers in the rendered code block',
            ),
        );

        const startWrap = document.createElement('span');
        startWrap.classList.add(CodeTool.CSS.opt, CodeTool.CSS.optGroup);
        startWrap.title = 'First line number (e.g. 1 for full file, 42 for snippet from line 42)';
        const startLbl = document.createElement('span');
        startLbl.classList.add(CodeTool.CSS.optLabel);
        startLbl.textContent = 'Start';
        const startInput = document.createElement('input');
        startInput.type = 'number';
        startInput.min = '1';
        startInput.value = String(Math.max(1, Math.floor(Number(this.data.lineNumberStart)) || 1));
        startInput.classList.add(CodeTool.CSS.optInput);
        startInput.style.width = '36px';
        startInput.setAttribute('aria-label', 'Line number start');
        startInput.dataset.codeOpt = 'lineStart';
        startInput.addEventListener('input', () => {
            const v = parseInt(startInput.value, 10);
            this.data.lineNumberStart = !isNaN(v) && v >= 1 ? v : 1;
        });
        startWrap.appendChild(startLbl);
        startWrap.appendChild(startInput);
        optionsRow.appendChild(startWrap);

        optionsRow.appendChild(
            this.createToggle(
                'Wrap',
                this.data.wrapLongLines ?? false,
                (v) => {
                    this.data.wrapLongLines = v;
                },
                'Wrap long lines instead of horizontal scroll',
            ),
        );

        const tabWrap = document.createElement('span');
        tabWrap.classList.add(CodeTool.CSS.opt, CodeTool.CSS.optGroup);
        tabWrap.title = 'Indentation width in spaces (tab-size)';
        const tabLbl = document.createElement('span');
        tabLbl.classList.add(CodeTool.CSS.optLabel);
        tabLbl.textContent = 'Indent';
        const tabSelect = document.createElement('select');
        tabSelect.classList.add(CodeTool.CSS.optSelect);
        tabSelect.setAttribute('aria-label', 'Tab size');
        for (const t of TAB_OPTIONS) {
            const o = document.createElement('option');
            o.value = String(t);
            o.textContent = `Tab ${t}`;
            if (t === (this.data.tabSize ?? 4)) o.selected = true;
            tabSelect.appendChild(o);
        }
        tabSelect.addEventListener('change', () => {
            this.data.tabSize = parseInt(tabSelect.value, 10);
        });
        tabWrap.appendChild(tabLbl);
        tabWrap.appendChild(tabSelect);
        optionsRow.appendChild(tabWrap);

        optionsRow.appendChild(
            this.createToggle(
                'Hide header',
                this.data.hideHeader ?? false,
                (v) => {
                    this.data.hideHeader = v;
                },
                'Hide the header bar (language/filename + copy button)',
            ),
        );
        optionsRow.appendChild(
            this.createToggle(
                'Hide copy btn',
                this.data.hideCopyButton ?? false,
                (v) => {
                    this.data.hideCopyButton = v;
                },
                'Hide the copy-to-clipboard button',
            ),
        );
        optionsRow.appendChild(
            this.createToggle(
                'Collapsible',
                this.data.collapsible ?? false,
                (v) => {
                    this.data.collapsible = v;
                },
                'Allow expand/collapse when code exceeds threshold',
            ),
        );

        const threshInput = document.createElement('input');
        threshInput.type = 'number';
        threshInput.min = '5';
        threshInput.placeholder = '20';
        threshInput.value = this.data.collapsibleThreshold ? String(this.data.collapsibleThreshold) : '';
        threshInput.classList.add(CodeTool.CSS.optInput);
        threshInput.style.width = '42px';
        threshInput.dataset.codeOpt = 'collapseThresh';
        threshInput.addEventListener('input', () => {
            const v = parseInt(threshInput.value, 10);
            // Number only: min 5, else default 20
            this.data.collapsibleThreshold = !isNaN(v) && v >= 5 ? v : 20;
        });
        const threshWrap = this.createLabeledInput(
            'Collapse after',
            'Collapse when line count exceeds this (min 5)',
            threshInput,
        );
        threshWrap.classList.add(CodeTool.CSS.opt);
        const threshSuffix = document.createElement('span');
        threshSuffix.classList.add(CodeTool.CSS.optLabel);
        threshSuffix.textContent = 'lines';
        threshWrap.appendChild(threshSuffix);
        optionsRow.appendChild(threshWrap);

        const maxHInput = document.createElement('input');
        maxHInput.type = 'text';
        maxHInput.placeholder = '200px';
        maxHInput.value = this.data.maxHeight || '';
        maxHInput.classList.add(CodeTool.CSS.optInput);
        maxHInput.style.width = '70px';
        maxHInput.dataset.codeOpt = 'maxHeight';
        maxHInput.addEventListener('input', () => {
            const v = maxHInput.value.trim();
            this.data.maxHeight = isValidMaxHeight(v) ? v : '';
        });
        const maxHWrap = this.createLabeledInput('Max height', 'Max height with scroll (e.g. 200px, 15rem)', maxHInput);
        maxHWrap.classList.add(CodeTool.CSS.opt);
        optionsRow.appendChild(maxHWrap);

        const hlInput = document.createElement('input');
        hlInput.type = 'text';
        hlInput.placeholder = '3,5-7';
        hlInput.value = this.data.highlightLines || '';
        hlInput.classList.add(CodeTool.CSS.optInput);
        hlInput.style.width = '80px';
        hlInput.dataset.codeOpt = 'highlightLines';
        hlInput.addEventListener('input', () => {
            const v = hlInput.value.trim();
            this.data.highlightLines = isValidHighlightLines(v) ? v : '';
        });
        const hlWrap = this.createLabeledInput('Highlight', 'Lines to highlight (e.g. 3,5-7,9)', hlInput);
        hlWrap.classList.add(CodeTool.CSS.opt);
        optionsRow.appendChild(hlWrap);

        wrapper.appendChild(optionsRow);

        const textarea = document.createElement('textarea');
        textarea.classList.add(CodeTool.CSS.textarea);
        textarea.placeholder = this.config.placeholder || 'Enter your code here...';
        textarea.value = this.data.code;
        textarea.rows = 8;
        textarea.spellcheck = false;
        textarea.addEventListener('input', () => {
            this.data.code = textarea.value;
        });
        wrapper.appendChild(textarea);

        this.wrapper = wrapper;
        return wrapper;
    }

    save(): CodeToolData {
        if (this.langInput && !this.langInput.disabled) {
            this.data.language = this.langInput.value.trim() || 'plaintext';
        }
        // Re-validate on save (min 1, invalid -> 1)
        const startEl = this.wrapper?.querySelector<HTMLInputElement>('[data-code-opt="lineStart"]');
        const startVal = parseInt(startEl?.value ?? '', 10);
        this.data.lineNumberStart = !isNaN(startVal) && startVal >= 1 ? startVal : 1;

        const threshEl = this.wrapper?.querySelector<HTMLInputElement>('[data-code-opt="collapseThresh"]');
        const threshVal = parseInt(threshEl?.value ?? '', 10);
        this.data.collapsibleThreshold = !isNaN(threshVal) && threshVal >= 5 ? threshVal : 20;

        const maxHEl = this.wrapper?.querySelector<HTMLInputElement>('[data-code-opt="maxHeight"]');
        const maxH = maxHEl?.value?.trim() ?? '';
        this.data.maxHeight = maxH && isValidMaxHeight(maxH) ? maxH : '';

        const hlEl = this.wrapper?.querySelector<HTMLInputElement>('[data-code-opt="highlightLines"]');
        const hl = hlEl?.value?.trim() ?? '';
        this.data.highlightLines = hl && isValidHighlightLines(hl) ? hl : '';

        return this.data;
    }
}
