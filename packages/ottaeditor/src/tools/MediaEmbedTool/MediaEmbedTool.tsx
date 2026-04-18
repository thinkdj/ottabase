import './MediaEmbedTool.css';

/** EditorJS block data for a non-image media embed */
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
 * EditorJS tool for non-image media embeds (video, audio, PDF, document, archive).
 * Inserted programmatically by MediaLibraryTool — not shown in the toolbox.
 */
export default class MediaEmbedTool {
    private data: MediaEmbedData;
    private wrapper: HTMLElement;

    static get toolbox() {
        return undefined as any; // Hidden from toolbox — inserted via MediaLibraryTool only
    }

    static get isReadOnlySupported() {
        return true;
    }

    constructor({ data }: { data: MediaEmbedData }) {
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

        this.wrapper = document.createElement('div');
        this.wrapper.classList.add('media-embed-tool', 'ob-plugin');
    }

    render() {
        this.wrapper.innerHTML = '';

        if (!this.data.url) {
            this.wrapper.innerHTML = `<p class="media-embed-empty">No media URL provided</p>`;
            return this.wrapper;
        }

        const kind = this.data.mediaKind || 'other';
        const title = this.data.title || this.data.url.substring(this.data.url.lastIndexOf('/') + 1);

        // Build preview based on media kind
        if (kind === 'video') {
            const video = document.createElement('video');
            video.src = this.data.previewUrl || this.data.url;
            video.controls = true;
            video.playsInline = true;
            video.preload = 'metadata';
            video.className = 'media-embed-video';
            this.wrapper.appendChild(video);
        } else if (kind === 'audio') {
            const audioContainer = document.createElement('div');
            audioContainer.className = 'media-embed-audio-container';
            audioContainer.innerHTML = `
                <div class="media-embed-audio-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                    </svg>
                </div>
            `;
            const audio = document.createElement('audio');
            audio.src = this.data.previewUrl || this.data.url;
            audio.controls = true;
            audio.preload = 'metadata';
            audio.className = 'media-embed-audio';
            audioContainer.appendChild(audio);
            this.wrapper.appendChild(audioContainer);
        } else if (kind === 'document' && (this.data.mimeType || '').toLowerCase() === 'application/pdf') {
            const iframe = document.createElement('iframe');
            iframe.src = this.data.previewUrl || this.data.url;
            iframe.title = title;
            iframe.className = 'media-embed-pdf';
            iframe.setAttribute('sandbox', 'allow-same-origin');
            iframe.loading = 'lazy';
            this.wrapper.appendChild(iframe);
        } else {
            // Generic file placeholder
            const placeholder = document.createElement('div');
            placeholder.className = 'media-embed-placeholder';
            placeholder.innerHTML = `
                <div class="media-embed-placeholder-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                    </svg>
                </div>
                <p class="media-embed-placeholder-title">${this.escapeHtml(title)}</p>
                <p class="media-embed-placeholder-kind">${this.escapeHtml(kind)}</p>
            `;
            this.wrapper.appendChild(placeholder);
        }

        // Caption input
        if (this.data.caption || this.data.title) {
            const captionEl = document.createElement('div');
            captionEl.className = 'media-embed-caption';
            captionEl.textContent = this.data.caption || this.data.title || '';
            this.wrapper.appendChild(captionEl);
        }

        return this.wrapper;
    }

    save(): MediaEmbedData {
        return { ...this.data };
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
