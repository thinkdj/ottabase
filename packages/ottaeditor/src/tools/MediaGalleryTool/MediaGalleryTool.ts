import type { API, BlockTool } from '@editorjs/editorjs';
import './MediaGalleryTool.css';

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
    namespace?: string;
    defaultLayout?: MediaGalleryLayoutPreset;
    maxItems?: number;
    /** Enable multi-select in the media library picker (default: true). */
    allowMultiselect?: boolean;
}

interface EditorJsBlock {
    id: string;
}

interface MediaSelectionPayload {
    id?: string;
    url: string;
    title?: string;
    originalName?: string;
    altText?: string;
    caption?: string;
    mediaId?: string;
    mimeType?: string;
    mediaKind?: string;
    thumbnailUrl?: string;
    previewUrl?: string;
}

interface EditorMediaState {
    activeBlockId: string;
}

const stateByNamespace = new Map<string, EditorMediaState>();
const instancesByNamespace = new Map<string, Map<string, MediaGalleryTool>>();
// Stores the actual handler reference per namespace so it can be removed when the namespace is empty.
const listenerByNamespace = new Map<string, (e: Event) => void>();

/** Tracks references to Up/Down buttons per item card for fine-grained state updates. */
interface ItemCardRef {
    card: HTMLElement;
    upBtn: HTMLButtonElement;
    downBtn: HTMLButtonElement;
}

const DEFAULT_LAYOUT: MediaGalleryLayoutPreset = 'grid-balanced';
const LAYOUT_OPTIONS: Array<{ value: MediaGalleryLayoutPreset; label: string }> = [
    { value: 'grid-balanced', label: 'Grid' },
    { value: 'grid-featured', label: 'Grid Featured' },
    { value: 'masonry', label: 'Masonry' },
    { value: 'filmstrip', label: 'Filmstrip' },
    { value: 'mosaic', label: 'Mosaic' },
];

function getState(ns: string): EditorMediaState {
    let state = stateByNamespace.get(ns);
    if (!state) {
        state = { activeBlockId: '' };
        stateByNamespace.set(ns, state);
    }
    return state;
}

function getInstances(ns: string): Map<string, MediaGalleryTool> {
    let map = instancesByNamespace.get(ns);
    if (!map) {
        map = new Map();
        instancesByNamespace.set(ns, map);
    }
    return map;
}

function attachSharedListener(ns: string) {
    if (listenerByNamespace.has(ns)) {
        return;
    }

    const handler = (e: Event) => {
        const customEvent = e as CustomEvent<{ media: MediaSelectionPayload }>;
        const state = getState(ns);
        const activeBlockId = state.activeBlockId;
        if (!activeBlockId) return;
        const instance = getInstances(ns).get(activeBlockId);
        if (!instance) return;
        instance.handleMediaSelected(customEvent.detail?.media);
    };

    listenerByNamespace.set(ns, handler);
    window.addEventListener('media-library-selected-item', handler);
}

/** Remove the shared listener and state for a namespace when it has no remaining instances. */
function detachSharedListener(ns: string) {
    const handler = listenerByNamespace.get(ns);
    if (handler) {
        window.removeEventListener('media-library-selected-item', handler);
        listenerByNamespace.delete(ns);
    }
    stateByNamespace.delete(ns);
}

export default class MediaGalleryTool implements BlockTool {
    private api: API;
    private block: EditorJsBlock;
    private config: MediaGalleryToolConfig;
    private namespace: string;
    private data: MediaGalleryData;
    private wrapper: HTMLElement | null = null;
    private itemsContainer: HTMLElement | null = null;
    private layoutPreviewEl: HTMLElement | null = null;
    private itemCountEl: HTMLElement | null = null;
    private maxReachedEl: HTMLElement | null = null;
    private emptyEl: HTMLElement | null = null;
    /** Parallel array mirroring this.data.items; entries match by index. */
    private itemCardEls: ItemCardRef[] = [];
    /** Whether the items list is collapsed */
    private isCollapsed = false;
    /** Reference to expand/collapse button for state updates */
    private expandCollapseBtn: HTMLButtonElement | null = null;

    static get toolbox() {
        return {
            title: 'Media Gallery',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>',
        };
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
        this.namespace = this.config.namespace || 'default';
        this.data = this.normalizeData(data);

        getInstances(this.namespace).set(block.id, this);
        attachSharedListener(this.namespace);
    }

    private normalizeData(data?: Partial<MediaGalleryData>): MediaGalleryData {
        const layout = data?.layout || this.config.defaultLayout || DEFAULT_LAYOUT;
        return {
            title: data?.title || '',
            caption: data?.caption || '',
            layout,
            items: (data?.items || []).filter((item) => Boolean(item?.url)).map((item) => ({ ...item })),
        };
    }

    render(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.classList.add('cdx-media-gallery', 'ob-plugin');

        const top = document.createElement('div');
        top.classList.add('cdx-media-gallery__top');

        const controls = document.createElement('div');
        controls.classList.add('cdx-media-gallery__controls');

        const titleGroup = this.createInputGroup('Gallery title', this.data.title || '', (value) => {
            this.data.title = value;
        });
        controls.appendChild(titleGroup);

        const layoutGroup = document.createElement('div');
        layoutGroup.classList.add('ob-input-group');
        const layoutLabel = document.createElement('label');
        layoutLabel.classList.add('ob-label');
        layoutLabel.textContent = 'Layout preset';
        const layoutSelect = document.createElement('select');
        layoutSelect.classList.add('ob-select');
        layoutSelect.setAttribute('aria-label', 'Gallery layout preset');
        LAYOUT_OPTIONS.forEach((option) => {
            const optionEl = document.createElement('option');
            optionEl.value = option.value;
            optionEl.textContent = option.label;
            optionEl.selected = this.data.layout === option.value;
            layoutSelect.appendChild(optionEl);
        });
        layoutSelect.addEventListener('change', () => {
            this.data.layout = layoutSelect.value as MediaGalleryLayoutPreset;
            // Layout change only affects the preview minimap, not item cards
            this.renderLayoutPreview();
        });
        layoutGroup.appendChild(layoutLabel);
        layoutGroup.appendChild(layoutSelect);
        controls.appendChild(layoutGroup);

        const captionGroup = document.createElement('div');
        captionGroup.classList.add('ob-input-group');
        const captionLabel = document.createElement('label');
        captionLabel.classList.add('ob-label');
        captionLabel.textContent = 'Gallery caption';
        const captionInput = document.createElement('textarea');
        captionInput.classList.add('ob-textarea');
        captionInput.rows = 2;
        captionInput.value = this.data.caption || '';
        captionInput.placeholder = 'Optional caption shown below the gallery.';
        captionInput.addEventListener('input', () => {
            this.data.caption = captionInput.value;
        });
        captionGroup.appendChild(captionLabel);
        captionGroup.appendChild(captionInput);
        controls.appendChild(captionGroup);

        const previewPanel = document.createElement('div');
        previewPanel.classList.add('cdx-media-gallery__preview-panel');

        const previewLabel = document.createElement('div');
        previewLabel.classList.add('cdx-media-gallery__preview-label');
        previewLabel.textContent = 'Layout preview';

        const layoutPreviewEl = document.createElement('div');
        layoutPreviewEl.classList.add('cdx-media-gallery__layout-preview');
        this.layoutPreviewEl = layoutPreviewEl;
        this.renderLayoutPreview();

        const previewHint = document.createElement('div');
        previewHint.classList.add('cdx-media-gallery__preview-hint');
        previewHint.textContent = 'Approximate visual map of how cards are arranged.';

        // Item count badge (e.g. "3 / 50 items")
        const itemCountEl = document.createElement('div');
        itemCountEl.classList.add('cdx-media-gallery__item-count');
        this.itemCountEl = itemCountEl;

        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.classList.add('cdx-media-gallery__add-button');
        addButton.textContent = 'Add media';
        addButton.addEventListener('click', (event) => {
            event.preventDefault();
            this.openMediaLibrary();
        });

        previewPanel.appendChild(previewLabel);
        previewPanel.appendChild(layoutPreviewEl);
        previewPanel.appendChild(previewHint);
        previewPanel.appendChild(itemCountEl);
        previewPanel.appendChild(addButton);

        // Items section: header row (label + expand/collapse + clear-all) above the list
        const itemsHeader = document.createElement('div');
        itemsHeader.classList.add('cdx-media-gallery__items-header');

        const itemsLabel = document.createElement('span');
        itemsLabel.classList.add('cdx-media-gallery__items-label');
        itemsLabel.textContent = 'Items';

        // Header actions container
        const headerActions = document.createElement('div');
        headerActions.classList.add('cdx-media-gallery__header-actions');

        // Expand/collapse toggle
        const expandCollapseBtn = document.createElement('button');
        expandCollapseBtn.type = 'button';
        expandCollapseBtn.classList.add('cdx-media-gallery__expand-collapse-button');
        expandCollapseBtn.textContent = this.isCollapsed ? 'Expand' : 'Collapse';
        expandCollapseBtn.setAttribute('aria-label', this.isCollapsed ? 'Expand items list' : 'Collapse items list');
        expandCollapseBtn.addEventListener('click', (event) => {
            event.preventDefault();
            this.isCollapsed = !this.isCollapsed;
            expandCollapseBtn.textContent = this.isCollapsed ? 'Expand' : 'Collapse';
            expandCollapseBtn.setAttribute(
                'aria-label',
                this.isCollapsed ? 'Expand items list' : 'Collapse items list',
            );
            if (this.itemsContainer) {
                this.itemsContainer.classList.toggle('cdx-media-gallery__items--collapsed', this.isCollapsed);
            }
        });
        this.expandCollapseBtn = expandCollapseBtn;
        headerActions.appendChild(expandCollapseBtn);

        // Clear all removes every item in one click — placed here so it's clearly scoped to the item list
        const clearButton = document.createElement('button');
        clearButton.type = 'button';
        clearButton.classList.add('cdx-media-gallery__clear-button');
        clearButton.textContent = 'Clear all';
        clearButton.setAttribute('aria-label', 'Remove all gallery items');
        clearButton.addEventListener('click', (event) => {
            event.preventDefault();
            if (this.data.items.length === 0) return;
            this.requestConfirm(
                `Remove all ${this.data.items.length} item${this.data.items.length === 1 ? '' : 's'} from the gallery?`,
                'Clear all',
                () => {
                    this.data.items = [];
                    this.itemCardEls = [];
                    this.renderItems();
                },
            );
        });
        headerActions.appendChild(clearButton);

        itemsHeader.appendChild(itemsLabel);
        itemsHeader.appendChild(headerActions);

        const itemsContainer = document.createElement('div');
        itemsContainer.classList.add('cdx-media-gallery__items');

        top.appendChild(controls);
        top.appendChild(previewPanel);
        wrapper.appendChild(top);
        wrapper.appendChild(itemsHeader);
        wrapper.appendChild(itemsContainer);

        this.wrapper = wrapper;
        this.itemsContainer = itemsContainer;
        this.renderItems();

        return wrapper;
    }

    private createInputGroup(labelText: string, value: string, onInput: (value: string) => void): HTMLElement {
        const group = document.createElement('div');
        group.classList.add('ob-input-group');
        const label = document.createElement('label');
        label.classList.add('ob-label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'text';
        input.classList.add('ob-input');
        input.value = value;
        input.addEventListener('input', () => onInput(input.value));
        group.appendChild(label);
        group.appendChild(input);
        return group;
    }

    /** Full rebuild of the item list; used on initial render and clear-all. */
    private renderItems() {
        if (!this.itemsContainer) return;

        this.renderLayoutPreview();
        this.itemCardEls = [];
        this.itemsContainer.className = 'cdx-media-gallery__items';
        this.itemsContainer.innerHTML = '';
        this.emptyEl = null;
        this.maxReachedEl = null;

        if (this.data.items.length === 0) {
            this.showEmptyState();
            this.updateItemCount();
            return;
        }

        this.data.items.forEach((item) => {
            const ref = this.buildItemCard(item);
            this.itemCardEls.push(ref);
            this.itemsContainer!.appendChild(ref.card);
        });

        this.refreshButtonStates();
        this.updateItemCount();
        this.syncMaxReachedBanner();
    }

    /** Build a single item card DOM element without appending it. */
    private buildItemCard(item: MediaGalleryItem): ItemCardRef {
        const card = document.createElement('div');
        card.classList.add('cdx-media-gallery__item-card');

        // Thumbnail
        const previewWrap = document.createElement('div');
        previewWrap.classList.add('cdx-media-gallery__preview');
        if ((item.mediaKind || 'image') === 'image') {
            const img = document.createElement('img');
            img.src = item.thumbnailUrl || item.previewUrl || item.url;
            img.alt = item.altText || item.title || 'Gallery image';
            previewWrap.appendChild(img);
        } else {
            const kind = document.createElement('div');
            kind.classList.add('cdx-media-gallery__kind-chip');
            kind.textContent = (item.mediaKind || 'other').toUpperCase();
            previewWrap.appendChild(kind);
        }

        // Meta — compact two-row layout with persistent labels so title/alt/caption are always identifiable
        const meta = document.createElement('div');
        meta.classList.add('cdx-media-gallery__meta');

        // Row 1: title + alt text side by side, each with a visible micro-label
        const row1 = document.createElement('div');
        row1.classList.add('cdx-media-gallery__meta-row');

        const titleField = document.createElement('div');
        titleField.classList.add('cdx-media-gallery__field');
        const titleLabel = document.createElement('span');
        titleLabel.classList.add('cdx-media-gallery__field-label');
        titleLabel.textContent = 'Title';
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.classList.add('ob-input', 'ob-input--sm');
        titleInput.placeholder = 'Image title';
        titleInput.value = item.title || '';
        // Use indexOf to get the current index dynamically (stable across reorders)
        titleInput.addEventListener('input', () => {
            const idx = this.data.items.indexOf(item);
            if (idx !== -1) this.data.items[idx].title = titleInput.value;
        });
        titleField.appendChild(titleLabel);
        titleField.appendChild(titleInput);

        const altField = document.createElement('div');
        altField.classList.add('cdx-media-gallery__field');
        const altLabel = document.createElement('span');
        altLabel.classList.add('cdx-media-gallery__field-label');
        altLabel.textContent = 'Alt text';
        const altInput = document.createElement('input');
        altInput.type = 'text';
        altInput.classList.add('ob-input', 'ob-input--sm');
        altInput.placeholder = 'Screen reader description';
        altInput.value = item.altText || '';
        altInput.addEventListener('input', () => {
            const idx = this.data.items.indexOf(item);
            if (idx !== -1) this.data.items[idx].altText = altInput.value;
        });
        altField.appendChild(altLabel);
        altField.appendChild(altInput);

        row1.appendChild(titleField);
        row1.appendChild(altField);

        // Row 2: caption with its own label
        const captionField = document.createElement('div');
        captionField.classList.add('cdx-media-gallery__field');
        const captionLabel = document.createElement('span');
        captionLabel.classList.add('cdx-media-gallery__field-label');
        captionLabel.textContent = 'Caption';
        const captionInput = document.createElement('input');
        captionInput.type = 'text';
        captionInput.classList.add('ob-input', 'ob-input--sm');
        captionInput.placeholder = 'Shown below the image';
        captionInput.value = item.caption || '';
        captionInput.addEventListener('input', () => {
            const idx = this.data.items.indexOf(item);
            if (idx !== -1) this.data.items[idx].caption = captionInput.value;
        });
        captionField.appendChild(captionLabel);
        captionField.appendChild(captionInput);

        meta.appendChild(row1);
        meta.appendChild(captionField);

        // Controls — small icon buttons
        const itemControls = document.createElement('div');
        itemControls.classList.add('cdx-media-gallery__item-controls');

        const upBtn = this.createIconButton('↑', 'Move item up', () => {
            const idx = this.data.items.indexOf(item);
            if (idx > 0) this.moveItem(idx, -1);
        }) as HTMLButtonElement;

        const downBtn = this.createIconButton('↓', 'Move item down', () => {
            const idx = this.data.items.indexOf(item);
            if (idx !== -1 && idx < this.data.items.length - 1) this.moveItem(idx, 1);
        }) as HTMLButtonElement;

        const removeBtn = this.createIconButton(
            '×',
            'Remove item',
            () => {
                this.requestConfirm('Remove this item from the gallery?', 'Remove', () => {
                    const idx = this.data.items.indexOf(item);
                    if (idx !== -1) this.removeItem(idx);
                });
            },
            true,
        ) as HTMLButtonElement;

        itemControls.appendChild(upBtn);
        itemControls.appendChild(downBtn);
        itemControls.appendChild(removeBtn);

        card.appendChild(previewWrap);
        card.appendChild(meta);
        card.appendChild(itemControls);

        return { card, upBtn, downBtn };
    }

    /** Small icon button used for per-item controls (↑ ↓ ×). */
    private createIconButton(icon: string, ariaLabel: string, onClick: () => void, danger = false): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.classList.add('cdx-media-gallery__item-button');
        if (danger) button.classList.add('cdx-media-gallery__item-button--danger');
        button.textContent = icon;
        button.setAttribute('aria-label', ariaLabel);
        button.addEventListener('click', (event) => {
            event.preventDefault();
            if (!button.disabled) onClick();
        });
        return button;
    }

    /** Update Up/Down disabled states only for cards whose boundary status may have changed. */
    private refreshButtonStates() {
        this.itemCardEls.forEach(({ upBtn, downBtn }, i) => {
            upBtn.disabled = i === 0;
            downBtn.disabled = i === this.itemCardEls.length - 1;
        });
    }

    private showEmptyState() {
        if (!this.itemsContainer) return;
        const empty = document.createElement('div');
        empty.classList.add('cdx-media-gallery__empty');
        empty.textContent = 'No media selected. Click "Add media" to build the gallery.';
        this.emptyEl = empty;
        this.itemsContainer.appendChild(empty);
    }

    /** Update the "N / max items" count badge in the preview panel. */
    private updateItemCount() {
        if (!this.itemCountEl) return;
        const count = this.data.items.length;
        const max = this.config.maxItems || 50;
        this.itemCountEl.textContent = count === 0 ? '' : `${count} / ${max} items`;
    }

    /** Show or hide the max-reached warning banner below the item list. */
    private syncMaxReachedBanner() {
        const maxItems = this.config.maxItems || 50;
        const atMax = this.data.items.length >= maxItems;
        if (atMax && !this.maxReachedEl && this.itemsContainer) {
            const banner = document.createElement('div');
            banner.classList.add('cdx-media-gallery__max-reached');
            banner.textContent = `Maximum of ${maxItems} items reached.`;
            this.maxReachedEl = banner;
            this.itemsContainer.appendChild(banner);
        } else if (!atMax && this.maxReachedEl) {
            this.maxReachedEl.remove();
            this.maxReachedEl = null;
        }
    }

    /** Fine-grained: append one new card to the live DOM (no full rebuild). */
    private appendItemCard(item: MediaGalleryItem) {
        if (!this.itemsContainer) return;
        // Remove empty-state placeholder if present
        if (this.emptyEl) {
            this.emptyEl.remove();
            this.emptyEl = null;
        }
        const ref = this.buildItemCard(item);
        this.itemCardEls.push(ref);
        // Insert before the max-reached banner if it exists
        if (this.maxReachedEl) {
            this.itemsContainer.insertBefore(ref.card, this.maxReachedEl);
        } else {
            this.itemsContainer.appendChild(ref.card);
        }
        this.refreshButtonStates();
        this.updateItemCount();
        this.syncMaxReachedBanner();
    }

    /** Fine-grained: remove the card at `index` from the live DOM (no full rebuild). */
    private removeItemCardAt(index: number) {
        const ref = this.itemCardEls[index];
        ref.card.remove();
        this.itemCardEls.splice(index, 1);
        if (this.itemCardEls.length === 0) {
            this.showEmptyState();
        } else {
            this.refreshButtonStates();
        }
        this.updateItemCount();
        this.syncMaxReachedBanner();
    }

    /**
     * Fine-grained: swap two adjacent cards in the DOM.
     * Always called with the lower index first (i < j).
     * Inserting hiCard before loCard is sufficient because they are adjacent.
     */
    private swapAdjacentCards(lo: number, hi: number) {
        const loRef = this.itemCardEls[lo];
        const hiRef = this.itemCardEls[hi];
        loRef.card.parentNode?.insertBefore(hiRef.card, loRef.card);
        this.itemCardEls[lo] = hiRef;
        this.itemCardEls[hi] = loRef;
        this.refreshButtonStates();
    }

    private renderLayoutPreview() {
        if (!this.layoutPreviewEl) {
            return;
        }

        const presetClass = `cdx-media-gallery__layout-preview--${this.data.layout}`;
        this.layoutPreviewEl.className = 'cdx-media-gallery__layout-preview';
        this.layoutPreviewEl.classList.add(presetClass);
        this.layoutPreviewEl.innerHTML = '';

        const blocks = this.getPreviewBlocksForLayout();
        blocks.forEach((blockClass) => {
            const block = document.createElement('div');
            block.classList.add('cdx-media-gallery__layout-cell', blockClass);
            this.layoutPreviewEl?.appendChild(block);
        });
    }

    private getPreviewBlocksForLayout(): string[] {
        switch (this.data.layout) {
            case 'grid-featured':
                return ['wide', 'normal', 'normal', 'normal', 'normal'];
            case 'masonry':
                // Non-uniform heights convey the stacking nature of masonry columns
                return ['tall', 'short', 'normal', 'short', 'short', 'tall'];
            case 'filmstrip':
                return ['strip', 'strip', 'strip', 'strip'];
            case 'mosaic':
                return ['wide', 'normal', 'tall', 'normal', 'normal', 'wide'];
            case 'grid-balanced':
            default:
                return ['normal', 'normal', 'normal', 'normal', 'normal', 'normal'];
        }
    }

    private moveItem(index: number, direction: -1 | 1) {
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= this.data.items.length) return;
        // Swap data
        [this.data.items[index], this.data.items[nextIndex]] = [this.data.items[nextIndex], this.data.items[index]];
        // Swap DOM nodes without a full rebuild
        const lo = Math.min(index, nextIndex);
        const hi = Math.max(index, nextIndex);
        this.swapAdjacentCards(lo, hi);
    }

    private removeItem(index: number) {
        this.data.items.splice(index, 1);
        // Remove single node without a full rebuild
        this.removeItemCardAt(index);
    }

    /**
     * Request confirmation via the React `MediaGalleryConfirmBridge` (shadcn AlertDialog).
     * Falls back to window.confirm() when the bridge is not mounted (e.g. tests / storybook).
     *
     * @param message     - Human-readable message shown in the dialog body.
     * @param confirmLabel - Label for the destructive confirm button (default: "Remove").
     * @param onConfirmed - Callback executed only when the user clicks confirm.
     */
    private requestConfirm(message: string, confirmLabel: string, onConfirmed: () => void) {
        const CONFIRM_EVENT = 'media-gallery-confirm';
        const RESULT_EVENT = 'media-gallery-confirm-result';
        const id = `${this.block.id}-${Date.now()}`;

        // Check whether the React bridge is present by seeing if anything is listening.
        // CustomEvent is always dispatchable; we detect the bridge via a marker on window.
        const bridgePresent = Boolean(
            (window as Window & { __mgConfirmBridgeActive?: boolean }).__mgConfirmBridgeActive,
        );

        if (!bridgePresent) {
            // Fallback for environments without the React bridge
            if (window.confirm(message)) onConfirmed();
            return;
        }

        // One-time listener for the response
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

    private openMediaLibrary() {
        const state = getState(this.namespace);
        state.activeBlockId = this.block.id;
        window.dispatchEvent(
            new CustomEvent('media-library-open', {
                detail: {
                    source: 'editor',
                    acceptKinds: ['image', 'video', 'audio', 'document', 'archive', 'other'],
                    // Gallery defaults to multi-select so users can batch-add items in one pick
                    multiselect: this.config.allowMultiselect !== false,
                },
            }),
        );
    }

    // Not async: no await is needed; caller in attachSharedListener is also plain sync now.
    handleMediaSelected(media?: MediaSelectionPayload) {
        if (!media?.url) return;

        const nextItem: MediaGalleryItem = {
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

        const duplicate = this.data.items.some(
            (item) => item.mediaId && nextItem.mediaId && item.mediaId === nextItem.mediaId,
        );
        if (duplicate) return;

        const maxItems = this.config.maxItems || 50;
        if (this.data.items.length >= maxItems) {
            // Banner is already visible via syncMaxReachedBanner; silently reject
            return;
        }

        this.data.items.push(nextItem);
        // Fine-grained append — no full rebuild
        this.appendItemCard(nextItem);
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
        const instances = getInstances(this.namespace);
        instances.delete(this.block.id);
        // When the last block in a namespace is removed, clean up the window listener and state
        // to prevent accumulation if the editor is torn down and re-mounted.
        if (instances.size === 0) {
            instancesByNamespace.delete(this.namespace);
            detachSharedListener(this.namespace);
        }
    }
}
