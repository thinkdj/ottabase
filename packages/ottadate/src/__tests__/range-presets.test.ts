/**
 * @ottabase/ottadate — Tests for range presets
 */

import { describe, expect, it } from 'vitest';
import { getDefaultRangePresets } from '../core/range-presets';

describe('getDefaultRangePresets', () => {
    const presets = getDefaultRangePresets();

    it('returns 7 default presets', () => {
        expect(presets).toHaveLength(7);
    });

    it('each preset has a label and range function', () => {
        for (const p of presets) {
            expect(typeof p.label).toBe('string');
            expect(p.label.length).toBeGreaterThan(0);
            expect(typeof p.range).toBe('function');
        }
    });

    it('returns expected preset labels in order', () => {
        const labels = presets.map((p) => p.label);
        expect(labels).toEqual([
            'Today',
            'Last 3 Days',
            'Last 7 Days',
            'Last 30 Days',
            'Last 3 Months',
            'Last 6 Months',
            'Last 1 Year',
        ]);
    });

    it('each range returns valid start and end Dates', () => {
        for (const p of presets) {
            const { start, end } = p.range();
            expect(start).toBeInstanceOf(Date);
            expect(end).toBeInstanceOf(Date);
            expect(isNaN(start.getTime())).toBe(false);
            expect(isNaN(end.getTime())).toBe(false);
        }
    });

    it('start is always before or equal to end', () => {
        for (const p of presets) {
            const { start, end } = p.range();
            expect(start.getTime()).toBeLessThanOrEqual(end.getTime());
        }
    });

    it('"Today" preset start and end are the same calendar day', () => {
        const today = presets[0];
        const { start, end } = today.range();
        expect(start.getFullYear()).toBe(end.getFullYear());
        expect(start.getMonth()).toBe(end.getMonth());
        expect(start.getDate()).toBe(end.getDate());
    });

    it('"Today" start is at 00:00:00 and end is at 23:59:59', () => {
        const { start, end } = presets[0].range();
        expect(start.getHours()).toBe(0);
        expect(start.getMinutes()).toBe(0);
        expect(start.getSeconds()).toBe(0);
        expect(end.getHours()).toBe(23);
        expect(end.getMinutes()).toBe(59);
        expect(end.getSeconds()).toBe(59);
    });

    it('"Last 7 Days" spans 7 calendar days', () => {
        const { start, end } = presets[2].range();
        const diffMs = end.getTime() - start.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        // 7 days = from start-of-day 6 days ago to end-of-today ≈ ~7 days
        expect(diffDays).toBeGreaterThanOrEqual(6.9);
        expect(diffDays).toBeLessThanOrEqual(7.1);
    });

    it('end date is always today', () => {
        const now = new Date();
        for (const p of presets) {
            const { end } = p.range();
            expect(end.getFullYear()).toBe(now.getFullYear());
            expect(end.getMonth()).toBe(now.getMonth());
            expect(end.getDate()).toBe(now.getDate());
        }
    });

    it('returns fresh instances on each call (no caching)', () => {
        const presets1 = getDefaultRangePresets();
        const presets2 = getDefaultRangePresets();
        expect(presets1).not.toBe(presets2);
        expect(presets1[0]).not.toBe(presets2[0]);
    });
});
