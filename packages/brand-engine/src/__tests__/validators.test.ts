import { DEFAULT_LAYOUT, isValidLayoutConfig, isValidPathPattern, mergeLayoutConfig } from '@ottabase/ottalayout';
import { describe, expect, it } from 'vitest';
import { isValidBrandTheme, isValidJSON, isValidTokenColors, safeParseJSON } from '../validators';

// ===========================================================================
// mergeLayoutConfig
// ===========================================================================

describe('mergeLayoutConfig', () => {
    it('returns defaults when partial is null', () => {
        expect(mergeLayoutConfig(null)).toEqual(DEFAULT_LAYOUT);
    });

    it('returns defaults when partial is undefined', () => {
        expect(mergeLayoutConfig(undefined)).toEqual(DEFAULT_LAYOUT);
    });

    it('preserves valid partial values', () => {
        const partial = { header: 'minimal', density: 'compact' } as unknown;
        const result = mergeLayoutConfig(partial as any);
        expect(result.header).toBe('minimal');
        expect(result.density).toBe('compact');
        expect(result.navigation).toBe(DEFAULT_LAYOUT.navigation);
        expect(result.contentWidth).toBe(DEFAULT_LAYOUT.contentWidth);
        expect(result.footer).toBe(DEFAULT_LAYOUT.footer);
    });

    it('defaults invalid header to default', () => {
        const result = mergeLayoutConfig({ header: 'invalid' } as any);
        expect(result.header).toBe(DEFAULT_LAYOUT.header);
    });

    it('defaults invalid footer to default', () => {
        const result = mergeLayoutConfig({ footer: 'yes' } as any);
        expect(result.footer).toBe(DEFAULT_LAYOUT.footer);
    });

    it('merges all valid partial fields', () => {
        const partial = {
            header: 'none',
            navigation: 'drawer',
            contentWidth: 'full',
            footer: false,
            density: 'compact',
        };
        const result = mergeLayoutConfig(partial);
        // Check all required fields match partial
        expect(result.header).toBe('none');
        expect(result.navigation).toBe('drawer');
        expect(result.contentWidth).toBe('full');
        expect(result.footer).toBe(false);
        expect(result.density).toBe('compact');
        // Extended fields get defaults
        expect(result.headerSticky).toBeDefined();
        expect(result.sidebarWidth).toBeDefined();
    });
});

// ===========================================================================
// isValidTokenColors
// ===========================================================================

describe('isValidTokenColors', () => {
    it('accepts object with string values', () => {
        expect(isValidTokenColors({ primary: '0 100% 50%', background: '0 0% 100%' })).toBe(true);
    });

    it('accepts object with undefined values', () => {
        expect(isValidTokenColors({ primary: '0 0% 0%', custom: undefined })).toBe(true);
    });

    it('rejects null', () => {
        expect(isValidTokenColors(null)).toBe(false);
    });

    it('rejects arrays', () => {
        expect(isValidTokenColors([])).toBe(false);
    });

    it('rejects object with non-string values', () => {
        expect(isValidTokenColors({ primary: 123 })).toBe(false);
        expect(isValidTokenColors({ primary: null })).toBe(false);
    });
});

// ===========================================================================
// isValidLayoutConfig
// ===========================================================================

describe('isValidLayoutConfig', () => {
    it('accepts full valid config', () => {
        const config = {
            header: 'topbar',
            navigation: 'sidebar',
            contentWidth: 'fluid',
            footer: true,
            density: 'comfy',
        };
        expect(isValidLayoutConfig(config)).toBe(true);
    });

    it('rejects config with invalid header', () => {
        expect(isValidLayoutConfig({ ...DEFAULT_LAYOUT, header: 'invalid' })).toBe(false);
    });

    it('rejects config with missing footer', () => {
        expect(isValidLayoutConfig({ ...DEFAULT_LAYOUT, footer: undefined })).toBe(false);
    });

    it('rejects non-object', () => {
        expect(isValidLayoutConfig(null)).toBe(false);
        expect(isValidLayoutConfig('string')).toBe(false);
    });
});

// ===========================================================================
// isValidBrandTheme
// ===========================================================================

describe('isValidBrandTheme', () => {
    it('accepts theme with name and tokens', () => {
        expect(isValidBrandTheme({ name: 'test', tokens: { color: { light: {}, dark: {} } } })).toBe(true);
    });

    it('rejects missing name', () => {
        expect(isValidBrandTheme({ tokens: {} })).toBe(false);
    });

    it('rejects missing tokens', () => {
        expect(isValidBrandTheme({ name: 'test' })).toBe(false);
    });

    it('rejects null tokens', () => {
        expect(isValidBrandTheme({ name: 'test', tokens: null })).toBe(false);
    });
});

// ===========================================================================
// isValidPathPattern
// ===========================================================================

describe('isValidPathPattern', () => {
    it('accepts simple paths', () => {
        expect(isValidPathPattern('/')).toBe(true);
        expect(isValidPathPattern('/about')).toBe(true);
        expect(isValidPathPattern('/foo/bar')).toBe(true);
    });

    it('accepts wildcard patterns', () => {
        expect(isValidPathPattern('/*')).toBe(true);
        expect(isValidPathPattern('/docs/**')).toBe(true);
        expect(isValidPathPattern('/user/*/profile')).toBe(true);
    });

    it('accepts patterns with regex metacharacters (literal match)', () => {
        expect(isValidPathPattern('/foo.bar')).toBe(true);
        expect(isValidPathPattern('/path(with)parens')).toBe(true);
    });

    it('rejects empty string', () => {
        expect(isValidPathPattern('')).toBe(false);
    });

    it('rejects non-string', () => {
        expect(isValidPathPattern(null as unknown as string)).toBe(false);
        expect(isValidPathPattern(123 as unknown as string)).toBe(false);
    });
});

// ===========================================================================
// isValidJSON
// ===========================================================================

describe('isValidJSON', () => {
    it('accepts valid JSON', () => {
        expect(isValidJSON('{}')).toBe(true);
        expect(isValidJSON('{"a":1}')).toBe(true);
        expect(isValidJSON('[]')).toBe(true);
    });

    it('rejects invalid JSON', () => {
        expect(isValidJSON('{')).toBe(false);
        expect(isValidJSON('not json')).toBe(false);
    });
});

// ===========================================================================
// safeParseJSON
// ===========================================================================

describe('safeParseJSON', () => {
    it('parses valid JSON', () => {
        expect(safeParseJSON('{"a":1}')).toEqual({ a: 1 });
    });

    it('returns fallback for null/undefined/empty', () => {
        expect(safeParseJSON(null)).toEqual({});
        expect(safeParseJSON(undefined)).toEqual({});
        expect(safeParseJSON('')).toEqual({});
    });

    it('returns custom fallback when provided', () => {
        expect(safeParseJSON(null, { default: true })).toEqual({ default: true });
    });

    it('returns fallback on parse error', () => {
        expect(safeParseJSON('invalid')).toEqual({});
        expect(safeParseJSON('{', { fallback: 42 })).toEqual({ fallback: 42 });
    });
});
