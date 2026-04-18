import './MediaLibraryTool.css';

/** Subset of the Editor.js Block API used by this tool */
interface BlocksApi {
    getCurrentBlockIndex(): number;
    getBlocksCount(): number;
    getBlockByIndex(index: number): { id: string } | undefined;
    delete(index: number): void;
    insert(
        type: string,
        data: Record<string, unknown>,
        config: Record<string, unknown>,
        index: number,
        needToFocus: boolean,
    ): Promise<void>;
}

interface EditorJsApi {
    blocks: BlocksApi;
}

interface EditorJsBlock {
    id: string;
}

interface MediaFilePayload {
    url: string;
    name?: string;
    caption?: string;
    alt?: string;
    width?: number;
    height?: number;
    mediaId?: string;
    mimeType?: string;
    mediaKind?: string;
    title?: string;
    thumbnailUrl?: string;
    previewUrl?: string;
}

/** Per-editor activation state, keyed by a namespace string (defaults to 'default') */
interface EditorMediaState {
    isActive: boolean;
    activeBlockIndex: number | null;
    activeBlockId: string;
}

const stateByNamespace = new Map<string, EditorMediaState>();
const instancesByNamespace = new Map<string, Map<string, MediaLibraryTool>>();
const attachedNamespaces = new Set<string>();

function getState(ns: string): EditorMediaState {
    let state = stateByNamespace.get(ns);
    if (!state) {
        state = { isActive: false, activeBlockIndex: null, activeBlockId: '' };
        stateByNamespace.set(ns, state);
    }
    return state;
}

function getInstances(ns: string): Map<string, MediaLibraryTool> {
    let map = instancesByNamespace.get(ns);
    if (!map) {
        map = new Map();
        instancesByNamespace.set(ns, map);
    }
    return map;
}

function attachSharedListener(ns: string) {
    if (attachedNamespaces.has(ns)) return;
    attachedNamespaces.add(ns);

    window.addEventListener('media-library-selected-item', async (e: Event) => {
        const customEvent = e as CustomEvent;
        const state = getState(ns);
        if (state.isActive) return;

        const instances = getInstances(ns);
        const instance = instances.get(state.activeBlockId);
        if (!instance) return;

        state.isActive = true;
        try {
            await instance.handleMediaSelected(customEvent.detail);
        } finally {
            state.isActive = false;
        }
    });
}

export default class MediaLibraryTool {
    private api: EditorJsApi;
    private wrapper: HTMLElement;
    private block: EditorJsBlock;
    private namespace: string;
    private hasMedia: boolean = false;
    private placeholder: HTMLElement | null = null;

    static get toolbox() {
        return {
            title: 'Media Library',
            icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v1a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" /><path d="M4 13m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" /><path d="M14 4m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" /><path d="M14 15m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v1a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" /></svg>',
        };
    }

    constructor({ api, config, block }: { api: EditorJsApi; config: Record<string, unknown>; block: EditorJsBlock }) {
        this.api = api;
        this.block = block;
        this.wrapper = document.createElement('div');

        // Namespace isolates state when multiple editors exist on the same page
        this.namespace = (config.namespace as string) || 'default';

        getInstances(this.namespace).set(block.id, this);
        attachSharedListener(this.namespace);
    }

    async handleMediaSelected(detail: { media: MediaFilePayload; openedVia?: string }) {
        const file = detail.media;
        const mediaLibOpenedVia = detail.openedVia === 'programmatic';
        const state = getState(this.namespace);

        try {
            let currentIndex = this.api.blocks.getCurrentBlockIndex();

            // Delete the media library block first if it was opened programmatically
            if (mediaLibOpenedVia && state.activeBlockIndex !== null) {
                const blockToDelete = this.api.blocks.getBlockByIndex(state.activeBlockIndex);
                if (blockToDelete && blockToDelete.id === state.activeBlockId) {
                    this.api.blocks.delete(state.activeBlockIndex);
                    currentIndex = state.activeBlockIndex;
                }
            } else if (!mediaLibOpenedVia) {
                currentIndex = this.api.blocks.getBlocksCount();
            }

            currentIndex =
                currentIndex < 0 ? (state.activeBlockIndex ?? this.api.blocks.getBlocksCount()) : currentIndex;

            // Route to the correct block type based on mediaKind
            const kind = file.mediaKind || 'image';
            if (kind === 'image') {
                await this.insertImage(file, currentIndex);
            } else {
                await this.insertMediaEmbed(file, currentIndex);
            }

            // Hide the placeholder since media was selected
            this.hasMedia = true;
            if (this.placeholder) {
                this.placeholder.style.display = 'none';
            }

            state.activeBlockIndex = null;
            state.activeBlockId = '';
        } catch (error) {
            console.error('Error inserting media block:', error);
        }
    }

    private async insertImage(file: MediaFilePayload, index: number) {
        const imageData = {
            success: 1,
            url: file.url,
            file: { url: file.url },
            caption: file.caption || file.name,
            alt: file.alt || '',
            width: file.width || undefined,
            height: file.height || undefined,
            mediaId: file.mediaId || undefined,
            mimeType: file.mimeType || undefined,
            withBorder: true,
            withBackground: true,
            stretched: false,
        };
        return this.api.blocks.insert('image', imageData, {}, index, true);
    }

    private async insertMediaEmbed(file: MediaFilePayload, index: number) {
        const embedData = {
            url: file.url,
            title: file.title || file.name || '',
            caption: file.caption || '',
            mediaId: file.mediaId || undefined,
            mimeType: file.mimeType || '',
            mediaKind: file.mediaKind || 'other',
            thumbnailUrl: file.thumbnailUrl || undefined,
            previewUrl: file.previewUrl || undefined,
        };
        return this.api.blocks.insert('mediaEmbed', embedData, {}, index, true);
    }

    openMediaLib() {
        const state = getState(this.namespace);
        state.activeBlockIndex = this.api.blocks.getCurrentBlockIndex();
        state.activeBlockId = this.block.id;
        window.dispatchEvent(
            new CustomEvent('media-library-open', {
                detail: {
                    source: 'editor',
                },
            }),
        );
    }

    render() {
        this.wrapper.classList.add('cdx-media-library', 'ob-plugin');

        this.placeholder = document.createElement('div');
        this.placeholder.classList.add('cdx-media-library-placeholder');
        this.placeholder.innerHTML = `
            <div class="cdx-media-library-placeholder-content">
                Click to select media from library
            </div>
        `;

        this.placeholder.addEventListener('click', () => {
            this.openMediaLib();
        });

        this.wrapper.appendChild(this.placeholder);

        return this.wrapper;
    }

    save() {
        return {};
    }

    destroy() {
        getInstances(this.namespace).delete(this.block.id);
    }
}
