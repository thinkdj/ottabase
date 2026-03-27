import type { API, BlockTool } from '@editorjs/editorjs';
import './CTATool.css';

interface CTAToolConfig {
    placeholder?: string;
    defaultStyle?: 'primary' | 'secondary' | 'outline' | 'ghost';
    defaultAlignment?: 'left' | 'center' | 'right';
}

interface CTAData {
    text: string;
    url: string;
    style: 'primary' | 'secondary' | 'outline' | 'ghost';
    alignment: 'left' | 'center' | 'right';
    openInNewTab: boolean;
    icon?: string;
}

export default class CTATool implements BlockTool {
    private api: API;
    private data: CTAData;
    private config: CTAToolConfig;
    private wrapper: HTMLElement | null = null;
    private instanceId: string;

    private static idSeed = 0;

    static get CSS() {
        return {
            baseClass: 'cdx-cta',
            wrapper: 'cdx-cta__wrapper',
            form: 'cdx-cta__form',
            row: 'cdx-cta__row',
            inputGroup: 'cdx-cta__input-group',
            label: 'cdx-cta__label',
            input: 'cdx-cta__input',
            select: 'cdx-cta__select',
            checkbox: 'cdx-cta__checkbox',
            checkboxLabel: 'cdx-cta__checkbox-label',
            preview: 'cdx-cta__preview',
            previewButton: 'cdx-cta__preview-button',
            alignBtnGroup: 'cdx-cta__align-group',
            alignBtn: 'cdx-cta__align-btn',
            alignBtnActive: 'cdx-cta__align-btn--active',
        };
    }

    static get toolbox() {
        return {
            title: 'Call to Action',
            // Tabler-style CTA button icon with improved spacing
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="10" rx="3"/><path d="M9 12h6"/><path d="M13 10l2 2-2 2"/></svg>',
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
        data?: Partial<CTAData>;
        config?: CTAToolConfig;
        api: API;
        block?: { id?: string };
    }) {
        this.api = api;
        this.config = config || {};
        this.instanceId = block?.id || CTATool.nextId();
        this.data = {
            text: data?.text || 'Get Started',
            url: data?.url || '',
            style: data?.style || this.config.defaultStyle || 'primary',
            alignment: data?.alignment || this.config.defaultAlignment || 'center',
            openInNewTab: data?.openInNewTab ?? false,
            icon: data?.icon || '',
        };
    }

    private static nextId(): string {
        CTATool.idSeed += 1;
        return `cta-${CTATool.idSeed}`;
    }

    private domId(name: string): string {
        return `${name}-${this.instanceId}`;
    }

    render(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.classList.add(CTATool.CSS.baseClass, CTATool.CSS.wrapper, 'ob-plugin');

        const form = document.createElement('div');
        form.classList.add(CTATool.CSS.form, 'ob-form');

        // Row 1: Text input + Style select
        const row1 = document.createElement('div');
        row1.classList.add(CTATool.CSS.row);

        // Text input
        const textGroup = document.createElement('div');
        textGroup.classList.add(CTATool.CSS.inputGroup, 'ob-input-group');
        textGroup.style.flex = '1';

        const textLabel = document.createElement('label');
        textLabel.classList.add(CTATool.CSS.label, 'ob-label');
        textLabel.textContent = 'Button Text';
        const textInputId = this.domId('cta-text');
        textLabel.setAttribute('for', textInputId);

        const textInput = document.createElement('input');
        textInput.id = textInputId;
        textInput.type = 'text';
        textInput.classList.add(CTATool.CSS.input, 'ob-input');
        textInput.placeholder = this.config.placeholder || 'Enter button text...';
        textInput.value = this.data.text;
        textInput.addEventListener('input', (event) => {
            this.data.text = (event.target as HTMLInputElement).value;
            this.updatePreview();
        });

        textGroup.appendChild(textLabel);
        textGroup.appendChild(textInput);

        // Style select
        const styleGroup = document.createElement('div');
        styleGroup.classList.add(CTATool.CSS.inputGroup, 'ob-input-group');
        styleGroup.style.width = '110px';

        const styleLabel = document.createElement('label');
        styleLabel.classList.add(CTATool.CSS.label, 'ob-label');
        styleLabel.textContent = 'Style';
        const styleSelectId = this.domId('cta-style');
        styleLabel.setAttribute('for', styleSelectId);

        const styleSelect = document.createElement('select');
        styleSelect.id = styleSelectId;
        styleSelect.classList.add(CTATool.CSS.select, 'ob-select');

        const styles: Array<{ value: CTAData['style']; label: string }> = [
            { value: 'primary', label: 'Primary' },
            { value: 'secondary', label: 'Secondary' },
            { value: 'outline', label: 'Outline' },
            { value: 'ghost', label: 'Ghost' },
        ];

        styles.forEach((style) => {
            const option = document.createElement('option');
            option.value = style.value;
            option.textContent = style.label;
            option.selected = style.value === this.data.style;
            styleSelect.appendChild(option);
        });

        styleSelect.addEventListener('change', (event) => {
            this.data.style = (event.target as HTMLSelectElement).value as CTAData['style'];
            this.updatePreview();
        });

        styleGroup.appendChild(styleLabel);
        styleGroup.appendChild(styleSelect);

        row1.appendChild(textGroup);
        row1.appendChild(styleGroup);

        // Row 2: URL input
        const urlGroup = document.createElement('div');
        urlGroup.classList.add(CTATool.CSS.inputGroup, 'ob-input-group');

        const urlLabel = document.createElement('label');
        urlLabel.classList.add(CTATool.CSS.label, 'ob-label');
        urlLabel.textContent = 'URL';
        const urlInputId = this.domId('cta-url');
        urlLabel.setAttribute('for', urlInputId);

        const urlInput = document.createElement('input');
        urlInput.id = urlInputId;
        urlInput.type = 'url';
        urlInput.classList.add(CTATool.CSS.input, 'ob-input');
        urlInput.placeholder = 'https://example.com';
        urlInput.value = this.data.url;
        urlInput.addEventListener('input', (event) => {
            this.data.url = (event.target as HTMLInputElement).value;
            this.updatePreview();
        });

        urlGroup.appendChild(urlLabel);
        urlGroup.appendChild(urlInput);

        // Row 3: Alignment + Open in new tab
        const row3 = document.createElement('div');
        row3.classList.add(CTATool.CSS.row);

        // Alignment buttons
        const alignGroup = document.createElement('div');
        alignGroup.classList.add(CTATool.CSS.inputGroup, 'ob-input-group');
        alignGroup.style.flex = '1';

        const alignLabel = document.createElement('label');
        alignLabel.classList.add(CTATool.CSS.label, 'ob-label');
        alignLabel.textContent = 'Alignment';

        const alignBtnGroup = document.createElement('div');
        alignBtnGroup.classList.add(CTATool.CSS.alignBtnGroup);

        const alignments: Array<{ value: CTAData['alignment']; icon: string; title: string }> = [
            {
                value: 'left',
                title: 'Left',
                // Tabler icon: align-left
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="18" y2="18"/></svg>',
            },
            {
                value: 'center',
                title: 'Center',
                // Tabler icon: align-center
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="5" y1="18" x2="19" y2="18"/></svg>',
            },
            {
                value: 'right',
                title: 'Right',
                // Tabler icon: align-right
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="6" y1="18" x2="20" y2="18"/></svg>',
            },
        ];

        alignments.forEach(({ value, icon, title }) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.classList.add(CTATool.CSS.alignBtn);
            if (value === this.data.alignment) btn.classList.add(CTATool.CSS.alignBtnActive);
            btn.innerHTML = icon;
            btn.title = title;
            btn.setAttribute('data-align', value);
            btn.addEventListener('click', () => {
                this.data.alignment = value;
                alignBtnGroup.querySelectorAll(`.${CTATool.CSS.alignBtn}`).forEach((b) => {
                    b.classList.toggle(CTATool.CSS.alignBtnActive, b.getAttribute('data-align') === value);
                });
                this.updatePreview();
            });
            alignBtnGroup.appendChild(btn);
        });

        alignGroup.appendChild(alignLabel);
        alignGroup.appendChild(alignBtnGroup);

        // Open in new tab checkbox
        const checkboxGroup = document.createElement('div');
        checkboxGroup.classList.add(CTATool.CSS.inputGroup);
        checkboxGroup.style.justifyContent = 'flex-end';
        checkboxGroup.style.flexDirection = 'row';
        checkboxGroup.style.alignItems = 'flex-end';
        checkboxGroup.style.gap = '6px';
        checkboxGroup.style.paddingBottom = '4px';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        const newTabId = this.domId('cta-new-tab');
        checkbox.id = newTabId;
        checkbox.classList.add(CTATool.CSS.checkbox, 'ob-checkbox');
        checkbox.checked = this.data.openInNewTab;
        checkbox.addEventListener('change', (event) => {
            this.data.openInNewTab = (event.target as HTMLInputElement).checked;
            this.updatePreview();
        });

        const checkboxLabel = document.createElement('label');
        checkboxLabel.classList.add(CTATool.CSS.checkboxLabel, 'ob-checkbox-label');
        checkboxLabel.setAttribute('for', newTabId);
        checkboxLabel.textContent = ' New tab';
        checkboxLabel.style.cursor = 'pointer';
        checkboxLabel.style.margin = '0';

        checkboxGroup.appendChild(checkbox);
        checkboxGroup.appendChild(checkboxLabel);

        row3.appendChild(alignGroup);
        row3.appendChild(checkboxGroup);

        // Preview
        const preview = document.createElement('div');
        preview.classList.add(CTATool.CSS.preview);

        const previewButton = document.createElement('a');
        previewButton.classList.add(CTATool.CSS.previewButton);
        previewButton.href = this.data.url || '#';
        previewButton.textContent = this.data.text || 'Button';
        previewButton.target = this.data.openInNewTab ? '_blank' : '_self';
        previewButton.rel = this.data.openInNewTab ? 'noopener noreferrer' : '';

        preview.appendChild(previewButton);

        form.appendChild(row1);
        form.appendChild(urlGroup);
        form.appendChild(row3);
        form.appendChild(preview);

        wrapper.appendChild(form);

        this.wrapper = wrapper;
        this.updatePreview();

        return wrapper;
    }

    private updatePreview(): void {
        if (!this.wrapper) return;

        const previewButton = this.wrapper.querySelector(`.${CTATool.CSS.previewButton}`) as HTMLAnchorElement;
        if (!previewButton) return;

        previewButton.textContent = this.data.text || 'Button';
        previewButton.href = this.data.url || '#';
        previewButton.target = this.data.openInNewTab ? '_blank' : '_self';
        previewButton.rel = this.data.openInNewTab ? 'noopener noreferrer' : '';

        // Update style classes
        previewButton.classList.remove(
            'cdx-cta__preview-button--primary',
            'cdx-cta__preview-button--secondary',
            'cdx-cta__preview-button--outline',
            'cdx-cta__preview-button--ghost',
        );
        previewButton.classList.add(`cdx-cta__preview-button--${this.data.style}`);

        // Update preview alignment
        const preview = this.wrapper.querySelector(`.${CTATool.CSS.preview}`) as HTMLElement;
        if (preview) {
            preview.style.textAlign = this.data.alignment;
        }
    }

    save(): CTAData {
        return { ...this.data };
    }

    validate(savedData: CTAData): boolean {
        return savedData.text.trim() !== '' && savedData.url.trim() !== '';
    }
}
