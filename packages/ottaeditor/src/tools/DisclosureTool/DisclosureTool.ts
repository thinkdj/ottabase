import type { API, BlockTool } from '@editorjs/editorjs';
import './DisclosureTool.css';

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
// Standard wording presets
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

// ---------------------------------------------------------------------------
// Tool implementation
// ---------------------------------------------------------------------------

export default class DisclosureTool implements BlockTool {
    private api: API;
    private data: DisclosureData;
    private config: DisclosureToolConfig;
    private wrapper: HTMLElement | null = null;
    private instanceId: string;

    private static idSeed = 0;

    static get CSS() {
        return {
            baseClass: 'cdx-disclosure',
            wrapper: 'cdx-disclosure__wrapper',
            section: 'cdx-disclosure__section',
            sectionHeader: 'cdx-disclosure__section-header',
            sectionToggle: 'cdx-disclosure__section-toggle',
            sectionBody: 'cdx-disclosure__section-body',
            label: 'cdx-disclosure__label',
            sublabel: 'cdx-disclosure__sublabel',
            select: 'cdx-disclosure__select',
            input: 'cdx-disclosure__input',
            textarea: 'cdx-disclosure__textarea',
            previewText: 'cdx-disclosure__preview',
            row: 'cdx-disclosure__row',
            toggle: 'cdx-disclosure__toggle',
            toggleSlider: 'cdx-disclosure__toggle-slider',
            radioGroup: 'cdx-disclosure__radio-group',
            radio: 'cdx-disclosure__radio',
            radioLabel: 'cdx-disclosure__radio-label',
        };
    }

    static get toolbox() {
        return {
            title: 'Disclosure',
            // Tabler icon: shield (disclosure/transparency feel)
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4v4c0 5-3.5 9.74-8 11-4.5-1.26-8-6-8-11V7l8-4z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
        };
    }

    static get enableLineBreaks() {
        return true;
    }

    constructor({
        data,
        config,
        api,
        block,
    }: {
        data?: Partial<DisclosureData>;
        config?: DisclosureToolConfig;
        api: API;
        block?: { id?: string };
    }) {
        this.api = api;
        this.config = config || {};
        this.instanceId = block?.id || DisclosureTool.nextId();

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

    private static nextId(): string {
        DisclosureTool.idSeed += 1;
        return `disclosure-${DisclosureTool.idSeed}`;
    }

    private domId(name: string): string {
        return `${name}-${this.instanceId}`;
    }

    render(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.classList.add(DisclosureTool.CSS.baseClass, DisclosureTool.CSS.wrapper, 'ob-plugin');

        wrapper.appendChild(this.buildAISection());
        wrapper.appendChild(this.buildSponsoredSection());

        this.wrapper = wrapper;
        return wrapper;
    }

    // -------------------------------------------------------------------------
    // AI Disclosure section
    // -------------------------------------------------------------------------

    private buildAISection(): HTMLElement {
        const section = document.createElement('div');
        section.classList.add(DisclosureTool.CSS.section);

        // Header with toggle
        const header = document.createElement('div');
        header.classList.add(DisclosureTool.CSS.sectionHeader);

        const titleGroup = document.createElement('div');
        // Tabler robot icon
        titleGroup.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>';
        const titleSpan = document.createElement('span');
        titleSpan.classList.add(DisclosureTool.CSS.label);
        titleSpan.textContent = 'AI Disclosure';
        titleGroup.appendChild(titleSpan);
        titleGroup.style.display = 'inline-flex';
        titleGroup.style.alignItems = 'center';
        titleGroup.style.gap = '6px';

        const aiEnabledId = this.domId('ai-enabled');
        const toggle = this.buildToggle(aiEnabledId, this.data.aiEnabled, (checked) => {
            this.data.aiEnabled = checked;
            body.style.display = checked ? 'flex' : 'none';
        });

        header.appendChild(titleGroup);
        header.appendChild(toggle);
        section.appendChild(header);

        // Body (shown when toggle on)
        const body = document.createElement('div');
        body.classList.add(DisclosureTool.CSS.sectionBody);
        body.style.display = this.data.aiEnabled ? 'flex' : 'none';

        // Level select
        const levelGroup = document.createElement('div');
        levelGroup.classList.add(DisclosureTool.CSS.row);

        const levelLabel = document.createElement('label');
        levelLabel.classList.add(DisclosureTool.CSS.sublabel, 'ob-hint');
        levelLabel.textContent = 'AI usage level';
        const aiLevelId = this.domId('disclosure-ai-level');
        levelLabel.setAttribute('for', aiLevelId);

        const levelSelect = document.createElement('select');
        levelSelect.id = aiLevelId;
        levelSelect.classList.add(DisclosureTool.CSS.select, 'ob-select');

        const levels: AIDisclosureLevel[] = ['slight', 'mid', 'high', 'custom'];
        levels.forEach((level) => {
            const opt = document.createElement('option');
            opt.value = level;
            opt.textContent = AI_LEVEL_LABELS[level];
            opt.selected = level === this.data.aiLevel;
            levelSelect.appendChild(opt);
        });

        // Custom percent input (shown only when 'custom' selected)
        const percentGroup = document.createElement('div');
        percentGroup.classList.add(DisclosureTool.CSS.row);
        percentGroup.style.display = this.data.aiLevel === 'custom' ? 'flex' : 'none';

        const percentLabel = document.createElement('label');
        percentLabel.classList.add(DisclosureTool.CSS.sublabel);
        percentLabel.textContent = 'AI usage %';
        const aiPercentId = this.domId('disclosure-ai-percent');
        percentLabel.setAttribute('for', aiPercentId);

        const percentInput = document.createElement('input');
        percentInput.id = aiPercentId;
        percentInput.type = 'number';
        percentInput.min = '1';
        percentInput.max = '100';
        percentInput.classList.add(DisclosureTool.CSS.input, 'ob-input');
        percentInput.value = String(this.data.aiPercent ?? 50);
        percentInput.placeholder = '1–100';
        percentInput.addEventListener('input', () => {
            const val = parseInt(percentInput.value);
            if (Number.isFinite(val) && val >= 1 && val <= 100) {
                this.data.aiPercent = val;
                this.updateAIPreview(previewEl);
            }
        });

        percentGroup.appendChild(percentLabel);
        percentGroup.appendChild(percentInput);

        // Preview text
        const previewEl = document.createElement('div');
        previewEl.classList.add(DisclosureTool.CSS.previewText);

        levelSelect.addEventListener('change', () => {
            this.data.aiLevel = levelSelect.value as AIDisclosureLevel;
            percentGroup.style.display = this.data.aiLevel === 'custom' ? 'flex' : 'none';
            this.updateAIPreview(previewEl);
        });

        this.updateAIPreview(previewEl);

        levelGroup.appendChild(levelLabel);
        levelGroup.appendChild(levelSelect);

        body.appendChild(levelGroup);
        body.appendChild(percentGroup);
        body.appendChild(previewEl);

        section.appendChild(body);
        return section;
    }

    private updateAIPreview(el: HTMLElement): void {
        const text = this.getAIDisclosureText();
        el.textContent = text ? `Preview: "${text}"` : '';
        el.style.display = text ? 'block' : 'none';
    }

    getAIDisclosureText(): string {
        if (!this.data.aiEnabled || this.data.aiLevel === 'none') return '';
        if (this.data.aiLevel === 'custom') {
            const pct = this.data.aiPercent ?? 50;
            return `Approximately ${pct}% of this content was created with AI assistance.`;
        }
        return AI_LEVEL_WORDING[this.data.aiLevel as keyof typeof AI_LEVEL_WORDING] || '';
    }

    // -------------------------------------------------------------------------
    // Sponsored Disclosure section
    // -------------------------------------------------------------------------

    private buildSponsoredSection(): HTMLElement {
        const section = document.createElement('div');
        section.classList.add(DisclosureTool.CSS.section);
        section.style.borderTop = '1px solid hsl(var(--border))';
        section.style.marginTop = '4px';
        section.style.paddingTop = '8px';

        // Header with toggle
        const header = document.createElement('div');
        header.classList.add(DisclosureTool.CSS.sectionHeader);

        const titleGroup = document.createElement('div');
        // Tabler tag icon (sponsored/commercial)
        titleGroup.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 21l-8.5-8.5 7.5-7.5H20v9.5l-8.5 6.5z"/><circle cx="17" cy="7" r="1"/></svg>';
        const titleSpan = document.createElement('span');
        titleSpan.classList.add(DisclosureTool.CSS.label);
        titleSpan.textContent = 'Sponsored Disclosure';
        titleGroup.appendChild(titleSpan);
        titleGroup.style.display = 'inline-flex';
        titleGroup.style.alignItems = 'center';
        titleGroup.style.gap = '6px';

        const sponsoredEnabledId = this.domId('sponsored-enabled');
        const toggle = this.buildToggle(sponsoredEnabledId, this.data.sponsoredEnabled, (checked) => {
            this.data.sponsoredEnabled = checked;
            body.style.display = checked ? 'flex' : 'none';
        });

        header.appendChild(titleGroup);
        header.appendChild(toggle);
        section.appendChild(header);

        // Body
        const body = document.createElement('div');
        body.classList.add(DisclosureTool.CSS.sectionBody);
        body.style.display = this.data.sponsoredEnabled ? 'flex' : 'none';

        // Type radio: Preset vs Custom
        const typeGroup = document.createElement('div');
        typeGroup.classList.add(DisclosureTool.CSS.radioGroup);

        const previewEl = document.createElement('div');
        previewEl.classList.add(DisclosureTool.CSS.previewText);

        const customTextGroup = document.createElement('div');
        customTextGroup.classList.add(DisclosureTool.CSS.row);
        customTextGroup.style.display = this.data.sponsoredType === 'custom' ? 'flex' : 'none';

        const customLabel = document.createElement('label');
        customLabel.classList.add(DisclosureTool.CSS.sublabel, 'ob-hint');
        customLabel.textContent = 'Custom disclaimer';
        const sponsoredTextId = this.domId('disclosure-sponsored-text');
        customLabel.setAttribute('for', sponsoredTextId);

        const customTextarea = document.createElement('textarea');
        customTextarea.id = sponsoredTextId;
        customTextarea.classList.add(DisclosureTool.CSS.textarea, 'ob-textarea');
        customTextarea.placeholder = 'Enter your custom sponsored disclaimer...';
        customTextarea.value = this.data.sponsoredText || '';
        customTextarea.rows = 2;
        customTextarea.addEventListener('input', () => {
            this.data.sponsoredText = customTextarea.value;
            this.updateSponsoredPreview(previewEl);
        });

        customTextGroup.appendChild(customLabel);
        customTextGroup.appendChild(customTextarea);

        const radioTypes: Array<{ value: 'preset' | 'custom'; label: string }> = [
            { value: 'preset', label: 'Standard text' },
            { value: 'custom', label: 'Custom text' },
        ];

        const sponsoredTypeName = this.domId('disclosure-sponsored-type');
        radioTypes.forEach(({ value, label }) => {
            const radioWrapper = document.createElement('label');
            radioWrapper.classList.add(DisclosureTool.CSS.radioLabel);

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = sponsoredTypeName;
            radio.classList.add(DisclosureTool.CSS.radio);
            radio.value = value;
            radio.checked = value === this.data.sponsoredType;
            radio.addEventListener('change', () => {
                this.data.sponsoredType = value;
                customTextGroup.style.display = value === 'custom' ? 'flex' : 'none';
                this.updateSponsoredPreview(previewEl);
            });

            radioWrapper.appendChild(radio);
            radioWrapper.appendChild(document.createTextNode(label));
            typeGroup.appendChild(radioWrapper);
        });

        this.updateSponsoredPreview(previewEl);

        body.appendChild(typeGroup);
        body.appendChild(customTextGroup);
        body.appendChild(previewEl);

        section.appendChild(body);
        return section;
    }

    private updateSponsoredPreview(el: HTMLElement): void {
        const text = this.getSponsoredText();
        el.textContent = text ? `Preview: "${text}"` : '';
        el.style.display = text ? 'block' : 'none';
    }

    getSponsoredText(): string {
        if (!this.data.sponsoredEnabled) return '';
        if (this.data.sponsoredType === 'custom') return this.data.sponsoredText?.trim() || '';
        return SPONSORED_PRESET_TEXT;
    }

    // -------------------------------------------------------------------------
    // Shared: toggle switch
    // -------------------------------------------------------------------------

    private buildToggle(id: string, checked: boolean, onChange: (checked: boolean) => void): HTMLElement {
        const label = document.createElement('label');
        label.classList.add(DisclosureTool.CSS.toggle);
        label.setAttribute('for', id);

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id;
        input.checked = checked;
        input.style.display = 'none';
        input.addEventListener('change', () => onChange(input.checked));

        const slider = document.createElement('span');
        slider.classList.add(DisclosureTool.CSS.toggleSlider);
        if (checked) slider.classList.add('cdx-disclosure__toggle-slider--on');

        input.addEventListener('change', () => {
            slider.classList.toggle('cdx-disclosure__toggle-slider--on', input.checked);
        });

        label.appendChild(input);
        label.appendChild(slider);
        return label;
    }

    // -------------------------------------------------------------------------
    // EditorJS lifecycle
    // -------------------------------------------------------------------------

    save(): DisclosureData {
        return { ...this.data };
    }

    validate(savedData: DisclosureData): boolean {
        // Valid if at least one disclosure type is active and coherent
        if (!savedData.aiEnabled && !savedData.sponsoredEnabled) return false;
        if (savedData.aiEnabled && savedData.aiLevel === 'none') return false;
        if (savedData.sponsoredEnabled && savedData.sponsoredType === 'custom') {
            return (savedData.sponsoredText?.trim() || '') !== '';
        }
        return true;
    }
}
