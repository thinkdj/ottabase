/**
 * BeforeAfterTool - EditorJS block tool for comparing two images with a draggable slider.
 *
 * Renders a split-view with "before" (left) and "after" (right) images.
 * The user drags a handle to reveal more or less of each image.
 * Supports horizontal and vertical orientations, captions, and initial slider position.
 *
 * ## Media Gallery Integration
 * This tool supports selecting images from the Media Gallery. When the user
 * clicks the gallery icon next to a URL input, it dispatches a `media-library-open`
 * event with a unique field identifier. The selected image is received via
 * the `media-library-selected-item` event.
 *
 * @see ImageHotspotsTool for the pattern documentation
 */
import './BeforeAfterTool.css';

/* ── SVG Icons (Lucide-style) ────────────────────────────────────────────── */
const Icons = {
    /** Gallery/Image icon for opening media library */
    gallery:
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
    /** Horizontal orientation icon */
    horizontal:
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="12" y1="5" x2="12" y2="19"/><path d="M9 12H6"/><path d="M18 12h-3"/></svg>',
    /** Vertical orientation icon */
    vertical:
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><line x1="5" y1="12" x2="19" y2="12"/><path d="M12 9V6"/><path d="M12 18v-3"/></svg>',
};

/** Image position presets (maps to CSS object-position) */
export type ImagePosition =
    | 'top-left'
    | 'top'
    | 'top-right'
    | 'left'
    | 'center'
    | 'right'
    | 'bottom-left'
    | 'bottom'
    | 'bottom-right';

export interface BeforeAfterData {
    /** URL for the "before" image (left / top) */
    beforeUrl: string;
    /** URL for the "after" image (right / bottom) */
    afterUrl: string;
    /** Optional label shown on the before side (null/empty = don't render) */
    beforeLabel: string;
    /** Optional label shown on the after side (null/empty = don't render) */
    afterLabel: string;
    /** Slider orientation: 'horizontal' (left↔right) or 'vertical' (top↔bottom) */
    orientation: 'horizontal' | 'vertical';
    /** Initial slider position 0–100 (percentage from left/top) */
    sliderPosition: number;
    /** Optional caption below the block */
    caption: string;
    /** Optional fixed height (e.g., '400px', '50vh') */
    height?: string;
    /** Image fit mode: 'contain' preserves aspect ratio, 'cover' fills container */
    imageFit?: 'contain' | 'cover';
    /** Position of before image when using cover fit */
    beforePosition?: ImagePosition;
    /** Position of after image when using cover fit */
    afterPosition?: ImagePosition;
}

export interface BeforeAfterToolConfig {
    /** Default orientation */
    defaultOrientation?: 'horizontal' | 'vertical';
    /** Default slider position (0–100) */
    defaultPosition?: number;
    /** Namespace for media library events (default: 'default') */
    namespace?: string;
    /** Default height (e.g., '400px', '50vh') */
    defaultHeight?: string;
    /** Default image fit mode */
    defaultImageFit?: 'contain' | 'cover';
}

const DEFAULT_DATA: BeforeAfterData = {
    beforeUrl: '',
    afterUrl: '',
    beforeLabel: 'Before',
    afterLabel: 'After',
    orientation: 'horizontal',
    sliderPosition: 50,
    caption: '',
    height: '',
    imageFit: 'contain',
    beforePosition: 'center',
    afterPosition: 'center',
};

/** Convert position preset to CSS object-position value */
function positionToCSS(pos: ImagePosition): string {
    const map: Record<ImagePosition, string> = {
        'top-left': 'left top',
        top: 'center top',
        'top-right': 'right top',
        left: 'left center',
        center: 'center center',
        right: 'right center',
        'bottom-left': 'left bottom',
        bottom: 'center bottom',
        'bottom-right': 'right bottom',
    };
    return map[pos] || 'center center';
}

/* ───────────────────────────────────────────────────────────────────────────── */

export default class BeforeAfterTool {
    private api: any;
    private data: BeforeAfterData;
    private config: BeforeAfterToolConfig;
    private wrapper: HTMLElement | null = null;
    private block: any;
    private namespace: string;

    /* State for drag interaction */
    private isDragging = false;
    private containerEl: HTMLElement | null = null;
    private boundEndDrag = () => this.endDrag();
    private boundOnMediaSelected: (e: Event) => void;
    private pendingField: 'beforeUrl' | 'afterUrl' | null = null;

    /* State for multi-click detection (double/triple click) */
    private clickCount = 0;
    private clickTimeout: ReturnType<typeof setTimeout> | null = null;

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
        this.namespace = this.config.namespace || 'default';
        this.data = {
            ...DEFAULT_DATA,
            orientation: this.config.defaultOrientation || DEFAULT_DATA.orientation,
            sliderPosition: this.config.defaultPosition ?? DEFAULT_DATA.sliderPosition,
            height: this.config.defaultHeight || DEFAULT_DATA.height,
            imageFit: this.config.defaultImageFit || DEFAULT_DATA.imageFit,
            ...data,
        };

        /* Bind event handler */
        this.boundOnMediaSelected = this.onMediaSelected.bind(this);
    }

    /* ── Media Library Event Handler ────────────────────────────────────────── */

    private onMediaSelected(e: Event): void {
        const event = e as CustomEvent;
        const detail = event.detail;

        /* Check if this event is for one of our fields */
        if (detail?.field === 'beforeAfter:beforeUrl') {
            if (detail?.media?.url) {
                this.data.beforeUrl = detail.media.url;
                this.buildUI();
            }
        } else if (detail?.field === 'beforeAfter:afterUrl') {
            if (detail?.media?.url) {
                this.data.afterUrl = detail.media.url;
                this.buildUI();
            }
        }
    }

    private openMediaLibrary(field: 'beforeUrl' | 'afterUrl'): void {
        window.dispatchEvent(
            new CustomEvent('media-library-open', {
                detail: {
                    source: 'editor',
                    field: `beforeAfter:${field}`,
                },
            }),
        );
    }

    /* ── render ─────────────────────────────────────────────────────────────── */

    render(): HTMLElement {
        this.wrapper = document.createElement('div');
        this.wrapper.classList.add('ob-plugin', BeforeAfterTool.CSS.wrapper);

        /* Attach media library event listener */
        window.addEventListener('media-library-selected-item', this.boundOnMediaSelected);

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

        /* Row: before URL + after URL (with gallery buttons) */
        const urlRow = document.createElement('div');
        urlRow.className = 'cdx-before-after__url-row';

        urlRow.appendChild(
            this.createInputGroupWithGallery('Before image URL', this.data.beforeUrl, 'https://…', 'beforeUrl', (v) => {
                this.data.beforeUrl = v;
                this.refreshPreview();
            }),
        );
        urlRow.appendChild(
            this.createInputGroupWithGallery('After image URL', this.data.afterUrl, 'https://…', 'afterUrl', (v) => {
                this.data.afterUrl = v;
                this.refreshPreview();
            }),
        );

        form.appendChild(urlRow);

        /* Row: labels (with hint about empty = hidden) */
        const labelRow = document.createElement('div');
        labelRow.className = 'cdx-before-after__label-row';

        labelRow.appendChild(
            this.createInputGroup('Before label', this.data.beforeLabel, 'Before (empty = hidden)', (v) => {
                this.data.beforeLabel = v;
                this.refreshPreview();
            }),
        );
        labelRow.appendChild(
            this.createInputGroup('After label', this.data.afterLabel, 'After (empty = hidden)', (v) => {
                this.data.afterLabel = v;
                this.refreshPreview();
            }),
        );

        form.appendChild(labelRow);

        /* Row: orientation toggle + position slider */
        const optionsRow = document.createElement('div');
        optionsRow.className = 'cdx-before-after__options-row';

        /* Orientation visual toggle */
        const orientGroup = document.createElement('div');
        orientGroup.className = 'ob-input-group';
        const orientLabel = document.createElement('label');
        orientLabel.className = 'ob-label';
        orientLabel.textContent = 'Orientation';

        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'cdx-before-after__orientation-toggle';

        const horizBtn = document.createElement('button');
        horizBtn.type = 'button';
        horizBtn.className = `cdx-before-after__orientation-btn${this.data.orientation === 'horizontal' ? ' cdx-before-after__orientation-btn--active' : ''}`;
        horizBtn.innerHTML = Icons.horizontal;
        horizBtn.title = 'Horizontal (left ↔ right)';
        horizBtn.addEventListener('click', () => {
            this.data.orientation = 'horizontal';
            horizBtn.classList.add('cdx-before-after__orientation-btn--active');
            vertBtn.classList.remove('cdx-before-after__orientation-btn--active');
            this.refreshPreview();
        });

        const vertBtn = document.createElement('button');
        vertBtn.type = 'button';
        vertBtn.className = `cdx-before-after__orientation-btn${this.data.orientation === 'vertical' ? ' cdx-before-after__orientation-btn--active' : ''}`;
        vertBtn.innerHTML = Icons.vertical;
        vertBtn.title = 'Vertical (top ↔ bottom)';
        vertBtn.addEventListener('click', () => {
            this.data.orientation = 'vertical';
            vertBtn.classList.add('cdx-before-after__orientation-btn--active');
            horizBtn.classList.remove('cdx-before-after__orientation-btn--active');
            this.refreshPreview();
        });

        toggleContainer.appendChild(horizBtn);
        toggleContainer.appendChild(vertBtn);
        orientGroup.appendChild(orientLabel);
        orientGroup.appendChild(toggleContainer);
        optionsRow.appendChild(orientGroup);

        /* Position slider */
        const posGroup = document.createElement('div');
        posGroup.className = 'ob-input-group';
        const posLabel = document.createElement('label');
        posLabel.className = 'ob-label cdx-before-after__position-label';
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

        /* Size controls above preview */
        this.buildSizeControls();

        /* Interactive preview */
        this.buildPreview();
    }

    /* ── Size Controls (above preview) ─────────────────────────────────────── */

    private buildSizeControls(): void {
        if (!this.wrapper) return;

        /* Reuse existing element to prevent DOM position jumping */
        let sizeControls = this.wrapper.querySelector('.cdx-before-after__size-controls') as HTMLElement;
        if (!sizeControls) {
            sizeControls = document.createElement('div');
            sizeControls.className = 'cdx-before-after__size-controls';
            /* Insert right after the form — always above the preview */
            const form = this.wrapper.querySelector('.cdx-before-after__form');
            if (form?.nextSibling) {
                this.wrapper.insertBefore(sizeControls, form.nextSibling);
            } else {
                this.wrapper.appendChild(sizeControls);
            }
        }
        sizeControls.innerHTML = '';

        /* Height + Image Fit row */
        const sizeRow = document.createElement('div');
        sizeRow.className = 'cdx-before-after__size-row';

        /* Height input */
        const heightGroup = document.createElement('div');
        heightGroup.className = 'ob-input-group';
        const heightLabel = document.createElement('label');
        heightLabel.className = 'ob-label';
        heightLabel.textContent = 'Height';
        const heightInput = document.createElement('input');
        heightInput.type = 'text';
        heightInput.className = 'ob-input';
        heightInput.placeholder = 'e.g., 400px or 50vh';
        heightInput.value = this.data.height || '';
        heightInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') heightInput.blur();
        });
        heightInput.addEventListener('blur', () => {
            const v = heightInput.value.trim();
            if (!v) {
                this.data.height = '';
                this.refreshPreview();
                return;
            }
            /* Valid CSS height: number + px/em/rem/vh, capped at 5000px */
            if (/^\d+(\.\d+)?(px|em|rem|vh)$/i.test(v)) {
                const n = parseFloat(v);
                const unit = v.replace(/[\d.]/g, '').toLowerCase();
                if (unit === 'px' && n > 5000) {
                    this.data.height = '';
                    heightInput.value = '';
                } else {
                    this.data.height = v;
                }
            } else if (/^\d+(\.\d+)?$/.test(v)) {
                const n = parseFloat(v);
                if (n >= 0 && n <= 5000) {
                    this.data.height = `${n}px`;
                    heightInput.value = this.data.height;
                } else {
                    this.data.height = '';
                    heightInput.value = '';
                }
            } else {
                this.data.height = '';
                heightInput.value = '';
            }
            this.refreshPreview();
        });
        heightGroup.appendChild(heightLabel);
        heightGroup.appendChild(heightInput);
        sizeRow.appendChild(heightGroup);

        /* Image Fit toggle */
        const fitGroup = document.createElement('div');
        fitGroup.className = 'ob-input-group';
        const fitLabel = document.createElement('label');
        fitLabel.className = 'ob-label';
        fitLabel.textContent = 'Image Fit';
        const fitToggle = document.createElement('div');
        fitToggle.className = 'cdx-before-after__fit-toggle';

        const containBtn = document.createElement('button');
        containBtn.type = 'button';
        containBtn.className = `cdx-before-after__fit-btn${this.data.imageFit !== 'cover' ? ' cdx-before-after__fit-btn--active' : ''}`;
        containBtn.textContent = 'Contain';
        containBtn.title = 'Preserve aspect ratio';
        containBtn.addEventListener('click', () => {
            this.data.imageFit = 'contain';
            this.refreshPreview();
            this.buildSizeControls(); // Rebuild to hide/show position pickers
        });

        const coverBtn = document.createElement('button');
        coverBtn.type = 'button';
        coverBtn.className = `cdx-before-after__fit-btn${this.data.imageFit === 'cover' ? ' cdx-before-after__fit-btn--active' : ''}`;
        coverBtn.textContent = 'Cover';
        coverBtn.title = 'Fill container';
        coverBtn.addEventListener('click', () => {
            this.data.imageFit = 'cover';
            this.refreshPreview();
            this.buildSizeControls(); // Rebuild to show position pickers
        });

        fitToggle.appendChild(containBtn);
        fitToggle.appendChild(coverBtn);
        fitGroup.appendChild(fitLabel);
        fitGroup.appendChild(fitToggle);
        sizeRow.appendChild(fitGroup);

        /* Position pickers inline (only shown when imageFit === 'cover') */
        if (this.data.imageFit === 'cover') {
            sizeRow.appendChild(
                this.createPositionPicker('Before image focus', this.data.beforePosition || 'center', (pos) => {
                    this.data.beforePosition = pos;
                    this.refreshPreview();
                }),
            );

            sizeRow.appendChild(
                this.createPositionPicker('After image focus', this.data.afterPosition || 'center', (pos) => {
                    this.data.afterPosition = pos;
                    this.refreshPreview();
                }),
            );
        }

        sizeControls.appendChild(sizeRow);
    }

    /* ── Position Picker (3x3 grid) ────────────────────────────────────────── */

    private createPositionPicker(
        label: string,
        current: ImagePosition,
        onChange: (pos: ImagePosition) => void,
    ): HTMLElement {
        const group = document.createElement('div');
        group.className = 'ob-input-group';

        const labelEl = document.createElement('label');
        labelEl.className = 'ob-label';
        labelEl.textContent = label;
        group.appendChild(labelEl);

        const grid = document.createElement('div');
        grid.className = 'cdx-before-after__position-grid';

        const positions: ImagePosition[] = [
            'top-left',
            'top',
            'top-right',
            'left',
            'center',
            'right',
            'bottom-left',
            'bottom',
            'bottom-right',
        ];

        positions.forEach((pos) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `cdx-before-after__position-btn${current === pos ? ' cdx-before-after__position-btn--active' : ''}`;
            btn.dataset.position = pos;
            btn.title = pos.replace('-', ' ');
            btn.addEventListener('click', () => {
                grid.querySelectorAll('.cdx-before-after__position-btn').forEach((b) => {
                    b.classList.remove('cdx-before-after__position-btn--active');
                });
                btn.classList.add('cdx-before-after__position-btn--active');
                onChange(pos);
            });
            grid.appendChild(btn);
        });

        group.appendChild(grid);
        return group;
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

        /* Apply height and imageFit if configured */
        if (this.data.height) {
            container.style.height = this.data.height;
        } else if (this.data.imageFit === 'cover') {
            /* Default height for cover mode — percentage heights don't resolve
               without an explicit parent height, causing the image to collapse */
            container.style.height = '300px';
        }
        if (this.data.imageFit === 'cover') {
            container.classList.add('cdx-before-after__container--cover');
        }

        /* After image (sits behind the clip) */
        if (this.data.afterUrl) {
            const afterImg = document.createElement('img');
            afterImg.src = this.data.afterUrl;
            afterImg.alt = this.data.afterLabel || 'After';
            afterImg.className = BeforeAfterTool.CSS.after;
            afterImg.draggable = false;
            /* Apply object-position when using cover mode */
            if (this.data.imageFit === 'cover' && this.data.afterPosition) {
                afterImg.style.objectPosition = positionToCSS(this.data.afterPosition);
            }
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
            /* Apply object-position when using cover mode */
            if (this.data.imageFit === 'cover' && this.data.beforePosition) {
                beforeImg.style.objectPosition = positionToCSS(this.data.beforePosition);
            }
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

        /* Drag events - whole container responds to dragging, not just handle */
        container.addEventListener('mousedown', (e) => this.startDrag(e));
        container.addEventListener('touchstart', (e) => this.startDrag(e), { passive: false });
        container.addEventListener('mousemove', (e) => this.onDrag(e));
        container.addEventListener('touchmove', (e) => this.onDrag(e), { passive: false });
        document.addEventListener('mouseup', this.boundEndDrag);
        document.addEventListener('touchend', this.boundEndDrag);

        /* Click events - double-click to move to cursor, triple-click to cycle */
        container.addEventListener('click', (e) => this.handleContainerClick(e));

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
        const posLabel = this.wrapper?.querySelector('.cdx-before-after__position-label');
        if (posLabel) {
            posLabel.textContent = `Position (${this.data.sliderPosition}%)`;
        }
    }

    private endDrag(): void {
        this.isDragging = false;
    }

    /**
     * Handle multi-click on preview container:
     * - Double-click: moves slider to cursor position
     * - Triple-click: cycles position 0 → 50 → 100 based on current position
     */
    private handleContainerClick(e: MouseEvent): void {
        this.clickCount++;

        if (this.clickTimeout) {
            clearTimeout(this.clickTimeout);
        }

        /* Store click position for double-click */
        const clickX = e.clientX;
        const clickY = e.clientY;

        this.clickTimeout = setTimeout(() => {
            if (this.clickCount === 2 && this.containerEl) {
                // Double-click: move slider to cursor position
                const rect = this.containerEl.getBoundingClientRect();
                let pct: number;
                if (this.data.orientation === 'vertical') {
                    pct = ((clickY - rect.top) / rect.height) * 100;
                } else {
                    pct = ((clickX - rect.left) / rect.width) * 100;
                }
                pct = Math.max(0, Math.min(100, Math.round(pct)));
                this.setSliderPosition(pct);
            } else if (this.clickCount >= 3) {
                // Triple-click: smart cycle 0 → 50 → 100
                const current = this.data.sliderPosition;
                let next: number;
                if (current < 25) {
                    next = 50;
                } else if (current < 75) {
                    next = 100;
                } else {
                    next = 0;
                }
                this.setSliderPosition(next);
            }
            this.clickCount = 0;
        }, 300);
    }

    /**
     * Update slider position and sync all UI elements
     */
    private setSliderPosition(position: number): void {
        this.data.sliderPosition = position;

        if (this.containerEl) {
            const beforeDiv = this.containerEl.querySelector(`.${BeforeAfterTool.CSS.before}`) as HTMLElement | null;
            if (beforeDiv) this.applyClip(beforeDiv);

            const handle = this.containerEl.querySelector(`.${BeforeAfterTool.CSS.handle}`) as HTMLElement | null;
            if (handle) this.positionHandle(handle);
        }

        /* Sync position slider if visible */
        const rangeInput = this.wrapper?.querySelector('.cdx-before-after__slider-input') as HTMLInputElement | null;
        if (rangeInput) rangeInput.value = String(position);
        const posLabel = this.wrapper?.querySelector('.cdx-before-after__position-label');
        if (posLabel) {
            posLabel.textContent = `Position (${position}%)`;
        }
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

    /**
     * Creates an input group with a media gallery button.
     * Pattern for media gallery integration in editor plugins:
     * - Adds a clickable icon button next to the input
     * - Dispatches 'media-library-open' event with a unique field identifier
     * - Listens for 'media-library-selected-item' event with matching field
     */
    private createInputGroupWithGallery(
        label: string,
        value: string,
        placeholder: string,
        field: 'beforeUrl' | 'afterUrl',
        onChange: (v: string) => void,
    ): HTMLElement {
        const group = document.createElement('div');
        group.className = 'ob-input-group';

        const lbl = document.createElement('label');
        lbl.className = 'ob-label';
        lbl.textContent = label;

        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'cdx-before-after__input-with-gallery';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'ob-input';
        input.value = value;
        input.placeholder = placeholder;
        input.addEventListener('input', () => onChange(input.value));

        const galleryBtn = document.createElement('button');
        galleryBtn.type = 'button';
        galleryBtn.className = 'cdx-before-after__gallery-btn';
        galleryBtn.innerHTML = Icons.gallery;
        galleryBtn.title = 'Select from Media Library';
        galleryBtn.addEventListener('click', () => this.openMediaLibrary(field));

        inputWrapper.appendChild(input);
        inputWrapper.appendChild(galleryBtn);

        group.appendChild(lbl);
        group.appendChild(inputWrapper);
        return group;
    }

    /* ── Cleanup ────────────────────────────────────────────────────────────── */

    destroy(): void {
        this.isDragging = false;
        window.removeEventListener('media-library-selected-item', this.boundOnMediaSelected);
        document.removeEventListener('mouseup', this.boundEndDrag);
        document.removeEventListener('touchend', this.boundEndDrag);
        this.containerEl = null;
    }
}
