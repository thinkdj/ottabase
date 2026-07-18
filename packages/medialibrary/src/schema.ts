// ============================================================
// @ottabase/medialibrary — Schema re-exports
//
// The canonical media table lives in @ottabase/ottaorm as a core
// table (`mediaTable`); re-exported here for convenience.
// ============================================================

import { mediaTable, type MediaType, type NewMediaType } from '@ottabase/ottaorm';

export { mediaTable };
export type { MediaType, NewMediaType };
