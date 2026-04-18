/**
 * ImageHotspotsTool - EditorJS block tool for placing clickable annotation
 * points on an image. Each hotspot has a position (x%, y%), title, and
 * rich-text content that appears in a tooltip/modal.
 *
 * ## Media Gallery Integration
 * This tool supports selecting images from the Media Gallery. When the user
 * clicks the gallery icon (📷) next to the URL input, it dispatches a
 * `media-library-open` event. The selected image URL is received via the
 * `media-library-selected-item` event.
 *
 * To use this pattern in other plugins:
 * 1. Dispatch `media-library-open` event with `{ detail: { source: 'editor', field: 'fieldName' } }`
 * 2. Listen for `media-library-selected-item` and check `detail.field` matches
 * 3. Update your data with `detail.media.url`
 */
import './ImageHotspotsTool.css';

/* ── SVG Icons (Lucide-style) ────────────────────────────────────────────── */
const Icons = {
    /** Gallery/Image icon for opening media library */
    gallery:
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
    /** Check icon for save action */
    check: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    /** X icon for remove action */
    remove: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
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

export interface HotspotItem {
    /** Unique id per hotspot (for keying) */
    id: string;
    /** Horizontal position as 0–100 percentage from left */
    x: number;
    /** Vertical position as 0–100 percentage from top */
    y: number;
    /** Short label shown on hover */
    title: string;
    /** Extended description shown in the tooltip */
    content: string;
}

export interface ImageHotspotsData {
    /** The base image URL */
    imageUrl: string;
    /** Alt text for the image */
    alt: string;
    /** Caption below the block */
    caption: string;
    /** Hotspot markers */
    hotspots: HotspotItem[];
    /** Optional fixed height (e.g., '400px', '50vh') */
    height?: string;
    /** Image fit mode: 'contain' preserves aspect ratio, 'cover' fills container */
    imageFit?: 'contain' | 'cover';
    /** Image position when using cover fit */
    imagePosition?: ImagePosition;
}

export interface ImageHotspotsToolConfig {
    /** Maximum number of hotspots allowed */
    maxHotspots?: number;
    /** Namespace for media library events (default: 'default') */
    namespace?: string;
}

const DEFAULT_DATA: ImageHotspotsData = {
    imageUrl: '',
    alt: '',
    caption: '',
    hotspots: [],
    height: '',
    imageFit: 'contain',
    imagePosition: 'center',
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

export default class ImageHotspotsTool {
    private api: any;
    private data: ImageHotspotsData;
    private config: ImageHotspotsToolConfig;
    private wrapper: HTMLElement | null = null;
    private block: any;
    private editingHotspotId: string | null = null;
    private namespace: string;
    private boundOnMediaSelected: (e: Event) => void;
    private boundOnDocumentClick: (e: MouseEvent) => void;

    /* Drag state for moving hotspots */
    private draggingHotspotId: string | null = null;
    private dragStarted = false;
    private boundOnMouseMove: (e: MouseEvent) => void;
    private boundOnMouseUp: () => void;
    private boundOnTouchMove: (e: TouchEvent) => void;
    private boundOnTouchEnd: () => void;

    static get toolbox() {
        return {
            title: 'Image Hotspots',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 1.892.402 3.13 1.5 4.5L12 22l6.5-7.5c1.098-1.37 1.5-2.608 1.5-4.5a8 8 0 0 0-8-8z"/></svg>',
        };
    }

    static get CSS() {
        return {
            wrapper: 'cdx-image-hotspots',
            canvas: 'cdx-image-hotspots__canvas',
            dot: 'cdx-image-hotspots__dot',
            dotActive: 'cdx-image-hotspots__dot--active',
            tooltip: 'cdx-image-hotspots__tooltip',
            form: 'cdx-image-hotspots__form',
            list: 'cdx-image-hotspots__list',
        };
    }

    constructor({
        data,
        api,
        config,
        block,
    }: {
        data: ImageHotspotsData;
        api: any;
        config: ImageHotspotsToolConfig;
        block: any;
    }) {
        this.api = api;
        this.block = block;
        this.config = config || {};
        this.namespace = this.config.namespace || 'default';
        this.data = {
            ...DEFAULT_DATA,
            ...data,
            hotspots: Array.isArray(data?.hotspots) ? data.hotspots : [],
        };

        /* Bind event handlers */
        this.boundOnMediaSelected = this.onMediaSelected.bind(this);
        this.boundOnDocumentClick = this.onDocumentClick.bind(this);

        /* Bind drag handlers */
        this.boundOnMouseMove = this.onHotspotDrag.bind(this);
        this.boundOnMouseUp = this.onHotspotDragEnd.bind(this);
        this.boundOnTouchMove = this.onHotspotTouchDrag.bind(this);
        this.boundOnTouchEnd = this.onHotspotDragEnd.bind(this);
    }

    /* ── Media Library Event Handler ────────────────────────────────────────── */

    private onMediaSelected(e: Event): void {
        const event = e as CustomEvent;
        const detail = event.detail;
        /* Only handle if the field matches our expected target */
        if (detail?.field !== 'imageHotspots:imageUrl') return;
        if (detail?.media?.url) {
            this.data.imageUrl = detail.media.url;
            if (detail.media.alt) this.data.alt = detail.media.alt;
            this.buildUI();
        }
    }

    private openMediaLibrary(): void {
        window.dispatchEvent(
            new CustomEvent('media-library-open', {
                detail: {
                    source: 'editor',
                    field: 'imageHotspots:imageUrl',
                },
            }),
        );
    }

    /* ── Confirm Dialog (via React bridge or window.confirm fallback) ───────── */

    /**
     * Request confirmation via the React `MediaGalleryConfirmBridge` (shadcn AlertDialog).
     * Falls back to window.confirm() when the bridge is not mounted (e.g. tests / storybook).
     */
    private requestConfirm(message: string, confirmLabel: string, onConfirmed: () => void) {
        const CONFIRM_EVENT = 'media-gallery-confirm';
        const RESULT_EVENT = 'media-gallery-confirm-result';
        const id = `${this.block.id}-${Date.now()}`;

        const bridgePresent = Boolean(
            (window as Window & { __mgConfirmBridgeActive?: boolean }).__mgConfirmBridgeActive,
        );

        if (!bridgePresent) {
            if (window.confirm(message)) onConfirmed();
            return;
        }

        const handleResult = (event: Event) => {
            const detail = (event as CustomEvent<{ id: string; confirmed: boolean }>).detail;
            if (detail?.id !== id) return;
            window.removeEventListener(RESULT_EVENT, handleResult);
            if (detail.confirmed) onConfirmed();
        };
        window.addEventListener(RESULT_EVENT, handleResult);

        window.dispatchEvent(
            new CustomEvent(CONFIRM_EVENT, {
                detail: { id, message, confirmLabel },
            }),
        );
    }

    /* ── Document Click Handler (close popover on outside click) ───────────── */

    private onDocumentClick(e: MouseEvent): void {
        if (!this.wrapper || !this.editingHotspotId) return;

        const target = e.target as HTMLElement;
        /* Ignore clicks within tooltip or its dot */
        const tooltip = this.wrapper.querySelector(`.${ImageHotspotsTool.CSS.tooltip}`);
        const activeDot = this.wrapper.querySelector(`.${ImageHotspotsTool.CSS.dotActive}`);

        if (tooltip?.contains(target) || activeDot?.contains(target)) return;
        /* Ignore clicks on list items (they have their own handlers) */
        if (target.closest(`.${ImageHotspotsTool.CSS.list}`)) return;

        /* Close popover on outside click */
        this.editingHotspotId = null;
        this.refreshCanvas();
        this.buildHotspotList();
    }

    /* ── Hotspot Drag Handlers ────────────────────────────────────────────── */

    private onHotspotDragStart(e: MouseEvent | TouchEvent, hs: HotspotItem): void {
        e.preventDefault();
        e.stopPropagation();

        this.draggingHotspotId = hs.id;
        this.dragStarted = false;

        /* Attach move/up handlers */
        document.addEventListener('mousemove', this.boundOnMouseMove);
        document.addEventListener('mouseup', this.boundOnMouseUp);
        document.addEventListener('touchmove', this.boundOnTouchMove, { passive: false });
        document.addEventListener('touchend', this.boundOnTouchEnd);
    }

    private onHotspotDrag(e: MouseEvent): void {
        if (!this.draggingHotspotId || !this.wrapper) return;
        this.dragStarted = true;

        const canvas = this.wrapper.querySelector(`.${ImageHotspotsTool.CSS.canvas}`) as HTMLElement | null;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
        const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

        const hs = this.data.hotspots.find((h) => h.id === this.draggingHotspotId);
        if (hs) {
            hs.x = Math.max(0, Math.min(100, x));
            hs.y = Math.max(0, Math.min(100, y));

            /* Update dot position directly for smooth dragging */
            const dot = canvas.querySelector(`[data-id="${hs.id}"]`) as HTMLElement | null;
            if (dot) {
                dot.style.left = `${hs.x}%`;
                dot.style.top = `${hs.y}%`;
            }
        }
    }

    private onHotspotTouchDrag(e: TouchEvent): void {
        if (!this.draggingHotspotId || !this.wrapper || !e.touches[0]) return;
        e.preventDefault();
        this.dragStarted = true;

        const canvas = this.wrapper.querySelector(`.${ImageHotspotsTool.CSS.canvas}`) as HTMLElement | null;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = Math.round(((touch.clientX - rect.left) / rect.width) * 100);
        const y = Math.round(((touch.clientY - rect.top) / rect.height) * 100);

        const hs = this.data.hotspots.find((h) => h.id === this.draggingHotspotId);
        if (hs) {
            hs.x = Math.max(0, Math.min(100, x));
            hs.y = Math.max(0, Math.min(100, y));

            /* Update dot position directly for smooth dragging */
            const dot = canvas.querySelector(`[data-id="${hs.id}"]`) as HTMLElement | null;
            if (dot) {
                dot.style.left = `${hs.x}%`;
                dot.style.top = `${hs.y}%`;
            }
        }
    }

    private onHotspotDragEnd(): void {
        const wasDragging = this.dragStarted;
        this.draggingHotspotId = null;
        this.dragStarted = false;

        document.removeEventListener('mousemove', this.boundOnMouseMove);
        document.removeEventListener('mouseup', this.boundOnMouseUp);
        document.removeEventListener('touchmove', this.boundOnTouchMove);
        document.removeEventListener('touchend', this.boundOnTouchEnd);

        /* Update list if we actually dragged */
        if (wasDragging) {
            this.buildHotspotList();
        }
    }

    /* ── render ─────────────────────────────────────────────────────────────── */

    render(): HTMLElement {
        this.wrapper = document.createElement('div');
        this.wrapper.classList.add('ob-plugin', ImageHotspotsTool.CSS.wrapper);

        /* Attach global event listeners */
        window.addEventListener('media-library-selected-item', this.boundOnMediaSelected);
        document.addEventListener('mousedown', this.boundOnDocumentClick);

        this.buildUI();
        return this.wrapper;
    }

    /* ── save ──────────────────────────────────────────────────────────────── */

    save(): ImageHotspotsData {
        return { ...this.data, hotspots: this.data.hotspots.map((h) => ({ ...h })) };
    }

    validate(savedData: ImageHotspotsData): boolean {
        return !!savedData.imageUrl;
    }

    /* ── UI ─────────────────────────────────────────────────────────────────── */

    private buildUI(): void {
        if (!this.wrapper) return;
        this.wrapper.innerHTML = '';

        const form = document.createElement('div');
        form.className = 'ob-form';

        /* Image URL row */
        const urlRow = document.createElement('div');
        urlRow.className = 'cdx-image-hotspots__url-row';

        urlRow.appendChild(
            this.makeInputGroupWithGallery('Image URL', this.data.imageUrl, 'https://…', (v) => {
                this.data.imageUrl = v;
                this.refreshCanvas();
            }),
        );
        urlRow.appendChild(
            this.makeInputGroup('Alt text', this.data.alt, 'Describe the image…', (v) => {
                this.data.alt = v;
            }),
        );

        form.appendChild(urlRow);

        /* Caption */
        form.appendChild(
            this.makeInputGroup('Caption', this.data.caption, 'Optional caption…', (v) => {
                this.data.caption = v;
            }),
        );

        this.wrapper.appendChild(form);

        /* Size controls above canvas */
        this.buildSizeControls();

        /* Canvas (image + dots) - right below size controls */
        this.buildCanvas();

        /* Hotspot list (below canvas) */
        this.buildHotspotList();
    }

    /* ── Size Controls (above canvas) ──────────────────────────────────────── */

    private buildSizeControls(): void {
        if (!this.wrapper) return;

        /* Reuse existing element to prevent DOM position jumping */
        let sizeControls = this.wrapper.querySelector('.cdx-image-hotspots__size-controls') as HTMLElement;
        if (!sizeControls) {
            sizeControls = document.createElement('div');
            sizeControls.className = 'cdx-image-hotspots__size-controls';
            /* Insert right after the form — always above the canvas */
            const form = this.wrapper.querySelector('.ob-form');
            if (form?.nextSibling) {
                this.wrapper.insertBefore(sizeControls, form.nextSibling);
            } else {
                this.wrapper.appendChild(sizeControls);
            }
        }
        sizeControls.innerHTML = '';

        /* Height + Image Fit row */
        const sizeRow = document.createElement('div');
        sizeRow.className = 'cdx-image-hotspots__size-row';

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
                this.refreshCanvas();
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
            this.refreshCanvas();
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
        fitToggle.className = 'cdx-image-hotspots__fit-toggle';

        const containBtn = document.createElement('button');
        containBtn.type = 'button';
        containBtn.className = `cdx-image-hotspots__fit-btn${this.data.imageFit !== 'cover' ? ' cdx-image-hotspots__fit-btn--active' : ''}`;
        containBtn.textContent = 'Contain';
        containBtn.title = 'Preserve aspect ratio';
        containBtn.addEventListener('click', () => {
            this.data.imageFit = 'contain';
            this.refreshCanvas();
            this.buildSizeControls(); // Rebuild to hide position picker
        });

        const coverBtn = document.createElement('button');
        coverBtn.type = 'button';
        coverBtn.className = `cdx-image-hotspots__fit-btn${this.data.imageFit === 'cover' ? ' cdx-image-hotspots__fit-btn--active' : ''}`;
        coverBtn.textContent = 'Cover';
        coverBtn.title = 'Fill container';
        coverBtn.addEventListener('click', () => {
            this.data.imageFit = 'cover';
            this.refreshCanvas();
            this.buildSizeControls(); // Rebuild to show position picker
        });

        fitToggle.appendChild(containBtn);
        fitToggle.appendChild(coverBtn);
        fitGroup.appendChild(fitLabel);
        fitGroup.appendChild(fitToggle);
        sizeRow.appendChild(fitGroup);

        /* Position picker (only when cover mode) */
        if (this.data.imageFit === 'cover') {
            sizeRow.appendChild(
                this.createPositionPicker('Image Focus', this.data.imagePosition || 'center', (pos) => {
                    this.data.imagePosition = pos;
                    this.refreshCanvas();
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
        grid.className = 'cdx-image-hotspots__position-grid';

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
            btn.className = `cdx-image-hotspots__position-btn${current === pos ? ' cdx-image-hotspots__position-btn--active' : ''}`;
            btn.dataset.position = pos;
            btn.title = pos.replace('-', ' ');
            btn.addEventListener('click', () => {
                grid.querySelectorAll('.cdx-image-hotspots__position-btn').forEach((b) => {
                    b.classList.remove('cdx-image-hotspots__position-btn--active');
                });
                btn.classList.add('cdx-image-hotspots__position-btn--active');
                onChange(pos);
            });
            grid.appendChild(btn);
        });

        group.appendChild(grid);
        return group;
    }

    /* ── Canvas ─────────────────────────────────────────────────────────────── */

    private buildCanvas(): void {
        if (!this.wrapper) return;

        const old = this.wrapper.querySelector(`.${ImageHotspotsTool.CSS.canvas}`);
        if (old) old.remove();

        if (!this.data.imageUrl) return;

        const canvas = document.createElement('div');
        canvas.className = ImageHotspotsTool.CSS.canvas;

        /* Apply height and imageFit styles */
        if (this.data.height) {
            canvas.style.height = this.data.height;
        } else if (this.data.imageFit === 'cover') {
            /* Default height for cover mode — percentage heights don't resolve
               without an explicit parent height, causing the image to collapse */
            canvas.style.height = '300px';
        }
        if (this.data.imageFit === 'cover') {
            canvas.classList.add('cdx-image-hotspots__canvas--cover');
        }

        /* Base image */
        const img = document.createElement('img');
        img.src = this.data.imageUrl;
        img.alt = this.data.alt || '';
        img.draggable = false;
        /* Apply object-position when using cover mode */
        if (this.data.imageFit === 'cover' && this.data.imagePosition) {
            img.style.objectPosition = positionToCSS(this.data.imagePosition);
        }
        canvas.appendChild(img);

        /* Click-to-add hint */
        const hint = document.createElement('div');
        hint.className = 'cdx-image-hotspots__hint';
        hint.textContent = 'Click image to add a hotspot';
        canvas.appendChild(hint);

        /* Existing dots */
        this.data.hotspots.forEach((hs) => {
            canvas.appendChild(this.createDot(hs));
        });

        /* Click handler: add new hotspot at click position */
        canvas.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            /* Ignore clicks on dots / tooltips */
            if (target.closest(`.${ImageHotspotsTool.CSS.dot}`) || target.closest(`.${ImageHotspotsTool.CSS.tooltip}`))
                return;

            const maxHotspots = this.config.maxHotspots || 20;
            if (this.data.hotspots.length >= maxHotspots) return;

            const rect = canvas.getBoundingClientRect();
            const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
            const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

            const newHotspot: HotspotItem = {
                id: this.uid(),
                x: Math.max(0, Math.min(100, x)),
                y: Math.max(0, Math.min(100, y)),
                title: '',
                content: '',
            };

            this.data.hotspots.push(newHotspot);
            canvas.appendChild(this.createDot(newHotspot));
            this.buildHotspotList();

            /* Auto-open edit for the new hotspot */
            this.editingHotspotId = newHotspot.id;
            this.refreshCanvas();
            this.buildHotspotList();
        });

        /* Insert before list so canvas stays between size controls and list */
        const list = this.wrapper.querySelector(`.${ImageHotspotsTool.CSS.list}`);
        if (list) {
            this.wrapper.insertBefore(canvas, list);
        } else {
            this.wrapper.appendChild(canvas);
        }
    }

    private refreshCanvas(): void {
        this.buildCanvas();
    }

    /* ── Dot element ────────────────────────────────────────────────────────── */

    private createDot(hs: HotspotItem): HTMLElement {
        const dot = document.createElement('div');
        dot.className = `${ImageHotspotsTool.CSS.dot}${this.editingHotspotId === hs.id ? ` ${ImageHotspotsTool.CSS.dotActive}` : ''}`;
        dot.style.left = `${hs.x}%`;
        dot.style.top = `${hs.y}%`;
        dot.title = hs.title || 'Hotspot (click to edit, drag to move)';
        dot.dataset.id = hs.id;

        /* Index label */
        const idx = this.data.hotspots.findIndex((h) => h.id === hs.id);
        dot.textContent = String(idx + 1);

        /* Drag: start drag on mousedown/touchstart */
        dot.addEventListener('mousedown', (e) => {
            /* Only left click */
            if (e.button !== 0) return;
            /* Don't start drag if clicking tooltip content */
            if ((e.target as HTMLElement).closest(`.${ImageHotspotsTool.CSS.tooltip}`)) return;
            this.onHotspotDragStart(e, hs);
        });
        dot.addEventListener(
            'touchstart',
            (e) => {
                /* Don't start drag if touching tooltip content */
                if ((e.target as HTMLElement).closest(`.${ImageHotspotsTool.CSS.tooltip}`)) return;
                this.onHotspotDragStart(e, hs);
            },
            { passive: false },
        );

        /* Click: toggle tooltip (only if not dragging) */
        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            /* Ignore click if we were dragging */
            if (this.dragStarted) return;
            if (this.editingHotspotId === hs.id) {
                this.editingHotspotId = null;
            } else {
                this.editingHotspotId = hs.id;
            }
            this.refreshCanvas();
            this.buildHotspotList();
        });

        /* Tooltip - opens upward if hotspot is below 70% of canvas height */
        if (this.editingHotspotId === hs.id) {
            const tooltip = document.createElement('div');
            const tooltipAbove = hs.y > 70;
            tooltip.className = `${ImageHotspotsTool.CSS.tooltip}${tooltipAbove ? ' cdx-image-hotspots__tooltip--above' : ''}`;
            tooltip.addEventListener('click', (e) => e.stopPropagation());
            tooltip.addEventListener('mousedown', (e) => e.stopPropagation());

            const titleInput = document.createElement('input');
            titleInput.type = 'text';
            titleInput.className = 'ob-input';
            titleInput.placeholder = 'Hotspot title…';
            titleInput.value = hs.title;
            titleInput.addEventListener('input', () => {
                hs.title = titleInput.value;
                dot.title = hs.title;
                this.buildHotspotList();
            });

            const contentInput = document.createElement('textarea');
            contentInput.className = 'ob-textarea';
            contentInput.placeholder = 'Description / content…';
            contentInput.value = hs.content;
            contentInput.rows = 3;
            contentInput.addEventListener('input', () => {
                hs.content = contentInput.value;
                this.buildHotspotList();
            });

            /* Button row: Remove (left) + Save (right) */
            const buttonRow = document.createElement('div');
            buttonRow.className = 'cdx-image-hotspots__tooltip-buttons';

            const removeBtn = document.createElement('button');
            removeBtn.className = 'cdx-image-hotspots__remove-btn';
            removeBtn.innerHTML = `${Icons.remove} Remove`;
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const label = hs.title || `Hotspot ${idx + 1}`;
                this.requestConfirm(`Remove "${label}"? This action cannot be undone.`, 'Remove', () => {
                    this.data.hotspots = this.data.hotspots.filter((h) => h.id !== hs.id);
                    this.editingHotspotId = null;
                    this.refreshCanvas();
                    this.buildHotspotList();
                });
            });

            const saveBtn = document.createElement('button');
            saveBtn.className = 'cdx-image-hotspots__save-btn';
            saveBtn.innerHTML = `${Icons.check} Save`;
            saveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editingHotspotId = null;
                this.refreshCanvas();
                this.buildHotspotList();
            });

            buttonRow.appendChild(removeBtn);
            buttonRow.appendChild(saveBtn);

            tooltip.appendChild(titleInput);
            tooltip.appendChild(contentInput);
            tooltip.appendChild(buttonRow);
            dot.appendChild(tooltip);
        }

        return dot;
    }

    /* ── Hotspot list (below canvas) ────────────────────────────────────────── */

    private buildHotspotList(): void {
        if (!this.wrapper) return;

        let list = this.wrapper.querySelector(`.${ImageHotspotsTool.CSS.list}`) as HTMLElement | null;
        if (!list) {
            list = document.createElement('div');
            list.className = ImageHotspotsTool.CSS.list;
            this.wrapper.appendChild(list);
        }

        list.innerHTML = '';

        if (this.data.hotspots.length === 0) return;

        const header = document.createElement('div');
        header.className = 'cdx-image-hotspots__list-header';
        header.innerHTML = `<span class="ob-section-label">Hotspots (${this.data.hotspots.length})</span>`;
        list.appendChild(header);

        this.data.hotspots.forEach((hs, idx) => {
            const row = document.createElement('div');
            row.className = 'cdx-image-hotspots__list-item';

            const badge = document.createElement('span');
            badge.className = 'cdx-image-hotspots__list-badge';
            badge.textContent = String(idx + 1);

            const title = document.createElement('span');
            title.className = 'cdx-image-hotspots__list-title';
            title.textContent = hs.title || `Hotspot ${idx + 1}`;

            const coords = document.createElement('span');
            coords.className = 'cdx-image-hotspots__list-coords';
            coords.textContent = `(${hs.x}%, ${hs.y}%)`;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'cdx-image-hotspots__list-remove';
            removeBtn.innerHTML = Icons.remove;
            removeBtn.title = 'Remove hotspot';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const label = hs.title || `Hotspot ${idx + 1}`;
                this.requestConfirm(`Remove "${label}"? This action cannot be undone.`, 'Remove', () => {
                    this.data.hotspots = this.data.hotspots.filter((h) => h.id !== hs.id);
                    if (this.editingHotspotId === hs.id) this.editingHotspotId = null;
                    this.refreshCanvas();
                    this.buildHotspotList();
                });
            });

            row.appendChild(badge);
            row.appendChild(title);
            row.appendChild(coords);
            row.appendChild(removeBtn);

            /* Click to focus in canvas */
            row.addEventListener('click', () => {
                this.editingHotspotId = this.editingHotspotId === hs.id ? null : hs.id;
                this.refreshCanvas();
                this.buildHotspotList();
            });

            list.appendChild(row);
        });
    }

    /* ── Helpers ────────────────────────────────────────────────────────────── */

    private makeInputGroup(
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
    private makeInputGroupWithGallery(
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

        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'cdx-image-hotspots__input-with-gallery';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'ob-input';
        input.value = value;
        input.placeholder = placeholder;
        input.addEventListener('input', () => onChange(input.value));

        const galleryBtn = document.createElement('button');
        galleryBtn.type = 'button';
        galleryBtn.className = 'cdx-image-hotspots__gallery-btn';
        galleryBtn.innerHTML = Icons.gallery;
        galleryBtn.title = 'Select from Media Library';
        galleryBtn.addEventListener('click', () => this.openMediaLibrary());

        inputWrapper.appendChild(input);
        inputWrapper.appendChild(galleryBtn);

        group.appendChild(lbl);
        group.appendChild(inputWrapper);
        return group;
    }

    private uid(): string {
        return 'hs_' + Math.random().toString(36).slice(2, 10);
    }

    /* ── Cleanup ────────────────────────────────────────────────────────────── */

    destroy(): void {
        this.editingHotspotId = null;
        window.removeEventListener('media-library-selected-item', this.boundOnMediaSelected);
        document.removeEventListener('mousedown', this.boundOnDocumentClick);
    }
}
