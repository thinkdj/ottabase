/**
 * BeforeAfterTool - EditorJS block tool for comparing two images with a draggable slider.
 *
 * Renders a split-view with "before" (left) and "after" (right) images.
 * The user drags a handle to reveal more or less of each image.
 * Supports horizontal and vertical orientations, captions, and initial slider position.
 */
import './BeforeAfterTool.css';

export interface BeforeAfterData {
    /** URL for the "before" image (left / top) */
    beforeUrl: string;
    /** URL for the "after" image (right / bottom) */
    afterUrl: string;
    /** Optional label shown on the before side */
    beforeLabel: string;
    /** Optional label shown on the after side */
    afterLabel: string;
    /** Slider orientation: 'horizontal' (left↔right) or 'vertical' (top↔bottom) */
    orientation: 'horizontal' | 'vertical';
    /** Initial slider position 0–100 (percentage from left/top) */
    sliderPosition: number;
    /** Optional caption below the block */
    caption: string;
}

export interface BeforeAfterToolConfig {
    /** Default orientation */
    defaultOrientation?: 'horizontal' | 'vertical';
    /** Default slider position (0–100) */
    defaultPosition?: number;
}

const DEFAULT_DATA: BeforeAfterData = {
    beforeUrl: '',
    afterUrl: '',
    beforeLabel: 'Before',
    afterLabel: 'After',
    orientation: 'horizontal',
    sliderPosition: 50,
    caption: '',
};

/* ───────────────────────────────────────────────────────────────────────────── */

export default class BeforeAfterTool {
    private api: any;
    private data: BeforeAfterData;
    private config: BeforeAfterToolConfig;
    private wrapper: HTMLElement | null = null;
    private block: any;

    /* State for drag interaction */
    private isDragging = false;
    private containerEl: HTMLElement | null = null;
    private boundEndDrag = () => this.endDrag();

    static get toolbox() {
        return {
            title: 'Before / After',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><polyline points="8 12 5 12"/><polyline points="19 12 16 12"/></svg>',
        };
    }

    static get CSS() {
        return {
            wrapper: 'cdx-before-after',
            form: 'cdx-before-after__form',
            preview: 'cdx-before-after__preview',
            container: 'cdx-before-after__container',
            before: 'cdx-before-after__before',
            after: 'cdx-before-after__after',
            handle: 'cdx-before-after__handle',
            label: 'cdx-before-after__label',
        };
    }

    constructor({
        data,
        api,
        config,
        block,
    }: {
        data: BeforeAfterData;
        api: any;
        config: BeforeAfterToolConfig;
        block: any;
    }) {
        this.api = api;
        this.block = block;
        this.config = config || {};
        this.data = {
            ...DEFAULT_DATA,
            orientation: this.config.defaultOrientation || DEFAULT_DATA.orientation,
            sliderPosition: this.config.defaultPosition ?? DEFAULT_DATA.sliderPosition,
            ...data,
        };
    }

    /* ── render ─────────────────────────────────────────────────────────────── */

    render(): HTMLElement {
        this.wrapper = document.createElement('div');
        this.wrapper.classList.add('ob-plugin', BeforeAfterTool.CSS.wrapper);

        this.buildUI();
        return this.wrapper;
    }

    /* ── save ──────────────────────────────────────────────────────────────── */

    save(): BeforeAfterData {
        return { ...this.data };
    }

    validate(savedData: BeforeAfterData): boolean {
        return !!(savedData.beforeUrl || savedData.afterUrl);
    }

    /* ── UI construction ───────────────────────────────────────────────────── */

    private buildUI(): void {
        if (!this.wrapper) return;
        this.wrapper.innerHTML = '';

        /* Form inputs */
        const form = document.createElement('div');
        form.className = 'ob-form cdx-before-after__form';

        /* Row: before URL + after URL */
        const urlRow = document.createElement('div');
        urlRow.className = 'cdx-before-after__url-row';

        urlRow.appendChild(
            this.createInputGroup('Before image URL', this.data.beforeUrl, 'https://…', (v) => {
                this.data.beforeUrl = v;
                this.refreshPreview();
            }),
        );
        urlRow.appendChild(
            this.createInputGroup('After image URL', this.data.afterUrl, 'https://…', (v) => {
                this.data.afterUrl = v;
                this.refreshPreview();
            }),
        );

        form.appendChild(urlRow);

        /* Row: labels */
        const labelRow = document.createElement('div');
        labelRow.className = 'cdx-before-after__label-row';

        labelRow.appendChild(
            this.createInputGroup('Before label', this.data.beforeLabel, 'Before', (v) => {
                this.data.beforeLabel = v;
                this.refreshPreview();
            }),
        );
        labelRow.appendChild(
            this.createInputGroup('After label', this.data.afterLabel, 'After', (v) => {
                this.data.afterLabel = v;
                this.refreshPreview();
            }),
        );

        form.appendChild(labelRow);

        /* Row: orientation + position + caption */
        const optionsRow = document.createElement('div');
        optionsRow.className = 'cdx-before-after__options-row';

        /* Orientation select */
        const orientGroup = document.createElement('div');
        orientGroup.className = 'ob-input-group';
        const orientLabel = document.createElement('label');
        orientLabel.className = 'ob-label';
        orientLabel.textContent = 'Orientation';
        const orientSelect = document.createElement('select');
        orientSelect.className = 'ob-select';
        ['horizontal', 'vertical'].forEach((val) => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val.charAt(0).toUpperCase() + val.slice(1);
            if (val === this.data.orientation) opt.selected = true;
            orientSelect.appendChild(opt);
        });
        orientSelect.addEventListener('change', () => {
            this.data.orientation = orientSelect.value as 'horizontal' | 'vertical';
            this.refreshPreview();
        });
        orientGroup.appendChild(orientLabel);
        orientGroup.appendChild(orientSelect);
        optionsRow.appendChild(orientGroup);

        /* Position slider */
        const posGroup = document.createElement('div');
        posGroup.className = 'ob-input-group';
        const posLabel = document.createElement('label');
        posLabel.className = 'ob-label';
        posLabel.textContent = `Position (${this.data.sliderPosition}%)`;
        const posInput = document.createElement('input');
        posInput.type = 'range';
        posInput.min = '0';
        posInput.max = '100';
        posInput.value = String(this.data.sliderPosition);
        posInput.className = 'ob-input cdx-before-after__slider-input';
        posInput.addEventListener('input', () => {
            this.data.sliderPosition = Number(posInput.value);
            posLabel.textContent = `Position (${this.data.sliderPosition}%)`;
            this.refreshPreview();
        });
        posGroup.appendChild(posLabel);
        posGroup.appendChild(posInput);
        optionsRow.appendChild(posGroup);

        form.appendChild(optionsRow);

        /* Caption */
        form.appendChild(
            this.createInputGroup('Caption', this.data.caption, 'Add a caption…', (v) => {
                this.data.caption = v;
            }),
        );

        this.wrapper.appendChild(form);

        /* Interactive preview */
        this.buildPreview();
    }

    /* ── Preview ───────────────────────────────────────────────────────────── */

    private buildPreview(): void {
        if (!this.wrapper) return;

        /* Remove old preview */
        const old = this.wrapper.querySelector(`.${BeforeAfterTool.CSS.preview}`);
        if (old) old.remove();

        if (!this.data.beforeUrl && !this.data.afterUrl) return;

        const preview = document.createElement('div');
        preview.className = BeforeAfterTool.CSS.preview;

        const container = document.createElement('div');
        container.className = `${BeforeAfterTool.CSS.container} ${this.data.orientation === 'vertical' ? 'cdx-before-after__container--vertical' : ''}`;
        this.containerEl = container;

        /* After image (sits behind the clip) */
        if (this.data.afterUrl) {
            const afterImg = document.createElement('img');
            afterImg.src = this.data.afterUrl;
            afterImg.alt = this.data.afterLabel || 'After';
            afterImg.className = BeforeAfterTool.CSS.after;
            afterImg.draggable = false;
            container.appendChild(afterImg);
        }

        /* Before image (clipped) */
        if (this.data.beforeUrl) {
            const beforeDiv = document.createElement('div');
            beforeDiv.className = BeforeAfterTool.CSS.before;
            this.applyClip(beforeDiv);

            const beforeImg = document.createElement('img');
            beforeImg.src = this.data.beforeUrl;
            beforeImg.alt = this.data.beforeLabel || 'Before';
            beforeImg.draggable = false;
            beforeDiv.appendChild(beforeImg);
            container.appendChild(beforeDiv);
        }

        /* Labels */
        if (this.data.beforeLabel) {
            const lbl = document.createElement('span');
            lbl.className = `${BeforeAfterTool.CSS.label} cdx-before-after__label--before`;
            lbl.textContent = this.data.beforeLabel;
            container.appendChild(lbl);
        }
        if (this.data.afterLabel) {
            const lbl = document.createElement('span');
            lbl.className = `${BeforeAfterTool.CSS.label} cdx-before-after__label--after`;
            lbl.textContent = this.data.afterLabel;
            container.appendChild(lbl);
        }

        /* Drag handle */
        const handle = document.createElement('div');
        handle.className = BeforeAfterTool.CSS.handle;
        this.positionHandle(handle);
        container.appendChild(handle);

        /* Drag events */
        handle.addEventListener('mousedown', (e) => this.startDrag(e));
        handle.addEventListener('touchstart', (e) => this.startDrag(e), { passive: false });
        container.addEventListener('mousemove', (e) => this.onDrag(e));
        container.addEventListener('touchmove', (e) => this.onDrag(e), { passive: false });
        document.addEventListener('mouseup', this.boundEndDrag);
        document.addEventListener('touchend', this.boundEndDrag);

        preview.appendChild(container);
        this.wrapper.appendChild(preview);
    }

    private refreshPreview(): void {
        this.buildPreview();
    }

    /* ── Drag logic ────────────────────────────────────────────────────────── */

    private startDrag(e: MouseEvent | TouchEvent): void {
        e.preventDefault();
        this.isDragging = true;
    }

    private onDrag(e: MouseEvent | TouchEvent): void {
        if (!this.isDragging || !this.containerEl) return;
        e.preventDefault();

        const rect = this.containerEl.getBoundingClientRect();
        let clientX: number, clientY: number;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        let pct: number;
        if (this.data.orientation === 'vertical') {
            pct = ((clientY - rect.top) / rect.height) * 100;
        } else {
            pct = ((clientX - rect.left) / rect.width) * 100;
        }

        pct = Math.max(0, Math.min(100, pct));
        this.data.sliderPosition = Math.round(pct);

        /* Update clip + handle position without rebuilding DOM */
        const beforeDiv = this.containerEl.querySelector(`.${BeforeAfterTool.CSS.before}`) as HTMLElement | null;
        if (beforeDiv) this.applyClip(beforeDiv);

        const handle = this.containerEl.querySelector(`.${BeforeAfterTool.CSS.handle}`) as HTMLElement | null;
        if (handle) this.positionHandle(handle);

        /* Sync position slider if visible */
        const rangeInput = this.wrapper?.querySelector('.cdx-before-after__slider-input') as HTMLInputElement | null;
        if (rangeInput) rangeInput.value = String(this.data.sliderPosition);
        const posLabel = this.wrapper?.querySelector('.ob-input-group .ob-label');
        if (posLabel && posLabel.textContent?.startsWith('Position')) {
            posLabel.textContent = `Position (${this.data.sliderPosition}%)`;
        }
    }

    private endDrag(): void {
        this.isDragging = false;
    }

    /* ── Helpers ────────────────────────────────────────────────────────────── */

    private applyClip(el: HTMLElement): void {
        const p = this.data.sliderPosition;
        if (this.data.orientation === 'vertical') {
            el.style.clipPath = `inset(0 0 ${100 - p}% 0)`;
        } else {
            el.style.clipPath = `inset(0 ${100 - p}% 0 0)`;
        }
    }

    private positionHandle(el: HTMLElement): void {
        const p = this.data.sliderPosition;
        if (this.data.orientation === 'vertical') {
            el.style.top = `${p}%`;
            el.style.left = '0';
            el.style.right = '0';
            el.style.width = '100%';
            el.style.height = '4px';
            el.style.transform = 'translateY(-50%)';
        } else {
            el.style.left = `${p}%`;
            el.style.top = '0';
            el.style.bottom = '0';
            el.style.height = '100%';
            el.style.width = '4px';
            el.style.transform = 'translateX(-50%)';
        }
    }

    private createInputGroup(
        label: string,
        value: string,
        placeholder: string,
        onChange: (v: string) => void,
    ): HTMLElement {
        const group = document.createElement('div');
        group.className = 'ob-input-group';

        const lbl = document.createElement('label');
        lbl.className = 'ob-label';
        lbl.textContent = label;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'ob-input';
        input.value = value;
        input.placeholder = placeholder;
        input.addEventListener('input', () => onChange(input.value));

        group.appendChild(lbl);
        group.appendChild(input);
        return group;
    }

    /* ── Cleanup ────────────────────────────────────────────────────────────── */

    destroy(): void {
        this.isDragging = false;
        document.removeEventListener('mouseup', this.boundEndDrag);
        document.removeEventListener('touchend', this.boundEndDrag);
        this.containerEl = null;
    }
}
