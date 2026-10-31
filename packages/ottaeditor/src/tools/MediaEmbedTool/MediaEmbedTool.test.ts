import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { MediaEmbedData } from './MediaEmbedTool';
import MediaEmbedTool from './MediaEmbedTool';

const tools: MediaEmbedTool[] = [];

function mount(data: Partial<MediaEmbedData> = {}) {
    const tool = new MediaEmbedTool({ data });
    const element = tool.render();
    document.body.appendChild(element);
    tools.push(tool);
    return { tool, element };
}

afterEach(() => {
    tools.splice(0).forEach((t) => t.destroy());
    document.body.innerHTML = '';
});

describe('MediaEmbedTool', () => {
    it('is in the toolbox as "Video & files" and supports read-only', () => {
        expect(MediaEmbedTool.toolbox.title).toBe('Video & files');
        expect(MediaEmbedTool.isReadOnlySupported).toBe(true);
    });

    it('starts with default empty values and keeps provided data', () => {
        expect(new MediaEmbedTool({ data: {} }).save()).toEqual({
            title: '',
            caption: '',
            mimeType: '',
            mediaKind: 'other',
        });
        const data: MediaEmbedData = {
            media: { key: 'app/media/0123456789abcdef0123456789abcdef.mp3' },
            title: 'My Track',
            caption: 'Listen now',
            mimeType: 'audio/mpeg',
            mediaKind: 'audio',
        };
        expect(new MediaEmbedTool({ data }).save()).toEqual(data);
    });

    it('opens in edit when empty, preview when it has a file', () => {
        expect(mount().element.dataset.mode).toBe('edit');
        expect(mount({ media: 'https://cdn.example.com/clip.mp4', mediaKind: 'video' }).element.dataset.mode).toBe(
            'preview',
        );
    });

    it('title and caption fields flow into save()', () => {
        const { tool } = mount({ media: 'https://cdn.example.com/clip.mp4', mediaKind: 'video' });
        fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'Demo video' } });
        fireEvent.input(screen.getByLabelText('Caption'), { target: { value: 'A quick demo' } });
        expect(tool.save()).toMatchObject({ title: 'Demo video', caption: 'A quick demo', mediaKind: 'video' });
    });

    it('a library pick stores its file, kind and metadata', () => {
        const { tool, element } = mount();
        let field: string | undefined;
        window.addEventListener(
            'media-library-open',
            ((e: CustomEvent<{ field: string; acceptKinds: string[] }>) => {
                field = e.detail.field;
                expect(e.detail.acceptKinds).toContain('video');
            }) as EventListener,
            { once: true },
        );
        fireEvent.click(screen.getByRole('button', { name: /choose from library/i }));
        window.dispatchEvent(
            new CustomEvent('media-library-selected-item', {
                detail: {
                    field,
                    media: {
                        url: 'https://cdn.example.com/guide.pdf',
                        file: { key: 'app/media/0123456789abcdef0123456789abcdef.pdf' },
                        mimeType: 'application/pdf',
                        mediaKind: 'document',
                        title: 'User Guide',
                    },
                },
            }),
        );
        expect(tool.save()).toMatchObject({
            media: { key: 'app/media/0123456789abcdef0123456789abcdef.pdf' },
            mimeType: 'application/pdf',
            mediaKind: 'document',
            title: 'User Guide',
        });
        expect(element.dataset.mode).toBe('preview');
    });
});
