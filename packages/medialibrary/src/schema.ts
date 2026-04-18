// ============================================================
// @ottabase/medialibrary — Schema re-exports
//
// The canonical media table now lives in @ottabase/ottaorm as a
// core table (`mediaTable`). This file re-exports it under the
// legacy name for backward compatibility.
// ============================================================

import { mediaTable, type MediaType, type NewMediaType } from '@ottabase/ottaorm';

/** @deprecated Use `mediaTable` from `@ottabase/ottaorm` */
export const mediaLibraryItemsTable = mediaTable;
export { mediaTable };

/** @deprecated Use `MediaType` from `@ottabase/ottaorm` */
export type MediaLibraryItemRecord = MediaType;
/** @deprecated Use `NewMediaType` from `@ottabase/ottaorm` */
export type NewMediaLibraryItemRecord = NewMediaType;
export type { MediaType, NewMediaType };
