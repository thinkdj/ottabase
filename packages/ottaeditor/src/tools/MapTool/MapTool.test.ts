// @ts-nocheck - EditorJS BlockToolConstructorOptions has inconsistent required fields across versions
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MapTool from './MapTool';

// Mock CSS import
vi.mock('./MapTool.css', () => ({}));

const createMockAPI = () => ({
    blocks: { getCurrentBlockIndex: vi.fn(() => 0) },
    ui: { notifier: { show: vi.fn() } },
});

describe('MapTool', () => {
    let tool: MapTool;
    let mockAPI: ReturnType<typeof createMockAPI>;

    beforeEach(() => {
        mockAPI = createMockAPI();
        tool = new MapTool({ data: {} as any, config: {}, api: mockAPI as any });
    });

    describe('Toolbox', () => {
        it('should have correct toolbox configuration', () => {
            expect(MapTool.toolbox.title).toBe('Map');
            expect(MapTool.toolbox.icon).toBeTruthy();
        });
    });

    describe('Initialization', () => {
        it('should initialize with default values', () => {
            const saved = tool.save();
            expect(saved.url).toBe('');
            expect(saved.provider).toBe('openstreetmap');
            expect(saved.theme).toBe('default');
            expect(saved.height).toBe(400);
            expect(saved.caption).toBe('');
            expect(saved.zoom).toBe(13);
        });

        it('should initialize with provided data', () => {
            const customTool = new MapTool({
                data: {
                    url: 'https://www.openstreetmap.org/#map=13/51.5/-0.1',
                    provider: 'openstreetmap',
                    theme: 'dark',
                    height: 500,
                    caption: 'London',
                    zoom: 13,
                } as any,
                config: {},
                api: mockAPI as any,
            });

            const saved = customTool.save();
            expect(saved.url).toBe('https://www.openstreetmap.org/#map=13/51.5/-0.1');
            expect(saved.provider).toBe('openstreetmap');
            expect(saved.theme).toBe('dark');
            expect(saved.height).toBe(500);
            expect(saved.caption).toBe('London');
        });

        it('should respect config defaults', () => {
            const configuredTool = new MapTool({
                data: {} as any,
                config: { defaultProvider: 'gmaps', defaultHeight: 300, defaultTheme: 'satellite' },
                api: mockAPI as any,
            });
            const saved = configuredTool.save();
            expect(saved.provider).toBe('gmaps');
            expect(saved.height).toBe(300);
            expect(saved.theme).toBe('satellite');
        });
    });

    describe('Rendering', () => {
        it('should render wrapper element', () => {
            const el = tool.render();
            expect(el).toBeInstanceOf(HTMLElement);
            expect(el.classList.contains('cdx-map')).toBe(true);
            expect(el.classList.contains('cdx-map__wrapper')).toBe(true);
        });

        it('should render URL input', () => {
            const el = tool.render();
            const input = el.querySelector('input[type="url"]') as HTMLInputElement;
            expect(input).toBeTruthy();
        });

        it('auto-detects Google provider for maps.app.goo.gl links', () => {
            const el = tool.render();
            const input = el.querySelector('input[type="url"]') as HTMLInputElement;
            const providerSelect = el.querySelector('[data-key="provider"]') as HTMLSelectElement;

            input.value = 'https://maps.app.goo.gl/example';
            input.dispatchEvent(new Event('change'));

            expect(providerSelect.value).toBe('gmaps');
            expect(tool.save().provider).toBe('gmaps');
        });

        it('should render provider select', () => {
            const el = tool.render();
            const select = el.querySelector('[data-key="provider"]') as HTMLSelectElement;
            expect(select).toBeTruthy();
            const options = Array.from(select.options).map((o) => o.value);
            expect(options).toContain('openstreetmap');
            expect(options).toContain('gmaps');
        });

        it('should render theme select', () => {
            const el = tool.render();
            const select = el.querySelector('[data-key="theme"]') as HTMLSelectElement;
            expect(select).toBeTruthy();
            const options = Array.from(select.options).map((o) => o.value);
            expect(options).toContain('default');
            expect(options).toContain('dark');
            expect(options).toContain('satellite');
            expect(options).toContain('terrain');
        });

        it('should render height input', () => {
            const el = tool.render();
            const input = el.querySelector('input[type="number"]') as HTMLInputElement;
            expect(input).toBeTruthy();
            expect(input.value).toBe('400');
        });

        it('should show placeholder when no URL is provided', () => {
            const el = tool.render();
            const placeholder = el.querySelector('.cdx-map__placeholder');
            expect(placeholder).toBeTruthy();
        });
    });

    describe('Validation', () => {
        it('should fail validation when URL is empty', () => {
            expect(tool.validate(tool.save())).toBe(false);
        });

        it('should pass validation when URL is provided', () => {
            const mapWithUrl = new MapTool({
                data: { url: 'https://www.openstreetmap.org/#map=13/51.5/-0.1' } as any,
                config: {},
                api: mockAPI as any,
            });
            expect(mapWithUrl.validate(mapWithUrl.save())).toBe(true);
        });
    });

    describe('toEmbedUrl', () => {
        it('should pass through existing embed URLs unchanged', () => {
            const embedUrl = 'https://www.openstreetmap.org/export/embed.html?bbox=1,2,3,4';
            expect(MapTool.toEmbedUrl(embedUrl, 'openstreetmap', 'default', 13)).toBe(embedUrl);
        });

        it('should convert Google Maps URL to embed format', () => {
            const url = 'https://www.google.com/maps/place/London';
            const result = MapTool.toEmbedUrl(url, 'gmaps', 'default', 13);
            expect(result).toContain('output=embed');
        });

        it('should set satellite map type for Google Maps', () => {
            const url = 'https://www.google.com/maps/place/London';
            const result = MapTool.toEmbedUrl(url, 'gmaps', 'satellite', 13);
            expect(result).toContain('t=k');
        });

        it('should set terrain map type for Google Maps', () => {
            const url = 'https://www.google.com/maps/place/London';
            const result = MapTool.toEmbedUrl(url, 'gmaps', 'terrain', 13);
            expect(result).toContain('t=p');
        });

        it('should convert OSM hash URL to embed format', () => {
            const url = 'https://www.openstreetmap.org/#map=13/51.5/-0.1';
            const result = MapTool.toEmbedUrl(url, 'openstreetmap', 'default', 13);
            expect(result).toContain('openstreetmap.org/export/embed.html');
            expect(result).toContain('bbox=');
        });

        it('should apply dark layer for OpenStreetMap dark theme', () => {
            const url = 'https://www.openstreetmap.org/#map=13/51.5/-0.1';
            const result = MapTool.toEmbedUrl(url, 'openstreetmap', 'dark', 13);
            expect(result).toContain('layer=HOT');
        });

        it('should return empty string for empty URL', () => {
            expect(MapTool.toEmbedUrl('', 'openstreetmap', 'default', 13)).toBe('');
        });
    });
});
