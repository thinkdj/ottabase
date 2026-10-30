import type { API, BlockTool, BlockToolConstructorOptions } from '@editorjs/editorjs';
import { toolboxEntry } from '../../blocks';
import { field, textarea } from '../../ui/kit';
import { BlockShell } from '../../ui/shell';
import { sanitizeRawHtml } from './RawHtmlSanitizer';

interface RawHtmlToolConfig {
    placeholder?: string;
}

interface RawHtmlToolData {
    html: string;
}

/** Raw HTML block: a monospace textarea; the preview is the sanitised result the reader gets. */
export default class RawHtmlTool implements BlockTool {
    private readonly api: API;
    private readonly config: RawHtmlToolConfig;
    private data: RawHtmlToolData;
    private shell: BlockShell | null = null;

    static get toolbox() {
        return toolboxEntry('raw');
    }

    static get enableLineBreaks() {
        return true;
    }

    constructor({ data, config, api }: BlockToolConstructorOptions<RawHtmlToolData, RawHtmlToolConfig>) {
        this.api = api;
        this.config = config || {};
        this.data = { html: data?.html || '' };
    }

    render(): HTMLElement {
        const shell = new BlockShell({ type: 'raw', hasContent: this.data.html.trim() !== '' });
        this.shell = shell;
        const html = textarea({
            value: this.data.html,
            rows: 8,
            mono: true,
            placeholder: this.config.placeholder || '<div>…</div>',
            onInput: (v) => {
                this.data.html = v;
                shell.preview({ html: sanitizeRawHtml(v) });
            },
        });
        shell.fields.append(
            field({
                label: 'HTML',
                control: html,
                hint: 'Wrapper and executable tags are removed when this block is saved.',
            }),
        );
        shell.preview({ html: sanitizeRawHtml(this.data.html) });
        return shell.element;
    }

    save(): RawHtmlToolData {
        return { html: sanitizeRawHtml(this.data.html) };
    }

    validate(savedData: RawHtmlToolData): boolean {
        return savedData.html.trim() !== '';
    }

    destroy(): void {
        this.shell?.destroy();
        this.shell = null;
    }
}
