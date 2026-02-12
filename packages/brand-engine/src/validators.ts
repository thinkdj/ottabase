// ---------------------------------------------------------------------------
// Brand Engine – Validators
// Type guards and validation helpers for brand configuration data
// ---------------------------------------------------------------------------

import type { LayoutConfig } from './layout';
import { DEFAULT_LAYOUT } from './layout';
import { pathPatternToRegex } from './layouts/resolver';
import type { TokenColors } from './tokens';
import type { BrandTheme } from './theme';

const VALID_HEADERS = ['minimal', 'sidebar', 'topbar', 'none'] as const;
const VALID_NAVIGATIONS = ['sidebar', 'topbar', 'drawer'] as const;
const VALID_WIDTHS = ['fixed', 'fluid', 'full'] as const;
const VALID_DENSITIES = ['compact', 'comfy'] as const;

/**
 * Merges partial layout config with defaults, validating each field.
 * Preserves valid custom values and only defaults invalid/missing fields.
 */
export function mergeLayoutConfig(
    partial: Record<string, unknown> | null | undefined,
    defaults: LayoutConfig = DEFAULT_LAYOUT,
): LayoutConfig {
    if (typeof partial !== 'object' || partial === null) return defaults;
    return {
        header: VALID_HEADERS.includes(partial.header as (typeof VALID_HEADERS)[number])
            ? (partial.header as LayoutConfig['header'])
            : defaults.header,
        navigation: VALID_NAVIGATIONS.includes(partial.navigation as (typeof VALID_NAVIGATIONS)[number])
            ? (partial.navigation as LayoutConfig['navigation'])
            : defaults.navigation,
        contentWidth: VALID_WIDTHS.includes(partial.contentWidth as (typeof VALID_WIDTHS)[number])
            ? (partial.contentWidth as LayoutConfig['contentWidth'])
            : defaults.contentWidth,
        footer: typeof partial.footer === 'boolean' ? partial.footer : defaults.footer,
        density: VALID_DENSITIES.includes(partial.density as (typeof VALID_DENSITIES)[number])
            ? (partial.density as LayoutConfig['density'])
            : defaults.density,
    };
}

/**
 * Validates that a value is a valid TokenColors object (HSL strings).
 */
export function isValidTokenColors(val: unknown): val is TokenColors {
    if (typeof val !== 'object' || val === null || Array.isArray(val)) {
        return false;
    }

    const obj = val as Record<string, unknown>;

    // Check that all properties are strings (HSL color values) or undefined
    return Object.values(obj).every((v) => typeof v === 'string' || v === undefined);
}

/**
 * Validates that a value is a valid LayoutConfig object.
 */
export function isValidLayoutConfig(val: unknown): val is LayoutConfig {
    if (typeof val !== 'object' || val === null) {
        return false;
    }

    const config = val as Record<string, unknown>;

    return (
        VALID_HEADERS.includes(config.header as (typeof VALID_HEADERS)[number]) &&
        VALID_NAVIGATIONS.includes(config.navigation as (typeof VALID_NAVIGATIONS)[number]) &&
        VALID_WIDTHS.includes(config.contentWidth as (typeof VALID_WIDTHS)[number]) &&
        VALID_DENSITIES.includes(config.density as (typeof VALID_DENSITIES)[number]) &&
        typeof config.footer === 'boolean'
    );
}

/**
 * Validates that a value is a valid BrandTheme object.
 */
export function isValidBrandTheme(val: unknown): val is BrandTheme {
    if (typeof val !== 'object' || val === null) {
        return false;
    }

    const obj = val as Record<string, unknown>;

    return typeof obj.name === 'string' && typeof obj.tokens === 'object' && obj.tokens !== null;
}

/**
 * Validates that a string is a valid path pattern for route matching.
 * Patterns can include * (single segment) and ** (zero-or-more segments).
 * Uses pathPatternToRegex so validation matches runtime behavior.
 */
export function isValidPathPattern(pattern: string): boolean {
    if (!pattern || typeof pattern !== 'string') return false;
    try {
        pathPatternToRegex(pattern);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validates JSON string can be parsed without errors.
 */
export function isValidJSON(json: string): boolean {
    try {
        JSON.parse(json);
        return true;
    } catch {
        return false;
    }
}

/**
 * Safely parses JSON with fallback to empty object.
 */
export function safeParseJSON<T = Record<string, unknown>>(json: string | null | undefined, fallback?: T): T {
    if (!json) return (fallback ?? {}) as T;

    try {
        return JSON.parse(json) as T;
    } catch {
        return (fallback ?? {}) as T;
    }
}
