// ---------------------------------------------------------------------------
// @ottabase/motion – Transition Presets
//
// Pre-built transition configurations that read brand-kit CSS custom properties.
// Each preset is a named collection of `motion` library props that can be spread
// onto `<motion.div>` (or any motion component) for consistent, brand-aware
// animations across the app.
// ---------------------------------------------------------------------------

import type { TokenMotion } from '@ottabase/brand-engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A transition preset that can be applied to a motion component */
export interface TransitionPreset {
    /** Initial state (hidden / before enter) */
    initial: Record<string, string | number>;
    /** Visible / entered state */
    animate: Record<string, string | number>;
    /** Exit state (before unmount) */
    exit: Record<string, string | number>;
    /** Transition configuration */
    transition: {
        duration: number;
        ease: number[];
    };
}

/** Named presets available out of the box */
export type PresetName = 'fade' | 'fadeUp' | 'fadeDown' | 'fadeScale' | 'slideLeft' | 'slideRight' | 'scaleSpring';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a CSS duration string (e.g. "200ms", "0.3s") into seconds */
export function parseDuration(value: string): number {
    const trimmed = value.trim().toLowerCase();
    if (trimmed.endsWith('ms')) return parseFloat(trimmed) / 1000;
    if (trimmed.endsWith('s')) return parseFloat(trimmed);
    return parseFloat(trimmed) / 1000; // assume ms
}

/**
 * Parse a CSS `cubic-bezier(…)` string into a 4-number tuple.
 * Falls back to ease-out if parsing fails.
 */
export function parseEasing(value: string): [number, number, number, number] {
    const fallback: [number, number, number, number] = [0.4, 0, 0.2, 1];
    const match = value.match(/cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
    if (!match) return fallback;
    return [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]), parseFloat(match[4])];
}

/** Parse a CSS length (e.g. "8px", "1rem") into a numeric px approximation */
export function parseOffset(value: string): number {
    const trimmed = value.trim().toLowerCase();
    if (trimmed.endsWith('rem')) return parseFloat(trimmed) * 16;
    if (trimmed.endsWith('em')) return parseFloat(trimmed) * 16;
    return parseFloat(trimmed); // assume px
}

// ---------------------------------------------------------------------------
// Preset builder
// ---------------------------------------------------------------------------

/**
 * Builds a complete set of transition presets from the resolved motion tokens.
 * Each preset produces `initial`, `animate`, `exit`, and `transition` objects
 * that can be spread directly onto `motion` components.
 */
export function buildPresets(tokens: Required<TokenMotion>): Record<PresetName, TransitionPreset> {
    const dNormal = parseDuration(tokens.durationNormal);
    const dSlow = parseDuration(tokens.durationSlow);
    const easeEnter = parseEasing(tokens.easingEnter);
    const easeExit = parseEasing(tokens.easingExit);
    const easeSpring = parseEasing(tokens.easingSpring);
    const scaleFrom = parseFloat(tokens.scaleFrom);
    const scaleTo = parseFloat(tokens.scaleTo);
    const slide = parseOffset(tokens.slideOffset);
    const opacityFrom = parseFloat(tokens.opacityFrom);

    return {
        /** Simple opacity fade */
        fade: {
            initial: { opacity: opacityFrom },
            animate: { opacity: 1 },
            exit: { opacity: opacityFrom },
            transition: { duration: dNormal, ease: easeEnter },
        },

        /** Fade in while sliding up */
        fadeUp: {
            initial: { opacity: opacityFrom, y: slide },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: opacityFrom, y: slide },
            transition: { duration: dNormal, ease: easeEnter },
        },

        /** Fade in while sliding down */
        fadeDown: {
            initial: { opacity: opacityFrom, y: -slide },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: opacityFrom, y: -slide },
            transition: { duration: dNormal, ease: easeExit },
        },

        /** Fade + scale (menus, popovers, tooltips) */
        fadeScale: {
            initial: { opacity: opacityFrom, scale: scaleFrom },
            animate: { opacity: 1, scale: 1 },
            exit: { opacity: opacityFrom, scale: scaleTo },
            transition: { duration: dNormal, ease: easeEnter },
        },

        /** Slide in from left (sidebars, drawers) */
        slideLeft: {
            initial: { x: -slide * 4, opacity: opacityFrom },
            animate: { x: 0, opacity: 1 },
            exit: { x: -slide * 4, opacity: opacityFrom },
            transition: { duration: dSlow, ease: easeEnter },
        },

        /** Slide in from right (sidebars, drawers) */
        slideRight: {
            initial: { x: slide * 4, opacity: opacityFrom },
            animate: { x: 0, opacity: 1 },
            exit: { x: slide * 4, opacity: opacityFrom },
            transition: { duration: dSlow, ease: easeExit },
        },

        /** Spring-like scale entrance (buttons, toasts, notifications) */
        scaleSpring: {
            initial: { scale: scaleFrom, opacity: opacityFrom },
            animate: { scale: 1, opacity: 1 },
            exit: { scale: scaleTo, opacity: opacityFrom },
            transition: { duration: dNormal, ease: easeSpring },
        },
    };
}
