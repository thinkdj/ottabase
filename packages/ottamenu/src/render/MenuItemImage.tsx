import { fileUrl, type FileSource } from '@ottabase/utils/media';
import { sanitizeUrl } from '@ottabase/utils/sanitize';

/** A menu item's icon: the thumb rendition of a stored file, or a sanitized outside address. */
export function MenuItemImage({ image, className }: { image?: FileSource | null; className: string }) {
    const src = image ? sanitizeUrl(fileUrl(image, 'thumb')) : '#';
    if (src === '#') return null;
    return <img src={src} alt="" className={className} loading="lazy" decoding="async" />;
}
