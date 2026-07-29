// ---------------------------------------------------------------------------
// Ottamenu – Pure menu types and tree utilities (headless, framework-agnostic)
// No persistence or ORM – models/schema/handlers live in @ottabase/brand-engine
// No rendered UI – all React renderers live behind the ./render subpath so this
// barrel stays pure and import-safe in non-React (edge/worker) contexts.
// ---------------------------------------------------------------------------

// Pure types (shared contract between renderers and persistence layer)
export type { MenuItemDto, MenuRenderType, MenuWithItemsDto } from './types';

// Tree utilities (pure functions, no DB dependency)
export { buildItemTree } from './treeUtils';
export type { MenuItemTreeNode } from './treeUtils';
