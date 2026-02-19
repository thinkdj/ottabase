// ---------------------------------------------------------------------------
// @ottabase/ottalayout/react – React API
//
// Slot system and page-level layout hints. Import pure logic (types, presets,
// resolver, validators) from '@ottabase/ottalayout' instead.
// ---------------------------------------------------------------------------

// ── Slots ──────────────────────────────────────────────────────────────────
export { LayoutSlotsProvider, LayoutSlot, SlotContent, useLayoutSlots } from './slots';
export type { LayoutSlotProps, SlotContentProps, BuiltInSlotName } from './slots';

// ── Layout Meta (page-level hints) ─────────────────────────────────────────
export { LayoutMetaProvider, useLayoutMeta, useResolvedLayoutMeta } from './useLayoutMeta';
export type { LayoutMeta } from './useLayoutMeta';
