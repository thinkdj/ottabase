import { beforeEach, describe, expect, it, vi } from 'vitest';
import MediaLibraryTool from './MediaLibraryTool';

// Mock CSS import
vi.mock('./MediaLibraryTool.css', () => ({}));

// Track block insertions
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

    beforeEach(() => {
        insertedBlocks.length = 0;
        mockAPI = createMockAPI();
    });

    describe('Toolbox', () => {
        it('should have correct toolbox configuration', () => {
            expect(MediaLibraryTool.toolbox.title).toBe('Media Library');
            expect(MediaLibraryTool.toolbox.icon).toBeTruthy();
        });
    });

    describe('Kind-aware insertion', () => {
        it('should insert an image block for image media', async () => {
            const tool = new MediaLibraryTool({
                api: mockAPI as any,
                config: {},
                block: { id: 'block-0' },
            });

            await tool.handleMediaSelected({
                media: {
                    url: 'https://cdn.example.com/photo.webp',
                    name: 'photo.webp',
                    mediaKind: 'image',
                    mimeType: 'image/webp',
                    mediaId: 'media-1',
                },
                openedVia: 'programmatic',
            });

            expect(insertedBlocks).toHaveLength(1);
            expect(insertedBlocks[0].type).toBe('image');
            expect(insertedBlocks[0].data.url).toBe('https://cdn.example.com/photo.webp');
        });

        it('should insert a mediaEmbed block for video media', async () => {
            const tool = new MediaLibraryTool({
                api: mockAPI as any,
                config: {},
                block: { id: 'block-0' },
            });

            await tool.handleMediaSelected({
                media: {
                    url: 'https://cdn.example.com/clip.mp4',
                    name: 'clip.mp4',
                    mediaKind: 'video',
                    mimeType: 'video/mp4',
                    mediaId: 'media-2',
                },
                openedVia: 'programmatic',
            });

            expect(insertedBlocks).toHaveLength(1);
            expect(insertedBlocks[0].type).toBe('mediaEmbed');
            expect(insertedBlocks[0].data.mediaKind).toBe('video');
        });

        it('should insert a mediaEmbed block for audio media', async () => {
            const tool = new MediaLibraryTool({
                api: mockAPI as any,
                config: {},
                block: { id: 'block-0' },
            });

            await tool.handleMediaSelected({
                media: {
                    url: 'https://cdn.example.com/track.mp3',
                    name: 'track.mp3',
                    mediaKind: 'audio',
                    mimeType: 'audio/mpeg',
                },
                openedVia: 'programmatic',
            });

            expect(insertedBlocks).toHaveLength(1);
            expect(insertedBlocks[0].type).toBe('mediaEmbed');
            expect(insertedBlocks[0].data.mediaKind).toBe('audio');
        });

        it('should insert a mediaEmbed block for document media', async () => {
            const tool = new MediaLibraryTool({
                api: mockAPI as any,
                config: {},
                block: { id: 'block-0' },
            });

            await tool.handleMediaSelected({
                media: {
                    url: 'https://cdn.example.com/guide.pdf',
                    name: 'guide.pdf',
                    mediaKind: 'document',
                    mimeType: 'application/pdf',
                },
                openedVia: 'programmatic',
            });

            expect(insertedBlocks).toHaveLength(1);
            expect(insertedBlocks[0].type).toBe('mediaEmbed');
            expect(insertedBlocks[0].data.mediaKind).toBe('document');
        });

        it('should default to image when mediaKind is missing', async () => {
            const tool = new MediaLibraryTool({
                api: mockAPI as any,
                config: {},
                block: { id: 'block-0' },
            });

            await tool.handleMediaSelected({
                media: {
                    url: 'https://cdn.example.com/photo.jpg',
                    name: 'photo.jpg',
                },
                openedVia: 'programmatic',
            });

            expect(insertedBlocks).toHaveLength(1);
            expect(insertedBlocks[0].type).toBe('image');
        });
    });

    describe('Namespace isolation', () => {
        it('should accept a namespace from config', () => {
            const tool = new MediaLibraryTool({
                api: mockAPI as any,
                config: { namespace: 'editor-a' },
                block: { id: 'block-ns' },
            });

            // Tool construction should not throw
            expect(tool).toBeTruthy();
        });
    });

    describe('Render', () => {
        it('should render a placeholder element', () => {
            const tool = new MediaLibraryTool({
                api: mockAPI as any,
                config: {},
                block: { id: 'block-r' },
            });

            const wrapper = tool.render();
            expect(wrapper.classList.contains('cdx-media-library')).toBe(true);
            expect(wrapper.querySelector('.cdx-media-library-placeholder')).toBeTruthy();
        });
    });

    describe('Save', () => {
        it('should return an empty object', () => {
            const tool = new MediaLibraryTool({
                api: mockAPI as any,
                config: {},
                block: { id: 'block-s' },
            });

            expect(tool.save()).toEqual({});
        });
    });
});
