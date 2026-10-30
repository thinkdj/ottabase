import type { API, BlockTool, BlockToolConstructorOptions } from '@editorjs/editorjs';
import { toolboxEntry } from '../../blocks';
import { field, row, segment, stack, textInput, toggle } from '../../ui/kit';
import { BlockShell } from '../../ui/shell';

export type CTAStyle = 'primary' | 'secondary' | 'outline' | 'ghost';
export type CTAAlignment = 'left' | 'center' | 'right';

export interface CTAToolConfig {
    placeholder?: string;
    defaultStyle?: CTAStyle;
    defaultAlignment?: CTAAlignment;
}

export interface CTAData {
    text: string;
    url: string;
    style: CTAStyle;
    alignment: CTAAlignment;
    openInNewTab: boolean;
    icon?: string;
}

const STYLES: ReadonlyArray<{ value: CTAStyle; label: string }> = [
    { value: 'primary', label: 'Primary' },
    { value: 'secondary', label: 'Secondary' },
    { value: 'outline', label: 'Outline' },
    { value: 'ghost', label: 'Ghost' },
];

/**
 * Button block. Edit mode is two rows of fields; preview is the renderer's own CTA, so the
 * author sees the exact button readers get, in the brand's colours.
 */
export default class CTATool implements BlockTool {
    private readonly api: API;
    private readonly config: CTAToolConfig;
    private data: CTAData;
    private shell: BlockShell | null = null;

    static get toolbox() {
        return toolboxEntry('cta');
    }

    static get enableLineBreaks() {
        return true;
    }

    constructor({ data, config, api }: BlockToolConstructorOptions<Partial<CTAData>, CTAToolConfig>) {
        this.api = api;
        this.config = config || {};
        this.data = {
            text: data?.text || 'Get Started',
            url: data?.url || '',
            style: data?.style || this.config.defaultStyle || 'primary',
            alignment: data?.alignment || this.config.defaultAlignment || 'center',
            openInNewTab: data?.openInNewTab ?? false,
            icon: data?.icon || '',
        };
    }

    render(): HTMLElement {
        const shell = new BlockShell({ type: 'cta', hasContent: Boolean(this.data.url), summary: this.summary() });
        this.shell = shell;

        const text = textInput({
            value: this.data.text,
            placeholder: this.config.placeholder || 'Button text',
            onInput: (v) => this.update({ text: v }),
        });
        const url = textInput({
            value: this.data.url,
            type: 'url',
            placeholder: 'https://example.com/signup',
            onInput: (v) => this.update({ url: v }),
        });
        const style = segment<CTAStyle>({
            value: this.data.style,
            ariaLabel: 'Button style',
            options: STYLES,
            onChange: (v) => this.update({ style: v }),
        });
        const alignment = segment<CTAAlignment>({
            value: this.data.alignment,
            ariaLabel: 'Alignment',
            options: [
                { value: 'left', icon: 'alignLeft', label: 'Left' },
                { value: 'center', icon: 'alignCenter', label: 'Center' },
                { value: 'right', icon: 'alignRight', label: 'Right' },
            ],
            onChange: (v) => this.update({ alignment: v }),
        });
        const newTab = toggle({
            checked: this.data.openInNewTab,
            label: 'Open in a new tab',
            onChange: (v) => this.update({ openInNewTab: v }),
        });

        shell.fields.append(
            stack(
                row(
                    field({ label: 'Label', control: text, grow: true }),
                    field({ label: 'Link', control: url, grow: true }),
                ),
                row(
                    field({ label: 'Style', control: style }),
                    field({ label: 'Alignment', control: alignment }),
                    newTab,
                ),
            ),
        );
        shell.preview(this.previewData());
        return shell.element;
    }

    private update(patch: Partial<CTAData>) {
        this.data = { ...this.data, ...patch };
        this.shell?.setSummary(this.summary());
        this.shell?.preview(this.previewData());
    }

    private summary(): string {
        const style = STYLES.find((s) => s.value === this.data.style)?.label ?? this.data.style;
        return `${style} · ${this.data.alignment}`;
    }

    private previewData(): Record<string, unknown> {
        return { ...this.data, text: this.data.text || 'Button' };
    }

    save(): CTAData {
        return { ...this.data };
    }

    validate(savedData: CTAData): boolean {
        return savedData.text.trim() !== '' && savedData.url.trim() !== '';
    }

    destroy(): void {
        this.shell?.destroy();
        this.shell = null;
    }
}
