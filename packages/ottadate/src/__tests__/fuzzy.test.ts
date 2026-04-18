/**
 * @ottabase/ottadate — Tests for FuzzyDateTime core logic
 */

import { describe, expect, it } from 'vitest';
import {
    APPROXIMATION_LABELS,
    buildFuzzyLabel,
    createFuzzyDateTime,
    getResolutionDescription,
    isResolutionFinerOrEqual,
    parseFuzzyDateTime,
    refreshFuzzyLabel,
    RESOLUTION_LABELS,
    RESOLUTION_ORDER,
    resolutionIndex,
    snapToResolution,
} from '../core/fuzzy';
import type { DateApproximation, DateResolution } from '../core/types';

describe('RESOLUTION_ORDER', () => {
    it('has 6 levels from coarsest to finest', () => {
        expect(RESOLUTION_ORDER).toEqual(['year', 'month', 'day', 'hour', 'minute', 'second']);
    });
});

describe('resolutionIndex', () => {
    it('returns correct indices', () => {
        expect(resolutionIndex('year')).toBe(0);
        expect(resolutionIndex('month')).toBe(1);
        expect(resolutionIndex('day')).toBe(2);
        expect(resolutionIndex('hour')).toBe(3);
        expect(resolutionIndex('minute')).toBe(4);
        expect(resolutionIndex('second')).toBe(5);
    });
});

describe('isResolutionFinerOrEqual', () => {
    it('returns true when A is finer', () => {
        expect(isResolutionFinerOrEqual('day', 'month')).toBe(true);
        expect(isResolutionFinerOrEqual('second', 'year')).toBe(true);
    });

    it('returns true when equal', () => {
        expect(isResolutionFinerOrEqual('month', 'month')).toBe(true);
    });

    it('returns false when A is coarser', () => {
        expect(isResolutionFinerOrEqual('year', 'month')).toBe(false);
    });
});

describe('snapToResolution', () => {
    const baseDate = new Date(Date.UTC(2025, 4, 20, 11, 30, 45, 500)); // May 20 2025 11:30:45.500 UTC

    it('snaps to year', () => {
        const snapped = snapToResolution(baseDate, 'year');
        expect(snapped.getUTCFullYear()).toBe(2025);
        expect(snapped.getUTCMonth()).toBe(0);
        expect(snapped.getUTCDate()).toBe(1);
        expect(snapped.getUTCHours()).toBe(0);
        expect(snapped.getUTCMinutes()).toBe(0);
        expect(snapped.getUTCSeconds()).toBe(0);
    });

    it('snaps to month', () => {
        const snapped = snapToResolution(baseDate, 'month');
        expect(snapped.getUTCFullYear()).toBe(2025);
        expect(snapped.getUTCMonth()).toBe(4); // May
        expect(snapped.getUTCDate()).toBe(1);
        expect(snapped.getUTCHours()).toBe(0);
    });

    it('snaps to day', () => {
        const snapped = snapToResolution(baseDate, 'day');
        expect(snapped.getUTCFullYear()).toBe(2025);
        expect(snapped.getUTCMonth()).toBe(4);
        expect(snapped.getUTCDate()).toBe(20);
        expect(snapped.getUTCHours()).toBe(0);
        expect(snapped.getUTCMinutes()).toBe(0);
    });

    it('snaps to hour', () => {
        const snapped = snapToResolution(baseDate, 'hour');
        expect(snapped.getUTCDate()).toBe(20);
        expect(snapped.getUTCHours()).toBe(11);
        expect(snapped.getUTCMinutes()).toBe(0);
        expect(snapped.getUTCSeconds()).toBe(0);
    });

    it('snaps to minute', () => {
        const snapped = snapToResolution(baseDate, 'minute');
        expect(snapped.getUTCHours()).toBe(11);
        expect(snapped.getUTCMinutes()).toBe(30);
        expect(snapped.getUTCSeconds()).toBe(0);
    });

    it('snaps to second', () => {
        const snapped = snapToResolution(baseDate, 'second');
        expect(snapped.getUTCSeconds()).toBe(45);
        expect(snapped.getUTCMilliseconds()).toBe(0);
    });

    it('does not mutate the original date', () => {
        const original = new Date(baseDate.getTime());
        snapToResolution(baseDate, 'year');
        expect(baseDate.getTime()).toBe(original.getTime());
    });
});

describe('buildFuzzyLabel', () => {
    it('builds year label with sometime', () => {
        const d = new Date(Date.UTC(2018, 0, 1));
        expect(buildFuzzyLabel(d, 'year', 'sometime')).toBe('Sometime in 2018');
    });

    it('builds month label with sometime', () => {
        const d = new Date(Date.UTC(2020, 4, 1));
        expect(buildFuzzyLabel(d, 'month', 'sometime')).toBe('Sometime in May 2020');
    });

    it('builds day label with around', () => {
        const d = new Date(Date.UTC(2025, 4, 20));
        expect(buildFuzzyLabel(d, 'day', 'around')).toBe('Around May 20, 2025');
    });

    it('builds hour label with around', () => {
        const d = new Date(Date.UTC(2025, 4, 20, 11, 0, 0));
        expect(buildFuzzyLabel(d, 'hour', 'around')).toBe('Around 11:00, May 20, 2025');
    });

    it('builds minute label with exact', () => {
        const d = new Date(Date.UTC(2025, 4, 20, 11, 30, 0));
        expect(buildFuzzyLabel(d, 'minute', 'exact')).toBe('May 20, 2025 at 11:30');
    });

    it('builds second label with exact', () => {
        const d = new Date(Date.UTC(2025, 4, 20, 11, 30, 45));
        expect(buildFuzzyLabel(d, 'second', 'exact')).toBe('May 20, 2025 at 11:30:45');
    });

    it('builds year label with exact (no prefix)', () => {
        const d = new Date(Date.UTC(2018, 0, 1));
        expect(buildFuzzyLabel(d, 'year', 'exact')).toBe('2018');
    });
});

describe('createFuzzyDateTime', () => {
    it('creates a valid FuzzyDateTime with snapped timestamp', () => {
        const d = new Date(Date.UTC(2020, 4, 15, 10, 30, 0));
        const fuzzy = createFuzzyDateTime(d, 'month', 'sometime');

        expect(fuzzy.resolution).toBe('month');
        expect(fuzzy.approximation).toBe('sometime');
        expect(fuzzy.label).toBe('Sometime in May 2020');
        // Timestamp should be snapped to May 1 2020 00:00 UTC
        const snappedDate = new Date(fuzzy.timestamp * 1000);
        expect(snappedDate.getUTCDate()).toBe(1);
        expect(snappedDate.getUTCHours()).toBe(0);
    });

    it('defaults approximation to sometime', () => {
        const d = new Date(Date.UTC(2024, 0, 1));
        const fuzzy = createFuzzyDateTime(d, 'year');
        expect(fuzzy.approximation).toBe('sometime');
    });
});

describe('parseFuzzyDateTime', () => {
    it('parses a FuzzyDateTime back to components', () => {
        const fuzzy = createFuzzyDateTime(new Date(Date.UTC(2020, 4, 1)), 'month', 'sometime');
        const { date, resolution, approximation } = parseFuzzyDateTime(fuzzy);

        expect(resolution).toBe('month');
        expect(approximation).toBe('sometime');
        expect(date.getUTCMonth()).toBe(4);
        expect(date.getUTCFullYear()).toBe(2020);
    });
});

describe('refreshFuzzyLabel', () => {
    it('regenerates the label', () => {
        const fuzzy = {
            timestamp: 1588291200, // May 1 2020 00:00 UTC
            resolution: 'month' as DateResolution,
            approximation: 'around' as DateApproximation,
            label: 'old label',
        };
        const refreshed = refreshFuzzyLabel(fuzzy);
        expect(refreshed.label).toBe('Around May 2020');
        expect(refreshed.timestamp).toBe(fuzzy.timestamp);
    });
});

describe('RESOLUTION_LABELS', () => {
    it('has labels for all resolutions', () => {
        for (const res of RESOLUTION_ORDER) {
            expect(RESOLUTION_LABELS[res]).toBeDefined();
            expect(typeof RESOLUTION_LABELS[res]).toBe('string');
        }
    });
});

describe('APPROXIMATION_LABELS', () => {
    it('has labels for all approximations', () => {
        const approxes: DateApproximation[] = ['exact', 'around', 'sometime'];
        for (const a of approxes) {
            expect(APPROXIMATION_LABELS[a]).toBeDefined();
        }
    });
});

describe('getResolutionDescription', () => {
    it('returns a description string for each resolution', () => {
        for (const res of RESOLUTION_ORDER) {
            const desc = getResolutionDescription(res);
            expect(typeof desc).toBe('string');
            expect(desc.length).toBeGreaterThan(0);
        }
    });
});
