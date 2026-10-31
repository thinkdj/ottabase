import type { StoredFile } from '@ottabase/utils/media';
import { toolboxEntry } from '../../blocks';
import { button, h, iconEl, PRIVATE_FILE_MESSAGE, type MediaSelection } from '../../ui/kit';
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
        const detail = (e as CustomEvent<{ media: MediaSelection; openedVia?: string; field?: string }>).detail;
        // A `field` token means a block's own media input asked for this one
        if (detail?.field) return;
        const state = getState(ns);
        if (state.isActive) return;

        const instance = getInstances(ns).get(state.activeBlockId);
        if (!instance) return;

        state.isActive = true;
        try {
            await instance.handleMediaSelected(detail);
        } finally {
            state.isActive = false;
        }
    });
}

/**
 * "From library": a picker, not content. It opens the host's media library and replaces itself
 * with an `image` or `mediaEmbed` block for whatever was chosen.
 */
export default class MediaLibraryTool {
    private api: EditorJsApi;
    private wrapper: HTMLElement;
    private status: HTMLElement;
    private block: EditorJsBlock;
    private namespace: string;

    static get toolbox() {
        return toolboxEntry('mediaLibrary');
    }

    constructor({ api, config, block }: { api: EditorJsApi; config: Record<string, unknown>; block: EditorJsBlock }) {
        this.api = api;
        this.block = block;
        this.wrapper = h('div', { className: 'oe-picker', dataset: { block: 'mediaLibrary' } });
        this.status = h('p', { className: 'oe-hint oe-status', role: 'status' });

        // Namespace isolates state when multiple editors exist on the same page
        this.namespace = (config?.namespace as string) || 'default';

        getInstances(this.namespace).set(block.id, this);
        attachSharedListener(this.namespace);
    }

    async handleMediaSelected(detail: { media: MediaSelection; openedVia?: string }) {
        const media = detail.media;
        const mediaLibOpenedVia = detail.openedVia === 'programmatic';
        const state = getState(this.namespace);
        // Content keeps the stored file; a private one has none to keep, so the picker stays.
        if (!media?.file) {
            this.status.textContent = PRIVATE_FILE_MESSAGE;
            return;
        }
        this.status.textContent = '';

        try {
            let currentIndex = this.api.blocks.getCurrentBlockIndex();

            // Delete the picker block first if it was opened programmatically
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

            const kind = media.mediaKind || 'image';
            if (kind === 'image') await this.insertImage(media, media.file, currentIndex);
            else await this.insertMediaEmbed(media, media.file, currentIndex);

            this.wrapper.hidden = true;
            state.activeBlockIndex = null;
            state.activeBlockId = '';
        } catch (error) {
            // Message only: the raw object could carry request bodies; @ottabase/utils is not a dependency here
            console.error('Error inserting media block:', error instanceof Error ? error.message : String(error));
        }
    }

    private async insertImage(media: MediaSelection, file: StoredFile, index: number) {
        return this.api.blocks.insert(
            'image',
            {
                image: file,
                caption: media.caption || media.name || '',
                alt: media.alt || '',
                withBorder: true,
                withBackground: true,
                stretched: false,
            },
            {},
            index,
            true,
        );
    }

    private async insertMediaEmbed(media: MediaSelection, file: StoredFile, index: number) {
        return this.api.blocks.insert(
            'mediaEmbed',
            {
                media: file,
                title: media.title || media.name || '',
                caption: media.caption || '',
                mimeType: media.mimeType || '',
                mediaKind: media.mediaKind || 'other',
            },
            {},
            index,
            true,
        );
    }

    openMediaLib() {
        const state = getState(this.namespace);
        state.activeBlockIndex = this.api.blocks.getCurrentBlockIndex();
        state.activeBlockId = this.block.id;
        window.dispatchEvent(new CustomEvent('media-library-open', { detail: { source: 'editor' } }));
    }

    render() {
        this.wrapper.innerHTML = '';
        this.wrapper.append(
            iconEl('library', 18),
            h(
                'span',
                { className: 'oe-picker__text' },
                'Insert an image, video, audio file or document from your library.',
            ),
            button({
                label: 'Choose from library',
                icon: 'library',
                variant: 'primary',
                size: 'sm',
                onClick: () => this.openMediaLib(),
            }),
            this.status,
        );
        return this.wrapper;
    }

    save() {
        return {};
    }

    destroy() {
        getInstances(this.namespace).delete(this.block.id);
    }
}
