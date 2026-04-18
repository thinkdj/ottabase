import { uploadFile } from '@ottabase/ottaupload/utils';
import { validateFileType } from '@ottabase/ottaupload/validation';
import './AdvancedImageTool.css';
import { Icons } from './iconUtils';
import { AdvancedImageData } from './types';

export default class AdvancedImageTool {
    private api: any;
    private config: any;
    private data: AdvancedImageData;
    private wrapper: HTMLElement;
    private imageContainer: HTMLElement | null = null;
    private uploadArea: HTMLElement | null = null;
    private urlInput: HTMLInputElement | null = null;
    private fileInput: HTMLInputElement | null = null;
    private isUploading: boolean = false;

    static get toolbox() {
        return {
            title: 'Image',
            icon: Icons.image,
        };
    }

    static get isReadOnlySupported() {
        return true;
    }

    static get pasteConfig() {
        return {
            tags: ['img'],
            patterns: {
                image: /https?:\/\/\S+\.(gif|jpe?g|tiff?|png|svg|webp)(\?[a-z0-9=]*)?$/i,
            },
            files: {
                mimeTypes: ['image/*'],
            },
        };
    }

    constructor({ data, config, api, readOnly }: { data: any; config: any; api: any; readOnly: boolean }) {
        this.api = api;
        this.config = config || {};

        // Config defaults
        this.config.uploadEndpoint = this.config.uploadEndpoint || '/api/upload';
        this.config.maxFileSize = this.config.maxFileSize || 10 * 1024 * 1024; // 10MB default
        this.config.provider = this.config.provider || 'r2'; // Default to R2

        // Accept legacy @editorjs/image data shape: { file: { url }, caption, withBorder, withBackground, stretched }
        const legacyUrl = data?.file?.url || '';
        const initialUrl = data?.url || legacyUrl || '';

        this.data = {
            url: initialUrl,
            mediaId: data?.mediaId || '',
            mimeType: data?.mimeType || '',
            caption: data?.caption || '',
            withBorder: data?.withBorder ?? true,
            withBackground: data?.withBackground ?? true,
            stretched: data?.stretched ?? false,
            useNextImage: data?.useNextImage ?? false,
            alt: data?.alt || '',
            linkUrl: data?.linkUrl || '',
            width: data?.width || 0,
            height: data?.height || 0,
            featuredImage: data?.featuredImage ?? false,
            aspectRatio: data?.aspectRatio || 'original',
        };

        this.wrapper = document.createElement('div');
        this.wrapper.classList.add('advanced-image-tool', 'ob-plugin');
    }

    render() {
        if (this.data.url) {
            this.renderImage();
        } else {
            this.renderUploadArea();
        }

        return this.wrapper;
    }

    renderUploadArea() {
        this.wrapper.innerHTML = '';
        this.wrapper.classList.add('advanced-image-tool--empty');

        this.uploadArea = document.createElement('div');
        this.uploadArea.classList.add('advanced-image-upload-area');

        // Create file input (hidden)
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = 'image/*';
        this.fileInput.style.display = 'none';
        this.fileInput.addEventListener('change', (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                this.uploadFile(file);
            }
        });

        /* Upload area content */
        this.uploadArea.innerHTML = `
            <div class="advanced-image-upload-content">
                <div class="advanced-image-upload-icon">
                    ${Icons.imageLarge}
                </div>
                <div class="advanced-image-upload-text">
                    <p class="advanced-image-main-text">Drop an image here</p>
                    <div class="advanced-image-browse-section">
                        <button type="button" class="advanced-image-browse-btn">Browse files</button>
                    </div>
                </div>
                <div class="advanced-image-url-section">
                    <div class="advanced-image-url-divider">
                        <span>OR</span>
                    </div>
                    <div class="advanced-image-url-input-group">
                        <input type="url" placeholder="Enter a public image URL here..." class="advanced-image-url-input ob-input">
                        <button type="button" class="advanced-image-url-btn">Fetch</button>
                    </div>
                </div>
            </div>
        `;

        // Get elements with null checks
        const browseBtn = this.uploadArea.querySelector('.advanced-image-browse-btn') as HTMLButtonElement;
        this.urlInput = this.uploadArea.querySelector('.advanced-image-url-input') as HTMLInputElement;
        const urlBtn = this.uploadArea.querySelector('.advanced-image-url-btn') as HTMLButtonElement;

        // Event listeners with null checks
        if (browseBtn && this.fileInput) {
            browseBtn.addEventListener('click', () => this.fileInput?.click());
        }
        if (urlBtn) {
            urlBtn.addEventListener('click', () => this.handleUrlUpload());
        }
        if (this.urlInput) {
            this.urlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleUrlUpload();
                }
            });
        }

        // Drag and drop
        this.setupDragAndDrop();

        if (this.fileInput) {
            this.wrapper.appendChild(this.fileInput);
        }
        if (this.uploadArea) {
            this.wrapper.appendChild(this.uploadArea);
        }
    }

    renderImage() {
        this.wrapper.innerHTML = '';
        this.wrapper.classList.remove('advanced-image-tool--empty');

        this.imageContainer = document.createElement('div');
        this.imageContainer.classList.add('advanced-image-container');

        if (this.data.withBorder) {
            this.imageContainer.classList.add('advanced-image-container--with-border');
        }

        if (this.data.withBackground) {
            this.imageContainer.classList.add('advanced-image-container--with-background');
        }

        if (this.data.stretched) {
            this.imageContainer.classList.add('advanced-image-container--stretched');
        }

        if (this.data.featuredImage) {
            this.imageContainer.classList.add('advanced-image-container--featured');
        }

        // Apply aspect ratio class
        const aspectRatio = this.data.aspectRatio || 'original';
        if (aspectRatio !== 'original') {
            this.imageContainer.classList.add(`advanced-image-container--aspect-${aspectRatio.replace(':', '-')}`);
        }

        const img = document.createElement('img');
        img.src = this.data.url || '';
        img.classList.add('advanced-image');
        img.addEventListener('load', () => {
            this.imageContainer?.classList.add('advanced-image-container--loaded');
        });

        this.imageContainer?.appendChild(img);

        const inputsContainer = document.createElement('div');
        inputsContainer.classList.add('advanced-image-inputs-container');

        const captionInput = this.createDataInput('caption', 'text', 'Caption');
        const altInput = this.createDataInput('alt', 'text', 'Alt Text');
        const linkInput = this.createDataInput('linkUrl', 'url', 'Link URL');

        inputsContainer.appendChild(captionInput);
        inputsContainer.appendChild(altInput);
        inputsContainer.appendChild(linkInput);

        this.imageContainer.appendChild(inputsContainer);
        this.wrapper.appendChild(this.imageContainer);
    }

    createDataInput(key: 'caption' | 'alt' | 'linkUrl', type: string, labelText: string): HTMLDivElement {
        const wrapper = document.createElement('div');
        wrapper.classList.add('advanced-image-input-wrapper');

        const label = document.createElement('label');
        label.innerText = labelText;
        label.setAttribute('for', `advanced-image-${key}-input`);

        const input = document.createElement('input');
        input.id = `advanced-image-${key}-input`;
        input.type = type;
        input.value = this.data[key] || '';
        input.classList.add('cdx-input', 'ob-input');

        input.addEventListener('input', () => {
            this.data[key] = input.value;
        });

        // Add blur validation for the Link URL input
        if (key === 'linkUrl') {
            input.addEventListener('blur', () => {
                const url = input.value.trim();
                if (url && !this.isValidLinkUrl(url)) {
                    this.api.notifier.show({
                        message: 'Invalid URL. Must start with "https://" or "/".',
                        style: 'error',
                    });
                    input.value = '';
                    this.data.linkUrl = '';
                } else {
                    this.data.linkUrl = url; // Save the trimmed, valid URL
                }
            });
        }

        wrapper.appendChild(label);
        wrapper.appendChild(input);

        return wrapper;
    }

    setupDragAndDrop() {
        if (!this.uploadArea) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
            this.uploadArea?.addEventListener(eventName, this.preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach((eventName) => {
            this.uploadArea?.addEventListener(
                eventName,
                () => {
                    this.uploadArea?.classList.add('advanced-image-upload-area--dragover');
                },
                false,
            );
        });

        ['dragleave', 'drop'].forEach((eventName) => {
            this.uploadArea?.addEventListener(
                eventName,
                () => {
                    this.uploadArea?.classList.remove('advanced-image-upload-area--dragover');
                },
                false,
            );
        });

        this.uploadArea?.addEventListener(
            'drop',
            (e) => {
                const dragEvent = e as DragEvent;
                const files = dragEvent.dataTransfer?.files;
                if (files && files.length > 0) {
                    const file = files[0];
                    if (file.type.startsWith('image/')) {
                        this.uploadFile(file);
                    }
                }
            },
            false,
        );
    }

    preventDefaults(e: Event) {
        e.preventDefault();
        e.stopPropagation();
    }

    async handleUrlUpload() {
        if (!this.urlInput) return;
        const url = this.urlInput.value.trim();
        if (!url) return;

        if (!this.isValidImageUrl(url)) {
            this.showError('Please enter a valid image URL');
            return;
        }

        // For now, directly use the URL without uploading
        // In the future, we can add a server-side endpoint to fetch and upload if needed
        this.data.url = url;
        this.renderImage();
    }

    async uploadFile(file: File) {
        // Validate file type
        if (!validateFileType(file, ['image/*'])) {
            this.showError('Please select an image file');
            return;
        }

        this.showLoading('Uploading image... 0%');

        try {
            // Use ottaupload utility for upload
            const result = await uploadFile(file, {
                endpoint: this.config.uploadEndpoint,
                provider: this.config.provider,
                maxFileSize: this.config.maxFileSize,
                acceptedFileTypes: ['image/*'],
                onProgress: (progress) => {
                    this.showLoading(`Uploading image... ${progress}%`);
                },
                onSuccess: (response) => {
                    if (response.url) {
                        this.data.url = response.url;
                        this.data.mediaId = (response as any)?.media?.id || '';
                        this.data.mimeType = (response as any)?.media?.mimeType || file.type || '';
                        this.data.caption = (response as any)?.media?.caption || file.name;
                        this.data.alt = (response as any)?.media?.altText || this.data.alt;
                        this.data.width = (response as any)?.media?.width || this.data.width;
                        this.data.height = (response as any)?.media?.height || this.data.height;
                        // match legacy format
                        this.data.file = { url: response.url };
                        this.renderImage();
                    }
                },
                onError: (error) => {
                    console.error('File upload error:', error);
                    this.showError(error.message || 'Failed to upload image');
                },
            });

            // Handle failed upload
            if (!result.success) {
                this.showError(result.error || 'Failed to upload image');
            }
        } catch (error) {
            console.error('File upload error:', error);
            this.showError('Failed to upload image');
        }
    }

    showLoading(message: string) {
        this.isUploading = true;
        if (this.uploadArea) {
            this.uploadArea.innerHTML = `
                <div class="advanced-image-upload-content">
                    <div class="advanced-image-loading">
                        <div class="advanced-image-spinner"></div>
                        <p>${message}</p>
                    </div>
                </div>
            `;
        }
    }

    showError(message: string) {
        this.isUploading = false;
        if (this.uploadArea) {
            this.uploadArea.innerHTML = `
                <div class="advanced-image-upload-content">
                    <div class="advanced-image-error">
                        <p style="color: #e74c3c; margin-bottom: 10px;">${message}</p>
                        <button type="button" class="advanced-image-retry-btn">Try Again</button>
                    </div>
                </div>
            `;

            const retryBtn = this.uploadArea.querySelector('.advanced-image-retry-btn') as HTMLButtonElement;
            if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                    this.renderUploadArea();
                });
            }
        }
    }

    isValidImageUrl(url: string): boolean {
        try {
            new URL(url);
            return /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url);
        } catch {
            return false;
        }
    }

    isValidLinkUrl(url: string): boolean {
        // Allow empty URLs
        if (!url) {
            return true;
        }

        // Allow relative paths
        if (url.startsWith('/')) {
            return true;
        }

        // For absolute URLs, check for https and validate the structure
        if (url.startsWith('https://')) {
            try {
                const parsedUrl = new URL(url);
                // Also check that the hostname has a dot, to prevent single-word domains
                // e.g. "https://localhost" or "https://invalid"
                return parsedUrl.hostname.includes('.');
            } catch (e) {
                return false;
            }
        }

        return false;
    }

    renderSettings() {
        const wrapper = document.createElement('div');

        const toggleSettings = [
            { name: 'withBorder', icon: Icons.border, label: 'With border' },
            { name: 'stretched', icon: Icons.stretch, label: 'Stretch image' },
            { name: 'withBackground', icon: Icons.background, label: 'With background' },
            { name: 'featuredImage', icon: Icons.featured, label: 'Featured image' },
            { name: 'useNextImage', icon: Icons.image, label: 'Image optimization' },
        ];

        toggleSettings.forEach((setting) => {
            const settingItem = document.createElement('div');
            settingItem.classList.add('ce-popover-item');

            // Add multiple attributes for EditorJS filter to search through
            settingItem.textContent = setting.label;
            settingItem.setAttribute('data-item-name', setting.name);
            settingItem.setAttribute('title', setting.label);

            if (this.data[setting.name as keyof AdvancedImageData]) {
                settingItem.classList.add('ce-popover-item--active');
            }

            settingItem.innerHTML = `
                <div class="ce-popover-item__icon ce-popover-item__icon--tool">${setting.icon}</div>
                <div class="ce-popover-item__title">${setting.label}</div>
            `;

            settingItem.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Use a type-safe property assignment
                const propName = setting.name as keyof AdvancedImageData;
                if (typeof this.data[propName] === 'boolean') {
                    (this.data as any)[propName] = !this.data[propName];
                }

                settingItem.classList.toggle('ce-popover-item--active');

                // Use setTimeout to ensure DOM updates complete before EditorJS processes
                setTimeout(() => {
                    this.updateImageClasses();
                }, 0);
            });

            wrapper.appendChild(settingItem);
        });

        // Add aspect ratio selector
        const aspectRatioItem = document.createElement('div');
        aspectRatioItem.classList.add('ce-popover-item');
        aspectRatioItem.textContent = 'Aspect ratio';
        aspectRatioItem.setAttribute('data-item-name', 'aspectRatio');
        aspectRatioItem.setAttribute('title', 'Aspect ratio');

        aspectRatioItem.innerHTML = `
            <div class="ce-popover-item__icon ce-popover-item__icon--tool">${Icons.aspectRatio}</div>
            <div class="ce-popover-item__title">
                <select class="ce-popover-item__dropdown advanced-image-tool-dd aspect-ratio-select">
                    <option value="original">Original</option>
                    <option value="16:9">16:9</option>
                    <option value="4:3">4:3</option>
                    <option value="1:1">1:1</option>
                </select>
            </div>
        `;

        const select = aspectRatioItem.querySelector('.aspect-ratio-select') as unknown as HTMLSelectElement;
        if (select) {
            select.value = this.data.aspectRatio || 'original';

            select.addEventListener('change', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.data.aspectRatio = (e.target as HTMLSelectElement).value;

                // Use setTimeout to ensure DOM updates complete before EditorJS processes
                setTimeout(() => {
                    this.updateImageAspectRatio();
                }, 0);
            });

            // Prevent EditorJS from handling events on the select element
            select.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });

            select.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        wrapper.appendChild(aspectRatioItem);

        return wrapper;
    }

    updateImageClasses() {
        if (!this.imageContainer) return;

        this.imageContainer.classList.toggle('advanced-image-container--with-border', this.data.withBorder);
        this.imageContainer.classList.toggle('advanced-image-container--with-background', this.data.withBackground);
        this.imageContainer.classList.toggle('advanced-image-container--stretched', this.data.stretched);
        this.imageContainer.classList.toggle('advanced-image-container--featured', this.data.featuredImage);
    }

    updateImageAspectRatio() {
        if (!this.imageContainer) return;

        // Remove existing aspect ratio classes
        this.imageContainer.classList.remove(
            'advanced-image-container--aspect-16-9',
            'advanced-image-container--aspect-4-3',
            'advanced-image-container--aspect-1-1',
        );

        // Apply new aspect ratio
        const aspectRatio = this.data.aspectRatio || 'original';
        if (aspectRatio !== 'original') {
            this.imageContainer.classList.add(`advanced-image-container--aspect-${aspectRatio.replace(':', '-')}`);
        }
    }

    save() {
        // Sanitize and validate data before saving
        this.data.caption = this.data.caption?.trim();
        this.data.alt = this.data.alt?.trim();

        const linkUrl = this.data.linkUrl?.trim() || '';
        if (!this.isValidLinkUrl(linkUrl)) {
            this.data.linkUrl = ''; // Silently clear invalid URL on save
        } else {
            this.data.linkUrl = linkUrl;
        }

        return this.data;
    }

    validate(savedData: AdvancedImageData) {
        return typeof savedData.url === 'string' && savedData.url.trim() !== '';
    }

    static get sanitize() {
        return {
            url: {}, // Use default sanitizer
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
            useNextImage: true,
            featuredImage: true,
            aspectRatio: true,
        };
    }

    onPaste(event: any) {
        switch (event.type) {
            case 'tag': {
                // Handle pasted HTML img tags
                const element = event.detail.data;
                if (element && element.src) {
                    this.handleUrlUploadFromPaste(element.src);
                }
                break;
            }
            case 'pattern': {
                // Handle pasted URLs matching our pattern
                const url = event.detail.data;
                if (url) {
                    this.handleUrlUploadFromPaste(url);
                }
                break;
            }
            case 'file': {
                // Handle pasted files from clipboard
                const file = event.detail.file;
                if (file && file.type.startsWith('image/')) {
                    this.uploadFile(file);
                }
                break;
            }
        }
    }

    async handleUrlUploadFromPaste(url: string) {
        if (!this.isValidImageUrl(url)) {
            this.showError('Invalid image URL from paste');
            return;
        }

        // Just use the URL directly for now
        this.data.url = url;
        this.renderImage();
    }
}
