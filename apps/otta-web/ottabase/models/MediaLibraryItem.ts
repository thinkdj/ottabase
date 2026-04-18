// ============================================================
// Media model — re-exports the core Media model from @ottabase/ottaorm.
//
// The table is now `media` (core). The old `media_library_items`
// name and `MediaLibraryItem` class are kept as aliases for
// backward compatibility during migration.
// ============================================================
import { Media, mediaTable, type MediaType, type NewMediaType } from '@ottabase/ottaorm';

// Backward-compat aliases
export { Media, Media as MediaLibraryItem, mediaTable as mediaLibraryItemsTable, mediaTable };
export type { MediaType as MediaLibraryItemRecord, MediaType, NewMediaType as NewMediaLibraryItemRecord, NewMediaType };
