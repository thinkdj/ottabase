import type { MediaType } from '@ottabase/ottaorm';
import { createModelHooks } from '@ottabase/ottaorm/client';

export const mediaLibraryHooks = createModelHooks<MediaType>({
    entityName: 'media',
});

export function normalizeMediaLibraryListResponse(data: MediaType[] | { data?: MediaType[] } | undefined): MediaType[] {
    if (Array.isArray(data)) {
        return data;
    }

    return Array.isArray(data?.data) ? data.data : [];
}
