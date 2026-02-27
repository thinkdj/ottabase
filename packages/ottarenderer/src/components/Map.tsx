import { RenderFn } from 'editorjs-blocks-react-renderer';
import { useMemo } from 'react';

export type MapProvider = 'gmaps' | 'openstreetmap';
export type MapTheme = 'default' | 'dark' | 'satellite' | 'terrain';

/**
 * Map block data. Matches MapTool save output.
 * @property url - Map URL (Google Maps or OpenStreetMap)
 * @property provider - 'gmaps' | 'openstreetmap'
 * @property theme - 'default' | 'dark' | 'satellite' | 'terrain'
 * @property height - iframe height in px (clamped 100–800)
 * @property caption - Optional figure caption
 * @property zoom - Zoom level (default 13)
 */
export interface MapData {
    url?: string;
    provider?: MapProvider;
    theme?: MapTheme;
    height?: number;
    caption?: string;
    zoom?: number;
}

const MAP_HEIGHT_MIN = 100;
const MAP_HEIGHT_MAX = 800;

/**
 * Convert a plain map URL to an embed-friendly src for the given provider.
 * Mirrors the validation and shaping rules used in the editor MapTool.
 */
function toEmbedUrl(url: string, provider: MapProvider, theme: MapTheme, zoom: number): string {
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

        const placeMatch = url.match(/\/maps\/place\/([^/@]+)\/@(-?[\d.]+),(-?[\d.]+)/);
        if (placeMatch) {
            return `https://maps.google.com/maps?q=${encodeURIComponent(placeMatch[1])}&output=embed&z=${zoom}&t=${mapType}`;
        }

        return `https://maps.google.com/maps?q=${encodeURIComponent(url)}&output=embed&t=${mapType}`;
    }

    if (provider === 'openstreetmap') {
        if (!isOsmHost) return '';

        const mapMatch = url.match(/#map=(\d+)\/([-\d.]+)\/([-\d.]+)/);
        const latMatch = url.match(/[?&#]mlat=([-\d.]+)/);
        const lngMatch = url.match(/[?&#]mlon=([-\d.]+)/);

        const buildBbox = (lat: number, lng: number, z: number) => {
            const delta = (360 / Math.pow(2, z)) * 3;
            return `${(lng - delta).toFixed(6)}%2C${(lat - delta * 0.5).toFixed(6)}%2C${(lng + delta).toFixed(6)}%2C${(lat + delta * 0.5).toFixed(6)}`;
        };

        const layerMap: Record<MapTheme, string> = {
            default: 'M',
            dark: 'HOT',
            satellite: 'C',
            terrain: 'C',
        };
        const layer = layerMap[theme] || 'M';

        if (mapMatch) {
            const [, z, lat, lng] = mapMatch;
            const bbox = buildBbox(parseFloat(lat), parseFloat(lng), parseInt(z, 10));
            return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=${layer}&marker=${lat}%2C${lng}`;
        }

        if (latMatch && lngMatch) {
            const bbox = buildBbox(parseFloat(latMatch[1]), parseFloat(lngMatch[1]), zoom);
            return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=${layer}&marker=${latMatch[1]}%2C${lngMatch[1]}`;
        }

        return '';
    }

    return '';
}

const Map: RenderFn<MapData> = ({ data, className = '' }) => {
    const url = data?.url || '';
    const provider = data?.provider || 'openstreetmap';
    const theme = data?.theme || 'default';
    const rawHeight = data?.height || 400;
    const height = Math.max(MAP_HEIGHT_MIN, Math.min(MAP_HEIGHT_MAX, rawHeight));
    const caption = data?.caption;
    const zoom = data?.zoom ?? 13;

    const embedUrl = useMemo(() => toEmbedUrl(url, provider, theme, zoom), [url, provider, theme, zoom]);

    if (!url) return null;

    // Apply inversion only when dark theme is requested for providers without dark tiles (Google)
    const shouldInvert = theme === 'dark' && provider === 'gmaps';

    const themeLabel =
        provider === 'gmaps'
            ? 'Google Maps'
            : theme === 'satellite' || theme === 'terrain'
              ? 'OpenStreetMap (Cycle)'
              : 'OpenStreetMap';

    if (!embedUrl) {
        return (
            <figure
                className={`${className} my-6 cdc-content-map not-prose`}
                itemScope
                itemType="https://schema.org/Map"
            >
                <div className="relative rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground shadow-sm">
                    <p className="font-medium text-foreground mb-1">Map preview unavailable</p>
                    <p className="mb-3">The link could not be embedded safely. You can still open it in a new tab.</p>
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-primary hover:underline"
                        itemProp="url"
                    >
                        Open map
                    </a>
                </div>

                {caption && (
                    <figcaption className="mt-2 text-center text-sm text-muted-foreground italic" itemProp="name">
                        {caption}
                    </figcaption>
                )}
            </figure>
        );
    }

    return (
        <figure className={`${className} my-6 cdc-content-map not-prose`} itemScope itemType="https://schema.org/Map">
            <div
                className="relative rounded-lg overflow-hidden border border-border shadow-sm"
                style={shouldInvert ? { filter: 'invert(90%) hue-rotate(180deg)' } : undefined}
            >
                <iframe
                    src={embedUrl}
                    width="100%"
                    height={height}
                    style={{ display: 'block', border: 'none' }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    title={caption || `${themeLabel} map`}
                    aria-label={caption || `Interactive ${themeLabel} map`}
                    itemProp="url"
                />
            </div>

            {caption && (
                <figcaption className="mt-2 text-center text-sm text-muted-foreground italic" itemProp="name">
                    {caption}
                </figcaption>
            )}

            {/* Noscript fallback */}
            <noscript>
                <p className="text-sm text-muted-foreground">
                    <a href={url} target="_blank" rel="noopener noreferrer">
                        {caption || 'View map'}
                    </a>
                </p>
            </noscript>
        </figure>
    );
};

export default Map;
