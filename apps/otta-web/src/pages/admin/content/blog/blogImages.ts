/**
 * How the blog editors turn a pick, an upload or a typed address into what a post stores: a
 * `StoredFile` (never its URL) or an outside address kept as typed. A private file is refused,
 * because content cannot embed it: it is served by id, after a check.
 */
import type { MediaSelectionPayload } from '@ottabase/medialibrary';
import type { HeroImage, PhotoJournalItem } from '@ottabase/ottablog';
import { fileIdFromKey, type StoredFile } from '@ottabase/utils/media';

export const PRIVATE_IMAGE_MESSAGE = 'That file is private, so a post cannot show it. Choose a public image.';

/** A typed image address, trimmed, when it is an https URL; null otherwise. */
export function typedImageAddress(value: string): string | null {
    const trimmed = value.trim();
    try {
        return new URL(trimmed).protocol === 'https:' ? trimmed : null;
    } catch {
        return null;
    }
}

/** The hero for a media library pick: the library's alt text, else the author's, else the file name. */
export function heroFromPick(pick: MediaSelectionPayload, current: HeroImage | null): HeroImage | null {
    if (!pick.file) return null;
    return {
        ...current,
        image: pick.file,
        alt: pick.alt || current?.alt || pick.name || '',
        caption: pick.caption || undefined,
    };
}

/** The hero for a fresh upload (`storedFileOf(response.file)`), keeping what the author already wrote. */
export function heroFromUpload(file: StoredFile | null, fileName: string, current: HeroImage | null): HeroImage | null {
    if (!file) return null;
    return { ...current, image: file, alt: current?.alt || fileName };
}

/** A journal photograph for a media library pick, keyed by the file's id. Null for a private file. */
export function photoFromPick(pick: MediaSelectionPayload): PhotoJournalItem | null {
    if (!pick.file) return null;
    return {
        id: fileIdFromKey(pick.file.key) ?? crypto.randomUUID(),
        image: pick.file,
        title: pick.title ?? null,
        alt: pick.alt ?? null,
        caption: pick.caption ?? null,
        location: null,
        takenAt: null,
    };
}
