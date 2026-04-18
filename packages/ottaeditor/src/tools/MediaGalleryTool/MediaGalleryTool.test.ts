import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PLUGIN_NAMES, defaultPluginsMap } from '../../defaultPlugins';
import MediaGalleryTool, { type MediaGalleryData } from './MediaGalleryTool';

vi.mock('./MediaGalleryTool.css', () => ({}));

const createdTools: MediaGalleryTool[] = [];

function createTool(data?: Partial<MediaGalleryData>) {
    const tool = new MediaGalleryTool({
        api: {} as any,
        block: { id: 'gallery-test-block' },
        data,
        config: {},
    });

    const wrapper = tool.render();
    document.body.appendChild(wrapper);
    createdTools.push(tool);

    return { tool, wrapper };
}

afterEach(() => {
    createdTools.splice(0).forEach((tool) => tool.destroy?.());
    document.body.innerHTML = '';
});

describe('MediaGalleryTool', () => {
    it('registers the tool in default plugin map', () => {
        expect(DEFAULT_PLUGIN_NAMES.MEDIA_GALLERY).toBe('mediaGallery');
        expect(defaultPluginsMap.get(DEFAULT_PLUGIN_NAMES.MEDIA_GALLERY)?.tool).toBe(MediaGalleryTool as any);
    });

    it('adds selected media items and saves gallery data', () => {
        const { tool } = createTool({ layout: 'masonry', items: [] });

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

        expect(tool.save().items).toHaveLength(2);
        expect(tool.save().layout).toBe('masonry');
        expect(tool.save().items[0].mediaKind).toBe('image');
        expect(tool.save().items[1].mediaKind).toBe('video');
    });

    it('saves alt text per item', () => {
        const { tool } = createTool({ items: [] });

        tool.handleMediaSelected({
            id: 'm-1',
            url: 'https://cdn.example.com/photo.jpg',
            mediaKind: 'image',
            title: 'Mountain view',
            altText: 'A snow-capped mountain at dawn',
        });

        const saved = tool.save();
        expect(saved.items[0].altText).toBe('A snow-capped mountain at dawn');
    });

    it('prevents duplicate item insertion by media id', () => {
        const { tool } = createTool({ items: [] });

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

    it('enforces maxItems cap and shows a max-reached banner', () => {
        const tool = new MediaGalleryTool({
            api: {} as any,
            block: { id: 'max-test-block' },
            data: { items: [] },
            config: { maxItems: 2 },
        });
        const wrapper = tool.render();
        document.body.appendChild(wrapper);
        createdTools.push(tool);

        tool.handleMediaSelected({ id: 'a', url: 'https://cdn.example.com/a.jpg', mediaKind: 'image' });
        tool.handleMediaSelected({ id: 'b', url: 'https://cdn.example.com/b.jpg', mediaKind: 'image' });
        // Third item should be rejected
        tool.handleMediaSelected({ id: 'c', url: 'https://cdn.example.com/c.jpg', mediaKind: 'image' });

        expect(tool.save().items).toHaveLength(2);
        // Banner should be visible in the DOM
        expect(wrapper.querySelector('.cdx-media-gallery__max-reached')).toBeTruthy();
    });

    it('clears all items and shows empty state when Clear all is clicked', () => {
        const { tool, wrapper } = createTool({
            items: [
                { url: 'https://cdn.example.com/one.jpg', mediaKind: 'image' },
                { url: 'https://cdn.example.com/two.jpg', mediaKind: 'image' },
            ],
        });

        // Simulate the React bridge being mounted so the tool fires the event instead of window.confirm
        (window as unknown as Record<string, unknown>)['__mgConfirmBridgeActive'] = true;

        // Auto-confirm: listen for the request event and immediately fire back a confirmed result
        const autoConfirm = (event: Event) => {
            const { id } = (event as CustomEvent).detail;
            window.dispatchEvent(new CustomEvent('media-gallery-confirm-result', { detail: { id, confirmed: true } }));
        };
        window.addEventListener('media-gallery-confirm', autoConfirm);

        // Clear all must live in the items-header, not the preview panel
        const itemsHeader = wrapper.querySelector('.cdx-media-gallery__items-header') as HTMLElement;
        expect(itemsHeader).toBeTruthy();
        const clearBtn = itemsHeader.querySelector('.cdx-media-gallery__clear-button') as HTMLButtonElement;
        expect(clearBtn).toBeTruthy();
        clearBtn.click();

        window.removeEventListener('media-gallery-confirm', autoConfirm);
        delete (window as unknown as Record<string, unknown>)['__mgConfirmBridgeActive'];

        expect(tool.save().items).toHaveLength(0);
        expect(wrapper.querySelector('.cdx-media-gallery__empty')).toBeTruthy();
    });

    it('renders persistent micro-labels for title, alt text, and caption fields', () => {
        const { wrapper } = createTool({
            items: [{ url: 'https://cdn.example.com/photo.jpg', mediaKind: 'image', title: 'My photo' }],
        });

        const labels = Array.from(wrapper.querySelectorAll('.cdx-media-gallery__field-label')).map((el) =>
            el.textContent?.toUpperCase(),
        );
        expect(labels).toContain('TITLE');
        expect(labels).toContain('ALT TEXT');
        expect(labels).toContain('CAPTION');
    });

    it('moves items without rebuilding the entire list', () => {
        const { tool, wrapper } = createTool({
            items: [
                { url: 'https://cdn.example.com/first.jpg', mediaKind: 'image', title: 'First' },
                { url: 'https://cdn.example.com/second.jpg', mediaKind: 'image', title: 'Second' },
            ],
        });

        // Capture existing card nodes before move
        const cardsBefore = Array.from(wrapper.querySelectorAll('.cdx-media-gallery__item-card'));
        expect(cardsBefore).toHaveLength(2);

        // Click the Up button on the second item to move it to position 0
        const allUpBtns = wrapper.querySelectorAll<HTMLButtonElement>('[aria-label="Move item up"]');
        allUpBtns[1].click();

        // Data order flipped
        expect(tool.save().items[0].title).toBe('Second');
        expect(tool.save().items[1].title).toBe('First');

        // Same card nodes reused (fine-grained DOM swap, not full rebuild)
        const cardsAfter = Array.from(wrapper.querySelectorAll('.cdx-media-gallery__item-card'));
        expect(cardsAfter[0]).toBe(cardsBefore[1]);
        expect(cardsAfter[1]).toBe(cardsBefore[0]);
    });

    it('fails validation when gallery has no items', () => {
        const { tool } = createTool({ items: [] });
        expect(tool.validate({ layout: 'grid-balanced', items: [] })).toBe(false);
        expect(tool.validate({ layout: 'grid-balanced', items: [{ url: 'https://cdn.example.com/ok.jpg' }] })).toBe(
            true,
        );
    });

    it('cleans up namespace state and listener on last destroy', () => {
        const tool = new MediaGalleryTool({
            api: {} as any,
            block: { id: 'cleanup-block' },
            data: { items: [] },
            config: { namespace: 'cleanup-ns' },
        });
        tool.render();
        createdTools.push(tool);

        // Destroying the only instance for that namespace should not throw
        expect(() => tool.destroy()).not.toThrow();
    });
});
