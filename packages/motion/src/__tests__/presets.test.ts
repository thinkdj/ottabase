import { describe, expect, it } from 'vitest';
import { DEFAULT_MOTION } from '@ottabase/brand-engine';
import type { TokenMotion } from '@ottabase/brand-engine';
import { buildPresets, parseDuration, parseEasing, parseOffset } from '../presets';

// ---------------------------------------------------------------------------
// parseDuration
// ---------------------------------------------------------------------------

describe('parseDuration', () => {
    it('parses milliseconds to seconds', () => {
        expect(parseDuration('200ms')).toBeCloseTo(0.2);
        expect(parseDuration('100ms')).toBeCloseTo(0.1);
        expect(parseDuration('400ms')).toBeCloseTo(0.4);
    });

    it('parses seconds', () => {
        expect(parseDuration('0.3s')).toBeCloseTo(0.3);
        expect(parseDuration('1s')).toBeCloseTo(1);
    });

    it('assumes ms for bare numbers', () => {
        expect(parseDuration('250')).toBeCloseTo(0.25);
    });

    it('handles whitespace', () => {
        expect(parseDuration(' 200ms ')).toBeCloseTo(0.2);
    });
});

// ---------------------------------------------------------------------------
// parseEasing
// ---------------------------------------------------------------------------

describe('parseEasing', () => {
    it('parses a cubic-bezier string', () => {
        const result = parseEasing('cubic-bezier(0.4, 0, 0.2, 1)');
        expect(result).toEqual([0.4, 0, 0.2, 1]);
    });

    it('handles negative values (spring overshoot)', () => {
        const result = parseEasing('cubic-bezier(0.34, 1.56, 0.64, 1)');
        expect(result).toEqual([0.34, 1.56, 0.64, 1]);
    });

    it('returns fallback for invalid input', () => {
        const result = parseEasing('ease-in-out');
        expect(result).toEqual([0.4, 0, 0.2, 1]);
    });

    it('returns fallback for empty string', () => {
        const result = parseEasing('');
        expect(result).toEqual([0.4, 0, 0.2, 1]);
    });
});

// ---------------------------------------------------------------------------
// parseOffset
// ---------------------------------------------------------------------------

describe('parseOffset', () => {
    it('parses px values', () => {
        expect(parseOffset('8px')).toBe(8);
        expect(parseOffset('16px')).toBe(16);
    });

    it('parses rem values (1rem = 16px)', () => {
        expect(parseOffset('1rem')).toBe(16);
        expect(parseOffset('0.5rem')).toBe(8);
    });

    it('parses bare numbers as px', () => {
        expect(parseOffset('12')).toBe(12);
    });
});

// ---------------------------------------------------------------------------
// buildPresets
// ---------------------------------------------------------------------------

describe('buildPresets', () => {
    const tokens: Required<TokenMotion> = { ...DEFAULT_MOTION };
    const presets = buildPresets(tokens);

    it('returns all preset names', () => {
        expect(Object.keys(presets)).toEqual(
            expect.arrayContaining([
                'fade',
                'fadeUp',
                'fadeDown',
                'fadeScale',
                'slideLeft',
                'slideRight',
                'scaleSpring',
            ]),
        );
    });

    it('each preset has initial, animate, exit, and transition', () => {
        for (const [, preset] of Object.entries(presets)) {
            expect(preset).toHaveProperty('initial');
            expect(preset).toHaveProperty('animate');
            expect(preset).toHaveProperty('exit');
            expect(preset).toHaveProperty('transition');
            expect(preset.transition).toHaveProperty('duration');
            expect(preset.transition).toHaveProperty('ease');
        }
    });

    it('fade preset uses opacity only', () => {
        const fade = presets.fade;
        expect(fade.initial).toEqual({ opacity: 0 });
        expect(fade.animate).toEqual({ opacity: 1 });
        expect(fade.exit).toEqual({ opacity: 0 });
    });

    it('fadeUp preset includes y offset', () => {
        const preset = presets.fadeUp;
        expect(preset.initial.y).toBe(8); // DEFAULT_MOTION.slideOffset = '8px'
        expect(preset.animate.y).toBe(0);
    });

    it('fadeScale uses scaleFrom/scaleTo tokens', () => {
        const preset = presets.fadeScale;
        expect(preset.initial.scale).toBe(0.95); // DEFAULT_MOTION.scaleFrom
        expect(preset.exit.scale).toBe(0.95); // DEFAULT_MOTION.scaleTo
        expect(preset.animate.scale).toBe(1);
    });

    it('scaleSpring uses spring easing', () => {
        const preset = presets.scaleSpring;
        const springEase = parseEasing(DEFAULT_MOTION.easingSpring);
        expect(preset.transition.ease).toEqual(springEase);
    });

    it('slide presets use 4x slide offset', () => {
        const slideL = presets.slideLeft;
        const slideR = presets.slideRight;
        expect(slideL.initial.x).toBe(-32); // -8 * 4
        expect(slideR.initial.x).toBe(32); // 8 * 4
    });

    it('transition durations are derived from tokens', () => {
        expect(presets.fade.transition.duration).toBeCloseTo(0.2); // 200ms
        expect(presets.slideLeft.transition.duration).toBeCloseTo(0.4); // 400ms (slow)
    });

    it('produces different values for funky-style tokens', () => {
        const funkyTokens: Required<TokenMotion> = {
            ...DEFAULT_MOTION,
            durationNormal: '250ms',
            durationSlow: '500ms',
            scaleFrom: '0.9',
            scaleTo: '0.9',
            slideOffset: '16px',
            easingSpring: 'cubic-bezier(0.2, 1.8, 0.4, 1)',
        };
        const funkyPresets = buildPresets(funkyTokens);
        expect(funkyPresets.fade.transition.duration).toBeCloseTo(0.25);
        expect(funkyPresets.fadeScale.initial.scale).toBe(0.9);
        expect(funkyPresets.slideLeft.initial.x).toBe(-64); // -16 * 4
    });
});
