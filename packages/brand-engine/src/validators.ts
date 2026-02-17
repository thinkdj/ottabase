// ---------------------------------------------------------------------------
// Brand Engine – Validators
// Type guards and validation helpers for brand configuration data.
// Layout-specific validators delegate to @ottabase/ottalayout.
// ---------------------------------------------------------------------------

import type { BrandTheme } from './theme';
import type { TokenColors } from './tokens';

// Layout-specific validators live in @ottabase/ottalayout (canonical source).
// Import directly: import { mergeLayoutConfig, isValidLayoutConfig, isValidPathPattern } from '@ottabase/ottalayout';

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
