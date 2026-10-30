import type { API, BlockTool, BlockToolConstructorOptions } from '@editorjs/editorjs';
import { toolboxEntry } from '../../blocks';
import { field, h, segment, select, stack, textInput, textarea, toggle } from '../../ui/kit';
import { BlockShell } from '../../ui/shell';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AIDisclosureLevel = 'none' | 'slight' | 'mid' | 'high' | 'custom';

export interface DisclosureData {
    /** Whether the AI disclosure section is enabled */
    aiEnabled: boolean;
    /** Preset level for AI usage, or 'custom' for a percentage */
    aiLevel: AIDisclosureLevel;
    /** Custom percentage value (1–100), used when aiLevel === 'custom' */
    aiPercent?: number;
    /** Whether the sponsored disclosure section is enabled */
    sponsoredEnabled: boolean;
    /** Preset sponsored text ('preset') or custom text */
    sponsoredType: 'preset' | 'custom';
    /** Custom sponsored text, used when sponsoredType === 'custom' */
    sponsoredText?: string;
}

export interface DisclosureToolConfig {
    defaultAILevel?: AIDisclosureLevel;
}

// ---------------------------------------------------------------------------
// Standard wording presets (mirrored by the renderer)
// ---------------------------------------------------------------------------

export const AI_LEVEL_LABELS: Record<AIDisclosureLevel, string> = {
    none: 'None',
    slight: 'Slight AI help',
    mid: 'Significant AI help',
    high: 'Primarily AI-generated',
    custom: 'Custom %',
};

export const AI_LEVEL_WORDING: Record<Exclude<AIDisclosureLevel, 'none' | 'custom'>, string> = {
    slight: 'AI tools were used to assist in light editing and proofreading of this content.',
    mid: 'AI tools were significantly used in drafting and editing this content.',
    high: 'This content was primarily generated with AI assistance and reviewed by a human editor.',
};

export const SPONSORED_PRESET_TEXT =
    'This content was created in partnership with a sponsor. Our editorial standards remain independent.';

const AI_LEVEL_OPTIONS = (['slight', 'mid', 'high', 'custom'] as const).map((value) => ({
    value,
    label: AI_LEVEL_LABELS[value],
}));

/**
 * Disclosure block: two switches (AI use, sponsorship), each revealing its options when on.
 * Preview is the renderer's notice with the exact wording that will publish.
 */
export default class DisclosureTool implements BlockTool {
    private readonly api: API;
    private readonly config: DisclosureToolConfig;
    private data: DisclosureData;
    private shell: BlockShell | null = null;

    static get toolbox() {
        return toolboxEntry('disclosure');
    }

    static get enableLineBreaks() {
        return true;
    }

    constructor({ data, config, api }: BlockToolConstructorOptions<Partial<DisclosureData>, DisclosureToolConfig>) {
        this.api = api;
        this.config = config || {};
        const defaultAI = this.config.defaultAILevel || 'none';
        this.data = {
            aiEnabled: data?.aiEnabled ?? defaultAI !== 'none',
            aiLevel: data?.aiLevel || defaultAI,
            aiPercent: data?.aiPercent ?? 50,
            sponsoredEnabled: data?.sponsoredEnabled ?? false,
            sponsoredType: data?.sponsoredType || 'preset',
            sponsoredText: data?.sponsoredText || '',
        };
    }

    render(): HTMLElement {
        const shell = new BlockShell({
            type: 'disclosure',
            hasContent: this.validate(this.data),
            summary: this.summary(),
        });
        this.shell = shell;

        // AI section
        const percent = field({
            label: 'AI share',
            hint: 'Percent of the content, 1 to 100',
            control: textInput({
                value: String(this.data.aiPercent ?? 50),
                type: 'number',
                min: 1,
                max: 100,
                ariaLabel: 'AI usage percent',
                onInput: (v) => {
                    const n = parseInt(v, 10);
                    if (Number.isFinite(n) && n >= 1 && n <= 100) this.update({ aiPercent: n });
                },
            }),
        });
        const level = field({
            label: 'How much AI',
            control: select<AIDisclosureLevel>({
                value: this.data.aiLevel === 'none' ? 'slight' : this.data.aiLevel,
                options: AI_LEVEL_OPTIONS,
                ariaLabel: 'AI usage level',
                onChange: (v) => {
                    this.update({ aiLevel: v });
                    percent.hidden = v !== 'custom';
                },
            }),
        });
        percent.hidden = this.data.aiLevel !== 'custom';
        const aiBody = stack(level, percent);
        aiBody.hidden = !this.data.aiEnabled;
        const aiToggle = toggle({
            checked: this.data.aiEnabled,
            label: 'AI disclosure',
            hint: 'Say how much of this was made with AI',
            onChange: (on) => {
                // Turning the switch on with no level picked would save an invalid block
                this.update({
                    aiEnabled: on,
                    aiLevel: on && this.data.aiLevel === 'none' ? 'slight' : this.data.aiLevel,
                });
                aiBody.hidden = !on;
            },
        });

        // Sponsored section
        const customText = field({
            label: 'Your wording',
            control: textarea({
                value: this.data.sponsoredText ?? '',
                rows: 2,
                placeholder: 'This post is sponsored by…',
                ariaLabel: 'Custom sponsored text',
                onInput: (v) => this.update({ sponsoredText: v }),
            }),
        });
        customText.hidden = this.data.sponsoredType !== 'custom';
        const type = field({
            label: 'Wording',
            control: segment<'preset' | 'custom'>({
                value: this.data.sponsoredType,
                ariaLabel: 'Sponsored wording',
                options: [
                    { value: 'preset', label: 'Standard' },
                    { value: 'custom', label: 'Custom' },
                ],
                onChange: (v) => {
                    this.update({ sponsoredType: v });
                    customText.hidden = v !== 'custom';
                },
            }),
        });
        const sponsoredBody = stack(type, customText);
        sponsoredBody.hidden = !this.data.sponsoredEnabled;
        const sponsoredToggle = toggle({
            checked: this.data.sponsoredEnabled,
            label: 'Sponsored content',
            hint: 'Note a commercial relationship',
            onChange: (on) => {
                this.update({ sponsoredEnabled: on });
                sponsoredBody.hidden = !on;
            },
        });

        shell.fields.append(
            stack(
                h('div', { className: 'oe-stack' }, aiToggle, aiBody),
                h('hr', { className: 'oe-divider' }),
                h('div', { className: 'oe-stack' }, sponsoredToggle, sponsoredBody),
            ),
        );
        shell.preview(this.previewData());
        return shell.element;
    }

    private update(patch: Partial<DisclosureData>) {
        this.data = { ...this.data, ...patch };
        this.shell?.setSummary(this.summary());
        this.shell?.preview(this.previewData());
    }

    private summary(): string {
        const parts = [];
        if (this.data.aiEnabled && this.data.aiLevel !== 'none') parts.push(AI_LEVEL_LABELS[this.data.aiLevel]);
        if (this.data.sponsoredEnabled) parts.push('sponsored');
        return parts.length ? parts.join(' · ') : 'nothing to disclose yet';
    }

    private previewData(): Record<string, unknown> {
        return this.validate(this.data)
            ? { ...this.data }
            : { aiEnabled: true, aiLevel: 'slight', sponsoredEnabled: false, sponsoredType: 'preset' };
    }

    getAIDisclosureText(): string {
        if (!this.data.aiEnabled || this.data.aiLevel === 'none') return '';
        if (this.data.aiLevel === 'custom') {
            const pct = this.data.aiPercent ?? 50;
            return `Approximately ${pct}% of this content was created with AI assistance.`;
        }
        return AI_LEVEL_WORDING[this.data.aiLevel as keyof typeof AI_LEVEL_WORDING] || '';
    }

    getSponsoredText(): string {
        if (!this.data.sponsoredEnabled) return '';
        if (this.data.sponsoredType === 'custom') return this.data.sponsoredText?.trim() || '';
        return SPONSORED_PRESET_TEXT;
    }

    save(): DisclosureData {
        return { ...this.data };
    }

    validate(savedData: DisclosureData): boolean {
        if (!savedData.aiEnabled && !savedData.sponsoredEnabled) return false;
        if (savedData.aiEnabled && savedData.aiLevel === 'none') return false;
        if (savedData.sponsoredEnabled && savedData.sponsoredType === 'custom') {
            return (savedData.sponsoredText?.trim() || '') !== '';
        }
        return true;
    }

    destroy(): void {
        this.shell?.destroy();
        this.shell = null;
    }
}
