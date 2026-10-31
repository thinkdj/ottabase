import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { API } from '@editorjs/editorjs';
import { DEFAULT_PLUGIN_NAMES, defaultPluginsMap } from '../../defaultPlugins';
import ImageHotspotsTool, { type ImageHotspotsData, type ImageHotspotsToolConfig } from './ImageHotspotsTool';

const tools: ImageHotspotsTool[] = [];
const IMG = 'https://cdn.example.com/product.jpg';
const rect = { left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) };

function mount(data?: Partial<ImageHotspotsData>, config?: ImageHotspotsToolConfig) {
    const tool = new ImageHotspotsTool({ api: {} as API, data, config });
    const element = tool.render();
    document.body.appendChild(element);
    tools.push(tool);
    if (element.dataset.mode === 'preview') fireEvent.click(screen.getByRole('radio', { name: 'Edit' }));
    const canvas = element.querySelector('.oe-hotspots__canvas') as HTMLElement | null;
    if (canvas) canvas.getBoundingClientRect = () => rect;
    return { tool, element, canvas };
}

afterEach(() => {
    tools.splice(0).forEach((t) => t.destroy());
    document.body.innerHTML = '';
});

describe('ImageHotspotsTool', () => {
    it('is registered and saves its defaults', () => {
        expect(defaultPluginsMap.get(DEFAULT_PLUGIN_NAMES.IMAGE_HOTSPOTS)?.tool).toBe(ImageHotspotsTool);
        expect(ImageHotspotsTool.toolbox.title).toBe('Hotspots');
        const { tool, element } = mount();
        expect(tool.save()).toEqual({
            alt: '',
            caption: '',
            hotspots: [],
            height: '',
            imageFit: 'contain',
            imagePosition: 'center',
        });
        expect(element.querySelector('.oe-hotspots__canvas')).toBeNull();
    });

    it('edits reach save(): image, alt, caption, sizing', () => {
        const { tool } = mount();
        fireEvent.input(screen.getByLabelText('Image'), { target: { value: IMG } });
        fireEvent.input(screen.getByLabelText('Alt text'), { target: { value: 'Product' } });
        fireEvent.input(screen.getByLabelText('Caption'), { target: { value: 'Tap a pin' } });
        fireEvent.click(screen.getByRole('radio', { name: 'Cover' }));
        fireEvent.click(screen.getByRole('radio', { name: 'bottom right' }));
        expect(tool.save()).toMatchObject({
            image: IMG,
            alt: 'Product',
            caption: 'Tap a pin',
            imageFit: 'cover',
            imagePosition: 'bottom-right',
        });
    });

    it('a library pick stores its file and takes its alt text when none is set', () => {
        const { tool } = mount();
        let field: string | undefined;
        window.addEventListener('media-library-open', ((e: CustomEvent) => (field = e.detail.field)) as EventListener, {
            once: true,
        });
        fireEvent.click(screen.getByRole('button', { name: 'Image: choose from library' }));
        const file = { key: 'app/media/0123456789abcdef0123456789abcdef.jpg', width: 900, height: 600 };
        window.dispatchEvent(
            new CustomEvent('media-library-selected-item', {
                detail: { field, media: { url: '/shown.jpg', file, alt: 'The device, front' } },
            }),
        );
        expect(tool.save()).toMatchObject({ image: file, alt: 'The device, front' });
    });

    it('clicking the canvas adds a hotspot at the click position and opens its card', () => {
        const { tool, canvas } = mount({ image: IMG });
        fireEvent.click(canvas!, { clientX: 50, clientY: 25 });
        const [hs] = tool.save().hotspots;
        expect(hs).toMatchObject({ x: 25, y: 25, title: '', content: '' });
        expect(hs!.id).toMatch(/^hs_/);
        fireEvent.input(screen.getByRole('dialog', { name: 'Edit hotspot 1' }).querySelector('input')!, {
            target: { value: 'Power' },
        });
        fireEvent.input(screen.getByRole('dialog', { name: 'Edit hotspot 1' }).querySelector('textarea')!, {
            target: { value: 'Hold 2s' },
        });
        expect(tool.save().hotspots[0]).toMatchObject({ title: 'Power', content: 'Hold 2s' });
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('respects maxHotspots', () => {
        const { tool, canvas } = mount({ image: IMG }, { maxHotspots: 1 });
        fireEvent.click(canvas!, { clientX: 20, clientY: 20 });
        fireEvent.click(canvas!, { clientX: 80, clientY: 80 });
        expect(tool.save().hotspots).toHaveLength(1);
    });

    it('reorders and removes hotspots through the list, renumbering the dots', async () => {
        const { tool, element } = mount({
            image: IMG,
            hotspots: [
                { id: 'a', x: 10, y: 10, title: 'A', content: '' },
                { id: 'b', x: 60, y: 60, title: 'B', content: '' },
            ],
        });
        fireEvent.click(screen.getByRole('button', { name: 'Move B up' }));
        expect(tool.save().hotspots.map((h) => h.id)).toEqual(['b', 'a']);
        expect(element.querySelector('.oe-hotspots__dot[data-id="b"]')?.textContent).toBe('1');
        fireEvent.click(screen.getByRole('button', { name: 'Remove A' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
        await waitFor(() => expect(tool.save().hotspots.map((h) => h.id)).toEqual(['b']));
        expect(element.querySelectorAll('.oe-hotspots__dot')).toHaveLength(1);
    });

    it('validates that an image is set', () => {
        const { tool } = mount();
        expect(tool.validate(tool.save())).toBe(false);
        expect(tool.validate({ ...tool.save(), image: IMG })).toBe(true);
    });
});
