import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { API } from '@editorjs/editorjs';

// POST /api/files answers `{ success, file }`, the stored file's view.
const uploadFile = vi.hoisted(() =>
    vi.fn(async (_file: File, options: { onSuccess?: (response: unknown) => void; purpose?: string }) => {
        const response = {
            success: true,
            file: { id: 'f1', url: '/api/files/public/app/media/f1.png', mimeType: 'image/png', width: 64, height: 48 },
        };
        options.onSuccess?.(response);
        return response;
    }),
);
vi.mock('@ottabase/ottaupload/utils', () => ({ uploadFile }));

import AdvancedImageTool from './AdvancedImageTool';
import type { AdvancedImageData } from './types';

const tools: AdvancedImageTool[] = [];

function mount(data: Partial<AdvancedImageData> = {}) {
    const tool = new AdvancedImageTool({ api: {} as API, data, config: {}, block: {} as never, readOnly: false });
    const element = tool.render();
    document.body.appendChild(element);
    tools.push(tool);
    return { tool, element };
}

afterEach(() => {
    tools.splice(0).forEach((t) => t.destroy());
    document.body.innerHTML = '';
});

describe('AdvancedImageTool', () => {
    it('uses the registry toolbox entry and keeps its paste config', () => {
        expect(AdvancedImageTool.toolbox.title).toBe('Image');
        expect(AdvancedImageTool.pasteConfig.tags).toEqual(['img']);
        expect(AdvancedImageTool.isReadOnlySupported).toBe(true);
    });

    it('uploads through the files service and keeps the stored file’s view URL and id', async () => {
        const { tool } = mount();
        await tool.uploadFile(new File(['x'], 'photo.png', { type: 'image/png' }));
        expect(uploadFile).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ endpoint: '/api/files', purpose: 'media' }),
        );
        expect(tool.save()).toMatchObject({ url: '/api/files/public/app/media/f1.png', mediaId: 'f1', width: 64 });
    });

    it('empty: renders the dropzone and the URL field in edit mode', () => {
        const { element } = mount();
        expect(element.dataset.mode).toBe('edit');
        expect(screen.getByRole('button', { name: /drop an image here/i })).toBeTruthy();
        expect(screen.getByLabelText('Image URL')).toBeTruthy();
    });

    it('a direct image URL typed into the field becomes the image', () => {
        const { tool, element } = mount();
        fireEvent.input(screen.getByLabelText('Image URL'), { target: { value: 'https://cdn.example.com/photo.jpg' } });
        expect(tool.save().url).toBe('https://cdn.example.com/photo.jpg');
        expect(element.dataset.mode).toBe('preview');
    });

    it('a non-image URL is refused with a status line', () => {
        const { tool } = mount();
        fireEvent.input(screen.getByLabelText('Image URL'), { target: { value: 'https://example.com/page' } });
        expect(tool.save().url).toBe('');
        expect(screen.getByRole('status').textContent).toMatch(/direct image URL/);
    });

    it('filled: options and text fields flow into save()', () => {
        const { tool } = mount({ url: 'https://cdn.example.com/a.png', withBorder: true, withBackground: true });
        fireEvent.input(screen.getByLabelText('Caption'), { target: { value: 'A caption ' } });
        fireEvent.input(screen.getByLabelText('Alt text'), { target: { value: 'Alt' } });
        fireEvent.click(screen.getByRole('switch', { name: 'Border' }));
        fireEvent.click(screen.getByRole('switch', { name: 'Stretch' }));
        fireEvent.click(
            within(screen.getByRole('radiogroup', { name: 'Aspect ratio' })).getByRole('radio', { name: '16:9' }),
        );
        const link = screen.getByLabelText('Link') as HTMLInputElement;
        fireEvent.input(link, { target: { value: 'ftp://nope' } });
        fireEvent.blur(link);
        expect(tool.save()).toMatchObject({
            caption: 'A caption',
            alt: 'Alt',
            withBorder: false,
            withBackground: true,
            stretched: true,
            aspectRatio: '16:9',
            linkUrl: '',
        });
    });

    it('a library pick fills url and metadata', () => {
        const { tool } = mount();
        const field = screen.getByLabelText('Image URL');
        const token = field.id ? undefined : undefined; // the field token is private; the library button opens with it
        fireEvent.click(screen.getByRole('button', { name: /choose from library/i }));
        // Simulate the host echoing the selection back; the token travels in the open event
        let openedField: string | undefined;
        window.addEventListener(
            'media-library-open',
            ((e: CustomEvent<{ field: string }>) => (openedField = e.detail.field)) as EventListener,
            { once: true },
        );
        fireEvent.click(screen.getByRole('button', { name: /choose from library/i }));
        window.dispatchEvent(
            new CustomEvent('media-library-selected-item', {
                detail: {
                    field: openedField ?? token,
                    media: {
                        url: 'https://cdn.example.com/lib.webp',
                        mediaId: 'm1',
                        mimeType: 'image/webp',
                        altText: 'Library alt',
                    },
                },
            }),
        );
        expect(tool.save()).toMatchObject({
            url: 'https://cdn.example.com/lib.webp',
            mediaId: 'm1',
            mimeType: 'image/webp',
            alt: 'Library alt',
        });
    });

    it('validate rejects an empty url', () => {
        const { tool } = mount();
        expect(tool.validate({ url: '' })).toBe(false);
        expect(tool.validate({ url: 'https://x.io/a.png' })).toBe(true);
    });
});
