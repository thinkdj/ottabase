// ---------------------------------------------------------------------------
// @ottabase/ottalayout – Layout Config Validators
//
// Type guards and merge helpers for LayoutConfig.
// Optional fields receive sensible defaults via mergeLayoutConfig().
// ---------------------------------------------------------------------------

import { pathPatternToRegex } from './resolver';
import type { LayoutConfig } from './types';
import { DEFAULT_LAYOUT, LAYOUT_FIELD_DEFAULTS } from './types';

// ── Valid value sets ───────────────────────────────────────────────────────

export const VALID_HEADERS = ['minimal', 'sidebar', 'topbar', 'none'] as const;
export const VALID_NAVIGATIONS = ['sidebar', 'topbar', 'drawer', 'none'] as const;
export const VALID_WIDTHS = ['xs', 'sm', 'md', 'lg', 'xl', 'full', 'fixed', 'fluid'] as const;
export const VALID_DENSITIES = ['compact', 'comfy', 'spacious'] as const;
export const VALID_SIDEBAR_WIDTHS = ['narrow', 'standard', 'wide'] as const;
export const VALID_CONTAINER_PADDINGS = ['none', 'sm', 'md', 'lg'] as const;
export const VALID_SIDEBAR_POSITIONS = ['left', 'right'] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

function isOneOf<T extends string>(value: unknown, valid: readonly T[]): value is T {
    return typeof value === 'string' && (valid as readonly string[]).includes(value);
}

/**
 * Merges a partial / unknown layout config with defaults, validating each field.
 * Preserves valid custom values and only defaults invalid/missing fields.
 * New optional fields are filled from LAYOUT_FIELD_DEFAULTS.
 */
export function mergeLayoutConfig(
    partial: Record<string, unknown> | Partial<LayoutConfig> | null | undefined,
    defaults: LayoutConfig = DEFAULT_LAYOUT,
): LayoutConfig {
    if (typeof partial !== 'object' || partial === null) return defaults;

    return {
        // Original required fields
        header: isOneOf(partial.header, VALID_HEADERS) ? partial.header : defaults.header,
        navigation: isOneOf(partial.navigation, VALID_NAVIGATIONS) ? partial.navigation : defaults.navigation,
        contentWidth: isOneOf(partial.contentWidth, VALID_WIDTHS) ? partial.contentWidth : defaults.contentWidth,
        footer: typeof partial.footer === 'boolean' ? partial.footer : defaults.footer,
        density: isOneOf(partial.density, VALID_DENSITIES) ? partial.density : defaults.density,

        // Extended optional fields
        headerSticky:
            typeof partial.headerSticky === 'boolean'
                ? partial.headerSticky
                : (defaults.headerSticky ?? LAYOUT_FIELD_DEFAULTS.headerSticky),
        sidebarWidth: isOneOf(partial.sidebarWidth, VALID_SIDEBAR_WIDTHS)
            ? partial.sidebarWidth
            : (defaults.sidebarWidth ?? LAYOUT_FIELD_DEFAULTS.sidebarWidth),
        sidebarCollapsible:
            typeof partial.sidebarCollapsible === 'boolean'
                ? partial.sidebarCollapsible
                : (defaults.sidebarCollapsible ?? LAYOUT_FIELD_DEFAULTS.sidebarCollapsible),
        sidebarPosition: isOneOf(partial.sidebarPosition, VALID_SIDEBAR_POSITIONS)
            ? partial.sidebarPosition
            : (defaults.sidebarPosition ?? LAYOUT_FIELD_DEFAULTS.sidebarPosition),
        containerPadding: isOneOf(partial.containerPadding, VALID_CONTAINER_PADDINGS)
            ? partial.containerPadding
            : (defaults.containerPadding ?? LAYOUT_FIELD_DEFAULTS.containerPadding),
        centerContent:
            typeof partial.centerContent === 'boolean'
                ? partial.centerContent
                : (defaults.centerContent ?? LAYOUT_FIELD_DEFAULTS.centerContent),
    };
}

/** Validates that a value is a valid LayoutConfig object. */
export function isValidLayoutConfig(val: unknown): val is LayoutConfig {
    if (typeof val !== 'object' || val === null) return false;

    const config = val as Record<string, unknown>;

    return (
        isOneOf(config.header, VALID_HEADERS) &&
        isOneOf(config.navigation, VALID_NAVIGATIONS) &&
        isOneOf(config.contentWidth, VALID_WIDTHS) &&
        isOneOf(config.density, VALID_DENSITIES) &&
        typeof config.footer === 'boolean'
    );
}

/**
 * Validates that a string is a valid path pattern for route matching.
 * Patterns can include `*` (single segment) and `**` (zero-or-more segments).
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
