import { describe, expect, it, vi } from 'vitest';
import type { MediaEmbedData } from './MediaEmbedTool';
import MediaEmbedTool from './MediaEmbedTool';

// Mock CSS import
vi.mock('./MediaEmbedTool.css', () => ({}));

describe('MediaEmbedTool', () => {
    describe('Toolbox', () => {
        it('should not appear in the toolbox', () => {
            // MediaEmbedTool is inserted via MediaLibraryTool, not shown directly
            expect(MediaEmbedTool.toolbox).toBeFalsy();
        });

        it('should support read-only mode', () => {
            expect(MediaEmbedTool.isReadOnlySupported).toBe(true);
        });
    });

    describe('Initialization', () => {
        it('should initialize with default empty values', () => {
            const tool = new MediaEmbedTool({ data: {} as MediaEmbedData });
            const saved = tool.save();
            expect(saved.url).toBe('');
            expect(saved.mediaKind).toBe('other');
            expect(saved.mimeType).toBe('');
            expect(saved.title).toBe('');
        });

        it('should initialize with provided data', () => {
            const tool = new MediaEmbedTool({
                data: {
                    url: 'https://cdn.example.com/clip.mp4',
                    title: 'Demo video',
                    caption: 'A quick demo',
                    mediaId: 'media-42',
                    mimeType: 'video/mp4',
                    mediaKind: 'video',
                },
            });

            const saved = tool.save();
            expect(saved.url).toBe('https://cdn.example.com/clip.mp4');
            expect(saved.title).toBe('Demo video');
            expect(saved.caption).toBe('A quick demo');
            expect(saved.mediaId).toBe('media-42');
            expect(saved.mimeType).toBe('video/mp4');
            expect(saved.mediaKind).toBe('video');
        });
    });

    describe('Rendering', () => {
        it('should render a video element for video kind', () => {
            const tool = new MediaEmbedTool({
                data: {
                    url: 'https://cdn.example.com/clip.mp4',
                    mimeType: 'video/mp4',
                    mediaKind: 'video',
                    title: 'My Video',
                },
            });
            const wrapper = tool.render();
            const video = wrapper.querySelector('video');
            expect(video).toBeTruthy();
            expect(video?.getAttribute('src')).toBe('https://cdn.example.com/clip.mp4');
            expect(video?.hasAttribute('controls')).toBe(true);
        });

        it('should render an audio element for audio kind', () => {
            const tool = new MediaEmbedTool({
                data: {
                    url: 'https://cdn.example.com/track.mp3',
                    mimeType: 'audio/mpeg',
                    mediaKind: 'audio',
                    title: 'My Track',
                },
            });
            const wrapper = tool.render();
            const audio = wrapper.querySelector('audio');
            expect(audio).toBeTruthy();
            expect(audio?.getAttribute('src')).toBe('https://cdn.example.com/track.mp3');
            expect(audio?.hasAttribute('controls')).toBe(true);
        });

        it('should render an iframe for PDF documents', () => {
            const tool = new MediaEmbedTool({
                data: {
                    url: 'https://cdn.example.com/guide.pdf',
                    mimeType: 'application/pdf',
                    mediaKind: 'document',
                    title: 'User Guide',
                },
            });
            const wrapper = tool.render();
            const iframe = wrapper.querySelector('iframe');
            expect(iframe).toBeTruthy();
            expect(iframe?.getAttribute('src')).toBe('https://cdn.example.com/guide.pdf');
            expect(iframe?.getAttribute('sandbox')).toBe('allow-same-origin');
        });

        it('should render a placeholder for unknown/other kinds', () => {
            const tool = new MediaEmbedTool({
                data: {
                    url: 'https://cdn.example.com/data.zip',
                    mimeType: 'application/zip',
                    mediaKind: 'archive',
                    title: 'Project bundle',
                },
            });
            const wrapper = tool.render();
            const placeholder = wrapper.querySelector('.media-embed-placeholder');
            expect(placeholder).toBeTruthy();
            expect(placeholder?.textContent).toContain('Project bundle');
            expect(placeholder?.textContent).toContain('archive');
        });

        it('should render empty message when no URL', () => {
            const tool = new MediaEmbedTool({ data: {} as MediaEmbedData });
            const wrapper = tool.render();
            const empty = wrapper.querySelector('.media-embed-empty');
            expect(empty).toBeTruthy();
        });

        it('should render caption when provided', () => {
            const tool = new MediaEmbedTool({
                data: {
                    url: 'https://cdn.example.com/clip.mp4',
                    mediaKind: 'video',
                    caption: 'Watch this demo',
                },
            });
            const wrapper = tool.render();
            const caption = wrapper.querySelector('.media-embed-caption');
            expect(caption).toBeTruthy();
            expect(caption?.textContent).toBe('Watch this demo');
        });
    });

    describe('Save', () => {
        it('should return the full data shape', () => {
            const data: MediaEmbedData = {
                url: 'https://cdn.example.com/track.mp3',
                title: 'My Track',
                caption: 'Listen now',
                mediaId: 'media-99',
                mimeType: 'audio/mpeg',
                mediaKind: 'audio',
                thumbnailUrl: 'https://cdn.example.com/track-thumb.jpg',
                previewUrl: 'https://cdn.example.com/track-preview.mp3',
            };
            const tool = new MediaEmbedTool({ data });
            const saved = tool.save();
            expect(saved).toEqual(data);
        });
    });
});
