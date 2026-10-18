// Design System v1: the verdant defaults, the fixed status language, and the
// derivation that keeps a kit's hover/active/text ladder on the kit's own hue.
import { describe, expect, it } from 'vitest';
import { midHslLightness, parseHslChannels, shiftHslLightness } from '../colors';
import { DEFAULT_COLORS_DARK, DEFAULT_COLORS_LIGHT, DEFAULT_TYPOGRAPHY } from '../defaults';
import { PRESET_MAP } from '../presets';
import { deriveColorExtras, resolveColors } from '../resolve-core';
import type { TokenColors } from '../tokens';

const TONES = ['success', 'warning', 'destructive', 'info', 'smoke', 'neutral'] as const;

describe('Design System v1 defaults', () => {
    it('carries every status tone as solid, foreground, text, soft and line in both modes', () => {
        for (const palette of [DEFAULT_COLORS_LIGHT, DEFAULT_COLORS_DARK]) {
            for (const tone of TONES) {
                for (const suffix of ['', '-foreground', '-text', '-soft', '-line']) {
                    expect(palette[`${tone}${suffix}`], `${tone}${suffix}`).toMatch(/^[\d.]+ [\d.]+% [\d.]+%$/);
                }
            }
        }
    });

    it('ships the text ladder, the primary stops and eight chart slots', () => {
        for (const key of [
            'subtle-foreground',
            'faint-foreground',
            'primary-hover',
            'primary-active',
            'accent-line',
            'chart-6',
            'chart-7',
            'chart-8',
            'chart-grid',
            'chart-axis',
            'chart-label',
        ]) {
            expect(DEFAULT_COLORS_LIGHT[key], key).toBeDefined();
            expect(DEFAULT_COLORS_DARK[key], key).toBeDefined();
        }
    });

    it('reads in Inter and copies in JetBrains Mono', () => {
        expect(DEFAULT_TYPOGRAPHY.heading.fontFamily).toBe('Inter');
        expect(DEFAULT_TYPOGRAPHY.body.fontFamily).toBe('Inter');
        expect(DEFAULT_TYPOGRAPHY.mono.fontFamily).toBe('JetBrains Mono');
        expect(DEFAULT_TYPOGRAPHY.mono.url).toContain('JetBrains+Mono');
    });

    it('is the verdant preset, token for token', () => {
        const verdant = PRESET_MAP.verdant;
        expect(verdant.colors.light).toEqual(DEFAULT_COLORS_LIGHT);
        expect(verdant.colors.dark).toEqual(DEFAULT_COLORS_DARK);
    });
});

describe('HSL channel helpers', () => {
    it('parses channels with and without an alpha', () => {
        expect(parseHslChannels('156 52% 34%')).toEqual({ h: 156, s: 52, l: 34, alpha: undefined });
        expect(parseHslChannels('156 52% 34% / 0.12')).toEqual({ h: 156, s: 52, l: 34, alpha: '0.12' });
        expect(parseHslChannels('#2a8460')).toBeNull();
    });

    it('shifts lightness, clamps, and keeps the alpha', () => {
        expect(shiftHslLightness('156 52% 34%', -6)).toBe('156 52% 28%');
        expect(shiftHslLightness('156 52% 97% / 0.5', 10)).toBe('156 52% 100% / 0.5');
        expect(shiftHslLightness('oklch(0.5 0.1 150)', -6)).toBe('oklch(0.5 0.1 150)');
    });

    it('takes the lightness midpoint with the first value hue and saturation', () => {
        expect(midHslLightness('140 10% 40%', '150 20% 10%')).toBe('140 10% 25%');
    });
});

describe('deriveColorExtras', () => {
    it('derives hover/active from primary, darker on light and brighter on dark', () => {
        const light = deriveColorExtras({ primary: '221 83% 53%' }, 'light');
        expect(light['primary-hover']).toBe('221 83% 47%');
        expect(light['primary-active']).toBe('221 83% 41%');
        const dark = deriveColorExtras({ primary: '221 83% 53%' }, 'dark');
        expect(dark['primary-hover']).toBe('221 83% 59%');
    });

    it('never overrides a value the theme spells out', () => {
        const out = deriveColorExtras({ primary: '221 83% 53%', 'primary-hover': '0 0% 0%' }, 'light');
        expect(out['primary-hover']).toBe('0 0% 0%');
    });

    it('derives the text ladder between foreground and muted-foreground', () => {
        const out = deriveColorExtras({ foreground: '222 84% 5%', 'muted-foreground': '215 16% 47%' }, 'light');
        expect(out['subtle-foreground']).toBe('215 16% 26%');
        expect(out['faint-foreground']).toBe('215 16% 62%');
    });

    it('is a no-op for a palette that defines nothing to derive from', () => {
        expect(deriveColorExtras({ background: '0 0% 100%' }, 'light')).toEqual({ background: '0 0% 100%' });
    });
});

describe('resolveColors with a partial kit', () => {
    it('keeps the extras on the kit hue instead of the verdant default', () => {
        const kit = { primary: '221 83% 53%' } as TokenColors;
        const resolved = resolveColors({ color: { light: kit, dark: {} as TokenColors } }, 'light');
        expect(resolved['primary-hover']).toBe('221 83% 47%');
        // Tones are a fixed language: they come from the defaults untouched.
        expect(resolved['success-text']).toBe(DEFAULT_COLORS_LIGHT['success-text']);
    });
});
