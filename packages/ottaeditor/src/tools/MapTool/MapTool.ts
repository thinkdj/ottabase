import type { API, BlockTool, BlockToolConstructorOptions } from '@editorjs/editorjs';
import { toolboxEntry } from '../../blocks';
import { field, row, segment, select, stack, textInput } from '../../ui/kit';
import { BlockShell } from '../../ui/shell';

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

const THEMES: ReadonlyArray<{ value: MapTheme; label: string }> = [
    { value: 'default', label: 'Default' },
    { value: 'dark', label: 'Dark' },
    { value: 'satellite', label: 'Satellite' },
    { value: 'terrain', label: 'Terrain' },
];

/**
 * Map block. Paste a Google Maps or OpenStreetMap link; the provider is detected from the host,
 * and the preview is the renderer's own iframe (or its "preview unavailable" state).
 */
export default class MapTool implements BlockTool {
    private readonly api: API;
    private readonly config: MapToolConfig;
    private data: MapData;
    private shell: BlockShell | null = null;
    private providerSegment: HTMLElement | null = null;

    static get toolbox() {
        return toolboxEntry('map');
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
        const shell = new BlockShell({ type: 'map', hasContent: Boolean(this.data.url), summary: this.summary() });
        this.shell = shell;

        const url = textInput({
            value: this.data.url,
            type: 'url',
            placeholder: 'Paste a Google Maps or OpenStreetMap link',
            onCommit: (v) => {
                const next = v.trim();
                const detected = MapTool.detectProvider(next);
                this.update({ url: next, ...(detected ? { provider: detected } : {}) });
                if (detected) this.syncProvider(detected);
            },
        });
        this.providerSegment = segment<MapProvider>({
            value: this.data.provider,
            ariaLabel: 'Provider',
            options: [
                { value: 'openstreetmap', label: 'OpenStreetMap' },
                { value: 'gmaps', label: 'Google Maps' },
            ],
            onChange: (v) => this.update({ provider: v }),
        });
        const theme = select<MapTheme>({
            value: this.data.theme,
            options: THEMES,
            ariaLabel: 'Theme',
            onChange: (v) => this.update({ theme: v }),
        });
        const height = textInput({
            value: String(this.data.height),
            type: 'number',
            min: 150,
            max: 800,
            ariaLabel: 'Height in pixels',
            onInput: (v) => {
                const n = parseInt(v, 10);
                if (!isNaN(n) && n >= 150 && n <= 800) this.update({ height: n });
            },
        });
        const zoom = textInput({
            value: String(this.data.zoom),
            type: 'number',
            min: 1,
            max: 20,
            ariaLabel: 'Zoom level',
            onInput: (v) => {
                const n = parseInt(v, 10);
                if (!isNaN(n) && n >= 1 && n <= 20) this.update({ zoom: n });
            },
        });
        const caption = textInput({
            value: this.data.caption,
            placeholder: 'Caption (optional)',
            onInput: (v) => this.update({ caption: v }),
        });

        shell.fields.append(
            stack(
                field({
                    label: 'Map link',
                    control: url,
                    hint: 'Share links, embed URLs and OpenStreetMap URLs all work.',
                }),
                row(
                    field({ label: 'Provider', control: this.providerSegment }),
                    field({ label: 'Theme', control: theme }),
                    field({ label: 'Height (px)', control: height }),
                    field({ label: 'Zoom', control: zoom }),
                ),
                field({ label: 'Caption', control: caption }),
            ),
        );
        shell.preview({ ...this.data });
        return shell.element;
    }

    /** Host-based provider detection for a pasted link; null when neither provider matches. */
    static detectProvider(url: string): MapProvider | null {
        if (url.includes('google.com/maps') || url.includes('goo.gl/maps') || url.includes('maps.app.goo.gl'))
            return 'gmaps';
        if (url.includes('openstreetmap.org') || url.includes('osm.org')) return 'openstreetmap';
        return null;
    }

    private syncProvider(provider: MapProvider) {
        this.providerSegment?.querySelectorAll<HTMLButtonElement>('[role=radio]').forEach((b) => {
            const on = (b.getAttribute('aria-label') === 'Google Maps' ? 'gmaps' : 'openstreetmap') === provider;
            b.setAttribute('aria-checked', String(on));
            b.tabIndex = on ? 0 : -1;
        });
    }

    private update(patch: Partial<MapData>) {
        this.data = { ...this.data, ...patch };
        this.shell?.setSummary(this.summary());
        this.shell?.preview({ ...this.data });
    }

    private summary(): string {
        return `${this.data.provider === 'gmaps' ? 'Google Maps' : 'OpenStreetMap'} · ${this.data.height}px`;
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
        if (protocol !== 'http:' && protocol !== 'https:') return '';

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

        // Already an embed URL: allow only for known hosts
        if (url.includes('/embed') || url.includes('output=embed') || url.includes('export/embed')) {
            if ((provider === 'gmaps' && isGMapsHost) || (provider === 'openstreetmap' && isOsmHost)) return url;
            return '';
        }

        if (provider === 'gmaps') {
            if (!isGMapsHost) return '';
            const mapType = theme === 'satellite' ? 'k' : theme === 'terrain' ? 'p' : 'm';
            if (url.includes('goo.gl/maps/')) {
                return `https://maps.google.com/maps?q=${encodeURIComponent(url)}&output=embed&t=${mapType}`;
            }
            const placeMatch = url.match(/\/maps\/place\/([^/@]+)\/@(-?[\d.]+),(-?[\d.]+)/);
            if (placeMatch) {
                return `https://maps.google.com/maps?q=${encodeURIComponent(placeMatch[1])}&output=embed&z=${zoom}&t=${mapType}`;
            }
            return `https://maps.google.com/maps?q=${encodeURIComponent(url)}&output=embed&t=${mapType}`;
        }

        if (provider === 'openstreetmap') {
            if (!isOsmHost) return '';
            const latMatch = url.match(/[?&#]mlat=([-\d.]+)/);
            const lngMatch = url.match(/[?&#]mlon=([-\d.]+)/);
            const mapMatch = url.match(/#map=(\d+)\/([-\d.]+)\/([-\d.]+)/);
            const layer = theme === 'satellite' || theme === 'terrain' ? 'C' : theme === 'dark' ? 'HOT' : 'M';

            if (mapMatch) {
                const [, z, lat, lng] = mapMatch;
                const bbox = MapTool.bboxFromCenter(parseFloat(lat), parseFloat(lng), parseInt(z, 10));
                return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=${layer}&marker=${lat}%2C${lng}`;
            }
            if (latMatch && lngMatch) {
                const bbox = MapTool.bboxFromCenter(parseFloat(latMatch[1]), parseFloat(lngMatch[1]), zoom);
                return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=${layer}&marker=${latMatch[1]}%2C${lngMatch[1]}`;
            }
            return '';
        }

        return '';
    }

    /** Bounding box for an OpenStreetMap embed from a centre and zoom (web mercator approximation) */
    private static bboxFromCenter(lat: number, lng: number, zoom: number): string {
        const delta = (360 / Math.pow(2, zoom)) * 3;
        return `${(lng - delta).toFixed(6)}%2C${(lat - delta * 0.5).toFixed(6)}%2C${(lng + delta).toFixed(6)}%2C${(lat + delta * 0.5).toFixed(6)}`;
    }

    save(): MapData {
        return { ...this.data };
    }

    validate(savedData: MapData): boolean {
        return savedData.url.trim() !== '';
    }

    destroy(): void {
        this.shell?.destroy();
        this.shell = null;
    }
}
