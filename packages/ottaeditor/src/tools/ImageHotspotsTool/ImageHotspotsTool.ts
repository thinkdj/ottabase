import type { API, BlockTool } from '@editorjs/editorjs';
import { fileUrl, type FileSource } from '@ottabase/utils/media';
import { toolboxEntry } from '../../blocks';
import {
    button,
    confirmInline,
    field,
    h,
    mediaInput,
    positionToCSS,
    row,
    sortableList,
    stack,
    textInput,
    textarea,
    type ImagePosition,
} from '../../ui/kit';
import { BlockShell } from '../../ui/shell';
import { sizingControls } from '../shared/sizing';
import './ImageHotspotsTool.css';

export type { ImagePosition };

export interface HotspotItem {
    /** Unique id per hotspot (for keying) */
    id: string;
    /** Horizontal position as 0–100 percentage from left */
    x: number;
    /** Vertical position as 0–100 percentage from top */
    y: number;
    title: string;
    content: string;
}

export interface ImageHotspotsData {
    /** A stored file, or an outside address */
    image?: FileSource;
    alt: string;
    caption: string;
    hotspots: HotspotItem[];
    /** Optional fixed height (e.g., '400px', '50vh') */
    height?: string;
    imageFit?: 'contain' | 'cover';
    imagePosition?: ImagePosition;
}

export interface ImageHotspotsToolConfig {
    /** Maximum number of hotspots allowed (default 20) */
    maxHotspots?: number;
    /** @deprecated Selections are routed per field now; kept for config compatibility */
    namespace?: string;
}

const DEFAULT_DATA: ImageHotspotsData = {
    alt: '',
    caption: '',
    hotspots: [],
    height: '',
    imageFit: 'contain',
    imagePosition: 'center',
};

/**
 * Hotspots block. Edit mode: the image and its text, sizing, then a canvas where a click adds a
 * numbered marker, a drag moves it and a click on it opens a small card to write its note; the
 * list below reorders and removes. Preview is the renderer's interactive image.
 */
export default class ImageHotspotsTool implements BlockTool {
    private readonly api: API;
    private readonly config: ImageHotspotsToolConfig;
    private data: ImageHotspotsData;
    private shell: BlockShell | null = null;
    private canvasHost: HTMLElement | null = null;
    private canvas: HTMLElement | null = null;
    private list: ReturnType<typeof sortableList<HotspotItem>> | null = null;
    private editingId: string | null = null;
    private cleanups: Array<() => void> = [];
    private readonly onDocumentDown = (e: MouseEvent) => {
        if (!this.editingId || !this.canvas) return;
        const t = e.target as HTMLElement;
        if (this.canvas.contains(t) || t.closest('.oe-list')) return;
        this.editingId = null;
        this.buildCanvas();
    };

    static get toolbox() {
        return toolboxEntry('imageHotspots');
    }

    constructor({
        data,
        api,
        config,
    }: {
        data?: Partial<ImageHotspotsData>;
        api: API;
        config?: ImageHotspotsToolConfig;
        block?: unknown;
    }) {
        this.api = api;
        this.config = config || {};
        this.data = {
            ...DEFAULT_DATA,
            ...data,
            hotspots: Array.isArray(data?.hotspots) ? data.hotspots.map((h) => ({ ...h })) : [],
        };
    }

    private get maxHotspots() {
        return this.config.maxHotspots || 20;
    }

    render(): HTMLElement {
        const shell = new BlockShell({
            type: 'imageHotspots',
            hasContent: Boolean(this.data.image),
            summary: this.summary(),
        });
        this.shell = shell;

        const image = mediaInput({
            value: this.data.image,
            ariaLabel: 'Image',
            onChange: (value, media) => {
                this.data.image = value;
                if (media?.alt && !this.data.alt) {
                    this.data.alt = media.alt;
                    alt.value = media.alt;
                }
                this.changed();
                this.buildCanvas();
            },
        });
        this.cleanups.push(image.destroy);
        const alt = textInput({
            value: this.data.alt,
            placeholder: 'Describe the image',
            onInput: (v) => this.set({ alt: v }),
        });
        const caption = textInput({
            value: this.data.caption,
            placeholder: 'Optional caption',
            onInput: (v) => this.set({ caption: v }),
        });
        const sizing = sizingControls(this.data, [{ key: 'imagePosition', label: 'Focus' }], () => {
            this.changed();
            this.buildCanvas();
        });

        this.canvasHost = h('div', { className: 'oe-hotspots' });
        this.list = sortableList<HotspotItem>({
            items: this.data.hotspots,
            emptyText: 'Click the image to place a hotspot.',
            rowLabel: (hs, i) => hs.title || `hotspot ${i + 1}`,
            confirmRemove: (hs) => (hs.title || hs.content ? `Remove "${hs.title || 'this hotspot'}"?` : null),
            onChange: () => {
                this.changed();
                this.buildCanvas();
            },
            renderRow: (hs, { index }) =>
                stack(
                    textInput({
                        value: hs.title,
                        placeholder: 'Title',
                        ariaLabel: `Hotspot ${index + 1} title`,
                        onInput: (v) => {
                            hs.title = v;
                            this.changed();
                        },
                    }),
                    textarea({
                        value: hs.content,
                        rows: 2,
                        placeholder: 'What the reader learns here',
                        ariaLabel: `Hotspot ${index + 1} content`,
                        onInput: (v) => {
                            hs.content = v;
                            this.changed();
                        },
                    }),
                ),
        });

        shell.fields.append(
            stack(
                field({ label: 'Image', control: image.element }),
                row(
                    field({ label: 'Alt text', control: alt, grow: true }),
                    field({ label: 'Caption', control: caption, grow: true }),
                ),
                sizing,
                this.canvasHost,
                h('div', { className: 'oe-section-label' }, 'Hotspots'),
                this.list.element,
            ),
        );
        document.addEventListener('mousedown', this.onDocumentDown);
        this.cleanups.push(() => document.removeEventListener('mousedown', this.onDocumentDown));
        this.buildCanvas();
        shell.preview({ ...this.data });
        return shell.element;
    }

    private set(patch: Partial<ImageHotspotsData>) {
        Object.assign(this.data, patch);
        this.changed();
    }

    private changed() {
        this.shell?.setSummary(this.summary());
        this.shell?.preview({ ...this.data, hotspots: this.data.hotspots.map((h) => ({ ...h })) });
    }

    private summary() {
        const n = this.data.hotspots.length;
        return this.data.image ? `${n} ${n === 1 ? 'hotspot' : 'hotspots'}` : 'no image';
    }

    /* ── Canvas: image + draggable numbered dots ───────────────────────────── */

    private buildCanvas() {
        if (!this.canvasHost) return;
        this.canvasHost.innerHTML = '';
        this.canvas = null;
        if (!this.data.image) return;

        const cover = this.data.imageFit === 'cover';
        const canvas = h('div', { className: `oe-hotspots__canvas${cover ? ' oe-hotspots__canvas--cover' : ''}` });
        if (this.data.height) canvas.style.height = this.data.height;
        else if (cover) canvas.style.height = '300px';

        const img = h('img', {
            className: 'oe-hotspots__img',
            // The canvas spans the block: the full rendition, never the unoptimised original
            src: fileUrl(this.data.image, 'full'),
            alt: this.data.alt || '',
            draggable: false,
        });
        if (cover) img.style.objectPosition = positionToCSS(this.data.imagePosition);
        canvas.append(img);
        const atMax = this.data.hotspots.length >= this.maxHotspots;
        canvas.append(
            h(
                'div',
                { className: 'oe-hotspots__hint' },
                atMax ? `Maximum of ${this.maxHotspots} hotspots` : 'Click to add a hotspot · drag to move',
            ),
        );
        this.data.hotspots.forEach((hs, i) => canvas.append(this.dot(hs, i)));

        canvas.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('.oe-hotspots__dot, .oe-hotspots__card')) return;
            if (this.data.hotspots.length >= this.maxHotspots) return;
            const r = canvas.getBoundingClientRect();
            const hs: HotspotItem = {
                id: 'hs_' + Math.random().toString(36).slice(2, 10),
                x: Math.max(0, Math.min(100, Math.round(((e.clientX - r.left) / r.width) * 100))),
                y: Math.max(0, Math.min(100, Math.round(((e.clientY - r.top) / r.height) * 100))),
                title: '',
                content: '',
            };
            this.data.hotspots.push(hs);
            this.editingId = hs.id;
            this.list?.refresh();
            this.changed();
            this.buildCanvas();
            (this.canvas?.querySelector('.oe-hotspots__card input') as HTMLInputElement | null)?.focus();
        });

        this.canvas = canvas;
        this.canvasHost.append(canvas);
    }

    private dot(hs: HotspotItem, index: number): HTMLElement {
        const editing = this.editingId === hs.id;
        const dot = h(
            'button',
            {
                type: 'button',
                className: `oe-hotspots__dot${editing ? ' oe-hotspots__dot--active' : ''}`,
                'aria-label': hs.title || `Hotspot ${index + 1}`,
                'aria-expanded': String(editing),
                dataset: { id: hs.id },
            },
            String(index + 1),
        );
        dot.style.left = `${hs.x}%`;
        dot.style.top = `${hs.y}%`;

        let moved = false;
        dot.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            moved = false;
            dot.setPointerCapture?.(e.pointerId);
            const onMove = (ev: PointerEvent) => {
                if (!this.canvas) return;
                moved = true;
                const r = this.canvas.getBoundingClientRect();
                hs.x = Math.max(0, Math.min(100, Math.round(((ev.clientX - r.left) / r.width) * 100)));
                hs.y = Math.max(0, Math.min(100, Math.round(((ev.clientY - r.top) / r.height) * 100)));
                dot.style.left = `${hs.x}%`;
                dot.style.top = `${hs.y}%`;
            };
            const onUp = () => {
                dot.removeEventListener('pointermove', onMove);
                dot.removeEventListener('pointerup', onUp);
                dot.removeEventListener('pointercancel', onUp);
                if (moved) this.changed();
            };
            dot.addEventListener('pointermove', onMove);
            dot.addEventListener('pointerup', onUp);
            dot.addEventListener('pointercancel', onUp);
        });
        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            if (moved) return;
            this.editingId = editing ? null : hs.id;
            this.buildCanvas();
        });

        if (!editing) return dot;
        const card = h('div', {
            className: `oe-hotspots__card${hs.y > 70 ? ' oe-hotspots__card--above' : ''}`,
            role: 'dialog',
            'aria-label': `Edit hotspot ${index + 1}`,
        });
        card.addEventListener('click', (e) => e.stopPropagation());
        card.addEventListener('pointerdown', (e) => e.stopPropagation());
        const title = textInput({
            value: hs.title,
            placeholder: 'Title',
            ariaLabel: `Hotspot ${index + 1} title`,
            onInput: (v) => {
                hs.title = v;
                this.list?.refresh();
                this.changed();
            },
        });
        const content = textarea({
            value: hs.content,
            rows: 3,
            placeholder: 'What the reader learns here',
            ariaLabel: `Hotspot ${index + 1} content`,
            onInput: (v) => {
                hs.content = v;
                this.list?.refresh();
                this.changed();
            },
        });
        const remove = button({
            label: 'Remove',
            icon: 'trash',
            variant: 'ghost',
            size: 'sm',
            onClick: async () => {
                if (
                    (hs.title || hs.content) &&
                    !(await confirmInline(card, `Remove "${hs.title || `Hotspot ${index + 1}`}"?`))
                )
                    return;
                this.data.hotspots.splice(this.data.hotspots.indexOf(hs), 1);
                this.editingId = null;
                this.list?.refresh();
                this.changed();
                this.buildCanvas();
            },
        });
        const done = button({
            label: 'Done',
            icon: 'check',
            variant: 'primary',
            size: 'sm',
            onClick: () => {
                this.editingId = null;
                this.buildCanvas();
            },
        });
        card.append(stack(title, content, h('div', { className: 'oe-hotspots__card-actions' }, remove, done)));
        return h('div', { className: 'oe-hotspots__pin', style: `left:${hs.x}%;top:${hs.y}%` }, dot, card);
    }

    save(): ImageHotspotsData {
        return { ...this.data, hotspots: this.data.hotspots.map((h) => ({ ...h })) };
    }

    validate(savedData: ImageHotspotsData): boolean {
        return Boolean(savedData.image);
    }

    destroy(): void {
        this.cleanups.splice(0).forEach((fn) => fn());
        this.editingId = null;
        this.shell?.destroy();
        this.shell = null;
    }
}
