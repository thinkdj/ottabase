/**
 * ImageHotspotsTool - EditorJS block tool for placing clickable annotation
 * points on an image. Each hotspot has a position (x%, y%), title, and
 * rich-text content that appears in a tooltip/modal.
 */
import './ImageHotspotsTool.css';

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
}

export interface ImageHotspotsToolConfig {
    /** Maximum number of hotspots allowed */
    maxHotspots?: number;
}

const DEFAULT_DATA: ImageHotspotsData = {
    imageUrl: '',
    alt: '',
    caption: '',
    hotspots: [],
};

/* ───────────────────────────────────────────────────────────────────────────── */

export default class ImageHotspotsTool {
    private api: any;
    private data: ImageHotspotsData;
    private config: ImageHotspotsToolConfig;
    private wrapper: HTMLElement | null = null;
    private block: any;
    private editingHotspotId: string | null = null;

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
        this.data = {
            ...DEFAULT_DATA,
            ...data,
            hotspots: Array.isArray(data?.hotspots) ? data.hotspots : [],
        };
    }

    /* ── render ─────────────────────────────────────────────────────────────── */

    render(): HTMLElement {
        this.wrapper = document.createElement('div');
        this.wrapper.classList.add('ob-plugin', ImageHotspotsTool.CSS.wrapper);
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
            this.makeInputGroup('Image URL', this.data.imageUrl, 'https://…', (v) => {
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

        /* Canvas (image + dots) */
        this.buildCanvas();

        /* Hotspot list */
        this.buildHotspotList();
    }

    /* ── Canvas ─────────────────────────────────────────────────────────────── */

    private buildCanvas(): void {
        if (!this.wrapper) return;

        const old = this.wrapper.querySelector(`.${ImageHotspotsTool.CSS.canvas}`);
        if (old) old.remove();

        if (!this.data.imageUrl) return;

        const canvas = document.createElement('div');
        canvas.className = ImageHotspotsTool.CSS.canvas;

        /* Base image */
        const img = document.createElement('img');
        img.src = this.data.imageUrl;
        img.alt = this.data.alt || '';
        img.draggable = false;
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

        this.wrapper.appendChild(canvas);
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
        dot.title = hs.title || 'Hotspot';
        dot.dataset.id = hs.id;

        /* Index label */
        const idx = this.data.hotspots.findIndex((h) => h.id === hs.id);
        dot.textContent = String(idx + 1);

        /* Click: toggle tooltip */
        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.editingHotspotId === hs.id) {
                this.editingHotspotId = null;
            } else {
                this.editingHotspotId = hs.id;
            }
            this.refreshCanvas();
            this.buildHotspotList();
        });

        /* Tooltip */
        if (this.editingHotspotId === hs.id) {
            const tooltip = document.createElement('div');
            tooltip.className = ImageHotspotsTool.CSS.tooltip;
            tooltip.addEventListener('click', (e) => e.stopPropagation());

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

            const removeBtn = document.createElement('button');
            removeBtn.className = 'cdx-image-hotspots__remove-btn';
            removeBtn.textContent = '✕ Remove';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.data.hotspots = this.data.hotspots.filter((h) => h.id !== hs.id);
                this.editingHotspotId = null;
                this.refreshCanvas();
                this.buildHotspotList();
            });

            tooltip.appendChild(titleInput);
            tooltip.appendChild(contentInput);
            tooltip.appendChild(removeBtn);
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
            removeBtn.textContent = '✕';
            removeBtn.title = 'Remove hotspot';
            removeBtn.addEventListener('click', () => {
                this.data.hotspots = this.data.hotspots.filter((h) => h.id !== hs.id);
                if (this.editingHotspotId === hs.id) this.editingHotspotId = null;
                this.refreshCanvas();
                this.buildHotspotList();
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

    private uid(): string {
        return 'hs_' + Math.random().toString(36).slice(2, 10);
    }

    /* ── Cleanup ────────────────────────────────────────────────────────────── */

    destroy(): void {
        this.editingHotspotId = null;
    }
}
