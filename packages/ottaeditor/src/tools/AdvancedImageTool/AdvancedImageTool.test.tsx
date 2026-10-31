import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { API } from '@editorjs/editorjs';

const KEY = 'app/media/0123456789abcdef0123456789abcdef.png';

// POST /api/files answers `{ success, file }`, the stored file's view; `audience` decides whether content may embed it.
const view = vi.hoisted(() => ({ audience: 'public' }));
const uploadFile = vi.hoisted(() =>
    vi.fn(async (_file: File, options: { onSuccess?: (response: unknown) => void; purpose?: string }) => {
        const response = {
            success: true,
            file: {
                id: '0123456789abcdef0123456789abcdef',
                storageKey: 'app/media/0123456789abcdef0123456789abcdef.png',
                audience: view.audience,
                url: '/api/files/public/app/media/0123456789abcdef0123456789abcdef.png',
                mimeType: 'image/png',
                width: 64,
                height: 48,
                variants: { thumb: { key: 'app/media/0123456789abcdef0123456789abcdef/thumb.webp' } },
            },
        };
        options.onSuccess?.(response);
        return response;
    }),
);
vi.mock('@ottabase/ottaupload/utils', () => ({ uploadFile }));

import AdvancedImageTool from './AdvancedImageTool';
import type { AdvancedImageData } from './types';
import { PRIVATE_FILE_MESSAGE } from '../../ui/kit';

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
    view.audience = 'public';
});

/** Open the library from the field and answer as the host would, with the open event's field token. */
function pick(media: Record<string, unknown>) {
    let field: string | undefined;
    window.addEventListener(
        'media-library-open',
        ((e: CustomEvent<{ field: string }>) => (field = e.detail.field)) as EventListener,
        { once: true },
    );
    fireEvent.click(screen.getByRole('button', { name: /choose from library/i }));
    window.dispatchEvent(new CustomEvent('media-library-selected-item', { detail: { field, media } }));
}

describe('AdvancedImageTool', () => {
    it('uses the registry toolbox entry and keeps its paste config', () => {
        expect(AdvancedImageTool.toolbox.title).toBe('Image');
        expect(AdvancedImageTool.pasteConfig.tags).toEqual(['img']);
        expect(AdvancedImageTool.isReadOnlySupported).toBe(true);
    });

    it('uploads through the files service and keeps the stored file, never its URL', async () => {
        const { tool } = mount();
        await tool.uploadFile(new File(['x'], 'photo.png', { type: 'image/png' }));
        expect(uploadFile).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ endpoint: '/api/files', purpose: 'media' }),
        );
        expect(tool.save().image).toEqual({ key: KEY, width: 64, height: 48, variants: ['thumb'] });
    });

    it('a private upload is refused: content cannot embed it', async () => {
        view.audience = 'owner';
        const { tool, element } = mount();
        await tool.uploadFile(new File(['x'], 'photo.png', { type: 'image/png' }));
        expect(tool.save().image).toBeUndefined();
        expect(element.querySelector('.oe-image__status')?.textContent).toBe(PRIVATE_FILE_MESSAGE);
    });

    it('empty: renders the dropzone and the URL field in edit mode', () => {
        const { element } = mount();
        expect(element.dataset.mode).toBe('edit');
        expect(screen.getByRole('button', { name: /drop an image here/i })).toBeTruthy();
        expect(screen.getByLabelText('Image URL')).toBeTruthy();
    });

    it('a direct image URL typed into the field becomes the image', () => {
        const { tool, element } = mount();
        fireEvent.input(screen.getByLabelText('Image URL'), {
            target: { value: ' https://cdn.example.com/photo.jpg ' },
        });
        expect(tool.save().image).toBe('https://cdn.example.com/photo.jpg');
        expect(element.dataset.mode).toBe('preview');
    });

    it('a non-image URL is refused with a status line', () => {
        const { tool, element } = mount();
        fireEvent.input(screen.getByLabelText('Image URL'), { target: { value: 'https://example.com/page' } });
        expect(tool.save().image).toBeUndefined();
        expect(element.querySelector('.oe-image__status')?.textContent).toMatch(/direct image URL/);
    });

    it('filled: options and text fields flow into save()', () => {
        const { tool } = mount({ image: 'https://cdn.example.com/a.png', withBorder: true, withBackground: true });
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

    it('a library pick stores its file and fills the alt text', () => {
        const { tool } = mount();
        const file = { key: KEY, width: 1200, height: 800, variants: ['thumb', 'card'] };
        pick({ url: 'https://files.test/shown-only.png', file, alt: 'Library alt' });
        expect(tool.save()).toMatchObject({ image: file, alt: 'Library alt' });
    });

    it('a private library pick is refused with a status line', () => {
        const { tool, element } = mount();
        pick({ url: '/api/files/0123456789abcdef0123456789abcdef', file: null });
        expect(tool.save().image).toBeUndefined();
        expect(element.querySelector('.oe-media .oe-status')?.textContent).toBe(PRIVATE_FILE_MESSAGE);
    });

    it('validate rejects a block without an image', () => {
        const { tool } = mount();
        expect(tool.validate({})).toBe(false);
        expect(tool.validate({ image: 'https://x.io/a.png' })).toBe(true);
        expect(tool.validate({ image: { key: KEY } })).toBe(true);
    });
});
