/**
 * @ottabase/ottadate — Tests for core date utilities
 */

import { describe, expect, it } from 'vitest';
import {
    buildCalendarGrid,
    detectTimezone,
    formatDate,
    formatDisplay,
    formatHour12,
    fromDate,
    getHoursList,
    getMinutesList,
    getMonthNames,
    getMonthNamesShort,
    getSecondsList,
    getWeekdayLabels,
    getYearRange,
    isDateInBounds,
    pad2,
    resolveConfig,
    resolveTimezone,
    toDate,
} from '../core/utils';

describe('toDate', () => {
    it('converts unix timestamp (seconds) to Date', () => {
        const d = toDate(1704067200); // Jan 1 2024 00:00 UTC
        expect(d).toBeInstanceOf(Date);
        expect(d!.getUTCFullYear()).toBe(2024);
        expect(d!.getUTCMonth()).toBe(0);
        expect(d!.getUTCDate()).toBe(1);
    });

    it('converts ISO string to Date', () => {
        const d = toDate('2024-06-15T10:30:00.000Z');
        expect(d).toBeInstanceOf(Date);
        expect(d!.getUTCMonth()).toBe(5); // June
        expect(d!.getUTCDate()).toBe(15);
    });

    it('passes through valid Date objects', () => {
        const original = new Date(2024, 5, 15);
        const d = toDate(original);
        expect(d).toEqual(original);
    });

    it('returns null for null/undefined', () => {
        expect(toDate(null)).toBeNull();
        expect(toDate(undefined)).toBeNull();
    });

    it('returns null for invalid date strings', () => {
        expect(toDate('not-a-date')).toBeNull();
    });
});

describe('fromDate', () => {
    it('converts Date to unix seconds', () => {
        const d = new Date(Date.UTC(2024, 0, 1, 0, 0, 0));
        const result = fromDate(d, 'unix');
        expect(result).toBe(1704067200);
    });

    it('converts Date to ISO string', () => {
        const d = new Date(Date.UTC(2024, 0, 1, 0, 0, 0));
        const result = fromDate(d, 'iso');
        expect(result).toBe('2024-01-01T00:00:00.000Z');
    });

    it('returns Date for "date" format', () => {
        const d = new Date(2024, 0, 1);
        const result = fromDate(d, 'date');
        expect(result).toEqual(d);
    });

    it('returns null for null input', () => {
        expect(fromDate(null, 'unix')).toBeNull();
    });
});

describe('buildCalendarGrid', () => {
    it('returns 42 days (6 weeks)', () => {
        const grid = buildCalendarGrid(2024, 0); // January 2024
        expect(grid).toHaveLength(42);
    });

    it('includes days from adjacent months', () => {
        const grid = buildCalendarGrid(2024, 0); // January 2024
        // First day should be before Jan 1 if Jan 1 is not Monday (weekStartsOn=1)
        // Jan 1 2024 is a Monday, so first day is Jan 1
        expect(grid[0].getDate()).toBe(1);
        expect(grid[0].getMonth()).toBe(0); // January
    });

    it('respects weekStartsOn=0 (Sunday)', () => {
        const grid = buildCalendarGrid(2024, 0, 0);
        expect(grid).toHaveLength(42);
    });
});

describe('getWeekdayLabels', () => {
    it('returns 7 labels starting with Monday by default', () => {
        const labels = getWeekdayLabels(1);
        expect(labels).toHaveLength(7);
        expect(labels[0]).toBe('Mo');
        expect(labels[6]).toBe('Su');
    });

    it('starts with Sunday when weekStartsOn=0', () => {
        const labels = getWeekdayLabels(0);
        expect(labels[0]).toBe('Su');
        expect(labels[6]).toBe('Sa');
    });
});

describe('getMonthNames', () => {
    it('returns 12 full month names', () => {
        const months = getMonthNames();
        expect(months).toHaveLength(12);
        expect(months[0]).toBe('January');
        expect(months[11]).toBe('December');
    });
});

describe('getMonthNamesShort', () => {
    it('returns 12 abbreviated month names', () => {
        const months = getMonthNamesShort();
        expect(months).toHaveLength(12);
        expect(months[0]).toBe('Jan');
        expect(months[11]).toBe('Dec');
    });
});

describe('getYearRange', () => {
    it('generates years around center', () => {
        const years = getYearRange(2024, 5);
        expect(years).toHaveLength(11); // 2019 to 2029
        expect(years[0]).toBe(2019);
        expect(years[years.length - 1]).toBe(2029);
    });
});

describe('formatDate', () => {
    it('formats a date with a pattern string', () => {
        const d = new Date(2024, 0, 15);
        expect(formatDate(d, 'yyyy-MM-dd')).toBe('2024-01-15');
    });

    it('returns empty string for null', () => {
        expect(formatDate(null, 'yyyy-MM-dd')).toBe('');
    });
});

describe('isDateInBounds', () => {
    const date = new Date(2024, 5, 15);

    it('returns true when no bounds', () => {
        expect(isDateInBounds(date)).toBe(true);
    });

    it('returns true when within bounds', () => {
        const min = new Date(2024, 0, 1);
        const max = new Date(2024, 11, 31);
        expect(isDateInBounds(date, min, max)).toBe(true);
    });

    it('returns false when before min', () => {
        const min = new Date(2024, 8, 1);
        expect(isDateInBounds(date, min)).toBe(false);
    });

    it('returns false when after max', () => {
        const max = new Date(2024, 3, 1);
        expect(isDateInBounds(date, null, max)).toBe(false);
    });
});

describe('pad2', () => {
    it('pads single digits', () => {
        expect(pad2(5)).toBe('05');
        expect(pad2(0)).toBe('00');
    });

    it('does not pad double digits', () => {
        expect(pad2(12)).toBe('12');
        expect(pad2(59)).toBe('59');
    });
});

describe('formatHour12', () => {
    it('formats AM hours', () => {
        expect(formatHour12(0)).toBe('12 AM');
        expect(formatHour12(9)).toBe('9 AM');
    });

    it('formats PM hours', () => {
        expect(formatHour12(12)).toBe('12 PM');
        expect(formatHour12(15)).toBe('3 PM');
    });
});

describe('detectTimezone', () => {
    it('returns a string timezone', () => {
        const tz = detectTimezone();
        expect(typeof tz).toBe('string');
        expect(tz.length).toBeGreaterThan(0);
    });
});

describe('resolveTimezone', () => {
    it('resolves "auto" to detected timezone', () => {
        const tz = resolveTimezone('auto');
        expect(typeof tz).toBe('string');
        expect(tz).not.toBe('auto');
    });

    it('passes through explicit timezone', () => {
        expect(resolveTimezone('America/New_York')).toBe('America/New_York');
    });
});

describe('getHoursList', () => {
    it('returns 24 hours', () => {
        expect(getHoursList()).toHaveLength(24);
        expect(getHoursList()[0]).toBe(0);
        expect(getHoursList()[23]).toBe(23);
    });
});

describe('getMinutesList', () => {
    it('returns 60 minutes with default step', () => {
        expect(getMinutesList()).toHaveLength(60);
    });

    it('respects step parameter', () => {
        const mins = getMinutesList(15);
        expect(mins).toEqual([0, 15, 30, 45]);
    });
});

describe('getSecondsList', () => {
    it('returns 60 seconds', () => {
        expect(getSecondsList()).toHaveLength(60);
    });
});

// ---------------------------------------------------------------------------
// Edge case tests added for comprehensive coverage
// ---------------------------------------------------------------------------

describe('buildCalendarGrid edge cases', () => {
    it('handles February in a leap year (2024)', () => {
        const grid = buildCalendarGrid(2024, 1); // Feb 2024 (leap year — 29 days)
        expect(grid).toHaveLength(42);
        // Feb 29 must be present somewhere in the grid
        const hasFeb29 = grid.some((d) => d.getMonth() === 1 && d.getDate() === 29);
        expect(hasFeb29).toBe(true);
    });

    it('handles February in a non-leap year (2023)', () => {
        const grid = buildCalendarGrid(2023, 1); // Feb 2023 (28 days)
        expect(grid).toHaveLength(42);
        // Feb 29 should NOT be present with month === 1
        const hasFeb29 = grid.some((d) => d.getMonth() === 1 && d.getDate() === 29);
        expect(hasFeb29).toBe(false);
    });

    it('December includes overflow into next year', () => {
        const grid = buildCalendarGrid(2024, 11); // December 2024
        expect(grid).toHaveLength(42);
        // Some trailing days should be in January 2025
        const nextYear = grid.some((d) => d.getFullYear() === 2025 && d.getMonth() === 0);
        expect(nextYear).toBe(true);
    });
});

describe('toDate edge cases', () => {
    it('treats numeric input as seconds (not milliseconds)', () => {
        // toDate always multiplies by 1000 — callers must pass seconds
        const secTs = 1704067200; // Jan 1 2024 UTC in seconds
        const d = toDate(secTs);
        expect(d).toBeInstanceOf(Date);
        expect(d!.getUTCFullYear()).toBe(2024);
        // Passing ms directly (without dividing) gives a far-future date
        const msTs = 1704067200000;
        const dMs = toDate(msTs);
        expect(dMs!.getUTCFullYear()).toBeGreaterThan(50000);
    });

    it('handles ISO string input', () => {
        const d = toDate('2024-06-15T12:30:00Z');
        expect(d).toBeInstanceOf(Date);
        expect(d!.getUTCMonth()).toBe(5); // June
        expect(d!.getUTCDate()).toBe(15);
    });

    it('handles Date object input (pass-through)', () => {
        const original = new Date(2024, 5, 15);
        const d = toDate(original);
        expect(d).toBe(original);
    });
});

describe('formatDisplay', () => {
    it('formats a date using the given display format', () => {
        const d = new Date(Date.UTC(2024, 0, 15));
        expect(formatDisplay(d, 'MMM d, yyyy')).toBe('Jan 15, 2024');
    });

    it('returns empty string for null', () => {
        expect(formatDisplay(null, 'MMM d, yyyy')).toBe('');
    });
});

describe('resolveConfig', () => {
    it('applies defaults for missing keys', () => {
        const cfg = resolveConfig({} as any);
        expect(cfg.timezone).toBe('auto');
        expect(cfg.locale).toBe('en-US');
        expect(cfg.firstDayOfWeek).toBe(1);
        expect(cfg.displayFormat).toBe('MMM d, yyyy');
        expect(cfg.inline).toBe(false);
        expect(cfg.disabled).toBe(false);
    });

    it('user values override defaults', () => {
        const cfg = resolveConfig({ timezone: 'America/New_York', firstDayOfWeek: 0 } as any);
        expect(cfg.timezone).toBe('America/New_York');
        expect(cfg.firstDayOfWeek).toBe(0);
        // Other defaults still present
        expect(cfg.locale).toBe('en-US');
    });
});
