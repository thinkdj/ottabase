import type { API, BlockTool } from '@editorjs/editorjs';
import { toolboxEntry } from '../../blocks';
import {
    button,
    confirmInline,
    field,
    h,
    onMediaSelected,
    openMediaLibrary,
    row,
    segment,
    sortableList,
    stack,
    textInput,
    textarea,
    uid,
    type MediaSelection,
} from '../../ui/kit';
import { BlockShell } from '../../ui/shell';

export type MediaGalleryLayoutPreset = 'grid-balanced' | 'grid-featured' | 'masonry' | 'filmstrip' | 'mosaic';

export interface MediaGalleryItem {
    id?: string;
    url: string;
    title?: string;
    caption?: string;
    mediaId?: string;
    mimeType?: string;
    mediaKind?: string;
    thumbnailUrl?: string;
    previewUrl?: string;
    altText?: string;
}

export interface MediaGalleryData {
    title?: string;
    caption?: string;
    layout: MediaGalleryLayoutPreset;
    items: MediaGalleryItem[];
}

export interface MediaGalleryToolConfig {
    /** @deprecated Selections are routed per block now; kept for config compatibility */
    namespace?: string;
    defaultLayout?: MediaGalleryLayoutPreset;
    maxItems?: number;
    /** Enable multi-select in the media library picker (default: true). */
    allowMultiselect?: boolean;
}

interface EditorJsBlock {
    id: string;
}

const DEFAULT_LAYOUT: MediaGalleryLayoutPreset = 'grid-balanced';
const LAYOUTS: ReadonlyArray<{ value: MediaGalleryLayoutPreset; label: string }> = [
    { value: 'grid-balanced', label: 'Grid' },
    { value: 'grid-featured', label: 'Featured' },
    { value: 'masonry', label: 'Masonry' },
    { value: 'filmstrip', label: 'Filmstrip' },
    { value: 'mosaic', label: 'Mosaic' },
];
const ALL_KINDS = ['image', 'video', 'audio', 'document', 'archive', 'other'] as const;

/**
 * Gallery block. Edit mode: title, layout, caption and a sortable list of items fed by the host's
 * media picker (multiselect). Preview is the renderer's gallery in the chosen layout.
 */
export default class MediaGalleryTool implements BlockTool {
    private readonly api: API;
    private readonly block: EditorJsBlock;
    private readonly config: MediaGalleryToolConfig;
    private data: MediaGalleryData;
    private shell: BlockShell | null = null;
    private list: ReturnType<typeof sortableList<MediaGalleryItem>> | null = null;
    private countEl: HTMLElement | null = null;
    private addBtn: HTMLButtonElement | null = null;
    private readonly field = uid('gallery');
    private unsubscribe: (() => void) | null = null;

    static get toolbox() {
        return toolboxEntry('mediaGallery');
    }

    constructor({
        api,
        data,
        config,
        block,
    }: {
        api: API;
        data?: Partial<MediaGalleryData>;
        config?: MediaGalleryToolConfig;
        block: EditorJsBlock;
    }) {
        this.api = api;
        this.block = block;
        this.config = config || {};
        const layout = data?.layout || this.config.defaultLayout || DEFAULT_LAYOUT;
        this.data = {
            title: data?.title || '',
            caption: data?.caption || '',
            layout,
            items: (data?.items || []).filter((item) => Boolean(item?.url)).map((item) => ({ ...item })),
        };
    }

    private get maxItems() {
        return this.config.maxItems || 50;
    }

    render(): HTMLElement {
        const shell = new BlockShell({
            type: 'mediaGallery',
            hasContent: this.data.items.length > 0,
            summary: this.summary(),
        });
        this.shell = shell;
        this.unsubscribe = onMediaSelected(this.field, (media) => this.handleMediaSelected(media));

        const title = textInput({
            value: this.data.title || '',
            placeholder: 'Optional title above the gallery',
            onInput: (v) => this.set({ title: v }),
        });
        const layout = segment<MediaGalleryLayoutPreset>({
            value: this.data.layout,
            ariaLabel: 'Layout',
            options: LAYOUTS,
            onChange: (v) => this.set({ layout: v }),
        });
        const caption = textarea({
            value: this.data.caption || '',
            rows: 2,
            placeholder: 'Optional caption below the gallery',
            onInput: (v) => this.set({ caption: v }),
        });

        this.list = sortableList<MediaGalleryItem>({
            items: this.data.items,
            emptyText: 'No media yet. Add items from the library.',
            rowLabel: (item, i) => item.title || `item ${i + 1}`,
            confirmRemove: () => null,
            onChange: () => this.changed(),
            renderRow: (item) => this.itemRow(item),
        });

        this.countEl = h('span', { className: 'oe-hint' });
        this.addBtn = button({
            label: 'Add media',
            icon: 'library',
            variant: 'outline',
            size: 'sm',
            onClick: () => this.openLibrary(),
        });
        const clear = button({
            label: 'Clear all',
            variant: 'ghost',
            size: 'sm',
            onClick: async () => {
                if (this.data.items.length === 0) return;
                const n = this.data.items.length;
                if (
                    !(await confirmInline(
                        shell.fields,
                        `Remove all ${n} item${n === 1 ? '' : 's'} from the gallery?`,
                        'Clear all',
                    ))
                )
                    return;
                this.data.items.splice(0);
                this.list?.refresh();
                this.changed();
            },
        });
        const bar = h(
            'div',
            { className: 'oe-row oe-gallery__bar' },
            h('span', { className: 'oe-section-label' }, 'Items'),
            this.countEl,
            h('span', { className: 'oe-gallery__spacer' }),
            clear,
            this.addBtn,
        );

        shell.fields.append(
            stack(
                row(field({ label: 'Title', control: title, grow: true }), field({ label: 'Layout', control: layout })),
                field({ label: 'Caption', control: caption }),
                bar,
                this.list.element,
            ),
        );
        this.syncCount();
        shell.preview({ ...this.save() });
        return shell.element;
    }

    private itemRow(item: MediaGalleryItem): HTMLElement {
        const isImage = (item.mediaKind || 'image') === 'image';
        const thumb = isImage
            ? h('img', {
                  className: 'oe-gallery__thumb',
                  src: item.thumbnailUrl || item.previewUrl || item.url,
                  alt: '',
              })
            : h(
                  'span',
                  { className: 'oe-gallery__thumb oe-gallery__thumb--kind' },
                  (item.mediaKind || 'file').toUpperCase(),
              );
        const label = item.title || 'item';
        return h(
            'div',
            { className: 'oe-gallery__item' },
            thumb,
            stack(
                textInput({
                    value: item.title || '',
                    placeholder: 'Title',
                    ariaLabel: `Title for ${label}`,
                    onInput: (v) => {
                        item.title = v;
                        this.changed();
                    },
                }),
                textInput({
                    value: item.altText || '',
                    placeholder: 'Alt text',
                    ariaLabel: `Alt text for ${label}`,
                    onInput: (v) => {
                        item.altText = v;
                        this.changed();
                    },
                }),
                textInput({
                    value: item.caption || '',
                    placeholder: 'Caption',
                    ariaLabel: `Caption for ${label}`,
                    onInput: (v) => {
                        item.caption = v;
                        this.changed();
                    },
                }),
            ),
        );
    }

    private openLibrary() {
        if (this.data.items.length >= this.maxItems) return;
        openMediaLibrary(this.field, { accept: [...ALL_KINDS], multiselect: this.config.allowMultiselect !== false });
    }

    /** A picker result for this block (also the test seam). */
    handleMediaSelected(media?: MediaSelection) {
        if (!media?.url) return;
        const next: MediaGalleryItem = {
            id: media.id,
            url: media.url,
            title: media.title || media.originalName || '',
            caption: media.caption || '',
            mediaId: media.mediaId || media.id,
            mimeType: media.mimeType || '',
            mediaKind: media.mediaKind || 'other',
            thumbnailUrl: media.thumbnailUrl || media.url,
            previewUrl: media.previewUrl || media.url,
            altText: media.altText || media.title || media.originalName || '',
        };
        if (this.data.items.some((item) => item.mediaId && next.mediaId && item.mediaId === next.mediaId)) return;
        if (this.data.items.length >= this.maxItems) return;
        this.data.items.push(next);
        this.list?.refresh();
        this.changed();
    }

    private set(patch: Partial<MediaGalleryData>) {
        Object.assign(this.data, patch);
        this.changed();
    }

    private changed() {
        this.syncCount();
        this.shell?.setSummary(this.summary());
        this.shell?.preview({ ...this.save() });
    }

    private syncCount() {
        const n = this.data.items.length;
        const atMax = n >= this.maxItems;
        if (this.countEl)
            this.countEl.textContent =
                n === 0 ? '' : atMax ? `${n} / ${this.maxItems} · maximum reached` : `${n} / ${this.maxItems}`;
        if (this.addBtn) this.addBtn.disabled = atMax;
    }

    private summary() {
        const n = this.data.items.length;
        const layout = LAYOUTS.find((l) => l.value === this.data.layout)?.label ?? this.data.layout;
        return `${n} ${n === 1 ? 'item' : 'items'} · ${layout}`;
    }

    save(): MediaGalleryData {
        return {
            title: this.data.title?.trim() || '',
            caption: this.data.caption?.trim() || '',
            layout: this.data.layout || DEFAULT_LAYOUT,
            items: this.data.items
                .filter((item) => item.url)
                .map((item) => ({
                    ...item,
                    title: item.title?.trim() || '',
                    caption: item.caption?.trim() || '',
                    altText: item.altText?.trim() || '',
                })),
        };
    }

    validate(savedData: MediaGalleryData): boolean {
        return Array.isArray(savedData?.items) && savedData.items.length > 0;
    }

    destroy() {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.shell?.destroy();
        this.shell = null;
    }
}
