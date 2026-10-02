/**
 * Whether the viewer should skip its JS-driven animations (slide, spring, zoom, counter pulse).
 *
 * Honors Ottabase's two motion switches, which both land in the motion tokens:
 *  - the OS `prefers-reduced-motion: reduce` setting (ui-shadcn zeroes the duration tokens), and
 *  - a brand kit's "Disable animations" (brand-engine emits `--motion-duration-*: 0s`).
 * Class-based transitions (`duration-normal` …) already follow the tokens; inline styles need this.
 */
export function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
    const duration = getComputedStyle(document.documentElement).getPropertyValue('--motion-duration-normal').trim();
    // Unset (no theme stylesheet) means "animate"; only an explicit zero disables.
    return duration !== '' && parseFloat(duration) === 0;
}
