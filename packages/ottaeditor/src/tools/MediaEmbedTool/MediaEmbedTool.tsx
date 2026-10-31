import type { API, BlockTool } from '@editorjs/editorjs';
import type { FileSource } from '@ottabase/utils/media';
import { toolboxEntry } from '../../blocks';
import { field, mediaInput, row, stack, textInput, type MediaSelection } from '../../ui/kit';
import { BlockShell } from '../../ui/shell';

/** Editor.js block data for a non-image media embed */
export interface MediaEmbedData {
    /** A stored file, or an outside address */
    media?: FileSource;
    title?: string;
    caption?: string;
    mimeType?: string;
    mediaKind?: string;
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
            media: data?.media || undefined,
            title: data?.title || '',
            caption: data?.caption || '',
            mimeType: data?.mimeType || '',
            mediaKind: data?.mediaKind || 'other',
        };
    }

    render(): HTMLElement {
        const shell = new BlockShell({
            type: 'mediaEmbed',
            hasContent: Boolean(this.data.media),
            summary: this.summary(),
        });
        this.shell = shell;

        const media = mediaInput({
            value: this.data.media,
            ariaLabel: 'Media file',
            placeholder: 'Choose a video, audio file or document',
            accept: ['video', 'audio', 'document', 'archive', 'other'],
            noThumb: true,
            onChange: (value, picked) => this.setMedia(value, picked),
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

    private setMedia(media: FileSource | undefined, picked?: MediaSelection) {
        this.update({
            media,
            mimeType: picked?.mimeType || this.data.mimeType,
            mediaKind: picked?.mediaKind || this.data.mediaKind || 'other',
            title: picked ? picked.title || picked.name || this.data.title : this.data.title,
        });
        if (picked) this.shell?.setMode('preview');
    }

    private update(patch: Partial<MediaEmbedData>) {
        this.data = { ...this.data, ...patch };
        this.shell?.setSummary(this.summary());
        this.shell?.preview({ ...this.data });
    }

    private summary(): string {
        if (!this.data.media) return 'no file yet';
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
