import type { API, BlockTool, BlockToolConstructorOptions } from '@editorjs/editorjs';
import './MapTool.css';

export type MapProvider = 'gmaps' | 'openstreetmap';
export type MapTheme = 'default' | 'dark' | 'satellite' | 'terrain';

export interface MapToolConfig {
    defaultProvider?: MapProvider;
    defaultHeight?: number;
    defaultTheme?: MapTheme;
}

export interface MapData {
    url: string;
    provider: MapProvider;
    theme: MapTheme;
    height: number;
    caption: string;
    zoom: number;
}

/**
 * MapTool – embed Google Maps or OpenStreetMap inside the editor.
 *
 * Paste a standard map URL or an embed URL; the tool converts it to an
 * embeddable iframe src automatically.
 */
export default class MapTool implements BlockTool {
    private api: API;
    private data: MapData;
    private config: MapToolConfig;
    private wrapper: HTMLElement | null = null;

    static get CSS() {
        return {
            baseClass: 'cdx-map',
            wrapper: 'cdx-map__wrapper',
            form: 'cdx-map__form',
            row2: 'cdx-map__row cdx-map__row--2',
            row3: 'cdx-map__row cdx-map__row--3',
            inputGroup: 'cdx-map__input-group',
            label: 'cdx-map__label',
            input: 'cdx-map__input',
            select: 'cdx-map__select',
            hint: 'cdx-map__hint',
            preview: 'cdx-map__preview',
            previewLabel: 'cdx-map__preview-label',
            iframeWrapper: 'cdx-map__iframe-wrapper',
            iframe: 'cdx-map__iframe',
            captionPreview: 'cdx-map__caption-preview',
            placeholder: 'cdx-map__placeholder',
            placeholderIcon: 'cdx-map__placeholder-icon',
        };
    }

    static get toolbox() {
        return {
            title: 'Map',
            icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>',
        };
    }

    static get enableLineBreaks() {
        return false;
    }

    constructor({ data, config, api }: BlockToolConstructorOptions<MapData, MapToolConfig>) {
        this.api = api;
        this.config = config || {};
        this.data = {
            url: data?.url || '',
            provider: data?.provider || this.config.defaultProvider || 'openstreetmap',
            theme: data?.theme || this.config.defaultTheme || 'default',
            height: data?.height || this.config.defaultHeight || 400,
            caption: data?.caption || '',
            zoom: data?.zoom ?? 13,
        };
    }

    render(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.classList.add(MapTool.CSS.baseClass, MapTool.CSS.wrapper);

        const form = document.createElement('div');
        form.classList.add(MapTool.CSS.form);

        // URL input (full width)
        form.appendChild(this.createUrlInput());

        // Provider / Theme / Height row
        const row = document.createElement('div');
        row.className = MapTool.CSS.row3;
        row.appendChild(this.createProviderSelect());
        row.appendChild(this.createThemeSelect());
        row.appendChild(this.createHeightInput());
        form.appendChild(row);

        // Caption
        form.appendChild(this.createCaptionInput());

        // Preview
        form.appendChild(this.createPreview());

        wrapper.appendChild(form);
        this.wrapper = wrapper;

        return wrapper;
    }

    private createUrlInput(): HTMLElement {
        const group = document.createElement('div');
        group.classList.add(MapTool.CSS.inputGroup);

        const label = document.createElement('label');
        label.classList.add(MapTool.CSS.label);
        label.textContent = 'Map URL';

        const input = document.createElement('input');
        input.type = 'url';
        input.classList.add(MapTool.CSS.input);
        input.placeholder = 'Paste a Google Maps or OpenStreetMap URL…';
        input.value = this.data.url;

        input.addEventListener('change', () => {
            this.data.url = input.value.trim();
            // Auto-detect provider from URL
            if (
                this.data.url.includes('google.com/maps') ||
                this.data.url.includes('goo.gl/maps') ||
                this.data.url.includes('maps.app.goo.gl')
            ) {
                this.data.provider = 'gmaps';
                const providerSelect = this.wrapper?.querySelector(
                    '.cdx-map__select[data-key="provider"]',
                ) as HTMLSelectElement | null;
                if (providerSelect) providerSelect.value = 'gmaps';
            } else if (this.data.url.includes('openstreetmap.org') || this.data.url.includes('osm.org')) {
                this.data.provider = 'openstreetmap';
                const providerSelect = this.wrapper?.querySelector(
                    '.cdx-map__select[data-key="provider"]',
                ) as HTMLSelectElement | null;
                if (providerSelect) providerSelect.value = 'openstreetmap';
            }
            this.refreshPreview();
        });

        const hint = document.createElement('div');
        hint.classList.add(MapTool.CSS.hint);
        hint.textContent = 'Supports Google Maps share links, embed URLs, or OpenStreetMap URLs.';

        group.appendChild(label);
        group.appendChild(input);
        group.appendChild(hint);

        return group;
    }

    private createProviderSelect(): HTMLElement {
        const group = document.createElement('div');
        group.classList.add(MapTool.CSS.inputGroup);

        const label = document.createElement('label');
        label.classList.add(MapTool.CSS.label);
        label.textContent = 'Provider';

        const select = document.createElement('select');
        select.classList.add(MapTool.CSS.select);
        select.setAttribute('data-key', 'provider');

        const providers: Array<{ value: MapProvider; label: string }> = [
            { value: 'openstreetmap', label: 'OpenStreetMap' },
            { value: 'gmaps', label: 'Google Maps' },
        ];

        providers.forEach(({ value, label: text }) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = text;
            opt.selected = value === this.data.provider;
            select.appendChild(opt);
        });

        select.addEventListener('change', () => {
            this.data.provider = select.value as MapProvider;
            this.refreshPreview();
        });

        group.appendChild(label);
        group.appendChild(select);
        return group;
    }

    private createThemeSelect(): HTMLElement {
        const group = document.createElement('div');
        group.classList.add(MapTool.CSS.inputGroup);

        const label = document.createElement('label');
        label.classList.add(MapTool.CSS.label);
        label.textContent = 'Theme';

        const select = document.createElement('select');
        select.classList.add(MapTool.CSS.select);
        select.setAttribute('data-key', 'theme');

        const themes: Array<{ value: MapTheme; label: string }> = [
            { value: 'default', label: 'Default' },
            { value: 'dark', label: 'Dark' },
            { value: 'satellite', label: 'Satellite' },
            { value: 'terrain', label: 'Terrain' },
        ];

        themes.forEach(({ value, label: text }) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = text;
            opt.selected = value === this.data.theme;
            select.appendChild(opt);
        });

        select.addEventListener('change', () => {
            this.data.theme = select.value as MapTheme;
            this.refreshPreview();
        });

        group.appendChild(label);
        group.appendChild(select);
        return group;
    }

    private createHeightInput(): HTMLElement {
        const group = document.createElement('div');
        group.classList.add(MapTool.CSS.inputGroup);

        const label = document.createElement('label');
        label.classList.add(MapTool.CSS.label);
        label.textContent = 'Height (px)';

        const input = document.createElement('input');
        input.type = 'number';
        input.classList.add(MapTool.CSS.input);
        input.min = '150';
        input.max = '800';
        input.step = '50';
        input.value = String(this.data.height);

        input.addEventListener('input', () => {
            const val = parseInt(input.value, 10);
            if (!isNaN(val) && val >= 150 && val <= 800) {
                this.data.height = val;
                this.refreshPreview();
            }
        });

        group.appendChild(label);
        group.appendChild(input);
        return group;
    }

    private createCaptionInput(): HTMLElement {
        const group = document.createElement('div');
        group.classList.add(MapTool.CSS.inputGroup);

        const label = document.createElement('label');
        label.classList.add(MapTool.CSS.label);
        label.textContent = 'Caption (optional)';

        const input = document.createElement('input');
        input.type = 'text';
        input.classList.add(MapTool.CSS.input);
        input.placeholder = 'Map caption…';
        input.value = this.data.caption;

        input.addEventListener('input', () => {
            this.data.caption = input.value;
            this.refreshPreview();
        });

        group.appendChild(label);
        group.appendChild(input);
        return group;
    }

    private createPreview(): HTMLElement {
        const preview = document.createElement('div');
        preview.classList.add(MapTool.CSS.preview);
        preview.setAttribute('data-key', 'preview');

        const previewLabel = document.createElement('div');
        previewLabel.classList.add(MapTool.CSS.previewLabel);
        previewLabel.textContent = 'Preview';
        preview.appendChild(previewLabel);

        const iframeWrapper = document.createElement('div');
        iframeWrapper.classList.add(MapTool.CSS.iframeWrapper);
        iframeWrapper.setAttribute('data-key', 'iframe-wrapper');
        preview.appendChild(iframeWrapper);

        this.renderPreviewContent(iframeWrapper);

        return preview;
    }

    /** Convert a standard map URL to an embeddable iframe src */
    static toEmbedUrl(url: string, provider: MapProvider, theme: MapTheme, zoom: number): string {
        if (!url) return '';

        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            return '';
        }

        const protocol = parsed.protocol.toLowerCase();
        if (protocol !== 'http:' && protocol !== 'https:') {
            return '';
        }

        const host = parsed.hostname.toLowerCase();
        const isGMapsHost = [
            'google.com',
            'www.google.com',
            'maps.google.com',
            'goo.gl',
            'www.goo.gl',
            'maps.app.goo.gl',
        ].some((h) => host === h || host.endsWith(`.${h}`));
        const isOsmHost = ['openstreetmap.org', 'www.openstreetmap.org', 'osm.org', 'www.osm.org'].some(
            (h) => host === h || host.endsWith(`.${h}`),
        );

        // Already an embed URL – allow only for known hosts
        if (url.includes('/embed') || url.includes('output=embed') || url.includes('export/embed')) {
            if ((provider === 'gmaps' && isGMapsHost) || (provider === 'openstreetmap' && isOsmHost)) {
                return url;
            }
            return '';
        }

        if (provider === 'gmaps') {
            if (!isGMapsHost) return '';

            const mapType = theme === 'satellite' ? 'k' : theme === 'terrain' ? 'p' : 'm';

            // https://goo.gl/maps/... short links – wrap in embed
            if (url.includes('goo.gl/maps/')) {
                return `https://maps.google.com/maps?q=${encodeURIComponent(url)}&output=embed&t=${mapType}`;
            }

            // https://www.google.com/maps/place/.../@lat,lng,zoomz => embed without API key
            const placeMatch = url.match(/\/maps\/place\/([^/@]+)\/@(-?[\d.]+),(-?[\d.]+)/);
            if (placeMatch) {
                return `https://maps.google.com/maps?q=${encodeURIComponent(placeMatch[1])}&output=embed&z=${zoom}&t=${mapType}`;
            }

            // Fallback: wrap in standard iframe embed
            return `https://maps.google.com/maps?q=${encodeURIComponent(url)}&output=embed&t=${mapType}`;
        }

        if (provider === 'openstreetmap') {
            if (!isOsmHost) return '';

            // https://www.openstreetmap.org/?mlat=51.5&mlon=-0.1#map=13/51.5/-0.1
            const latMatch = url.match(/[?&#]mlat=([-\d.]+)/);
            const lngMatch = url.match(/[?&#]mlon=([-\d.]+)/);
            const mapMatch = url.match(/#map=(\d+)\/([-\d.]+)\/([-\d.]+)/);

            if (mapMatch) {
                const [, z, lat, lng] = mapMatch;
                const bbox = MapTool.bboxFromCenter(parseFloat(lat), parseFloat(lng), parseInt(z, 10));
                const layer = theme === 'satellite' || theme === 'terrain' ? 'C' : theme === 'dark' ? 'HOT' : 'M';
                return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=${layer}&marker=${lat}%2C${lng}`;
            }

            if (latMatch && lngMatch) {
                const lat = latMatch[1];
                const lng = lngMatch[1];
                const bbox = MapTool.bboxFromCenter(parseFloat(lat), parseFloat(lng), zoom);
                const layer = theme === 'satellite' || theme === 'terrain' ? 'C' : theme === 'dark' ? 'HOT' : 'M';
                return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=${layer}&marker=${lat}%2C${lng}`;
            }

            // Unknown OSM shape – refuse to embed
            return '';
        }

        return '';
    }

    /** Compute a bounding-box string for OpenStreetMap embed from a center + zoom */
    private static bboxFromCenter(lat: number, lng: number, zoom: number): string {
        // Approximate degrees per pixel at given zoom (web mercator)
        const delta = (360 / Math.pow(2, zoom)) * 3;
        const minLng = (lng - delta).toFixed(6);
        const maxLng = (lng + delta).toFixed(6);
        const minLat = (lat - delta * 0.5).toFixed(6);
        const maxLat = (lat + delta * 0.5).toFixed(6);
        return `${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}`;
    }

    private renderPreviewContent(wrapper: HTMLElement): void {
        wrapper.innerHTML = '';

        const embedUrl = MapTool.toEmbedUrl(this.data.url, this.data.provider, this.data.theme, this.data.zoom);

        if (!embedUrl) {
            const placeholder = document.createElement('div');
            placeholder.classList.add(MapTool.CSS.placeholder);
            placeholder.innerHTML = `<div class="${MapTool.CSS.placeholderIcon}">🗺️</div><div>Paste a map URL above to see a preview</div>`;
            wrapper.appendChild(placeholder);
            return;
        }

        // Apply theme modifier class
        wrapper.className = MapTool.CSS.iframeWrapper;
        if (this.data.theme === 'dark') {
            wrapper.classList.add('cdx-map__iframe-wrapper--dark');
        }

        const iframe = document.createElement('iframe');
        iframe.classList.add(MapTool.CSS.iframe);
        iframe.src = embedUrl;
        iframe.height = String(this.data.height);
        iframe.style.height = `${this.data.height}px`;
        iframe.loading = 'lazy';
        iframe.allow = 'fullscreen';
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
        wrapper.appendChild(iframe);
    }

    private refreshPreview(): void {
        if (!this.wrapper) return;
        const iframeWrapper = this.wrapper.querySelector('[data-key="iframe-wrapper"]') as HTMLElement | null;
        if (iframeWrapper) {
            this.renderPreviewContent(iframeWrapper);
        }

        // Update caption preview
        const preview = this.wrapper.querySelector('[data-key="preview"]') as HTMLElement | null;
        if (preview) {
            let captionEl = preview.querySelector('.cdx-map__caption-preview') as HTMLElement | null;
            if (this.data.caption) {
                if (!captionEl) {
                    captionEl = document.createElement('div');
                    captionEl.classList.add(MapTool.CSS.captionPreview);
                    preview.appendChild(captionEl);
                }
                captionEl.textContent = this.data.caption;
            } else if (captionEl) {
                captionEl.remove();
            }
        }
    }

    save(): MapData {
        return { ...this.data };
    }

    validate(savedData: MapData): boolean {
        return savedData.url.trim() !== '';
    }
}
