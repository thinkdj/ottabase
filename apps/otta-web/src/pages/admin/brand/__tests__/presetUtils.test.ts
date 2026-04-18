import { describe, expect, it } from 'vitest';
import { expandPresetPreservingCursors, type ApiPresetShape } from '../presetUtils';

const mockPreset: ApiPresetShape = {
    name: 'verdant',
    colors: {
        light: {
            background: '0 0% 100%',
            foreground: '240 10% 4%',
            primary: '160 84% 39%',
        },
        dark: {
            background: '240 10% 4%',
            foreground: '0 0% 98%',
            primary: '160 84% 45%',
        },
    },
    typography: { heading: { fontFamily: 'Inter' } },
    spacing: { unit: '0.25rem' },
    radius: '0.5rem',
    shadows: {},
    motion: {},
};

describe('presetUtils', () => {
    describe('expandPresetPreservingCursors', () => {
        it('expands preset with full token structure', () => {
            const result = expandPresetPreservingCursors(mockPreset, null);

            expect(result.color).toBeDefined();
            expect(result.color).toHaveProperty('light');
            expect(result.color).toHaveProperty('dark');
            expect(result.typography).toBeDefined();
            expect(result.spacing).toBeDefined();
        });

        it('preserves cursors when switching preset', () => {
            const tokensWithCursors = JSON.stringify({
                cursors: { default: 'pointer', pointer: 'url("data:image/svg+xml,..."), pointer' },
            });

            const result = expandPresetPreservingCursors(mockPreset, tokensWithCursors);

            expect(result.cursors).toBeDefined();
            expect(result.cursors).toEqual({
                default: 'pointer',
                pointer: 'url("data:image/svg+xml,..."), pointer',
            });
        });

        it('preserves mode-split cursors when switching preset', () => {
            const tokensWithSplitCursors = JSON.stringify({
                cursors: {
                    light: { default: 'auto' },
                    dark: { default: 'crosshair' },
                },
            });

            const result = expandPresetPreservingCursors(mockPreset, tokensWithSplitCursors);

            expect(result.cursors).toBeDefined();
            expect(result.cursors).toEqual({
                light: { default: 'auto' },
                dark: { default: 'crosshair' },
            });
        });

        it('uses preset cursors when current tokens have none (artisan/funky style)', () => {
            const presetWithCursors = {
                ...mockPreset,
                cursors: { default: 'registry:arrow-crimson', pointer: 'registry:hand-crimson' },
            };
            const result = expandPresetPreservingCursors(presetWithCursors, '{}');

            expect(result.cursors).toEqual({ default: 'registry:arrow-crimson', pointer: 'registry:hand-crimson' });
        });

        it('handles malformed tokensJson gracefully', () => {
            const result = expandPresetPreservingCursors(mockPreset, '{ invalid }');

            expect(result.color).toBeDefined();
            expect(result.cursors).toBeUndefined();
        });
    });
});
