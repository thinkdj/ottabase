import { CURSOR_SVG_REGISTRY, resolveCursor } from './registry';
import type { CursorDef } from './registry';

export { CURSOR_SVG_REGISTRY, resolveCursor };
export type { CursorDef };

/** Get SVG cursor markup by key */
export const getCursorSvg = (key: string): string | undefined => CURSOR_SVG_REGISTRY[key]?.svg;

/** Get all available cursor keys */
export const getAvailableCursors = (): string[] => Object.keys(CURSOR_SVG_REGISTRY);
