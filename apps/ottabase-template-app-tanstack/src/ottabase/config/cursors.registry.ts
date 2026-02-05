/**
 * Cursor SVG Registry
 *
 * Reusable SVG cursor templates that can be referenced in theme configurations.
 * These SVGs are converted to data URIs at runtime for use with CSS cursor property.
 */

export const CURSOR_SVG_REGISTRY: Record<string, string> = {
    /**
     * Simple dot cursor - minimal and clean
     */
    dot: `<svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
        <circle cx="6" cy="6" r="5" fill="currentColor" stroke="white" stroke-width="1"/>
    </svg>`,

    /**
     * Ring cursor - hollow circle for non-intrusive presence
     */
    ring: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
    </svg>`,

    /**
     * Crosshair cursor - precision targeting
     */
    crosshair: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <line x1="12" y1="0" x2="12" y2="24" stroke="currentColor" stroke-width="1"/>
        <line x1="0" y1="12" x2="24" y2="12" stroke="currentColor" stroke-width="1"/>
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1"/>
    </svg>`,

    /**
     * Retro arrow cursor - classic computing aesthetic
     */
    'arrow-retro': `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 0 L0 16 L6 10 L10 18 L12 17 L8 9 L16 9 Z" fill="black" stroke="white" stroke-width="1"/>
    </svg>`,

    /**
     * Hand pointer cursor - interactive element indicator
     */
    'hand-pointer': `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 2a2 2 0 0 1 2 2v7h3l-5 6-5-6h3V4a2 2 0 0 1 2-2z" fill="currentColor" stroke="white" stroke-width="0.5"/>
    </svg>`,

    /**
     * Plus/add cursor - creation actions
     */
    plus: `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <line x1="10" y1="2" x2="10" y2="18" stroke="currentColor" stroke-width="2"/>
        <line x1="2" y1="10" x2="18" y2="10" stroke="currentColor" stroke-width="2"/>
    </svg>`,

    /**
     * Sparkle cursor - creative/magical actions
     */
    sparkle: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0l2 7h7l-5.5 4.5L18 19l-6-4.5L6 19l2.5-7.5L3 7h7z" fill="currentColor" stroke="white" stroke-width="0.5"/>
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
