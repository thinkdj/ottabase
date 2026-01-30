import type { API, BlockTool, BlockToolConstructorOptions } from '@editorjs/editorjs';
import './CTATool.css';

interface CTAToolConfig {
    placeholder?: string;
    defaultStyle?: 'primary' | 'secondary' | 'outline';
}

interface CTAData {
    text: string;
    url: string;
    style: 'primary' | 'secondary' | 'outline';
    openInNewTab: boolean;
    icon?: string;
}

export default class CTATool implements BlockTool {
    private api: API;
    private data: CTAData;
    private config: CTAToolConfig;
    private wrapper: HTMLElement | null = null;

    static get CSS() {
        return {
            baseClass: 'cdx-cta',
            wrapper: 'cdx-cta__wrapper',
            form: 'cdx-cta__form',
            inputGroup: 'cdx-cta__input-group',
            label: 'cdx-cta__label',
            input: 'cdx-cta__input',
            textarea: 'cdx-cta__textarea',
            select: 'cdx-cta__select',
            checkbox: 'cdx-cta__checkbox',
            checkboxLabel: 'cdx-cta__checkbox-label',
            preview: 'cdx-cta__preview',
            previewButton: 'cdx-cta__preview-button',
        };
    }

    static get toolbox() {
        return {
            title: 'Call to Action',
            icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M20.5 17h-17A2.502 2.502 0 0 1 1 14.5v-4A2.502 2.502 0 0 1 3.5 8h17a2.502 2.502 0 0 1 2.5 2.5v4a2.502 2.502 0 0 1-2.5 2.5zm-17-8A1.502 1.502 0 0 0 2 10.5v4A1.502 1.502 0 0 0 3.5 16h17a1.502 1.502 0 0 0 1.5-1.5v-4A1.502 1.502 0 0 0 20.5 9zM17 12H7v1h10z"/></svg>',
        };
    }

    static get enableLineBreaks() {
        return true;
    }

    constructor({ data, config, api }: BlockToolConstructorOptions<CTAData, CTAToolConfig>) {
        this.api = api;
        this.config = config || {};
        this.data = {
            text: data?.text || 'Get Started',
            url: data?.url || '',
            style: data?.style || this.config.defaultStyle || 'primary',
            openInNewTab: data?.openInNewTab ?? false,
            icon: data?.icon || '',
        };
    }

    render(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.classList.add(CTATool.CSS.baseClass, CTATool.CSS.wrapper);

        const form = document.createElement('div');
        form.classList.add(CTATool.CSS.form);

        // Compact layout: Text and Style in one row
        const topRow = document.createElement('div');
        topRow.style.display = 'grid';
        topRow.style.gridTemplateColumns = '1fr 120px';
        topRow.style.gap = '8px';
        topRow.style.alignItems = 'end';

        // Text input
        const textGroup = document.createElement('div');
        textGroup.classList.add(CTATool.CSS.inputGroup);

        const textLabel = document.createElement('label');
        textLabel.classList.add(CTATool.CSS.label);
        textLabel.textContent = 'Button Text';
        textLabel.setAttribute('for', 'cta-text');

        const textInput = document.createElement('input');
        textInput.id = 'cta-text';
        textInput.type = 'text';
        textInput.classList.add(CTATool.CSS.input);
        textInput.placeholder = this.config.placeholder || 'Enter button text...';
        textInput.value = this.data.text;

        textInput.addEventListener('input', (event) => {
            const target = event.target as HTMLInputElement;
            this.data.text = target.value;
            this.updatePreview();
        });

        textGroup.appendChild(textLabel);
        textGroup.appendChild(textInput);

        // Style select
        const styleGroup = document.createElement('div');
        styleGroup.classList.add(CTATool.CSS.inputGroup);

        const styleLabel = document.createElement('label');
        styleLabel.classList.add(CTATool.CSS.label);
        styleLabel.textContent = 'Style';
        styleLabel.setAttribute('for', 'cta-style');

        const styleSelect = document.createElement('select');
        styleSelect.id = 'cta-style';
        styleSelect.classList.add(CTATool.CSS.select);

        const styles: Array<{ value: CTAData['style']; label: string }> = [
            { value: 'primary', label: 'Primary' },
            { value: 'secondary', label: 'Secondary' },
            { value: 'outline', label: 'Outline' },
        ];

        styles.forEach((style) => {
            const option = document.createElement('option');
            option.value = style.value;
            option.textContent = style.label;
            option.selected = style.value === this.data.style;
            styleSelect.appendChild(option);
        });

        styleSelect.addEventListener('change', (event) => {
            const target = event.target as HTMLSelectElement;
            this.data.style = target.value as CTAData['style'];
            this.updatePreview();
        });

        styleGroup.appendChild(styleLabel);
        styleGroup.appendChild(styleSelect);

        topRow.appendChild(textGroup);
        topRow.appendChild(styleGroup);

        // URL input
        const urlGroup = document.createElement('div');
        urlGroup.classList.add(CTATool.CSS.inputGroup);

        const urlLabel = document.createElement('label');
        urlLabel.classList.add(CTATool.CSS.label);
        urlLabel.textContent = 'URL';
        urlLabel.setAttribute('for', 'cta-url');

        const urlInput = document.createElement('input');
        urlInput.id = 'cta-url';
        urlInput.type = 'url';
        urlInput.classList.add(CTATool.CSS.input);
        urlInput.placeholder = 'https://example.com';
        urlInput.value = this.data.url;

        urlInput.addEventListener('input', (event) => {
            const target = event.target as HTMLInputElement;
            this.data.url = target.value;
            this.updatePreview();
        });

        urlGroup.appendChild(urlLabel);
        urlGroup.appendChild(urlInput);

        // Open in new tab checkbox - inline with label
        const checkboxGroup = document.createElement('div');
        checkboxGroup.style.display = 'flex';
        checkboxGroup.style.alignItems = 'center';
        checkboxGroup.style.gap = '6px';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'cta-new-tab';
        checkbox.classList.add(CTATool.CSS.checkbox);
        checkbox.checked = this.data.openInNewTab;

        const checkboxLabel = document.createElement('label');
        checkboxLabel.classList.add(CTATool.CSS.checkboxLabel);
        checkboxLabel.setAttribute('for', 'cta-new-tab');
        checkboxLabel.textContent = 'Open in new tab';
        checkboxLabel.style.cursor = 'pointer';
        checkboxLabel.style.margin = '0';

        checkbox.addEventListener('change', (event) => {
            const target = event.target as HTMLInputElement;
            this.data.openInNewTab = target.checked;
            this.updatePreview();
        });

        checkboxGroup.appendChild(checkbox);
        checkboxGroup.appendChild(checkboxLabel);

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

        form.appendChild(topRow);
        form.appendChild(urlGroup);
        form.appendChild(checkboxGroup);
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
        );
        previewButton.classList.add(`cdx-cta__preview-button--${this.data.style}`);
    }

    save(): CTAData {
        return this.data;
    }

    validate(savedData: CTAData): boolean {
        return savedData.text.trim() !== '' && savedData.url.trim() !== '';
    }
}
