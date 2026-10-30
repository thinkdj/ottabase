import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { API } from '@editorjs/editorjs';
import { DEFAULT_PLUGIN_NAMES, defaultPluginsMap } from '../../defaultPlugins';
import MediaGalleryTool, { type MediaGalleryData, type MediaGalleryToolConfig } from './MediaGalleryTool';

const tools: MediaGalleryTool[] = [];

function mount(data?: Partial<MediaGalleryData>, config: MediaGalleryToolConfig = {}) {
    const tool = new MediaGalleryTool({ api: {} as API, block: { id: 'gallery-test' }, data, config });
    const element = tool.render();
    document.body.appendChild(element);
    tools.push(tool);
    return { tool, element };
}

afterEach(() => {
    tools.splice(0).forEach((t) => t.destroy());
    document.body.innerHTML = '';
});

describe('MediaGalleryTool', () => {
    it('is registered and takes its toolbox entry from the registry', () => {
        expect(DEFAULT_PLUGIN_NAMES.MEDIA_GALLERY).toBe('mediaGallery');
        expect(defaultPluginsMap.get(DEFAULT_PLUGIN_NAMES.MEDIA_GALLERY)?.tool).toBe(MediaGalleryTool);
        expect(MediaGalleryTool.toolbox.title).toBe('Gallery');
    });

    it('adds picker results and saves gallery data', () => {
        const { tool } = mount({ layout: 'masonry', items: [] });
        tool.handleMediaSelected({
            id: 'm-1',
            url: 'https://cdn.example.com/one.jpg',
            mediaKind: 'image',
            title: 'First item',
        });
        tool.handleMediaSelected({
            id: 'm-2',
            url: 'https://cdn.example.com/two.mp4',
            mediaKind: 'video',
            title: 'Second item',
        });
        const saved = tool.save();
        expect(saved.items).toHaveLength(2);
        expect(saved.layout).toBe('masonry');
        expect(saved.items[0]!.mediaKind).toBe('image');
        expect(saved.items[1]!.mediaKind).toBe('video');
        expect(screen.getByLabelText('Title for First item')).toBeTruthy();
    });

    it('routes a media-library-selected-item event with its own field token', () => {
        const { tool, element } = mount({ items: [] });
        fireEvent.click(screen.getByRole('button', { name: 'Add media' }));
        const opened = vi.fn();
        window.addEventListener('media-library-open', opened);
        fireEvent.click(screen.getByRole('button', { name: 'Add media' }));
        const detail = (opened.mock.calls[0]![0] as CustomEvent).detail;
        expect(detail.multiselect).toBe(true);
        window.dispatchEvent(
            new CustomEvent('media-library-selected-item', {
                detail: {
                    field: detail.field,
                    media: { id: 'x', url: 'https://cdn.example.com/x.jpg', mediaKind: 'image' },
                },
            }),
        );
        window.dispatchEvent(
            new CustomEvent('media-library-selected-item', {
                detail: { field: 'someone-else', media: { id: 'y', url: 'https://cdn.example.com/y.jpg' } },
            }),
        );
        expect(tool.save().items.map((i) => i.id)).toEqual(['x']);
        expect(element.querySelector('.oe-block__summary')?.textContent).toBe('1 item · Grid');
    });

    it('saves alt text per item and edits reach save()', () => {
        const { tool } = mount({ items: [] });
        tool.handleMediaSelected({
            id: 'm-1',
            url: 'https://cdn.example.com/photo.jpg',
            mediaKind: 'image',
            title: 'Mountain view',
            altText: 'A snow-capped mountain at dawn',
        });
        expect(tool.save().items[0]!.altText).toBe('A snow-capped mountain at dawn');
        fireEvent.input(screen.getByLabelText('Caption for Mountain view'), { target: { value: ' Dawn ' } });
        expect(tool.save().items[0]!.caption).toBe('Dawn');
    });

    it('prevents duplicate insertion by media id', () => {
        const { tool } = mount({ items: [] });
        tool.handleMediaSelected({
            id: 'm-1',
            mediaId: 'm-1',
            url: 'https://cdn.example.com/dup.jpg',
            mediaKind: 'image',
        });
        tool.handleMediaSelected({
            id: 'm-1',
            mediaId: 'm-1',
            url: 'https://cdn.example.com/dup.jpg',
            mediaKind: 'image',
        });
        expect(tool.save().items).toHaveLength(1);
    });

    it('enforces maxItems, disables Add and says so', () => {
        const { tool, element } = mount({ items: [] }, { maxItems: 2 });
        tool.handleMediaSelected({ id: 'a', url: 'https://cdn.example.com/a.jpg', mediaKind: 'image' });
        tool.handleMediaSelected({ id: 'b', url: 'https://cdn.example.com/b.jpg', mediaKind: 'image' });
        tool.handleMediaSelected({ id: 'c', url: 'https://cdn.example.com/c.jpg', mediaKind: 'image' });
        expect(tool.save().items).toHaveLength(2);
        expect((screen.getByRole('button', { name: 'Add media' }) as HTMLButtonElement).disabled).toBe(true);
        expect(element.textContent).toContain('maximum reached');
    });

    it('clears all items after an inline confirmation', async () => {
        const { tool, element } = mount({
            items: [
                { url: 'https://cdn.example.com/one.jpg', mediaKind: 'image' },
                { url: 'https://cdn.example.com/two.jpg', mediaKind: 'image' },
            ],
        });
        fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
        const confirm = await screen.findByRole('alertdialog');
        expect(confirm.textContent).toContain('Remove all 2 items');
        fireEvent.click(screen.getAllByRole('button', { name: 'Clear all' }).find((b) => confirm.contains(b))!);
        await waitFor(() => expect(tool.save().items).toHaveLength(0));
        expect(element.querySelector('.oe-list__empty')).toBeTruthy();
    });

    it('switches layout and reorders items through the list controls', () => {
        const { tool } = mount({
            items: [
                { url: 'https://cdn.example.com/first.jpg', mediaKind: 'image', title: 'First' },
                { url: 'https://cdn.example.com/second.jpg', mediaKind: 'image', title: 'Second' },
            ],
        });
        fireEvent.click(screen.getByRole('radio', { name: 'Mosaic' }));
        fireEvent.click(screen.getByRole('button', { name: 'Move Second up' }));
        expect(tool.save().layout).toBe('mosaic');
        expect(tool.save().items.map((i) => i.title)).toEqual(['Second', 'First']);
    });

    it('fails validation when the gallery has no items', () => {
        const { tool } = mount({ items: [] });
        expect(tool.validate({ layout: 'grid-balanced', items: [] })).toBe(false);
        expect(tool.validate({ layout: 'grid-balanced', items: [{ url: 'https://cdn.example.com/ok.jpg' }] })).toBe(
            true,
        );
    });
});
