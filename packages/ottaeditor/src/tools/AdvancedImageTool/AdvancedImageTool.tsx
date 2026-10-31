import type { API, BlockTool, BlockToolConstructorOptions, PasteEvent } from '@editorjs/editorjs';
import { uploadFile } from '@ottabase/ottaupload/utils';
import { validateFileType } from '@ottabase/ottaupload/validation';
import { toolboxEntry } from '../../blocks';
import {
    button,
    field,
    h,
    iconEl,
    mediaInput,
    row,
    sectionLabel,
    segment,
    stack,
    textInput,
    toggle,
    type MediaSelection,
} from '../../ui/kit';
import { BlockShell } from '../../ui/shell';
import './AdvancedImageTool.css';
import type { AdvancedImageData } from './types';

export interface AdvancedImageToolConfig {
    /** @default '/api/files' */
    uploadEndpoint?: string;
    maxFileSize?: number;
    /** The files purpose uploads are stored under. @default 'media' */
    purpose?: string;
}

type Aspect = 'original' | '16:9' | '4:3' | '1:1';

const IMAGE_URL = /\.(jpg|jpeg|png|gif|webp|svg|avif)(\?.*)?$/i;

/**
 * Image block. Empty: a dropzone plus a URL-or-library field. Filled: the current image with
 * Replace / Upload / Remove, then caption, alt, link, display options and aspect ratio.
 * Preview is the renderer's own figure.
 */
export default class AdvancedImageTool implements BlockTool {
    private readonly api: API;
    private readonly config: Required<AdvancedImageToolConfig>;
    private data: AdvancedImageData;
    private shell: BlockShell | null = null;
    private status: HTMLElement | null = null;
    private cleanups: Array<() => void> = [];

    static get toolbox() {
        return toolboxEntry('image');
    }

    static get isReadOnlySupported() {
        return true;
    }

    static get pasteConfig() {
        return {
            tags: ['img'],
            patterns: { image: /https?:\/\/\S+\.(gif|jpe?g|tiff?|png|svg|webp)(\?[a-z0-9=]*)?$/i },
            files: { mimeTypes: ['image/*'] },
        };
    }

    static get sanitize() {
        return {
            url: {},
            mediaId: true,
            mimeType: true,
            caption: true,
            withBorder: true,
            withBackground: true,
            stretched: true,
            alt: true,
            linkUrl: true,
            width: true,
            height: true,
            featuredImage: true,
            aspectRatio: true,
        };
    }

    constructor({
        data,
        config,
        api,
    }: BlockToolConstructorOptions<Partial<AdvancedImageData>, AdvancedImageToolConfig>) {
        this.api = api;
        this.config = {
            uploadEndpoint: config?.uploadEndpoint || '/api/files',
            maxFileSize: config?.maxFileSize || 10 * 1024 * 1024,
            purpose: config?.purpose || 'media',
        };
        this.data = {
            url: data?.url || '',
            mediaId: data?.mediaId || '',
            mimeType: data?.mimeType || '',
            caption: data?.caption || '',
            withBorder: data?.withBorder ?? false,
            withBackground: data?.withBackground ?? false,
            stretched: data?.stretched ?? false,
            alt: data?.alt || '',
            linkUrl: data?.linkUrl || '',
            width: data?.width || 0,
            height: data?.height || 0,
            featuredImage: data?.featuredImage ?? false,
            aspectRatio: data?.aspectRatio || 'original',
        };
    }

    render(): HTMLElement {
        this.shell = new BlockShell({ type: 'image', hasContent: Boolean(this.data.url), summary: this.summary() });
        this.buildFields();
        this.shell.preview({ ...this.data });
        return this.shell.element;
    }

    // ── fields ──────────────────────────────────────────────────────────────

    private buildFields() {
        const shell = this.shell;
        if (!shell) return;
        this.cleanups.forEach((fn) => fn());
        this.cleanups = [];
        shell.fields.innerHTML = '';
        this.status = h('p', { className: 'oe-hint oe-image__status', role: 'status' });

        shell.fields.append(this.data.url ? this.filledFields() : this.emptyFields(), this.status);
    }

    private emptyFields(): HTMLElement {
        const fileInput = h('input', {
            type: 'file',
            accept: 'image/*',
            className: 'oe-image__file',
            'aria-label': 'Upload an image',
        });
        fileInput.addEventListener('change', () => {
            const file = fileInput.files?.[0];
            if (file) this.uploadFile(file);
        });
        const drop = h(
            'div',
            {
                className: 'oe-image__drop',
                role: 'button',
                tabIndex: 0,
                'aria-label': 'Drop an image here or click to upload',
            },
            iconEl('upload', 24),
            h('strong', {}, 'Drop an image here'),
            h('span', { className: 'oe-hint' }, 'or click to upload'),
        );
        drop.addEventListener('click', () => fileInput.click());
        drop.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInput.click();
            }
        });
        for (const name of ['dragenter', 'dragover'] as const) {
            drop.addEventListener(name, (e) => {
                e.preventDefault();
                drop.classList.add('oe-image__drop--over');
            });
        }
        drop.addEventListener('dragleave', () => drop.classList.remove('oe-image__drop--over'));
        drop.addEventListener('drop', (e) => {
            e.preventDefault();
            drop.classList.remove('oe-image__drop--over');
            const file = e.dataTransfer?.files?.[0];
            if (file?.type.startsWith('image/')) this.uploadFile(file);
        });

        return stack(drop, this.urlField('Image URL'), fileInput);
    }

    private urlField(label: string): HTMLElement {
        const media = mediaInput({
            value: '',
            ariaLabel: label,
            placeholder: 'https://… or choose from the library',
            onChange: (url, picked) => {
                if (picked) return this.setImage(picked.url, picked);
                const trimmed = url.trim();
                if (!trimmed) return this.setStatus('');
                if (!this.isValidImageUrl(trimmed))
                    return this.setStatus('Enter a direct image URL (.jpg, .png, .webp, .gif, .svg).');
                this.setImage(trimmed);
            },
        });
        this.cleanups.push(media.destroy);
        return field({ label, control: media.element });
    }

    private filledFields(): HTMLElement {
        const fileInput = h('input', {
            type: 'file',
            accept: 'image/*',
            className: 'oe-image__file',
            'aria-label': 'Upload a replacement image',
        });
        fileInput.addEventListener('change', () => {
            const file = fileInput.files?.[0];
            if (file) this.uploadFile(file);
        });
        const current = h(
            'div',
            { className: 'oe-image__current' },
            h('img', { className: 'oe-image__thumb', src: this.data.url, alt: this.data.alt || '' }),
            h(
                'div',
                { className: 'oe-image__actions' },
                button({ label: 'Upload', icon: 'upload', size: 'sm', onClick: () => fileInput.click() }),
                button({
                    label: 'Remove',
                    icon: 'trash',
                    variant: 'ghost',
                    size: 'sm',
                    onClick: () => this.setImage(''),
                }),
            ),
            fileInput,
        );

        const caption = textInput({
            value: this.data.caption || '',
            placeholder: 'Shown under the image',
            onInput: (v) => this.update({ caption: v }),
        });
        const alt = textInput({
            value: this.data.alt || '',
            placeholder: 'Describe the image for screen readers',
            onInput: (v) => this.update({ alt: v }),
        });
        const link = textInput({
            value: this.data.linkUrl || '',
            type: 'url',
            placeholder: 'https://… or /page (optional)',
            onInput: (v) => this.update({ linkUrl: v }),
            onCommit: (v) => {
                const url = v.trim();
                if (url && !this.isValidLinkUrl(url)) {
                    this.setStatus('Link must start with https:// or /.');
                    link.value = '';
                    this.update({ linkUrl: '' });
                } else this.update({ linkUrl: url });
            },
        });

        const options = row(
            toggle({
                checked: !!this.data.withBorder,
                label: 'Border',
                onChange: (v) => this.update({ withBorder: v }),
            }),
            toggle({
                checked: !!this.data.withBackground,
                label: 'Background',
                onChange: (v) => this.update({ withBackground: v }),
            }),
            toggle({
                checked: !!this.data.stretched,
                label: 'Stretch',
                onChange: (v) => this.update({ stretched: v }),
            }),
            toggle({
                checked: !!this.data.featuredImage,
                label: 'Featured',
                onChange: (v) => this.update({ featuredImage: v }),
            }),
        );
        const aspect = segment<Aspect>({
            value: (this.data.aspectRatio as Aspect) || 'original',
            ariaLabel: 'Aspect ratio',
            options: [
                { value: 'original', label: 'Original' },
                { value: '16:9', label: '16:9' },
                { value: '4:3', label: '4:3' },
                { value: '1:1', label: '1:1' },
            ],
            onChange: (v) => this.update({ aspectRatio: v }),
        });

        return stack(
            current,
            this.urlField('Replace with URL'),
            row(
                field({ label: 'Caption', control: caption, grow: true }),
                field({ label: 'Alt text', control: alt, grow: true }),
            ),
            field({ label: 'Link', control: link }),
            // Not field(): it would label the first switch "Display" too, muddling its accessible name
            row(
                h('div', { className: 'oe-field' }, sectionLabel('Display'), options),
                field({ label: 'Aspect ratio', control: aspect }),
            ),
        );
    }

    // ── state ───────────────────────────────────────────────────────────────

    private update(patch: Partial<AdvancedImageData>) {
        this.data = { ...this.data, ...patch };
        this.shell?.setSummary(this.summary());
        this.shell?.preview({ ...this.data });
    }

    private setImage(url: string, media?: MediaSelection) {
        this.data = {
            ...this.data,
            url,
            mediaId: media?.mediaId || media?.id || (url ? this.data.mediaId : ''),
            mimeType: media?.mimeType || (url ? this.data.mimeType : ''),
            caption: media?.caption || this.data.caption,
            alt: media?.altText || this.data.alt,
            width: media?.width || (url ? this.data.width : 0),
            height: media?.height || (url ? this.data.height : 0),
        };
        this.setStatus('');
        this.buildFields();
        this.shell?.setSummary(this.summary());
        this.shell?.preview({ ...this.data });
        if (url) this.shell?.setMode('preview');
    }

    private setStatus(text: string, error = false) {
        if (!this.status) return;
        this.status.textContent = text;
        this.status.classList.toggle('oe-image__status--error', error);
    }

    private summary(): string {
        if (!this.data.url) return 'no image yet';
        const parts = [
            this.data.aspectRatio && this.data.aspectRatio !== 'original' ? this.data.aspectRatio : '',
            this.data.stretched ? 'stretched' : '',
        ].filter(Boolean);
        return parts.join(' · ') || 'original size';
    }

    // ── upload ──────────────────────────────────────────────────────────────

    async uploadFile(file: File) {
        if (!validateFileType(file, ['image/*'])) return this.setStatus('Please choose an image file.', true);
        this.setStatus('Uploading… 0%');
        try {
            const result = await uploadFile(file, {
                endpoint: this.config.uploadEndpoint,
                purpose: this.config.purpose,
                maxFileSize: this.config.maxFileSize,
                acceptedFileTypes: ['image/*'],
                onProgress: (progress) => this.setStatus(`Uploading… ${progress}%`),
                onSuccess: (response) => {
                    // The stored file's view: its URL and the sniffed type and size.
                    const stored = response.file;
                    if (stored?.url) {
                        this.setImage(stored.url, {
                            url: stored.url,
                            mediaId: stored.id,
                            mimeType: stored.mimeType || file.type,
                            caption: stored.caption || file.name,
                            altText: stored.altText ?? undefined,
                            width: stored.width ?? undefined,
                            height: stored.height ?? undefined,
                        });
                    }
                },
                onError: (error) => this.setStatus(error.message || 'Upload failed.', true),
            });
            if (!result.success) this.setStatus(result.error || 'Upload failed.', true);
        } catch {
            this.setStatus('Upload failed.', true);
        }
    }

    isValidImageUrl(url: string): boolean {
        try {
            new URL(url);
            return IMAGE_URL.test(url);
        } catch {
            return false;
        }
    }

    isValidLinkUrl(url: string): boolean {
        if (!url || url.startsWith('/')) return true;
        if (!url.startsWith('https://')) return false;
        try {
            return new URL(url).hostname.includes('.');
        } catch {
            return false;
        }
    }

    // ── Editor.js contract ─────────────────────────────────────────────────

    save(): AdvancedImageData {
        this.data.caption = this.data.caption?.trim();
        this.data.alt = this.data.alt?.trim();
        const linkUrl = this.data.linkUrl?.trim() || '';
        this.data.linkUrl = this.isValidLinkUrl(linkUrl) ? linkUrl : '';
        return this.data;
    }

    validate(savedData: AdvancedImageData) {
        return typeof savedData.url === 'string' && savedData.url.trim() !== '';
    }

    onPaste(event: PasteEvent) {
        const detail = event.detail as { data?: HTMLImageElement | string; file?: File };
        switch (event.type) {
            case 'tag': {
                const src = (detail.data as HTMLImageElement | undefined)?.src;
                if (src) this.pasteUrl(src);
                break;
            }
            case 'pattern':
                if (typeof detail.data === 'string') this.pasteUrl(detail.data);
                break;
            case 'file':
                if (detail.file?.type.startsWith('image/')) this.uploadFile(detail.file);
                break;
        }
    }

    private pasteUrl(url: string) {
        if (!this.isValidImageUrl(url)) return this.setStatus('That link is not a direct image URL.', true);
        this.setImage(url);
    }

    destroy() {
        this.cleanups.forEach((fn) => fn());
        this.cleanups = [];
        this.shell?.destroy();
        this.shell = null;
    }
}
