/**
 * @ottabase/ottadate — Tests for parseFuzzyInput
 *
 * Typed memories → FuzzyDateTime. Uses a fixed reference "now" (July 21 2026)
 * so relative words and 2-digit expansions are deterministic.
 */

import { describe, expect, it } from 'vitest';
import { parseFuzzyInput } from '../core/parse';

const NOW = new Date(2026, 6, 21, 15, 0, 0); // July 21 2026, local
const parse = (input: string) => parseFuzzyInput(input, { now: NOW });

describe('parseFuzzyInput — the four memory shapes', () => {
    it('parses "early 90s" as a decade with a part', () => {
        const f = parse('early 90s')!;
        expect(f.resolution).toBe('decade');
        expect(f.part).toBe('early');
        expect(f.label).toBe('Early 1990s');
    });

    it('parses "1996" as a year', () => {
        const f = parse('1996')!;
        expect(f.resolution).toBe('year');
        expect(f.label).toBe('Sometime in 1996');
    });

    it('parses "may 2010" as a month', () => {
        const f = parse('may 2010')!;
        expect(f.resolution).toBe('month');
        expect(f.label).toBe('Sometime in May 2010');
    });

    it('parses "21 july 2026" as a day', () => {
        const f = parse('21 july 2026')!;
        expect(f.resolution).toBe('day');
        expect(f.label).toBe('July 21, 2026');
    });
});

describe('parseFuzzyInput — parts, seasons, decades', () => {
    it('parses seasons with 2-digit years', () => {
        const f = parse('summer 98')!;
        expect(f.resolution).toBe('year');
        expect(f.part).toBe('summer');
        expect(f.label).toBe('Summer 1998');
    });

    it('treats "fall" as autumn', () => {
        expect(parse('fall 2004')!.part).toBe('autumn');
    });

    it('parses "late may 2010"', () => {
        const f = parse('late may 2010')!;
        expect(f.resolution).toBe('month');
        expect(f.part).toBe('late');
        expect(f.label).toBe('Late May 2010');
    });

    it('parses hyphenated and 4-digit decades', () => {
        expect(parse('mid-90s')!.label).toBe('Mid 1990s');
        expect(parse('the 1980s')!.label).toBe('Sometime in the 1980s');
    });

    it('resolves 2-digit decades to the most recent past occurrence', () => {
        expect(parse('20s')!.label).toContain('2020s');
        expect(parse('30s')!.label).toContain('1930s'); // 2030s hasn't happened
        expect(parse('90s')!.label).toContain('1990s');
    });

    it('parses a bare season as this year', () => {
        const f = parse('summer')!;
        expect(f.label).toBe('Summer 2026');
    });
});

describe('parseFuzzyInput — approximate markers', () => {
    it.each(['around 1996', '~1996', '1996ish', 'about 1996', 'roughly 1996'])('parses %s', (input) => {
        const f = parse(input)!;
        expect(f.approximate).toBe(true);
        expect(f.label).toBe('Around 1996');
    });

    it('parses "96ish"', () => {
        const f = parse('96ish')!;
        expect(f.approximate).toBe(true);
        expect(f.label).toBe('Around 1996');
    });
});

describe('parseFuzzyInput — days and times', () => {
    it('handles ordinals and filler words', () => {
        const f = parse('sometime on the 21st of july 2026')!;
        expect(f.resolution).toBe('day');
        expect(f.label).toBe('July 21, 2026');
    });

    it('reads "may 10" as May 10 of the current year (day, not 2010)', () => {
        const f = parse('may 10')!;
        expect(f.resolution).toBe('day');
        expect(f.label).toBe('May 10, 2026');
    });

    it('parses times when a full date is present', () => {
        expect(parse('21 jul 2010 14:30')!.resolution).toBe('minute');
        expect(parse('21 jul 2010 14:30:45')!.resolution).toBe('second');
        const pm = parse('may 21 2010 9pm')!;
        expect(pm.resolution).toBe('hour');
        expect(pm.label).toBe('May 21, 2010 at 21:00');
    });

    it('rejects a time without a full date', () => {
        expect(parse('may 2010 14:30')).toBeNull();
    });
});

describe('parseFuzzyInput — relative words', () => {
    it('parses today and yesterday at day resolution', () => {
        expect(parse('today')!.label).toBe('July 21, 2026');
        expect(parse('yesterday')!.label).toBe('July 20, 2026');
    });

    it('parses tonight / last night / this morning as day-parts', () => {
        expect(parse('tonight')!.label).toBe('Night of July 21, 2026');
        expect(parse('last night')!.label).toBe('Night of July 20, 2026');
        expect(parse('this morning')!.label).toBe('Morning of July 21, 2026');
    });

    it('rejects relative words mixed with explicit dates', () => {
        expect(parse('yesterday 1996')).toBeNull();
    });
});

describe('parseFuzzyInput — strictness', () => {
    it('rejects empty, garbage, and unknown tokens', () => {
        expect(parse('')).toBeNull();
        expect(parse('banana')).toBeNull();
        expect(parse('may 2010 banana')).toBeNull();
    });

    it('rejects contradictory combinations', () => {
        expect(parse('summer may 2010')).toBeNull(); // season + month
        expect(parse('early may 21 2010')).toBeNull(); // part + precise day
        expect(parse('1996 90s')).toBeNull(); // year + decade
        expect(parse('night 90s')).toBeNull(); // day-part on a decade
        expect(parse('1996 1997')).toBeNull(); // two years
    });

    it('rejects invalid calendar dates', () => {
        expect(parse('30 feb 2020')).toBeNull();
        expect(parse('32 jan 2020')).toBeNull();
    });
});
