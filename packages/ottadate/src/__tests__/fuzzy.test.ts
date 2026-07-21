/**
 * @ottabase/ottadate — Tests for FuzzyDateTime core logic (v2)
 *
 * Covers the derived-phrasing label grammar, part-of-period windows
 * (early/mid/late, seasons, day-parts), the approximate widening table,
 * the [earliest, latest] interval math, and the compact string encoding.
 */

import { describe, expect, it } from 'vitest';
import {
    buildFuzzyLabel,
    createFuzzyDateTime,
    decodeFuzzyDateTime,
    DEFAULT_RESOLUTIONS,
    encodeFuzzyDateTime,
    isResolutionFinerOrEqual,
    isValidPart,
    parseFuzzyDateTime,
    PART_LABELS,
    partsForResolution,
    refreshFuzzyLabel,
    RESOLUTION_LABELS,
    RESOLUTION_ORDER,
    resolutionBounds,
    resolutionIndex,
    snapToResolution,
} from '../core/fuzzy';

const unix = (y: number, mo = 0, d = 1, h = 0, mi = 0, s = 0) => Math.floor(Date.UTC(y, mo, d, h, mi, s) / 1000);

describe('RESOLUTION_ORDER', () => {
    it('has 7 levels from decade to second', () => {
        expect(RESOLUTION_ORDER).toEqual(['decade', 'year', 'month', 'day', 'hour', 'minute', 'second']);
    });

    it('DEFAULT_RESOLUTIONS excludes decade (opt-in)', () => {
        expect(DEFAULT_RESOLUTIONS).toEqual(['year', 'month', 'day', 'hour', 'minute', 'second']);
    });
});

describe('resolutionIndex / isResolutionFinerOrEqual', () => {
    it('orders decade as the coarsest level', () => {
        expect(resolutionIndex('decade')).toBe(0);
        expect(resolutionIndex('year')).toBe(1);
        expect(resolutionIndex('second')).toBe(6);
        expect(isResolutionFinerOrEqual('year', 'decade')).toBe(true);
        expect(isResolutionFinerOrEqual('decade', 'year')).toBe(false);
    });
});

describe('resolutionBounds', () => {
    it('returns coarsest as base and finest regardless of list order', () => {
        expect(resolutionBounds(['day', 'year', 'month'])).toEqual({ base: 'year', finest: 'day' });
        expect(resolutionBounds(['month', 'decade', 'year'])).toEqual({ base: 'decade', finest: 'month' });
    });

    it('falls back to year→second (decade opt-in) for empty/undefined input', () => {
        expect(resolutionBounds()).toEqual({ base: 'year', finest: 'second' });
        expect(resolutionBounds([])).toEqual({ base: 'year', finest: 'second' });
    });
});

describe('parts vocabulary', () => {
    it('offers early/mid/late for decade and month, plus seasons for year', () => {
        expect(partsForResolution('decade')).toEqual(['early', 'mid', 'late']);
        expect(partsForResolution('month')).toEqual(['early', 'mid', 'late']);
        expect(partsForResolution('year')).toEqual(['early', 'mid', 'late', 'spring', 'summer', 'autumn', 'winter']);
    });

    it('offers day-parts for day and nothing at time resolutions', () => {
        expect(partsForResolution('day')).toEqual(['morning', 'afternoon', 'evening', 'night']);
        expect(partsForResolution('hour')).toEqual([]);
        expect(partsForResolution('minute')).toEqual([]);
    });

    it('validates parts against the resolution', () => {
        expect(isValidPart('year', 'summer')).toBe(true);
        expect(isValidPart('month', 'summer')).toBe(false);
        expect(isValidPart('day', 'night')).toBe(true);
        expect(isValidPart('decade', 'night')).toBe(false);
    });

    it('has a label for every part', () => {
        for (const part of Object.keys(PART_LABELS)) {
            expect(PART_LABELS[part as keyof typeof PART_LABELS].length).toBeGreaterThan(0);
        }
    });
});

describe('snapToResolution', () => {
    const baseDate = new Date(Date.UTC(2025, 4, 20, 11, 30, 45, 500)); // May 20 2025 11:30:45.500 UTC

    it('snaps to decade', () => {
        const snapped = snapToResolution(baseDate, 'decade');
        expect(snapped.getUTCFullYear()).toBe(2020);
        expect(snapped.getUTCMonth()).toBe(0);
        expect(snapped.getUTCDate()).toBe(1);
        expect(snapped.getUTCHours()).toBe(0);
    });

    it('snaps to year / month / day', () => {
        expect(snapToResolution(baseDate, 'year').getTime()).toBe(Date.UTC(2025, 0, 1));
        expect(snapToResolution(baseDate, 'month').getTime()).toBe(Date.UTC(2025, 4, 1));
        expect(snapToResolution(baseDate, 'day').getTime()).toBe(Date.UTC(2025, 4, 20));
    });

    it('snaps to hour / minute / second', () => {
        expect(snapToResolution(baseDate, 'hour').getTime()).toBe(Date.UTC(2025, 4, 20, 11));
        expect(snapToResolution(baseDate, 'minute').getTime()).toBe(Date.UTC(2025, 4, 20, 11, 30));
        expect(snapToResolution(baseDate, 'second').getTime()).toBe(Date.UTC(2025, 4, 20, 11, 30, 45));
    });

    it('does not mutate the original date', () => {
        const original = new Date(baseDate.getTime());
        snapToResolution(baseDate, 'decade');
        expect(baseDate.getTime()).toBe(original.getTime());
    });
});

describe('buildFuzzyLabel — derived phrasing', () => {
    const y1996 = new Date(Date.UTC(1996, 0, 1));
    const may2010 = new Date(Date.UTC(2010, 4, 1));
    const day = new Date(Date.UTC(2010, 4, 21));

    it('renders plain coarse periods as "Sometime in …"', () => {
        expect(buildFuzzyLabel(y1996, 'decade')).toBe('Sometime in the 1990s');
        expect(buildFuzzyLabel(y1996, 'year')).toBe('Sometime in 1996');
        expect(buildFuzzyLabel(may2010, 'month')).toBe('Sometime in May 2010');
    });

    it('renders a plain day as just the date', () => {
        expect(buildFuzzyLabel(day, 'day')).toBe('May 21, 2010');
    });

    it('renders parts as their own word', () => {
        expect(buildFuzzyLabel(y1996, 'decade', { part: 'early' })).toBe('Early 1990s');
        expect(buildFuzzyLabel(y1996, 'year', { part: 'summer' })).toBe('Summer 1996');
        expect(buildFuzzyLabel(may2010, 'month', { part: 'late' })).toBe('Late May 2010');
        expect(buildFuzzyLabel(day, 'day', { part: 'night' })).toBe('Night of May 21, 2010');
    });

    it('prefixes "Around" when approximate', () => {
        expect(buildFuzzyLabel(y1996, 'year', { approximate: true })).toBe('Around 1996');
        expect(buildFuzzyLabel(y1996, 'decade', { approximate: true })).toBe('Around the 1990s');
        expect(buildFuzzyLabel(may2010, 'month', { part: 'late', approximate: true })).toBe('Around late May 2010');
    });

    it('renders time resolutions with at/Around', () => {
        const t = new Date(Date.UTC(2010, 4, 21, 14, 30, 45));
        expect(buildFuzzyLabel(t, 'minute')).toBe('May 21, 2010 at 14:30');
        expect(buildFuzzyLabel(t, 'minute', { approximate: true })).toBe('Around 14:30 on May 21, 2010');
        expect(buildFuzzyLabel(t, 'second')).toBe('May 21, 2010 at 14:30:45');
    });
});

describe('createFuzzyDateTime — intervals', () => {
    it('computes the plain period window (inclusive latest)', () => {
        const fuzzy = createFuzzyDateTime(new Date(Date.UTC(1996, 5, 10)), 'year');
        expect(fuzzy.timestamp).toBe(unix(1996));
        expect(fuzzy.earliest).toBe(unix(1996));
        expect(fuzzy.latest).toBe(unix(1997) - 1); // Dec 31 1996 23:59:59
        expect(fuzzy.part).toBeUndefined();
        expect(fuzzy.approximate).toBeUndefined();
    });

    it('narrows the window by a part and anchors the timestamp to its start', () => {
        const early90s = createFuzzyDateTime(new Date(Date.UTC(1994, 0, 1)), 'decade', { part: 'early' });
        expect(early90s.label).toBe('Early 1990s');
        expect(early90s.timestamp).toBe(unix(1990));
        expect(early90s.earliest).toBe(unix(1990));
        expect(early90s.latest).toBe(unix(1994) - 1); // early = years 0–3

        const late90s = createFuzzyDateTime(new Date(Date.UTC(1994, 0, 1)), 'decade', { part: 'late' });
        expect(late90s.timestamp).toBe(unix(1997)); // sorts after early
        expect(late90s.latest).toBe(unix(2000) - 1);

        const lateMay = createFuzzyDateTime(new Date(Date.UTC(2010, 4, 1)), 'month', { part: 'late' });
        expect(lateMay.earliest).toBe(unix(2010, 4, 21));
        expect(lateMay.latest).toBe(unix(2010, 5, 1) - 1);
    });

    it('maps seasons by hemisphere, winter belonging to its start year', () => {
        const summerN = createFuzzyDateTime(new Date(Date.UTC(1998, 0, 1)), 'year', { part: 'summer' });
        expect(summerN.label).toBe('Summer 1998');
        expect(summerN.earliest).toBe(unix(1998, 5, 1));
        expect(summerN.latest).toBe(unix(1998, 8, 1) - 1);

        const winterN = createFuzzyDateTime(new Date(Date.UTC(1998, 0, 1)), 'year', { part: 'winter' });
        expect(winterN.earliest).toBe(unix(1998, 11, 1)); // Dec 1998 …
        expect(winterN.latest).toBe(unix(1999, 2, 1) - 1); // … Feb 1999

        const summerS = createFuzzyDateTime(new Date(Date.UTC(1998, 0, 1)), 'year', {
            part: 'summer',
            hemisphere: 'south',
        });
        expect(summerS.earliest).toBe(unix(1998, 11, 1)); // southern summer = Dec–Feb
        expect(summerS.latest).toBe(unix(1999, 2, 1) - 1);
    });

    it('computes day-part windows within the same date', () => {
        const night = createFuzzyDateTime(new Date(Date.UTC(2010, 4, 21)), 'day', { part: 'night' });
        expect(night.earliest).toBe(unix(2010, 4, 21, 21));
        expect(night.latest).toBe(unix(2010, 4, 22) - 1);
        expect(night.timestamp).toBe(unix(2010, 4, 21, 21));
    });

    it('widens the window when approximate, leaving the timestamp anchored', () => {
        const around1996 = createFuzzyDateTime(new Date(Date.UTC(1996, 0, 1)), 'year', { approximate: true });
        expect(around1996.approximate).toBe(true);
        expect(around1996.timestamp).toBe(unix(1996));
        expect(around1996.earliest).toBe(unix(1995)); // ±1 year
        expect(around1996.latest).toBe(unix(1998) - 1);

        const aroundMay = createFuzzyDateTime(new Date(Date.UTC(2010, 4, 1)), 'month', { approximate: true });
        expect(aroundMay.earliest).toBe(unix(2010, 3, 1)); // ±1 month
        expect(aroundMay.latest).toBe(unix(2010, 6, 1) - 1);
    });

    it('silently drops a part that is invalid for the resolution', () => {
        const fuzzy = createFuzzyDateTime(new Date(Date.UTC(2010, 4, 1)), 'month', { part: 'summer' });
        expect(fuzzy.part).toBeUndefined();
        expect(fuzzy.label).toBe('Sometime in May 2010');
    });

    it('supports a custom label formatter', () => {
        const fuzzy = createFuzzyDateTime(new Date(Date.UTC(1996, 0, 1)), 'year', {
            formatLabel: (f) => `Watched in ${new Date(f.timestamp * 1000).getUTCFullYear()}`,
        });
        expect(fuzzy.label).toBe('Watched in 1996');
    });
});

describe('parseFuzzyDateTime / refreshFuzzyLabel', () => {
    it('round-trips a part + approximate value', () => {
        const fuzzy = createFuzzyDateTime(new Date(Date.UTC(1998, 0, 1)), 'year', {
            part: 'summer',
            approximate: true,
        });
        const parsed = parseFuzzyDateTime(fuzzy);
        expect(parsed.resolution).toBe('year');
        expect(parsed.part).toBe('summer');
        expect(parsed.approximate).toBe(true);
        expect(parsed.date.getUTCFullYear()).toBe(1998);

        const refreshed = refreshFuzzyLabel({ ...fuzzy, label: 'stale' });
        expect(refreshed.label).toBe(fuzzy.label);
        expect(refreshed.earliest).toBe(fuzzy.earliest);
        expect(refreshed.latest).toBe(fuzzy.latest);
    });
});

describe('encode / decode', () => {
    it('encodes each resolution compactly', () => {
        expect(encodeFuzzyDateTime(createFuzzyDateTime(new Date(Date.UTC(1994, 0, 1)), 'decade'))).toBe('199X');
        expect(encodeFuzzyDateTime(createFuzzyDateTime(new Date(Date.UTC(1996, 0, 1)), 'year'))).toBe('1996');
        expect(encodeFuzzyDateTime(createFuzzyDateTime(new Date(Date.UTC(2010, 4, 1)), 'month'))).toBe('2010-05');
        expect(encodeFuzzyDateTime(createFuzzyDateTime(new Date(Date.UTC(2010, 4, 21)), 'day'))).toBe('2010-05-21');
        expect(encodeFuzzyDateTime(createFuzzyDateTime(new Date(Date.UTC(2010, 4, 21, 14, 30, 45)), 'second'))).toBe(
            '2010-05-21T14:30:45',
        );
    });

    it('suffixes part and approximate', () => {
        const fuzzy = createFuzzyDateTime(new Date(Date.UTC(1998, 0, 1)), 'year', {
            part: 'summer',
            approximate: true,
        });
        expect(encodeFuzzyDateTime(fuzzy)).toBe('1998:summer~');

        const early = createFuzzyDateTime(new Date(Date.UTC(1994, 0, 1)), 'decade', { part: 'early' });
        expect(encodeFuzzyDateTime(early)).toBe('199X:early');
    });

    it('round-trips through decode', () => {
        const cases = [
            '199X',
            '199X:early~',
            '1996',
            '1998:summer',
            '2010-05:late',
            '2010-05-21:night',
            '2010-05-21T14:30',
        ];
        for (const encoded of cases) {
            const decoded = decodeFuzzyDateTime(encoded);
            expect(decoded).not.toBeNull();
            expect(encodeFuzzyDateTime(decoded!)).toBe(encoded);
        }
    });

    it('decodes to full intervals and labels', () => {
        const decoded = decodeFuzzyDateTime('1998:summer')!;
        expect(decoded.resolution).toBe('year');
        expect(decoded.part).toBe('summer');
        expect(decoded.label).toBe('Summer 1998');
        expect(decoded.earliest).toBe(unix(1998, 5, 1));
    });

    it('rejects malformed or invalid input', () => {
        expect(decodeFuzzyDateTime('nonsense')).toBeNull();
        expect(decodeFuzzyDateTime('2010-13')).toBeNull(); // month 13
        expect(decodeFuzzyDateTime('2010-02-30')).toBeNull(); // Feb 30
        expect(decodeFuzzyDateTime('2010-05:summer')).toBeNull(); // season on a month
        expect(decodeFuzzyDateTime('199X:night')).toBeNull(); // day-part on a decade
    });
});

describe('RESOLUTION_LABELS', () => {
    it('has labels for all resolutions including decade', () => {
        for (const res of RESOLUTION_ORDER) {
            expect(typeof RESOLUTION_LABELS[res]).toBe('string');
            expect(RESOLUTION_LABELS[res].length).toBeGreaterThan(0);
        }
    });
});
