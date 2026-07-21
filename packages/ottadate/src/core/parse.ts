/**
 * @ottabase/ottadate — parseFuzzyInput
 *
 * Turns a typed memory into a FuzzyDateTime — the text front-end to the same
 * vocabulary the pickers build visually. A small token grammar (no NLP deps):
 *
 *   "early 90s"        → decade + part        "Early 1990s"
 *   "1996" / "96ish"   → year (~ from "ish")  "Sometime in 1996" / "Around 1996"
 *   "summer 98"        → year + season        "Summer 1998"
 *   "late may 2010"    → month + part         "Late May 2010"
 *   "21 july 2026"     → day                  "July 21, 2026"
 *   "may 21 2010 9pm"  → hour                 "May 21, 2010 at 21:00"
 *   "yesterday" / "last night" / "tonight" / "this morning"
 *
 * Deliberately STRICT: any unrecognized token fails the parse (null) rather
 * than guessing — a wrong date silently accepted is worse than a red ring.
 * English-only for now. Ambiguity conventions: "may 10" reads as May 10 of the
 * current year (day, not 2010); two-digit years/decades resolve to the most
 * recent past occurrence ("98" → 1998, "20s" → 2020s, "30s" → 1930s).
 */

import type { DatePart, FuzzyDateTime } from './types';
import { createFuzzyDateTime, type CreateFuzzyOptions } from './fuzzy';

export interface ParseFuzzyOptions extends Pick<CreateFuzzyOptions, 'hemisphere' | 'formatLabel'> {
    /** Reference "now" for relative words and 2-digit years. Default: new Date() */
    now?: Date;
}

const MONTHS: Record<string, number> = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
};

const SEASONS: Record<string, DatePart> = {
    spring: 'spring',
    summer: 'summer',
    autumn: 'autumn',
    fall: 'autumn',
    winter: 'winter',
};

const EML: DatePart[] = ['early', 'mid', 'late'];
const DAY_PARTS: DatePart[] = ['morning', 'afternoon', 'evening', 'night'];
const APPROX_WORDS = ['about', 'around', 'approx', 'approximately', 'roughly', 'circa', 'ca', 'ish'];
const FILLER_WORDS = ['of', 'the', 'in', 'on', 'at', 'a', 'an', 'sometime'];

/** Most recent past occurrence of a 2-digit year ("98" → 1998, "26" → 2026) */
function expandTwoDigitYear(twoDigit: number, nowYear: number): number {
    const inCurrentCentury = Math.floor(nowYear / 100) * 100 + twoDigit;
    return inCurrentCentury <= nowYear ? inCurrentCentury : inCurrentCentury - 100;
}

/** Most recent past occurrence of a 2-digit decade ("90s" → 1990s, "20s" → 2020s) */
function expandTwoDigitDecade(twoDigit: number, nowYear: number): number {
    const nowDecade = nowYear - (nowYear % 10);
    const inCurrentCentury = Math.floor(nowYear / 100) * 100 + twoDigit;
    return inCurrentCentury <= nowDecade ? inCurrentCentury : inCurrentCentury - 100;
}

/**
 * Parse a typed memory into a FuzzyDateTime, or null when the input is empty,
 * ambiguous, contradictory, or contains anything unrecognized.
 */
export function parseFuzzyInput(input: string, options: ParseFuzzyOptions = {}): FuzzyDateTime | null {
    const now = options.now ?? new Date();
    const nowYear = now.getFullYear();

    let str = input.toLowerCase().trim();
    if (!str) return null;
    str = str.replace(/,/g, ' ').replace(/[’']/g, '').replace(/~/g, ' ~ ');
    // "mid-90s" / "early-may" → separate part token
    str = str.replace(/\b(early|mid|late)-/g, '$1 ');
    const tokens = str.split(/\s+/).filter(Boolean);

    let decade: number | null = null;
    let year: number | null = null;
    let month: number | null = null;
    let part: DatePart | null = null;
    let approximate = false;
    let hour: number | null = null;
    let minute: number | null = null;
    let second: number | null = null;
    let relative: 'today' | 'yesterday' | null = null;
    const smallNumbers: number[] = [];

    const setPart = (p: DatePart) => {
        if (part && part !== p) return false; // two different parts → fail
        part = p;
        return true;
    };

    for (let i = 0; i < tokens.length; i++) {
        let t = tokens[i];

        if (t === '~') {
            approximate = true;
            continue;
        }
        // "1996ish" / "summerish" → approximate + the base token
        if (t.length > 3 && t.endsWith('ish')) {
            approximate = true;
            t = t.slice(0, -3);
        }
        if (APPROX_WORDS.includes(t)) {
            approximate = true;
            continue;
        }
        if (FILLER_WORDS.includes(t)) continue;

        // Relative words (the journaling hot path)
        if (t === 'today') {
            relative = 'today';
            continue;
        }
        if (t === 'yesterday') {
            relative = 'yesterday';
            continue;
        }
        if (t === 'tonight') {
            relative = 'today';
            if (!setPart('night')) return null;
            continue;
        }
        if (t === 'last' && tokens[i + 1] === 'night') {
            relative = 'yesterday';
            if (!setPart('night')) return null;
            i++;
            continue;
        }
        if (t === 'this' && DAY_PARTS.includes(tokens[i + 1] as DatePart)) {
            relative = 'today';
            if (!setPart(tokens[i + 1] as DatePart)) return null;
            i++;
            continue;
        }

        if (t in MONTHS) {
            if (month != null) return null;
            month = MONTHS[t];
            continue;
        }
        if (t in SEASONS) {
            if (!setPart(SEASONS[t])) return null;
            continue;
        }
        if (EML.includes(t as DatePart) || DAY_PARTS.includes(t as DatePart)) {
            if (!setPart(t as DatePart)) return null;
            continue;
        }

        // Decades: "1990s" / "90s"
        let m = /^(\d{3})0s$/.exec(t);
        if (m) {
            if (decade != null) return null;
            decade = parseInt(m[1], 10) * 10;
            continue;
        }
        m = /^(\d)0s$/.exec(t);
        if (m) {
            if (decade != null) return null;
            decade = expandTwoDigitDecade(parseInt(m[1], 10) * 10, nowYear);
            continue;
        }

        // Time: "14:30", "14:30:45", "2:30pm"
        m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(am|pm)?$/.exec(t);
        if (m) {
            if (hour != null) return null;
            let h = parseInt(m[1], 10);
            const mi = parseInt(m[2], 10);
            const s = m[3] != null ? parseInt(m[3], 10) : null;
            if (m[4] === 'pm' && h < 12) h += 12;
            if (m[4] === 'am' && h === 12) h = 0;
            if (h > 23 || mi > 59 || (s != null && s > 59)) return null;
            hour = h;
            minute = mi;
            second = s;
            continue;
        }
        // "9pm" / "12am"
        m = /^(\d{1,2})(am|pm)$/.exec(t);
        if (m) {
            if (hour != null) return null;
            let h = parseInt(m[1], 10);
            if (h < 1 || h > 12) return null;
            if (m[2] === 'pm' && h < 12) h += 12;
            if (m[2] === 'am' && h === 12) h = 0;
            hour = h;
            continue;
        }

        // Ordinals: "21st" → 21
        m = /^(\d{1,2})(st|nd|rd|th)$/.exec(t);
        if (m) t = m[1];

        if (/^\d{4}$/.test(t)) {
            if (year != null) return null;
            year = parseInt(t, 10);
            continue;
        }
        if (/^\d{1,2}$/.test(t)) {
            smallNumbers.push(parseInt(t, 10));
            continue;
        }

        return null; // anything unrecognized fails the whole parse
    }

    // --- Assembly ---

    let day: number | null = null;

    if (relative) {
        // Relative words own the whole date — explicit date tokens contradict them
        if (decade != null || year != null || month != null || smallNumbers.length) return null;
        const d = new Date(now.getTime());
        if (relative === 'yesterday') d.setDate(d.getDate() - 1);
        year = d.getFullYear();
        month = d.getMonth();
        day = d.getDate();
    }

    if (decade != null) {
        // A decade is terminal — no finer tokens may accompany it
        if (year != null || month != null || smallNumbers.length || hour != null) return null;
        if (part && !EML.includes(part)) return null;
        return createFuzzyDateTime(new Date(Date.UTC(decade, 0, 1)), 'decade', {
            part,
            approximate,
            hemisphere: options.hemisphere,
            formatLabel: options.formatLabel,
        });
    }

    // Distribute leftover 1–2 digit numbers: day (≤31, needs a month) or 2-digit year
    for (const n of smallNumbers) {
        if (month != null && n >= 1 && n <= 31 && day == null) {
            day = n;
        } else if (year == null && n >= 32) {
            year = expandTwoDigitYear(n, nowYear);
        } else if (year == null && month == null && day == null) {
            year = expandTwoDigitYear(n, nowYear); // "summer 12" → 2012
        } else {
            return null;
        }
    }

    if (month != null && year == null) year = nowYear; // "in may" → May this year
    if (part && year == null && month == null) year = nowYear; // "summer" → this year
    if (year == null) return null;
    if (year < 1000 || year > 9999) return null;
    if (day != null && month == null) return null;

    // Validate the day against the actual month length
    if (day != null && month != null) {
        const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        if (day < 1 || day > daysInMonth) return null;
    }

    if (hour != null && day == null) return null; // a time needs a full date

    // Part validity against the final resolution
    if (part) {
        if (hour != null) return null; // "night 14:30" is contradictory
        if (DAY_PARTS.includes(part) && day == null) return null;
        if (!DAY_PARTS.includes(part) && day != null) return null; // "early may 21" — day is already precise
        if (part in SEASONS || ['spring', 'summer', 'autumn', 'winter'].includes(part)) {
            if (month != null) return null; // "summer may 2010" is contradictory
        }
    }

    const resolution =
        hour != null
            ? second != null
                ? 'second'
                : minute != null
                  ? 'minute'
                  : 'hour'
            : day != null
              ? 'day'
              : month != null
                ? 'month'
                : 'year';

    const date = new Date(Date.UTC(year, month ?? 0, day ?? 1, hour ?? 0, minute ?? 0, second ?? 0));
    return createFuzzyDateTime(date, resolution, {
        part,
        approximate,
        hemisphere: options.hemisphere,
        formatLabel: options.formatLabel,
    });
}
