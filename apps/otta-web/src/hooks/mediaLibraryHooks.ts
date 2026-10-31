import type { MediaLibraryItemLike } from '@ottabase/medialibrary';
import { createModelHooks } from '@ottabase/ottaorm/client';

/** Media rows as `/api/ottaorm/media` lists them: with the URLs the files service computed. Read-only. */
export const mediaLibraryHooks = createModelHooks<MediaLibraryItemLike>({
    entityName: 'media',
});

export function normalizeMediaLibraryListResponse(
    data: MediaLibraryItemLike[] | { data?: MediaLibraryItemLike[] } | undefined,
): MediaLibraryItemLike[] {
    if (Array.isArray(data)) {
        return data;
    }

    return Array.isArray(data?.data) ? data.data : [];
}
