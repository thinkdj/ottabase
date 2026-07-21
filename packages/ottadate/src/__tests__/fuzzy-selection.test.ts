/**
 * @ottabase/ottadate — Tests for the headless fuzzy-selection controller (v2)
 *
 * Locks in the derived-resolution model: the resolution is the deepest level
 * the user filled in, levels clear in cascade, parts are terminal refinements
 * bound to one level, and `approximate` widens the stored interval.
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

    it('builds a FuzzyDateTime with label and interval', () => {
        const sel = createFuzzySelection();
        sel.setYear(2020);
        sel.setMonth(4);

        const fuzzy = sel.build()!;
        expect(fuzzy.resolution).toBe('month');
        expect(fuzzy.label).toBe('Sometime in May 2020');
        expect(fuzzy.timestamp).toBe(Math.floor(Date.UTC(2020, 4, 1) / 1000));
        expect(fuzzy.latest).toBe(Math.floor(Date.UTC(2020, 5, 1) / 1000) - 1);
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

describe('createFuzzySelection — parts', () => {
    it('offers parts for the current derived level', () => {
        const sel = createFuzzySelection();
        expect(sel.partOptions()).toEqual(['early', 'mid', 'late', 'spring', 'summer', 'autumn', 'winter']);

        sel.toggleMonth(4);
        expect(sel.partOptions()).toEqual(['early', 'mid', 'late']);

        sel.toggleDay(20);
        expect(sel.partOptions()).toEqual(['morning', 'afternoon', 'evening', 'night']);

        sel.setHour(11);
        expect(sel.partOptions()).toEqual([]);
    });

    it('keeps the resolution at the named level and reflects the part in the build', () => {
        const sel = createFuzzySelection();
        sel.setYear(1998);
        sel.setPart('summer');
        expect(sel.resolution()).toBe('year');

        const fuzzy = sel.build()!;
        expect(fuzzy.part).toBe('summer');
        expect(fuzzy.label).toBe('Summer 1998');
    });

    it('clears the part when the selection depth changes (terminal rule)', () => {
        const sel = createFuzzySelection();
        sel.setYear(1998);
        sel.setPart('summer');

        sel.setMonth(6); // naming July supersedes "summer"
        expect(sel.state.part).toBeNull();
        expect(sel.resolution()).toBe('month');
    });

    it('keeps the part when only the value at the same level changes', () => {
        const sel = createFuzzySelection();
        sel.setYear(1998);
        sel.setPart('summer');
        sel.setYear(1999); // still year-level
        expect(sel.state.part).toBe('summer');
        expect(sel.build()!.label).toBe('Summer 1999');
    });

    it('toggles a part off when re-selected and rejects invalid parts', () => {
        const sel = createFuzzySelection();
        sel.setYear(1998);
        sel.togglePart('summer');
        expect(sel.state.part).toBe('summer');
        sel.togglePart('summer');
        expect(sel.state.part).toBeNull();

        sel.setPart('night'); // not valid at year level
        expect(sel.state.part).toBeNull();
    });

    it('offers no parts when disabled via options', () => {
        const sel = createFuzzySelection({ parts: false });
        sel.setYear(1998);
        expect(sel.partOptions()).toEqual([]);
    });
});

describe('createFuzzySelection — approximate', () => {
    it('marks the build as approximate and widens the interval', () => {
        const sel = createFuzzySelection();
        sel.setYear(1996);
        sel.setApproximate(true);

        const fuzzy = sel.build()!;
        expect(fuzzy.approximate).toBe(true);
        expect(fuzzy.label).toBe('Around 1996');
        expect(fuzzy.earliest).toBe(Math.floor(Date.UTC(1995, 0, 1) / 1000));

        sel.toggleApproximate();
        expect(sel.build()!.approximate).toBeUndefined();
    });
});

describe('createFuzzySelection — decade mode', () => {
    const opts = { resolutions: ['decade', 'year', 'month'] as const };

    it('starts at decade resolution with the year un-named', () => {
        const sel = createFuzzySelection({ resolutions: [...opts.resolutions] });
        expect(sel.base).toBe('decade');
        expect(sel.state.yearSet).toBe(false);
        expect(sel.resolution()).toBe('decade');
        expect(sel.partOptions()).toEqual(['early', 'mid', 'late']);
    });

    it('names and un-names a year within the decade', () => {
        const sel = createFuzzySelection({ resolutions: [...opts.resolutions] });
        sel.toggleYear(1996);
        expect(sel.state.yearSet).toBe(true);
        expect(sel.resolution()).toBe('year');

        sel.toggleYear(1996); // un-name
        expect(sel.state.yearSet).toBe(false);
        expect(sel.state.year).toBe(1990); // back to the decade start
        expect(sel.resolution()).toBe('decade');
    });

    it('steps decades preserving a decade-level part', () => {
        const sel = createFuzzySelection({ resolutions: [...opts.resolutions] });
        sel.setPart('early');
        sel.stepDecade(-3);
        expect(sel.state.part).toBe('early');
        const fuzzy = sel.build()!;
        expect(fuzzy.resolution).toBe('decade');
        expect(fuzzy.label).toContain('Early');
    });

    it('builds "Early 1990s" style values', () => {
        const sel = createFuzzySelection({ resolutions: [...opts.resolutions] });
        const currentDecade = new Date().getFullYear() - (new Date().getFullYear() % 10);
        sel.stepDecade((1990 - currentDecade) / 10);
        sel.setPart('early');
        const fuzzy = sel.build()!;
        expect(fuzzy.label).toBe('Early 1990s');
        expect(fuzzy.earliest).toBe(Math.floor(Date.UTC(1990, 0, 1) / 1000));
        expect(fuzzy.latest).toBe(Math.floor(Date.UTC(1994, 0, 1) / 1000) - 1);
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

describe('createFuzzySelection — shortcuts and lifecycle', () => {
    it('setToday selects today at day resolution without a time or part', () => {
        const sel = createFuzzySelection();
        sel.setPart('summer');
        sel.setToday();
        const now = new Date();
        expect(sel.state.year).toBe(now.getFullYear());
        expect(sel.state.day).toBe(now.getDate());
        expect(sel.state.hour).toBeNull();
        expect(sel.state.part).toBeNull();
        expect(sel.resolution()).toBe('day');
    });

    it('setNow fills to the finest allowed depth and is not approximate', () => {
        const sel = createFuzzySelection();
        sel.setApproximate(true);
        sel.setNow();
        expect(sel.resolution()).toBe('second');
        expect(sel.state.approximate).toBe(false);

        const bounded = createFuzzySelection({ resolutions: ['year', 'month', 'day'] });
        bounded.setNow();
        expect(bounded.resolution()).toBe('day');
        expect(bounded.state.hour).toBeNull();
    });

    it('clear resets to the empty state', () => {
        const sel = createFuzzySelection();
        sel.setNow();
        sel.setPart('night');
        sel.clear();
        expect(sel.state.hasSelection).toBe(false);
        expect(sel.state.part).toBeNull();
        expect(sel.state.approximate).toBe(false);
        expect(sel.build()).toBeNull();
    });

    it('load restores levels, part, and approximate from an existing value', () => {
        const value = createFuzzyDateTime(new Date(Date.UTC(1998, 0, 1)), 'year', {
            part: 'summer',
            approximate: true,
        });
        const sel = createFuzzySelection({ value });
        expect(sel.state.year).toBe(1998);
        expect(sel.state.monthSet).toBe(false);
        expect(sel.state.part).toBe('summer');
        expect(sel.state.approximate).toBe(true);
        expect(sel.resolution()).toBe('year');
        expect(sel.build()!.label).toBe('Around summer 1998');
    });

    it('load of a fine value leaves parts clear and time populated', () => {
        const value = createFuzzyDateTime(new Date(Date.UTC(2010, 4, 21, 14, 30, 0)), 'minute');
        const sel = createFuzzySelection({ value });
        expect(sel.state.hour).toBe(14);
        expect(sel.state.minute).toBe(30);
        expect(sel.state.second).toBeNull();
        expect(sel.resolution()).toBe('minute');
    });
});
