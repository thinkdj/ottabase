/**
 * Cursor SVG Registry
 *
 * Modern, clean SVG cursor templates referenced in theme configurations.
 * Converted to data URIs at runtime for use with CSS cursor property.
 *
 * Design principles:
 *   - Classic arrow / hand shapes — no dots, rings, or gimmicks
 *   - Theme accent colours baked into the SVG fill
 *   - White outline for contrast on any background
 */

export const CURSOR_SVG_REGISTRY: Record<string, string> = {
    // ── Modern arrow cursors (colour-accented) ──────────────────────────

    /**
     * Modern arrow – crimson / artisan palette
     * A classic pointer arrow with warm crimson fill and white border.
     */
    'arrow-crimson': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 2l2 18 5-5 4 7 2.5-1.5-4-7h7L3 2z" fill="#a8325a" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`,

    /**
     * Modern arrow – emerald / funky palette
     */
    'arrow-emerald': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 2l2 18 5-5 4 7 2.5-1.5-4-7h7L3 2z" fill="#2d9d5c" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`,

    /**
     * Modern arrow – violet / midnight palette
     */
    'arrow-violet': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 2l2 18 5-5 4 7 2.5-1.5-4-7h7L3 2z" fill="#7c5cbf" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`,

    /**
     * Modern arrow – black classic
     */
    'arrow-classic': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 2l2 18 5-5 4 7 2.5-1.5-4-7h7L3 2z" fill="#1a1a1a" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`,

    // ── Hand pointer cursors (colour-accented) ──────────────────────────

    /**
     * Pointing hand – crimson accent
     */
    'hand-crimson': `<svg width="24" height="28" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 1c1.1 0 2 .9 2 2v9h1.5c.83 0 1.5.67 1.5 1.5V14h1.5c.83 0 1.5.67 1.5 1.5V16h1c.83 0 1.5.67 1.5 1.5V22c0 3.31-2.69 6-6 6H11c-2.12 0-4.07-1.12-5.15-2.94l-3.38-5.7a1.5 1.5 0 0 1 2.06-2.06L7 19V3c0-1.1.9-2 2-2h1z" fill="#a8325a" stroke="white" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>`,

    /**
     * Pointing hand – emerald accent
     */
    'hand-emerald': `<svg width="24" height="28" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 1c1.1 0 2 .9 2 2v9h1.5c.83 0 1.5.67 1.5 1.5V14h1.5c.83 0 1.5.67 1.5 1.5V16h1c.83 0 1.5.67 1.5 1.5V22c0 3.31-2.69 6-6 6H11c-2.12 0-4.07-1.12-5.15-2.94l-3.38-5.7a1.5 1.5 0 0 1 2.06-2.06L7 19V3c0-1.1.9-2 2-2h1z" fill="#2d9d5c" stroke="white" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>`,

    /**
     * Pointing hand – classic black
     */
    'hand-classic': `<svg width="24" height="28" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 1c1.1 0 2 .9 2 2v9h1.5c.83 0 1.5.67 1.5 1.5V14h1.5c.83 0 1.5.67 1.5 1.5V16h1c.83 0 1.5.67 1.5 1.5V22c0 3.31-2.69 6-6 6H11c-2.12 0-4.07-1.12-5.15-2.94l-3.38-5.7a1.5 1.5 0 0 1 2.06-2.06L7 19V3c0-1.1.9-2 2-2h1z" fill="#1a1a1a" stroke="white" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>`,

    // ── Crosshair (cleaned up) ──────────────────────────────────────────

    /**
     * Precision crosshair – thin, modern
     */
    crosshair: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="12" y1="2" x2="12" y2="10" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="12" y1="14" x2="12" y2="22" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="2" y1="12" x2="10" y2="12" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="14" y1="12" x2="22" y2="12" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="12" cy="12" r="3" fill="none" stroke="#1a1a1a" stroke-width="1.2"/>
    </svg>`,

    // ── Text cursor ─────────────────────────────────────────────────────

    /**
     * I-beam text cursor
     */
    'text-beam': `<svg width="16" height="24" viewBox="0 0 16 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 2h8M4 22h8M8 2v20" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,

    // ── Legacy keys (kept for backward compat, point to new cursors) ────

    /**
     * @deprecated Use arrow-crimson or arrow-emerald instead
     */
    'arrow-retro': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 2l2 18 5-5 4 7 2.5-1.5-4-7h7L3 2z" fill="#1a1a1a" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`,

    /**
     * @deprecated Use hand-crimson or hand-emerald instead
     */
    'hand-pointer': `<svg width="24" height="28" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 1c1.1 0 2 .9 2 2v9h1.5c.83 0 1.5.67 1.5 1.5V14h1.5c.83 0 1.5.67 1.5 1.5V16h1c.83 0 1.5.67 1.5 1.5V22c0 3.31-2.69 6-6 6H11c-2.12 0-4.07-1.12-5.15-2.94l-3.38-5.7a1.5 1.5 0 0 1 2.06-2.06L7 19V3c0-1.1.9-2 2-2h1z" fill="#1a1a1a" stroke="white" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>`,
};

/**
 * Get SVG cursor template by key
 */
export const getCursorSvg = (key: string): string | undefined => {
    return CURSOR_SVG_REGISTRY[key];
};

/**
 * Get all available cursor keys
 */
export const getAvailableCursors = (): string[] => {
    return Object.keys(CURSOR_SVG_REGISTRY);
};
