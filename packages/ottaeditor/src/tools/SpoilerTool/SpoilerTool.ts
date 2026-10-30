import type { API, BlockTool, BlockToolConstructorOptions } from '@editorjs/editorjs';
import { toolboxEntry } from '../../blocks';
import { field, textarea } from '../../ui/kit';
import { BlockShell } from '../../ui/shell';

export interface SpoilerConfig {
    placeholder?: string;
}

export interface SpoilerData {
    text: string;
}

/** Spoiler block: one textarea; preview is the renderer's blurred text. */
export default class SpoilerTool implements BlockTool {
    private readonly api: API;
    private readonly config: SpoilerConfig;
    private data: SpoilerData;
    private shell: BlockShell | null = null;

    static get toolbox() {
        return toolboxEntry('spoiler');
    }

    static get enableLineBreaks() {
        return true;
    }

    constructor({ data, config, api }: BlockToolConstructorOptions<Partial<SpoilerData>, SpoilerConfig>) {
        this.api = api;
        this.config = config || {};
        this.data = { text: data?.text || '' };
    }

    render(): HTMLElement {
        const shell = new BlockShell({
            type: 'spoiler',
            hasContent: this.data.text.trim() !== '',
            summary: this.summary(),
        });
        this.shell = shell;
        shell.fields.append(
            field({
                label: 'Hidden text',
                hint: 'Readers click to reveal it',
                control: textarea({
                    value: this.data.text,
                    rows: 3,
                    placeholder: this.config.placeholder || 'Text to hide',
                    onInput: (v) => {
                        this.data.text = v;
                        shell.setSummary(this.summary());
                        shell.preview(this.previewData());
                    },
                }),
            }),
        );
        shell.preview(this.previewData());
        return shell.element;
    }

    private summary(): string {
        const n = this.data.text.trim().length;
        return n === 0 ? 'empty' : `${n} characters`;
    }

    private previewData(): Record<string, unknown> {
        return { text: this.data.text.trim() || 'Hidden text appears here' };
    }

    save(): SpoilerData {
        return this.data;
    }

    validate(savedData: SpoilerData): boolean {
        return savedData.text.trim() !== '';
    }

    destroy(): void {
        this.shell?.destroy();
        this.shell = null;
    }
}
