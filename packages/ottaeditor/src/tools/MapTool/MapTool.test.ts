import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { API } from '@editorjs/editorjs';
import MapTool, { type MapData, type MapToolConfig } from './MapTool';

const tools: MapTool[] = [];

function create(data: Partial<MapData> = {}, config: MapToolConfig = {}) {
    const tool = new MapTool({ api: {} as API, data: data as MapData, config, block: {} as never, readOnly: false });
    tools.push(tool);
    return tool;
}

function mount(data: Partial<MapData> = {}, config: MapToolConfig = {}) {
    const tool = create(data, config);
    const element = tool.render();
    document.body.appendChild(element);
    return { tool, element };
}

afterEach(() => {
    tools.splice(0).forEach((t) => t.destroy());
    document.body.innerHTML = '';
});

describe('MapTool', () => {
    it('takes its toolbox entry from the registry', () => {
        expect(MapTool.toolbox.title).toBe('Map');
        expect(MapTool.toolbox.icon).toContain('<svg');
    });

    it('starts from defaults, config and data', () => {
        expect(create().save()).toEqual({
            url: '',
            provider: 'openstreetmap',
            theme: 'default',
            height: 400,
            caption: '',
            zoom: 13,
        });
        expect(
            create({}, { defaultProvider: 'gmaps', defaultHeight: 300, defaultTheme: 'satellite' }).save(),
        ).toMatchObject({ provider: 'gmaps', height: 300, theme: 'satellite' });
        expect(
            create({
                url: 'https://www.openstreetmap.org/#map=13/51.5/-0.1',
                theme: 'dark',
                height: 500,
                caption: 'London',
            }).save(),
        ).toMatchObject({ theme: 'dark', height: 500, caption: 'London' });
    });

    it('opens in edit mode without a link and in preview with one', () => {
        expect(mount().element.dataset.mode).toBe('edit');
        expect(mount({ url: 'https://www.openstreetmap.org/#map=13/51.5/-0.1' }).element.dataset.mode).toBe('preview');
    });

    it('detects the provider from a pasted link and syncs the segment', () => {
        const { tool } = mount();
        const link = screen.getByLabelText('Map link');
        fireEvent.input(link, { target: { value: 'https://maps.app.goo.gl/example' } });
        fireEvent.blur(link);
        expect(tool.save().provider).toBe('gmaps');
        expect(
            within(screen.getByRole('radiogroup', { name: 'Provider' }))
                .getByRole('radio', { name: 'Google Maps' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('edits theme, height, zoom and caption through the kit', () => {
        const { tool, element } = mount();
        fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'terrain' } });
        fireEvent.input(screen.getByLabelText('Height (px)'), { target: { value: '500' } });
        fireEvent.input(screen.getByLabelText('Height (px)'), { target: { value: '9000' } }); // out of range, ignored
        fireEvent.input(screen.getByLabelText('Zoom'), { target: { value: '8' } });
        fireEvent.input(screen.getByLabelText('Caption'), { target: { value: 'HQ' } });
        expect(tool.save()).toMatchObject({ theme: 'terrain', height: 500, zoom: 8, caption: 'HQ' });
        expect(element.querySelector('.oe-block__summary')?.textContent).toBe('OpenStreetMap · 500px');
    });

    it('validates on the presence of a URL', () => {
        expect(create().validate(create().save())).toBe(false);
        const t = create({ url: 'https://www.openstreetmap.org/#map=13/51.5/-0.1' });
        expect(t.validate(t.save())).toBe(true);
    });

    describe('toEmbedUrl', () => {
        it('passes existing embed URLs through for known hosts only', () => {
            const embed = 'https://www.openstreetmap.org/export/embed.html?bbox=1,2,3,4';
            expect(MapTool.toEmbedUrl(embed, 'openstreetmap', 'default', 13)).toBe(embed);
            expect(MapTool.toEmbedUrl('https://evil.io/embed', 'openstreetmap', 'default', 13)).toBe('');
        });

        it('converts Google Maps links with the theme map type', () => {
            const url = 'https://www.google.com/maps/place/London';
            expect(MapTool.toEmbedUrl(url, 'gmaps', 'default', 13)).toContain('output=embed');
            expect(MapTool.toEmbedUrl(url, 'gmaps', 'satellite', 13)).toContain('t=k');
            expect(MapTool.toEmbedUrl(url, 'gmaps', 'terrain', 13)).toContain('t=p');
        });

        it('converts OpenStreetMap hash links with a bbox and layer', () => {
            const url = 'https://www.openstreetmap.org/#map=13/51.5/-0.1';
            expect(MapTool.toEmbedUrl(url, 'openstreetmap', 'default', 13)).toContain(
                'openstreetmap.org/export/embed.html?bbox=',
            );
            expect(MapTool.toEmbedUrl(url, 'openstreetmap', 'dark', 13)).toContain('layer=HOT');
        });

        it('refuses empty, non-http and unknown shapes', () => {
            expect(MapTool.toEmbedUrl('', 'openstreetmap', 'default', 13)).toBe('');
            expect(MapTool.toEmbedUrl('javascript:alert(1)', 'gmaps', 'default', 13)).toBe('');
            expect(MapTool.toEmbedUrl('https://www.openstreetmap.org/about', 'openstreetmap', 'default', 13)).toBe('');
        });
    });
});
