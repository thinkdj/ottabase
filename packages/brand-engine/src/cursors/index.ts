import { CURSOR_SVG_REGISTRY, resolveCursor } from './registry';

export { CURSOR_SVG_REGISTRY, resolveCursor };

/** Get SVG cursor template by key */
export const getCursorSvg = (key: string): string | undefined => CURSOR_SVG_REGISTRY[key];

/** Get all available cursor keys */
export const getAvailableCursors = (): string[] => Object.keys(CURSOR_SVG_REGISTRY);
