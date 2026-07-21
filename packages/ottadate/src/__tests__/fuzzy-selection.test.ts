/**
 * @ottabase/ottadate — Tests for the headless fuzzy-selection controller
 *
 * Locks in the derived-resolution model: the resolution is the deepest level
 * the user filled in, levels clear in cascade, and 'sometime' auto-swaps with
 * 'around' as the selection crosses into/out of time-of-day precision.
 */

import { describe, expect, it } from 'vitest';
import { createFuzzyDateTime } from '../core/fuzzy';
import { createFuzzySelection } from '../core/fuzzy-selection';

describe('createFuzzySelection — derived resolution', () => {
    it('starts empty with no selection and builds null', () => {
        const sel = createFuzzySelection();
        expect(sel.state.hasSelection).toBe(false);
        expect(sel.build()).toBeNull();
    });

    it('derives year → month → day → hour → minute → second as levels fill', () => {
        const sel = createFuzzySelection();

        sel.setYear(2020);
        expect(sel.resolution()).toBe('year');

        sel.setMonth(4); // May
        expect(sel.resolution()).toBe('month');

        sel.setDay(20);
        expect(sel.resolution()).toBe('day');

        sel.setHour(11);
        expect(sel.resolution()).toBe('hour');

        sel.setMinute(30);
        expect(sel.resolution()).toBe('minute');

        sel.setSecond(45);
        expect(sel.resolution()).toBe('second');
    });

    it('builds a snapped FuzzyDateTime with a natural label', () => {
        const sel = createFuzzySelection();
        sel.setYear(2020);
        sel.setMonth(4);

        const fuzzy = sel.build()!;
        expect(fuzzy.resolution).toBe('month');
        expect(fuzzy.approximation).toBe('sometime');
        expect(fuzzy.label).toBe('Sometime in May 2020');
        const date = new Date(fuzzy.timestamp * 1000);
        expect(date.getUTCFullYear()).toBe(2020);
        expect(date.getUTCMonth()).toBe(4);
        expect(date.getUTCDate()).toBe(1);
    });
});

describe('createFuzzySelection — toggling and cascade clearing', () => {
    it('re-selecting the active month clears month and everything finer', () => {
        const sel = createFuzzySelection();
        sel.setYear(2020);
        sel.toggleMonth(4);
        sel.toggleDay(20);
        sel.setHour(11);
        expect(sel.resolution()).toBe('hour');

        sel.toggleMonth(4); // toggle off
        expect(sel.state.monthSet).toBe(false);
        expect(sel.state.daySet).toBe(false);
        expect(sel.state.hour).toBeNull();
        expect(sel.resolution()).toBe('year');
    });

    it('re-selecting the active day clears day and time but keeps the month', () => {
        const sel = createFuzzySelection();
        sel.toggleMonth(4);
        sel.toggleDay(20);
        sel.setHour(11);

        sel.toggleDay(20); // toggle off
        expect(sel.state.monthSet).toBe(true);
        expect(sel.state.daySet).toBe(false);
        expect(sel.state.hour).toBeNull();
        expect(sel.resolution()).toBe('month');
    });

    it('clearing the hour clears minutes and seconds too', () => {
        const sel = createFuzzySelection();
        sel.toggleMonth(4);
        sel.toggleDay(20);
        sel.setHour(11);
        sel.setMinute(30);
        sel.setSecond(45);

        sel.setHour(null);
        expect(sel.state.minute).toBeNull();
        expect(sel.state.second).toBeNull();
        expect(sel.resolution()).toBe('day');
    });

    it('clamps the day when switching to a shorter month', () => {
        const sel = createFuzzySelection();
        sel.setYear(2025);
        sel.setMonth(0); // January
        sel.setDay(31);
        sel.setMonth(1); // February
        expect(sel.state.day).toBe(28);
    });
});

describe('createFuzzySelection — resolution bounds', () => {
    it('treats the coarsest allowed resolution as a required baseline', () => {
        const sel = createFuzzySelection({ resolutions: ['month', 'day'] });
        expect(sel.state.monthSet).toBe(true); // base floor
        sel.setYear(2020);
        expect(sel.resolution()).toBe('month');

        // Month is required — toggling the active month must not clear it
        sel.toggleMonth(sel.state.month);
        expect(sel.state.monthSet).toBe(true);
    });

    it('does not drill deeper than the finest allowed resolution', () => {
        const sel = createFuzzySelection({ resolutions: ['year', 'month'] });
        expect(sel.levelAllowed('month')).toBe(true);
        expect(sel.levelAllowed('day')).toBe(false);
    });
});

describe('createFuzzySelection — approximation handling', () => {
    it("auto-swaps 'sometime' to 'around' when a time is set, and restores it after", () => {
        const sel = createFuzzySelection();
        sel.toggleMonth(4);
        sel.toggleDay(20);
        expect(sel.build()!.approximation).toBe('sometime');

        sel.setHour(11);
        expect(sel.build()!.approximation).toBe('around');
        expect(sel.sometimeDisabled()).toBe(true);

        sel.setHour(null);
        expect(sel.build()!.approximation).toBe('sometime');
        expect(sel.sometimeDisabled()).toBe(false);
    });

    it('does not restore sometime after an explicit approximation choice', () => {
        const sel = createFuzzySelection();
        sel.toggleMonth(4);
        sel.toggleDay(20);
        sel.setHour(11); // auto-swap to 'around'
        sel.setApproximation('exact'); // explicit choice
        sel.setHour(null);
        expect(sel.build()!.approximation).toBe('exact');
    });

    it('ignores approximations outside the allowed list', () => {
        const sel = createFuzzySelection({ approximations: ['sometime', 'around'] });
        sel.setApproximation('exact');
        expect(sel.state.approximation).toBe('sometime');
    });
});

describe('createFuzzySelection — shortcuts and lifecycle', () => {
    it('setToday selects today at day resolution without a time', () => {
        const sel = createFuzzySelection();
        sel.setToday();
        const now = new Date();
        expect(sel.state.year).toBe(now.getFullYear());
        expect(sel.state.month).toBe(now.getMonth());
        expect(sel.state.day).toBe(now.getDate());
        expect(sel.state.hour).toBeNull();
        expect(sel.resolution()).toBe('day');
    });

    it('setNow fills to the finest allowed depth and switches to exact', () => {
        const sel = createFuzzySelection();
        sel.setNow();
        expect(sel.resolution()).toBe('second');
        expect(sel.state.approximation).toBe('exact');

        const bounded = createFuzzySelection({ resolutions: ['year', 'month', 'day'] });
        bounded.setNow();
        expect(bounded.resolution()).toBe('day');
        expect(bounded.state.hour).toBeNull();
    });

    it('clear resets to the empty state', () => {
        const sel = createFuzzySelection();
        sel.setNow();
        sel.clear();
        expect(sel.state.hasSelection).toBe(false);
        expect(sel.state.monthSet).toBe(false);
        expect(sel.build()).toBeNull();
    });

    it('load restores every level from an existing FuzzyDateTime', () => {
        const value = createFuzzyDateTime(new Date(Date.UTC(2020, 4, 20, 11, 30, 0)), 'minute', 'exact');
        const sel = createFuzzySelection({ value });
        expect(sel.state.year).toBe(2020);
        expect(sel.state.month).toBe(4);
        expect(sel.state.day).toBe(20);
        expect(sel.state.hour).toBe(11);
        expect(sel.state.minute).toBe(30);
        expect(sel.state.second).toBeNull();
        expect(sel.resolution()).toBe('minute');
        expect(sel.state.hasSelection).toBe(true);
    });

    it('load of a coarse value leaves finer levels unset', () => {
        const value = createFuzzyDateTime(new Date(Date.UTC(2018, 0, 1)), 'year', 'sometime');
        const sel = createFuzzySelection({ value });
        expect(sel.state.monthSet).toBe(false);
        expect(sel.state.daySet).toBe(false);
        expect(sel.resolution()).toBe('year');
        expect(sel.build()!.label).toBe('Sometime in 2018');
    });
});
