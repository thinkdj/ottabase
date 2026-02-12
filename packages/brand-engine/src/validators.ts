// ---------------------------------------------------------------------------
// Brand Engine – Validators
// Type guards and validation helpers for brand configuration data
// ---------------------------------------------------------------------------

import type { LayoutConfig } from './layout';
import type { TokenColors } from './tokens';
import type { BrandTheme } from './theme';

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

    const validHeaders = ['minimal', 'sidebar', 'topbar', 'none'];
    const validNavigations = ['sidebar', 'topbar', 'drawer'];
    const validWidths = ['fixed', 'fluid', 'full'];
    const validDensities = ['compact', 'comfy'];

    return (
        validHeaders.includes(config.header as string) &&
        validNavigations.includes(config.navigation as string) &&
        validWidths.includes(config.contentWidth as string) &&
        validDensities.includes(config.density as string) &&
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
 */
export function isValidPathPattern(pattern: string): boolean {
    if (!pattern || typeof pattern !== 'string') {
        return false;
    }

    try {
        // Test if pattern can be converted to regex without errors
        const escaped = pattern
            .replace(/\*\*/g, '<<GLOB>>')
            .replace(/\*/g, '[^/]+')
            .replace(/<<GLOB>>/g, '.*');
        // eslint-disable-next-line no-new
        new RegExp(`^${escaped}$`);
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
