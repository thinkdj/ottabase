// ---------------------------------------------------------------------------
// Preview Theme Tests – Ensures buildPreviewTheme works without theme registry
// Tests the client-side preview functionality used in admin UI
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { buildPreviewTheme } from '../previewTheme';

describe('buildPreviewTheme', () => {
    describe('Basic Functionality', () => {
        it('builds theme from tokensJson with expanded preset', () => {
            const tokensJson = JSON.stringify({
                color: {
                    light: {
                        primary: '180 75% 55%',
                        background: '0 0% 100%',
                        foreground: '222.2 84% 4.9%',
                    },
                    dark: {
                        primary: '180 75% 65%',
                        background: '222.2 84% 4.9%',
                        foreground: '210 40% 98%',
                    },
                },
                typography: {
                    heading: { fontFamily: 'Inter' },
                    body: { fontFamily: 'Inter' },
                    handwriting: { fontFamily: 'Caveat' },
                },
            });

            const lightTheme = buildPreviewTheme({ tokensJson }, 'light');
            const darkTheme = buildPreviewTheme({ tokensJson }, 'dark');

            expect(lightTheme.colors.primary).toBe('180 75% 55%');
            expect(darkTheme.colors.primary).toBe('180 75% 65%');
            expect(lightTheme.typography.heading.fontFamily).toBe('Inter');
            expect(darkTheme.typography.heading.fontFamily).toBe('Inter');
        });

        it('works without tokensJson (uses defaults)', () => {
            const theme = buildPreviewTheme({}, 'light');

            expect(theme).toHaveProperty('colors');
            expect(theme).toHaveProperty('typography');
            expect(theme).toHaveProperty('spacing');
            expect(theme.name).toBe('custom');
        });

        it('uses default colors when tokensJson has no colors', () => {
            const tokensJson = JSON.stringify({
                typography: {
                    heading: { fontFamily: 'CustomFont' },
                },
            });

            const theme = buildPreviewTheme({ tokensJson }, 'light');

            expect(theme.colors).toHaveProperty('primary');
            expect(theme.colors).toHaveProperty('background');
            expect(theme.typography.heading.fontFamily).toBe('CustomFont');
        });

        it('handles malformed tokensJson gracefully', () => {
            const theme = buildPreviewTheme({ tokensJson: '{invalid json}' }, 'light');

            expect(theme).toHaveProperty('colors');
            expect(theme).toHaveProperty('typography');
        });

        it('preserves themePresetId in name when provided', () => {
            const tokensJson = JSON.stringify({
                color: {
                    light: { primary: '180 75% 55%' },
                },
            });

            const theme = buildPreviewTheme({ tokensJson, themePresetId: 'verdant' }, 'light');

            expect(theme.name).toBe('verdant');
        });
    });

    describe('Mode Selection', () => {
        it('reads light colors when mode is light', () => {
            const tokensJson = JSON.stringify({
                color: {
                    light: { primary: '180 75% 55%', background: '0 0% 100%' },
                    dark: { primary: '180 75% 65%', background: '222.2 84% 4.9%' },
                },
            });

            const theme = buildPreviewTheme({ tokensJson }, 'light');

            expect(theme.colors.primary).toBe('180 75% 55%');
            expect(theme.colors.background).toBe('0 0% 100%');
        });

        it('reads dark colors when mode is dark', () => {
            const tokensJson = JSON.stringify({
                color: {
                    light: { primary: '180 75% 55%', background: '0 0% 100%' },
                    dark: { primary: '180 75% 65%', background: '222.2 84% 4.9%' },
                },
            });

            const theme = buildPreviewTheme({ tokensJson }, 'dark');

            expect(theme.colors.primary).toBe('180 75% 65%');
            expect(theme.colors.background).toBe('222.2 84% 4.9%');
        });

        it('falls back to light colors when dark colors missing', () => {
            const tokensJson = JSON.stringify({
                color: {
                    light: { primary: '180 75% 55%' },
                },
            });

            const theme = buildPreviewTheme({ tokensJson }, 'dark');

            // Should fall back to light colors
            expect(theme.colors.primary).toBe('180 75% 55%');
        });
    });

    describe('Typography Handling', () => {
        it('preserves typography from tokensJson', () => {
            const tokensJson = JSON.stringify({
                typography: {
                    heading: { fontFamily: 'Playfair Display', url: 'https://fonts.example.com' },
                    body: { fontFamily: 'Open Sans' },
                    handwriting: { fontFamily: 'Pacifico' },
                },
            });

            const theme = buildPreviewTheme({ tokensJson }, 'light');

            expect(theme.typography.heading.fontFamily).toBe('Playfair Display');
            expect(theme.typography.heading.url).toBe('https://fonts.example.com');
            expect(theme.typography.body.fontFamily).toBe('Open Sans');
            expect(theme.typography.handwriting.fontFamily).toBe('Pacifico');
        });

        it('uses default typography when not provided', () => {
            const theme = buildPreviewTheme({}, 'light');

            expect(theme.typography.heading.fontFamily).toBe('Inter');
            expect(theme.typography.body.fontFamily).toBe('Inter');
            expect(theme.typography.handwriting.fontFamily).toBe('Caveat');
        });
    });

    describe('Design Tokens', () => {
        it('preserves spacing from tokensJson', () => {
            const tokensJson = JSON.stringify({
                spacing: {
                    section: '3rem',
                    card: '2rem',
                    element: '1rem',
                },
            });

            const theme = buildPreviewTheme({ tokensJson }, 'light');

            expect(theme.spacing.section).toBe('3rem');
            expect(theme.spacing.card).toBe('2rem');
            expect(theme.spacing.element).toBe('1rem');
        });

        it('preserves radius from tokensJson', () => {
            const tokensJson = JSON.stringify({
                radius: '1rem',
            });

            const theme = buildPreviewTheme({ tokensJson }, 'light');

            expect(theme.radius).toBe('1rem');
        });

        it('merges custom shadows with defaults', () => {
            const tokensJson = JSON.stringify({
                shadow: {
                    sm: '0 2px 4px rgba(0,0,0,0.1)',
                },
            });

            const theme = buildPreviewTheme({ tokensJson }, 'light');

            expect(theme.shadows.sm).toBe('0 2px 4px rgba(0,0,0,0.1)');
            expect(theme.shadows).toHaveProperty('md'); // Default should still exist
        });

        it('merges custom motion with defaults', () => {
            const tokensJson = JSON.stringify({
                motion: {
                    durationFast: '50ms',
                },
            });

            const theme = buildPreviewTheme({ tokensJson }, 'light');

            expect(theme.motion.durationFast).toBe('50ms');
            expect(theme.motion).toHaveProperty('durationNormal'); // Default should still exist
        });
    });

    describe('Admin Preview Use Case', () => {
        it('simulates realtime preview of unsaved changes', () => {
            // User selects verdant preset, customizes primary color
            const tokensJson = JSON.stringify({
                color: {
                    light: {
                        // Verdant base + custom primary
                        primary: '200 85% 60%', // Custom
                        background: '0 0% 100%',
                        foreground: '222.2 84% 4.9%',
                    },
                    dark: {
                        primary: '200 85% 70%', // Custom
                        background: '222.2 84% 4.9%',
                        foreground: '210 40% 98%',
                    },
                },
                typography: {
                    heading: { fontFamily: 'Inter' },
                    body: { fontFamily: 'Inter' },
                    handwriting: { fontFamily: 'Caveat' },
                },
            });

            const lightTheme = buildPreviewTheme({ tokensJson, themePresetId: 'verdant' }, 'light');
            const darkTheme = buildPreviewTheme({ tokensJson, themePresetId: 'verdant' }, 'dark');

            // Custom colors should be applied
            expect(lightTheme.colors.primary).toBe('200 85% 60%');
            expect(darkTheme.colors.primary).toBe('200 85% 70%');

            // Theme name reflects preset
            expect(lightTheme.name).toBe('verdant');
            expect(darkTheme.name).toBe('verdant');
        });

        it('works for saved brand kit with expanded preset', () => {
            // This is what tokensJson looks like after saving with preset
            const tokensJson = JSON.stringify({
                color: {
                    light: {
                        background: '0 0% 100%',
                        foreground: '222.2 84% 4.9%',
                        primary: '168 76% 42%',
                        'primary-foreground': '0 0% 100%',
                        // ... all other verdant colors
                    },
                    dark: {
                        background: '222.2 84% 4.9%',
                        foreground: '210 40% 98%',
                        primary: '168 76% 52%',
                        'primary-foreground': '222.2 84% 4.9%',
                        // ... all other verdant colors
                    },
                },
                typography: {
                    heading: { fontFamily: 'Inter' },
                    body: { fontFamily: 'Inter' },
                    handwriting: { fontFamily: 'Caveat' },
                },
                spacing: { section: '2rem', card: '1.5rem', element: '0.5rem' },
                radius: '0.5rem',
            });

            const theme = buildPreviewTheme({ tokensJson, themePresetId: 'verdant' }, 'light');

            expect(theme.colors.primary).toBe('168 76% 42%');
            expect(theme.colors).toHaveProperty('primary-foreground');
            expect(theme.typography.heading.fontFamily).toBe('Inter');
        });
    });

    describe('Legacy Colors Migration', () => {
        it('handles legacy colors field (pre-refactor format)', () => {
            // Old format: colors instead of color
            const tokensJson = JSON.stringify({
                colors: {
                    light: { primary: '180 75% 55%' },
                    dark: { primary: '180 75% 65%' },
                },
            });

            const theme = buildPreviewTheme({ tokensJson }, 'light');

            expect(theme.colors.primary).toBe('180 75% 55%');
        });
    });

    describe('No Registry Dependency', () => {
        it('does not require theme registry to be initialized', () => {
            // This test validates that buildPreviewTheme works without registerBuiltInThemes()
            const tokensJson = JSON.stringify({
                color: {
                    light: { primary: '180 75% 55%' },
                },
            });

            // Should not throw "No theme found" error
            expect(() => {
                buildPreviewTheme({ tokensJson, themePresetId: 'verdant' }, 'light');
            }).not.toThrow();
        });

        it('works in client-side environment without server-side registry', () => {
            // Simulates admin UI usage where no theme registry exists
            const theme = buildPreviewTheme({ tokensJson: null, themePresetId: 'nonexistent' }, 'light');

            // Should return valid theme with defaults
            expect(theme).toHaveProperty('colors');
            expect(theme).toHaveProperty('typography');
            expect(theme.name).toBe('nonexistent');
        });
    });
});
