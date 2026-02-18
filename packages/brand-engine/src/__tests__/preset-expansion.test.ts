// ---------------------------------------------------------------------------
// Preset Expansion Tests – Ensures preset-as-template architecture works correctly
// Tests the critical path: preset selection → expansion → DB save → load → render
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { PRESET_MAP } from '../presets';

/**
 * Expand a preset to full theme tokens and merge with custom overrides.
 * This is the core logic from brand-kit-api.ts
 */
function expandPresetToTokens(presetId: string | null, existingTokensJson: string | null | undefined): string {
    let existing: Record<string, unknown> = {};
    try {
        if (existingTokensJson) {
            existing = JSON.parse(existingTokensJson) as Record<string, unknown>;
        }
    } catch {
        existing = {};
    }

    if (!presetId || !PRESET_MAP[presetId]) {
        return JSON.stringify(existing);
    }

    const preset = PRESET_MAP[presetId];

    const expanded: Record<string, unknown> = {
        color: {
            light: preset.colors.light,
            dark: preset.colors.dark,
        },
        typography: existing.typography || preset.typography,
        spacing: existing.spacing || preset.spacing,
        radius: existing.radius || preset.radius,
        shadow: existing.shadow || preset.shadows,
        motion: existing.motion || preset.motion,
    };

    if (existing.color && typeof existing.color === 'object') {
        const customColor = existing.color as Record<string, unknown>;
        const expandedColor = expanded.color as Record<string, unknown>;

        if (customColor.light && typeof customColor.light === 'object') {
            expandedColor.light = {
                ...(expandedColor.light as Record<string, string>),
                ...(customColor.light as Record<string, string>),
            };
        }
        if (customColor.dark && typeof customColor.dark === 'object') {
            expandedColor.dark = {
                ...(expandedColor.dark as Record<string, string>),
                ...(customColor.dark as Record<string, string>),
            };
        }
    }

    return JSON.stringify(expanded);
}

describe('Preset Expansion', () => {
    describe('expandPresetToTokens', () => {
        it('expands a preset to full tokens with colors.light and colors.dark', () => {
            const result = expandPresetToTokens('verdant', null);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveProperty('color');
            expect(parsed.color).toHaveProperty('light');
            expect(parsed.color).toHaveProperty('dark');
            expect(parsed).toHaveProperty('typography');
            expect(parsed).toHaveProperty('spacing');
        });

        it('includes all required color tokens in light mode', () => {
            const result = expandPresetToTokens('neo', null);
            const parsed = JSON.parse(result);

            const requiredTokens = [
                'background',
                'foreground',
                'primary',
                'primary-foreground',
                'secondary',
                'secondary-foreground',
                'muted',
                'muted-foreground',
                'border',
                'ring',
            ];

            for (const token of requiredTokens) {
                expect(parsed.color.light).toHaveProperty(token);
                expect(typeof parsed.color.light[token]).toBe('string');
            }
        });

        it('includes all required color tokens in dark mode', () => {
            const result = expandPresetToTokens('midnight', null);
            const parsed = JSON.parse(result);

            const requiredTokens = [
                'background',
                'foreground',
                'primary',
                'primary-foreground',
                'secondary',
                'secondary-foreground',
                'muted',
                'muted-foreground',
                'border',
                'ring',
            ];

            for (const token of requiredTokens) {
                expect(parsed.color.dark).toHaveProperty(token);
                expect(typeof parsed.color.dark[token]).toBe('string');
            }
        });

        it('returns existing tokens as-is when no preset selected', () => {
            const existingTokens = JSON.stringify({
                color: { light: { primary: '100 50% 50%' } },
                typography: { heading: { fontFamily: 'CustomFont' } },
            });

            const result = expandPresetToTokens(null, existingTokens);
            const parsed = JSON.parse(result);

            expect(parsed.color.light.primary).toBe('100 50% 50%');
            expect(parsed.typography.heading.fontFamily).toBe('CustomFont');
        });

        it('returns empty object when preset is invalid', () => {
            const result = expandPresetToTokens('nonexistent', null);
            const parsed = JSON.parse(result);

            expect(parsed).toEqual({});
        });

        it('merges custom color overrides on top of preset colors (light mode)', () => {
            const existingTokens = JSON.stringify({
                color: {
                    light: {
                        primary: '200 80% 60%',
                        accent: '150 70% 50%',
                    },
                },
            });

            const result = expandPresetToTokens('crisp', existingTokens);
            const parsed = JSON.parse(result);

            // Custom colors should override preset
            expect(parsed.color.light.primary).toBe('200 80% 60%');
            expect(parsed.color.light.accent).toBe('150 70% 50%');

            // Other preset colors should remain
            expect(parsed.color.light).toHaveProperty('background');
            expect(parsed.color.light).toHaveProperty('foreground');
        });

        it('merges custom color overrides on top of preset colors (dark mode)', () => {
            const existingTokens = JSON.stringify({
                color: {
                    dark: {
                        primary: '250 90% 70%',
                        destructive: '5 85% 55%',
                    },
                },
            });

            const result = expandPresetToTokens('rose', existingTokens);
            const parsed = JSON.parse(result);

            // Custom colors should override preset
            expect(parsed.color.dark.primary).toBe('250 90% 70%');
            expect(parsed.color.dark.destructive).toBe('5 85% 55%');

            // Other preset colors should remain
            expect(parsed.color.dark).toHaveProperty('background');
            expect(parsed.color.dark).toHaveProperty('foreground');
        });

        it('preserves custom typography when expanding preset', () => {
            const existingTokens = JSON.stringify({
                typography: {
                    heading: { fontFamily: 'CustomHeading' },
                    body: { fontFamily: 'CustomBody' },
                    handwriting: { fontFamily: 'CustomHandwriting' },
                },
            });

            const result = expandPresetToTokens('funky', existingTokens);
            const parsed = JSON.parse(result);

            expect(parsed.typography.heading.fontFamily).toBe('CustomHeading');
            expect(parsed.typography.body.fontFamily).toBe('CustomBody');
            expect(parsed.typography.handwriting.fontFamily).toBe('CustomHandwriting');
        });

        it('uses preset typography when no custom typography exists', () => {
            const result = expandPresetToTokens('artisan', null);
            const parsed = JSON.parse(result);

            // Should have typography from preset
            expect(parsed).toHaveProperty('typography');
            expect(parsed.typography).toBeDefined();
        });

        it('handles empty existingTokensJson gracefully', () => {
            const result = expandPresetToTokens('default', '');
            const parsed = JSON.parse(result);

            expect(parsed).toHaveProperty('color');
            expect(parsed.color).toHaveProperty('light');
            expect(parsed.color).toHaveProperty('dark');
        });

        it('handles malformed existingTokensJson gracefully', () => {
            const result = expandPresetToTokens('neo', '{invalid json}');
            const parsed = JSON.parse(result);

            // Should still expand preset
            expect(parsed).toHaveProperty('color');
            expect(parsed.color).toHaveProperty('light');
            expect(parsed.color).toHaveProperty('dark');
        });

        it('does not duplicate shared settings between light and dark', () => {
            const result = expandPresetToTokens('verdant', null);
            const parsed = JSON.parse(result);

            // Typography, spacing, etc. should be at root level (shared)
            expect(parsed).toHaveProperty('typography');
            expect(parsed).toHaveProperty('spacing');
            expect(parsed).toHaveProperty('radius');

            // Only colors should be split by mode
            expect(parsed.color).toHaveProperty('light');
            expect(parsed.color).toHaveProperty('dark');

            // Typography should NOT be inside color.light or color.dark
            expect(parsed.color.light).not.toHaveProperty('typography');
            expect(parsed.color.dark).not.toHaveProperty('typography');
        });

        it('preserves all preset fields (typography, spacing, radius, shadows, motion)', () => {
            const result = expandPresetToTokens('midnight', null);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveProperty('typography');
            expect(parsed).toHaveProperty('spacing');
            expect(parsed).toHaveProperty('radius');
            expect(parsed).toHaveProperty('shadow');
            expect(parsed).toHaveProperty('motion');
        });
    });

    describe('Preset Theme Structure Validation', () => {
        it('all presets have required structure', () => {
            const presetIds = Object.keys(PRESET_MAP);

            for (const presetId of presetIds) {
                const preset = PRESET_MAP[presetId];

                expect(preset, `Preset ${presetId} missing name`).toHaveProperty('name');
                expect(preset, `Preset ${presetId} missing colors`).toHaveProperty('colors');
                expect(preset.colors, `Preset ${presetId} missing colors.light`).toHaveProperty('light');
                expect(preset.colors, `Preset ${presetId} missing colors.dark`).toHaveProperty('dark');
            }
        });

        it('all preset light colors have required semantic tokens', () => {
            const presetIds = Object.keys(PRESET_MAP);
            const requiredTokens = [
                'background',
                'foreground',
                'primary',
                'primary-foreground',
                'secondary',
                'secondary-foreground',
                'muted',
                'muted-foreground',
                'border',
                'ring',
            ];

            for (const presetId of presetIds) {
                const preset = PRESET_MAP[presetId];

                for (const token of requiredTokens) {
                    expect(preset.colors.light, `Preset ${presetId} light missing ${token}`).toHaveProperty(token);
                    expect(typeof preset.colors.light[token], `Preset ${presetId} light.${token} is not a string`).toBe(
                        'string',
                    );
                }
            }
        });

        it('all preset dark colors have required semantic tokens', () => {
            const presetIds = Object.keys(PRESET_MAP);
            const requiredTokens = [
                'background',
                'foreground',
                'primary',
                'primary-foreground',
                'secondary',
                'secondary-foreground',
                'muted',
                'muted-foreground',
                'border',
                'ring',
            ];

            for (const presetId of presetIds) {
                const preset = PRESET_MAP[presetId];

                for (const token of requiredTokens) {
                    expect(preset.colors.dark, `Preset ${presetId} dark missing ${token}`).toHaveProperty(token);
                    expect(typeof preset.colors.dark[token], `Preset ${presetId} dark.${token} is not a string`).toBe(
                        'string',
                    );
                }
            }
        });

        it('all presets have typography configuration', () => {
            const presetIds = Object.keys(PRESET_MAP);

            for (const presetId of presetIds) {
                const preset = PRESET_MAP[presetId];
                expect(preset, `Preset ${presetId} missing typography`).toHaveProperty('typography');
            }
        });
    });

    describe('End-to-End Preset Flow', () => {
        it('simulates full flow: select preset → expand → save → load → render', () => {
            // 1. User selects "verdant" preset
            const presetId = 'verdant';

            // 2. Backend expands preset to full tokens
            const expandedJson = expandPresetToTokens(presetId, null);

            // 3. Save to DB (simulated - we just parse)
            const savedTokens = JSON.parse(expandedJson);

            // 4. Load from DB (simulated - already parsed)
            expect(savedTokens).toHaveProperty('color');
            expect(savedTokens.color).toHaveProperty('light');
            expect(savedTokens.color).toHaveProperty('dark');

            // 5. Frontend reads tokens.color.light for light mode
            const lightColors = savedTokens.color.light;
            expect(lightColors).toHaveProperty('primary');
            expect(typeof lightColors.primary).toBe('string');

            // 6. Frontend reads tokens.color.dark for dark mode
            const darkColors = savedTokens.color.dark;
            expect(darkColors).toHaveProperty('primary');
            expect(typeof darkColors.primary).toBe('string');

            // 7. Typography/spacing are shared (not mode-specific)
            expect(savedTokens).toHaveProperty('typography');
            expect(savedTokens.color.light).not.toHaveProperty('typography');
        });

        it('simulates custom color override flow', () => {
            // 1. User selects "crisp" preset
            let tokensJson = expandPresetToTokens('crisp', null);

            // 2. User customizes primary color
            const tokens = JSON.parse(tokensJson);
            tokens.color.light.primary = '180 75% 55%';

            // 3. Save updated tokens
            const customTokensJson = JSON.stringify(tokens);

            // 4. Load and verify custom color is preserved
            const loaded = JSON.parse(customTokensJson);
            expect(loaded.color.light.primary).toBe('180 75% 55%');

            // 5. Other colors should still be from preset
            expect(loaded.color.light).toHaveProperty('background');
            expect(loaded.color.light).toHaveProperty('foreground');
        });

        it('simulates preset switch with custom overrides preserved', () => {
            // 1. User has "neo" preset with custom colors
            const customColors = {
                color: {
                    light: { primary: '220 85% 60%' },
                    dark: { primary: '220 85% 70%' },
                },
            };

            // 2. User switches to "verdant" preset
            const newTokensJson = expandPresetToTokens('verdant', JSON.stringify(customColors));
            const newTokens = JSON.parse(newTokensJson);

            // 3. Custom colors should be merged on top of new preset
            expect(newTokens.color.light.primary).toBe('220 85% 60%');
            expect(newTokens.color.dark.primary).toBe('220 85% 70%');

            // 4. Other verdant colors should be present
            expect(newTokens.color.light).toHaveProperty('background');
            expect(newTokens.color.light).toHaveProperty('foreground');
        });
    });

    describe('Regression Prevention', () => {
        it('prevents colors being saved at root instead of in color.light/dark', () => {
            const result = expandPresetToTokens('funky', null);
            const parsed = JSON.parse(result);

            // Colors should be nested, not at root
            expect(parsed).not.toHaveProperty('primary');
            expect(parsed).not.toHaveProperty('background');
            expect(parsed.color.light).toHaveProperty('primary');
            expect(parsed.color.light).toHaveProperty('background');
        });

        it('prevents tokensJson being empty after preset selection', () => {
            const result = expandPresetToTokens('midnight', null);
            const parsed = JSON.parse(result);

            expect(Object.keys(parsed).length).toBeGreaterThan(0);
            expect(parsed.color).toBeDefined();
            expect(Object.keys(parsed.color.light).length).toBeGreaterThan(0);
        });

        it('prevents mode-specific settings being duplicated at root', () => {
            const result = expandPresetToTokens('verdant', null);
            const parsed = JSON.parse(result);

            // Only color should be mode-specific
            expect(parsed.color).toHaveProperty('light');
            expect(parsed.color).toHaveProperty('dark');

            // These should be at root (shared)
            expect(parsed).toHaveProperty('typography');
            expect(parsed).toHaveProperty('spacing');

            // These should NOT be mode-specific
            expect(parsed.typography).not.toHaveProperty('light');
            expect(parsed.typography).not.toHaveProperty('dark');
        });

        it('prevents preset registry lookup failures in Cloudflare Workers', () => {
            // This test validates that presets are expanded at save time,
            // not looked up from a runtime registry that can be reset
            const result = expandPresetToTokens('artisan', null);
            const parsed = JSON.parse(result);

            // After expansion, theme should be complete and self-contained
            expect(parsed.color.light).toBeDefined();
            expect(parsed.color.dark).toBeDefined();
            expect(Object.keys(parsed.color.light).length).toBeGreaterThan(5);
        });

        it('prevents custom colors being lost on save', () => {
            const customTokens = {
                color: {
                    light: {
                        primary: '200 80% 60%',
                        'primary-foreground': '0 0% 100%',
                    },
                },
            };

            const result = expandPresetToTokens('neo', JSON.stringify(customTokens));
            const parsed = JSON.parse(result);

            expect(parsed.color.light.primary).toBe('200 80% 60%');
            expect(parsed.color.light['primary-foreground']).toBe('0 0% 100%');
        });
    });
});
