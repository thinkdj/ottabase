// ---------------------------------------------------------------------------
// @ottabase/motion – React Hooks
//
// Provides `useBrandMotion` and `useTransitionPreset` hooks that read the
// current brand-kit's motion tokens (via CSS custom properties on :root) and
// return ready-to-use transition presets for `motion` components.
// ---------------------------------------------------------------------------

import { useMemo } from 'react';
import { DEFAULT_MOTION } from '@ottabase/brand-engine';
import type { TokenMotion } from '@ottabase/brand-engine';
import { buildPresets, type PresetName, type TransitionPreset } from './presets';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a single CSS custom property from the document root */
function getCSSVar(name: string, fallback: string): string {
    if (typeof document === 'undefined') return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}

/**
 * Reads the current brand-kit motion tokens from CSS custom properties.
 * Falls back to `DEFAULT_MOTION` when running in SSR or when a variable is
 * missing (e.g. an older brand kit that doesn't define the new tokens).
 */
export function readMotionTokens(): Required<TokenMotion> {
    return {
        durationFast: getCSSVar('--duration-fast', DEFAULT_MOTION.durationFast),
        durationNormal: getCSSVar('--duration-normal', DEFAULT_MOTION.durationNormal),
        durationSlow: getCSSVar('--duration-slow', DEFAULT_MOTION.durationSlow),
        easing: getCSSVar('--ease', DEFAULT_MOTION.easing),
        easingEnter: getCSSVar('--ease-enter', DEFAULT_MOTION.easingEnter),
        easingExit: getCSSVar('--ease-exit', DEFAULT_MOTION.easingExit),
        easingSpring: getCSSVar('--ease-spring', DEFAULT_MOTION.easingSpring),
        scaleFrom: getCSSVar('--scale-from', DEFAULT_MOTION.scaleFrom),
        scaleTo: getCSSVar('--scale-to', DEFAULT_MOTION.scaleTo),
        slideOffset: getCSSVar('--slide-offset', DEFAULT_MOTION.slideOffset),
        opacityFrom: getCSSVar('--opacity-from', DEFAULT_MOTION.opacityFrom),
        reducedMotion: getCSSVar('--reduced-motion', DEFAULT_MOTION.reducedMotion),
    };
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Returns the full set of brand-aware transition presets.
 *
 * Reads CSS custom properties injected by the brand-engine and converts them
 * into `motion` component props.
 *
 * @example
 * ```tsx
 * import { useBrandMotion } from '@ottabase/motion';
 * import { motion, AnimatePresence } from 'motion/react';
 *
 * function Menu({ open, children }) {
 *   const presets = useBrandMotion();
 *   return (
 *     <AnimatePresence>
 *       {open && <motion.div {...presets.fadeScale}>{children}</motion.div>}
 *     </AnimatePresence>
 *   );
 * }
 * ```
 */
export function useBrandMotion(): Record<PresetName, TransitionPreset> {
    return useMemo(() => {
        const tokens = readMotionTokens();
        return buildPresets(tokens);
    }, []);
}

/**
 * Returns a single named transition preset for the active brand kit.
 *
 * @example
 * ```tsx
 * const fadeUp = useTransitionPreset('fadeUp');
 * return <motion.div {...fadeUp}>Hello</motion.div>;
 * ```
 */
export function useTransitionPreset(name: PresetName): TransitionPreset {
    const presets = useBrandMotion();
    return presets[name];
}

/**
 * Returns the raw motion tokens from the active brand kit.
 * Useful for building custom animations outside of the preset system.
 */
export function useMotionTokens(): Required<TokenMotion> {
    return useMemo(() => readMotionTokens(), []);
}
