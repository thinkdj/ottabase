import { configureMedia, type FileSource } from '@ottabase/utils/media';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mediaInput, PRIVATE_FILE_MESSAGE, type MediaSelection } from './kit';

const FILE = {
    key: 'app/media/0123456789abcdef0123456789abcdef.jpg',
    width: 1200,
    height: 800,
    variants: ['thumb' as const],
};

/** Mount a media input and answer its library button the way the host's picker bridge does. */
function mount(value?: FileSource) {
    const onChange = vi.fn<(value: FileSource | undefined, media?: MediaSelection) => void>();
    const media = mediaInput({ value, ariaLabel: 'Image', onChange });
    document.body.append(media.element);
    const input = media.element.querySelector('input')!;
    const pick = (selection: MediaSelection) => {
        let field: string | undefined;
        window.addEventListener('media-library-open', ((e: CustomEvent) => (field = e.detail.field)) as EventListener, {
            once: true,
        });
        media.element.querySelector('button')!.click();
        window.dispatchEvent(new CustomEvent('media-library-selected-item', { detail: { field, media: selection } }));
    };
    return { media, input, onChange, pick };
}

afterEach(() => {
    document.body.innerHTML = '';
    configureMedia({ publicUrl: null });
});

describe('mediaInput', () => {
    it('stores a library pick as its file and paints the thumb rendition', () => {
        configureMedia({ publicUrl: 'https://files.test' });
        const { media, input, onChange, pick } = mount();
        pick({ url: 'https://files.test/shown.jpg', file: FILE, alt: 'Alt' });
        expect(onChange).toHaveBeenCalledWith(FILE, expect.objectContaining({ alt: 'Alt' }));
        expect(input.value).toBe('https://files.test/shown.jpg');
        const thumb = media.element.querySelector<HTMLElement>('.oe-media__thumb')!;
        expect(thumb.style.backgroundImage).toContain(
            'https://files.test/app/media/0123456789abcdef0123456789abcdef/thumb.webp',
        );
        media.destroy();
    });

    it('refuses a private pick with a status line and keeps the value', () => {
        const { media, onChange, pick } = mount('https://example.com/kept.jpg');
        pick({ url: '/api/files/0123456789abcdef0123456789abcdef', file: null });
        expect(onChange).not.toHaveBeenCalled();
        expect(media.element.querySelector('[role=status]')?.textContent).toBe(PRIVATE_FILE_MESSAGE);
        media.destroy();
    });

    it('stores a typed address trimmed, an empty field as undefined, and shows a stored value as its URL', () => {
        const { media, input, onChange } = mount(FILE);
        expect(input.value).toBe('/api/files/public/app/media/0123456789abcdef0123456789abcdef.jpg');
        input.value = '  https://example.com/a.png ';
        input.dispatchEvent(new Event('input'));
        expect(onChange).toHaveBeenLastCalledWith('https://example.com/a.png', undefined);
        input.value = '   ';
        input.dispatchEvent(new Event('input'));
        expect(onChange).toHaveBeenLastCalledWith(undefined, undefined);
        media.destroy();
    });
});
