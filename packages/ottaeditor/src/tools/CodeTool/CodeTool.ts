import type { API, BlockTool, BlockToolConstructorOptions } from '@editorjs/editorjs';
import { toolboxEntry } from '../../blocks';
import { field, row, select, stack, textInput, textarea, toggle } from '../../ui/kit';
import { BlockShell } from '../../ui/shell';

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
    { value: '__custom__', label: 'Custom…' },
] as const;

type LanguageOption = (typeof LANGUAGE_OPTIONS)[number]['value'];

const PREDEFINED_LANGS: Set<string> = new Set(
    LANGUAGE_OPTIONS.filter((o) => o.value !== '__custom__').map((o) => o.value),
);

const TAB_OPTIONS = ['2', '4', '8'] as const;

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

/**
 * Code block. The source is typed in a monospace textarea; everything the highlighter can do
 * (language, line numbers, wrapping, collapse, highlighted lines) sits in rows below it. Preview
 * is the renderer's highlighted block.
 */
export default class CodeTool implements BlockTool {
    private readonly api: API;
    private readonly config: CodeToolConfig;
    private data: CodeToolData;
    private shell: BlockShell | null = null;
    /** Raw field values that are only validated on save, exactly as the previous version did */
    private raw = { lineStart: '', threshold: '', maxHeight: '', highlight: '', customLang: '' };
    private customLangInput: HTMLInputElement | null = null;

    static get toolbox() {
        return toolboxEntry('code');
    }

    static get enableLineBreaks() {
        return true;
    }

    constructor({ data, config, api }: BlockToolConstructorOptions<Partial<CodeToolData>, CodeToolConfig>) {
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
        this.raw = {
            lineStart: String(this.data.lineNumberStart),
            threshold: this.data.collapsibleThreshold ? String(this.data.collapsibleThreshold) : '',
            maxHeight: this.data.maxHeight || '',
            highlight: this.data.highlightLines || '',
            customLang: this.isCustomLang() ? this.data.language || '' : '',
        };
    }

    private isCustomLang(): boolean {
        return !PREDEFINED_LANGS.has(this.data.language || '');
    }

    render(): HTMLElement {
        const shell = new BlockShell({
            type: 'code',
            hasContent: this.data.code.trim() !== '',
            summary: this.summary(),
        });
        this.shell = shell;

        const code = textarea({
            value: this.data.code,
            rows: 8,
            mono: true,
            placeholder: this.config.placeholder || 'Paste or type code',
            ariaLabel: 'Code',
            onInput: (v) => this.update({ code: v }),
        });

        const custom = this.isCustomLang();
        const customLang = textInput({
            value: this.raw.customLang,
            placeholder: 'e.g. rust, go, kotlin',
            ariaLabel: 'Custom language',
            onInput: (v) => {
                this.raw.customLang = v;
                if (!this.customLangInput?.disabled) this.update({ language: v || 'plaintext' });
            },
        });
        customLang.disabled = !custom;
        this.customLangInput = customLang;

        const language = select<LanguageOption>({
            value: custom ? '__custom__' : (this.data.language as LanguageOption),
            options: LANGUAGE_OPTIONS,
            ariaLabel: 'Language',
            onChange: (v) => {
                if (v === '__custom__') {
                    customLang.disabled = false;
                    this.update({ language: this.raw.customLang || 'plaintext' });
                    customLang.focus();
                } else {
                    customLang.disabled = true;
                    this.update({ language: v });
                }
            },
        });

        const lineNumbers = toggle({
            checked: this.data.showLineNumbers ?? false,
            label: 'Line numbers',
            onChange: (v) => this.update({ showLineNumbers: v }),
        });
        const lineStart = textInput({
            value: this.raw.lineStart,
            type: 'number',
            min: 1,
            size: 'sm',
            ariaLabel: 'First line number',
            onInput: (v) => {
                this.raw.lineStart = v;
                const n = parseInt(v, 10);
                this.update({ lineNumberStart: !isNaN(n) && n >= 1 ? n : 1 });
            },
        });
        const wrap = toggle({
            checked: this.data.wrapLongLines ?? false,
            label: 'Wrap long lines',
            onChange: (v) => this.update({ wrapLongLines: v }),
        });
        const tabSize = select<(typeof TAB_OPTIONS)[number]>({
            value: String(this.data.tabSize ?? 4) as (typeof TAB_OPTIONS)[number],
            options: TAB_OPTIONS.map((t) => ({ value: t, label: `${t} spaces` })),
            ariaLabel: 'Tab size',
            size: 'sm',
            onChange: (v) => this.update({ tabSize: parseInt(v, 10) }),
        });

        const hideHeader = toggle({
            checked: this.data.hideHeader ?? false,
            label: 'Hide header',
            onChange: (v) => this.update({ hideHeader: v }),
        });
        const hideCopy = toggle({
            checked: this.data.hideCopyButton ?? false,
            label: 'Hide copy button',
            onChange: (v) => this.update({ hideCopyButton: v }),
        });
        const collapsible = toggle({
            checked: this.data.collapsible ?? false,
            label: 'Collapsible',
            onChange: (v) => this.update({ collapsible: v }),
        });
        const threshold = textInput({
            value: this.raw.threshold,
            type: 'number',
            min: 5,
            size: 'sm',
            placeholder: '20',
            ariaLabel: 'Collapse after lines',
            onInput: (v) => {
                this.raw.threshold = v;
                const n = parseInt(v, 10);
                this.update({ collapsibleThreshold: !isNaN(n) && n >= 5 ? n : 20 });
            },
        });
        const maxHeight = textInput({
            value: this.raw.maxHeight,
            size: 'sm',
            placeholder: '200px',
            ariaLabel: 'Max height',
            onInput: (v) => {
                this.raw.maxHeight = v;
                const t = v.trim();
                this.update({ maxHeight: isValidMaxHeight(t) ? t : '' });
            },
        });
        const highlight = textInput({
            value: this.raw.highlight,
            size: 'sm',
            placeholder: '3,5-7',
            ariaLabel: 'Highlight lines',
            onInput: (v) => {
                this.raw.highlight = v;
                const t = v.trim();
                this.update({ highlightLines: isValidHighlightLines(t) ? t : '' });
            },
        });

        shell.fields.append(
            stack(
                code,
                row(
                    field({ label: 'Language', control: language }),
                    field({ label: 'Custom language', control: customLang }),
                ),
                row(
                    lineNumbers,
                    field({ label: 'First line', control: lineStart }),
                    wrap,
                    field({ label: 'Tab size', control: tabSize }),
                ),
                row(hideHeader, hideCopy, collapsible, field({ label: 'Collapse after (lines)', control: threshold })),
                row(
                    field({ label: 'Max height', control: maxHeight, hint: 'e.g. 200px, 15rem' }),
                    field({ label: 'Highlight lines', control: highlight, hint: 'e.g. 3,5-7,9' }),
                ),
            ),
        );
        shell.preview(this.previewData());
        return shell.element;
    }

    private update(patch: Partial<CodeToolData>) {
        this.data = { ...this.data, ...patch };
        this.shell?.setSummary(this.summary());
        this.shell?.preview(this.previewData());
    }

    private summary(): string {
        const lines = this.data.code ? this.data.code.split('\n').length : 0;
        return `${this.data.language || 'plaintext'} · ${lines} ${lines === 1 ? 'line' : 'lines'}`;
    }

    private previewData(): Record<string, unknown> {
        return { ...this.data, code: this.data.code || '// Nothing here yet' };
    }

    save(): CodeToolData {
        if (this.customLangInput && !this.customLangInput.disabled) {
            this.data.language = this.customLangInput.value.trim() || 'plaintext';
        }
        // Re-validate the free-text options on save, exactly as before
        const startVal = parseInt(this.raw.lineStart, 10);
        this.data.lineNumberStart = !isNaN(startVal) && startVal >= 1 ? startVal : 1;

        const threshVal = parseInt(this.raw.threshold, 10);
        this.data.collapsibleThreshold = !isNaN(threshVal) && threshVal >= 5 ? threshVal : 20;

        const maxH = this.raw.maxHeight.trim();
        this.data.maxHeight = maxH && isValidMaxHeight(maxH) ? maxH : '';

        const hl = this.raw.highlight.trim();
        this.data.highlightLines = hl && isValidHighlightLines(hl) ? hl : '';

        return this.data;
    }

    destroy(): void {
        this.shell?.destroy();
        this.shell = null;
    }
}
