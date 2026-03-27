import './MediaLibraryTool.css';

const globalState = {
    isActive: false,
    activeBlockIndex: null as number | null,
    activeBlockId: '',
};

export default class MediaLibraryTool {
    private api: any;
    private editor: any;
    private wrapper: HTMLElement;
    private block: any;
    private mediaSelectedListener: (e: Event) => void;
    private isActive: boolean = false;
    private isListenerAttached: boolean = false;

    static get toolbox() {
        return {
            title: 'Media Library',
            icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v1a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" /><path d="M4 13m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" /><path d="M14 4m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" /><path d="M14 15m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v1a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" /></svg>',
        };
    }

    constructor({ api, config, block }: { api: any; config: any; block: any }) {
        this.api = api;
        this.editor = config.editor;
        this.block = block;
        this.wrapper = document.createElement('div');

        // Define listener but don't attach it yet
        this.mediaSelectedListener = async (e: Event) => {
            const customEvent = e as CustomEvent;
            if (globalState.isActive) return;
            globalState.isActive = true;
            try {
                const file = customEvent.detail.media;
                const mediaLibOpenedVia = customEvent.detail?.openedVia === 'programmatic';
                console.log('Media selected:', file?.name, 'Media library opened via editor:', mediaLibOpenedVia);

                let currentIndex = this.api.blocks.getCurrentBlockIndex();

                // Delete the media library block first if it was opened programmatically (prevent index issues)
                if (mediaLibOpenedVia && globalState.activeBlockIndex !== null) {
                    const blockToDelete = this.api.blocks.getBlockByIndex(globalState.activeBlockIndex);
                    if (blockToDelete && blockToDelete.id === globalState.activeBlockId) {
                        console.log('Deleting media library block at index:', globalState.activeBlockIndex);
                        this.api.blocks.delete(globalState.activeBlockIndex);
                        // Adjust insertion index since we deleted a block
                        currentIndex = globalState.activeBlockIndex;
                    }
                } else if (!mediaLibOpenedVia) {
                    // Insert at the end if not opened via editor
                    currentIndex = this.api.blocks.getBlocksCount();
                }

                // Ensure a valid index always
                currentIndex =
                    currentIndex < 0
                        ? (globalState.activeBlockIndex ?? this.api.blocks.getBlocksCount())
                        : currentIndex;

                await this.insertImage(file, currentIndex);
                console.log('Image block inserted at index:', currentIndex);

                // Reset global state
                globalState.activeBlockIndex = null;
                globalState.activeBlockId = '';
            } catch (error) {
                console.error('Error inserting image block:', error);
            } finally {
                globalState.isActive = false;
            }
        };
    }

    async insertImage(file: any, index: number) {
        const imageData = {
            success: 1,
            file: {
                url: file.url,
            },
            caption: file.name,
            withBorder: true,
            withBackground: true,
            stretched: false,
        };
        return this.api.blocks.insert(
            'image', // Tool - assuming 'image' or 'advancedImage' is available.
            // Wait, if 'image' is alias to AdvancedImageTool, this works.
            imageData, // Block's data
            {}, // config
            index, // at current index
            true, // focus?
        );
    }

    openMediaLib() {
        // Store the current block index in global state
        globalState.activeBlockIndex = this.api.blocks.getCurrentBlockIndex();
        globalState.activeBlockId = this.block.id;
        window.dispatchEvent(new CustomEvent('media-library-open'));
        console.log('Global state:', globalState);
    }

    render() {
        this.wrapper.classList.add('cdx-media-library', 'ob-plugin');

        // Attach listener only once
        if (!this.isListenerAttached) {
            window.addEventListener('media-library-selected-item', this.mediaSelectedListener);
            this.isListenerAttached = true;
        }

        const placeholder = document.createElement('div');
        placeholder.classList.add('cdx-media-library-placeholder');
        placeholder.innerHTML = `
            <div class="cdx-media-library-placeholder-content">
                Click to select media from library
            </div>
        `;

        placeholder.addEventListener('click', () => {
            this.openMediaLib();
        });

        this.wrapper.appendChild(placeholder);

        // Auto-open media library when this block is created?
        // The original code does this:
        this.openMediaLib();

        return this.wrapper;
    }

    save() {
        return {};
    }

    destroy() {
        if (this.isListenerAttached) {
            window.removeEventListener('media-library-selected-item', this.mediaSelectedListener);
            this.isListenerAttached = false;
        }
        this.isActive = false;
    }
}
