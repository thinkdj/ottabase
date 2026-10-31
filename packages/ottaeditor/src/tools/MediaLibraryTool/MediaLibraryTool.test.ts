import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRIVATE_FILE_MESSAGE } from '../../ui/kit';
import MediaLibraryTool from './MediaLibraryTool';

const FILE = { key: 'app/media/0123456789abcdef0123456789abcdef.webp', width: 800, height: 600 };

const insertedBlocks: { type: string; data: Record<string, unknown> }[] = [];

const createMockAPI = () => ({
    blocks: {
        getCurrentBlockIndex: vi.fn(() => 0),
        getBlocksCount: vi.fn(() => 1),
        getBlockByIndex: vi.fn((index: number) => ({ id: `block-${index}` })),
        delete: vi.fn(),
        insert: vi.fn(async (type: string, data: Record<string, unknown>) => {
            insertedBlocks.push({ type, data });
        }),
    },
});

describe('MediaLibraryTool', () => {
    let mockAPI: ReturnType<typeof createMockAPI>;
    const tools: MediaLibraryTool[] = [];

    const make = (config: Record<string, unknown> = {}, id = 'block-0') => {
        const tool = new MediaLibraryTool({ api: mockAPI as never, config, block: { id } });
        tools.push(tool);
        return tool;
    };

    beforeEach(() => {
        insertedBlocks.length = 0;
        mockAPI = createMockAPI();
    });

    afterEach(() => {
        tools.splice(0).forEach((t) => t.destroy());
        document.body.innerHTML = '';
    });

    it('takes its toolbox entry from the registry', () => {
        expect(MediaLibraryTool.toolbox.title).toBe('From library');
        expect(MediaLibraryTool.toolbox.icon).toContain('<svg');
    });

    it.each([
        ['image', { mediaKind: 'image', mimeType: 'image/webp' }, 'image'],
        ['video', { mediaKind: 'video', mimeType: 'video/mp4' }, 'mediaEmbed'],
        ['audio', { mediaKind: 'audio', mimeType: 'audio/mpeg' }, 'mediaEmbed'],
        ['document', { mediaKind: 'document', mimeType: 'application/pdf' }, 'mediaEmbed'],
        ['missing kind', {}, 'image'],
    ])('inserts the right block type for %s media', async (_, media, expectedType) => {
        const tool = make();
        await tool.handleMediaSelected({
            media: { url: 'https://cdn.example.com/file', file: FILE, name: 'file', ...media },
            openedVia: 'programmatic',
        });
        expect(insertedBlocks).toHaveLength(1);
        expect(insertedBlocks[0]!.type).toBe(expectedType);
        // The stored file, never the URL the picker showed
        expect(insertedBlocks[0]!.data[expectedType === 'image' ? 'image' : 'media']).toEqual(FILE);
        expect(insertedBlocks[0]!.data).not.toHaveProperty('url');
    });

    it('refuses a private file and keeps the picker', async () => {
        const tool = make();
        const element = tool.render();
        await tool.handleMediaSelected({
            media: { url: '/api/files/0123456789abcdef0123456789abcdef', file: null, mediaKind: 'image' },
            openedVia: 'programmatic',
        });
        expect(insertedBlocks).toHaveLength(0);
        expect(element.hidden).toBe(false);
        expect(element.querySelector('.oe-status')?.textContent).toBe(PRIVATE_FILE_MESSAGE);
    });

    it('renders a picker row whose button opens the library without a field token', () => {
        const tool = make({ namespace: 'editor-a' }, 'block-r');
        document.body.appendChild(tool.render());
        let detail: { source?: string; field?: string } | undefined;
        window.addEventListener('media-library-open', ((e: CustomEvent) => (detail = e.detail)) as EventListener, {
            once: true,
        });
        fireEvent.click(screen.getByRole('button', { name: 'Choose from library' }));
        expect(detail).toEqual({ source: 'editor' });
    });

    it('ignores selections addressed to a block field, and saves an empty object', async () => {
        const tool = make({}, 'block-f');
        document.body.appendChild(tool.render());
        fireEvent.click(screen.getByRole('button', { name: 'Choose from library' }));
        window.dispatchEvent(
            new CustomEvent('media-library-selected-item', {
                detail: { field: 'oe-media-1', media: { url: 'https://x.io/a.png' } },
            }),
        );
        await Promise.resolve();
        expect(insertedBlocks).toHaveLength(0);
        expect(tool.save()).toEqual({});
    });
});
