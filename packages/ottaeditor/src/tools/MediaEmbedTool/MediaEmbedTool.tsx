import type { API, BlockTool } from '@editorjs/editorjs';
import { toolboxEntry } from '../../blocks';
import { field, mediaInput, row, stack, textInput, type MediaSelection } from '../../ui/kit';
import { BlockShell } from '../../ui/shell';

/** Editor.js block data for a non-image media embed */
export interface MediaEmbedData {
    url: string;
    title?: string;
    caption?: string;
    mediaId?: string;
    mimeType?: string;
    mediaKind?: string;
    thumbnailUrl?: string;
    previewUrl?: string;
}

/**
 * Video, audio, PDF or document from the library (MediaLibraryTool also inserts these).
 * Edit: pick the file, name it, caption it. Preview: the renderer's player.
 */
export default class MediaEmbedTool implements BlockTool {
    private data: MediaEmbedData;
    private shell: BlockShell | null = null;
    private unsubscribe: (() => void) | null = null;

    static get toolbox() {
        return toolboxEntry('mediaEmbed');
    }

    static get isReadOnlySupported() {
        return true;
    }

    constructor({ data }: { data: Partial<MediaEmbedData>; api?: API }) {
        this.data = {
            url: data?.url || '',
            title: data?.title || '',
            caption: data?.caption || '',
            mediaId: data?.mediaId || '',
            mimeType: data?.mimeType || '',
            mediaKind: data?.mediaKind || 'other',
            thumbnailUrl: data?.thumbnailUrl || '',
            previewUrl: data?.previewUrl || '',
        };
    }

    render(): HTMLElement {
        const shell = new BlockShell({
            type: 'mediaEmbed',
            hasContent: Boolean(this.data.url),
            summary: this.summary(),
        });
        this.shell = shell;

        const media = mediaInput({
            value: this.data.url,
            ariaLabel: 'Media file',
            placeholder: 'Choose a video, audio file or document',
            accept: ['video', 'audio', 'document', 'archive', 'other'],
            noThumb: true,
            onChange: (url, picked) => this.setMedia(url, picked),
        });
        this.unsubscribe = media.destroy;

        const title = textInput({
            value: this.data.title || '',
            placeholder: 'Shown as the file name',
            onInput: (v) => this.update({ title: v }),
        });
        const caption = textInput({
            value: this.data.caption || '',
            placeholder: 'Shown under the player (optional)',
            onInput: (v) => this.update({ caption: v }),
        });

        shell.fields.append(
            stack(
                field({ label: 'File', control: media.element }),
                row(
                    field({ label: 'Title', control: title, grow: true }),
                    field({ label: 'Caption', control: caption, grow: true }),
                ),
            ),
        );
        shell.preview({ ...this.data });
        return shell.element;
    }

    private setMedia(url: string, picked?: MediaSelection) {
        this.update({
            url,
            mediaId: picked?.mediaId || picked?.id || this.data.mediaId,
            mimeType: picked?.mimeType || this.data.mimeType,
            mediaKind: picked?.mediaKind || this.data.mediaKind || 'other',
            thumbnailUrl: picked?.thumbnailUrl || this.data.thumbnailUrl,
            previewUrl: picked?.previewUrl || this.data.previewUrl,
            title: picked ? picked.title || picked.originalName || this.data.title : this.data.title,
        });
        if (picked) this.shell?.setMode('preview');
    }

    private update(patch: Partial<MediaEmbedData>) {
        this.data = { ...this.data, ...patch };
        this.shell?.setSummary(this.summary());
        this.shell?.preview({ ...this.data });
    }

    private summary(): string {
        if (!this.data.url) return 'no file yet';
        return this.data.mediaKind && this.data.mediaKind !== 'other' ? this.data.mediaKind : 'file';
    }

    save(): MediaEmbedData {
        return { ...this.data };
    }

    destroy() {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.shell?.destroy();
        this.shell = null;
    }
}
