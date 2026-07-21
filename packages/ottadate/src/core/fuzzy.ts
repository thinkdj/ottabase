/**
 * @ottabase/ottadate — FuzzyDateTime core logic
 *
 * Handles dates where the user only remembers part of the date.
 * e.g. "Early 1990s", "Summer 1998", "Sometime in May 2010", "May 21, 2010 at 14:30"
 *
 * Three orthogonal ingredients:
 *
 *   resolution — the finest unit the user actually NAMED (decade → second)
 *   part       — a terminal part-of-period refinement, the coarse human answer
 *                to "when in X?" ("early", "summer", "night") instead of naming
 *                the next unit
 *   approximate — "~ish": the boundary itself is soft ("Around 1996" → could
 *                 be 1995 or 1997)
 *
 * Every FuzzyDateTime carries a computed inclusive interval [earliest, latest]
 * (UTC unix seconds) — the machine-usable truth that makes fuzzy dates
 * sortable, filterable, and renderable as bands on a timeline.
 */

import type { DatePart, DateResolution, FuzzyDateTime, FuzzyLabelFormatter, Hemisphere } from './types';
import { getMonthNames, pad2 } from './utils';

// ---------------------------------------------------------------------------
// Ordered resolution levels (coarsest → finest)
// ---------------------------------------------------------------------------

export const RESOLUTION_ORDER: DateResolution[] = ['decade', 'year', 'month', 'day', 'hour', 'minute', 'second'];

/** Default drill-down bounds for pickers — `decade` is opt-in, pass it explicitly. */
export const DEFAULT_RESOLUTIONS: DateResolution[] = ['year', 'month', 'day', 'hour', 'minute', 'second'];

/** Get the numeric index of a resolution (lower = coarser) */
export function resolutionIndex(res: DateResolution): number {
    return RESOLUTION_ORDER.indexOf(res);
}

/** Check if resolution A is finer than or equal to resolution B */
export function isResolutionFinerOrEqual(a: DateResolution, b: DateResolution): boolean {
    return resolutionIndex(a) >= resolutionIndex(b);
}

/**
 * Coarsest ("base") and finest resolution of an allowed-resolutions list.
 * The base is the minimum precision a selection must reach; the finest is how
 * deep the picker lets the user drill. Falls back to DEFAULT_RESOLUTIONS
 * (year → second) so decade never appears unless explicitly requested.
 */
export function resolutionBounds(allowed?: DateResolution[]): { base: DateResolution; finest: DateResolution } {
    const list = allowed && allowed.length ? allowed : DEFAULT_RESOLUTIONS;
    let base = list[0];
    let finest = list[0];
    for (const res of list) {
        if (resolutionIndex(res) < resolutionIndex(base)) base = res;
        if (resolutionIndex(res) > resolutionIndex(finest)) finest = res;
    }
    return { base, finest };
}

// ---------------------------------------------------------------------------
// Parts — the per-level "coarse sub-region" vocabulary
// ---------------------------------------------------------------------------

export const PART_LABELS: Record<DatePart, string> = {
    early: 'Early',
    mid: 'Mid',
    late: 'Late',
    spring: 'Spring',
    summer: 'Summer',
    autumn: 'Autumn',
    winter: 'Winter',
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
    night: 'Night',
};

/** Valid parts for a given resolution (empty at time-of-day resolutions) */
export function partsForResolution(res: DateResolution): DatePart[] {
    switch (res) {
        case 'decade':
        case 'month':
            return ['early', 'mid', 'late'];
        case 'year':
            return ['early', 'mid', 'late', 'spring', 'summer', 'autumn', 'winter'];
        case 'day':
            return ['morning', 'afternoon', 'evening', 'night'];
        default:
            return [];
    }
}

/** Whether a part is valid for a resolution */
export function isValidPart(res: DateResolution, part: DatePart): boolean {
    return partsForResolution(res).includes(part);
}

// ---------------------------------------------------------------------------
// Snapping
// ---------------------------------------------------------------------------

/**
 * Snap a Date to the start of the given resolution period.
 * e.g. resolution 'month' → zeroes out day/hour/minute/second
 */
export function snapToResolution(date: Date, resolution: DateResolution): Date {
    const d = new Date(date.getTime());

    // Always work in UTC to avoid timezone drift
    switch (resolution) {
        case 'decade':
            d.setUTCFullYear(d.getUTCFullYear() - (d.getUTCFullYear() % 10), 0, 1);
            d.setUTCHours(0, 0, 0, 0);
            break;
        case 'year':
            d.setUTCMonth(0, 1);
            d.setUTCHours(0, 0, 0, 0);
            break;
        case 'month':
            d.setUTCDate(1);
            d.setUTCHours(0, 0, 0, 0);
            break;
        case 'day':
            d.setUTCHours(0, 0, 0, 0);
            break;
        case 'hour':
            d.setUTCMinutes(0, 0, 0);
            break;
        case 'minute':
            d.setUTCSeconds(0, 0);
            break;
        case 'second':
            d.setUTCMilliseconds(0);
            break;
    }

    return d;
}

// ---------------------------------------------------------------------------
// Interval math — the [earliest, latest] window
// ---------------------------------------------------------------------------

/** Half-open UTC window [start, endEx) used internally; latest = endEx − 1s */
interface UtcWindow {
    start: Date;
    endEx: Date;
}

const utc = (y: number, mo = 0, d = 1, h = 0, mi = 0, s = 0) => new Date(Date.UTC(y, mo, d, h, mi, s));

/** Season → [startMonth, endMonthEx) offsets, relative to the season's year. Winter/summer may cross into the next year. */
function seasonMonths(part: DatePart, hemisphere: Hemisphere): { from: number; toEx: number } {
    const north = hemisphere !== 'south';
    switch (part) {
        case 'spring':
            return north ? { from: 2, toEx: 5 } : { from: 8, toEx: 11 };
        case 'summer':
            return north ? { from: 5, toEx: 8 } : { from: 11, toEx: 14 }; // south: Dec → Feb next year
        case 'autumn':
            return north ? { from: 8, toEx: 11 } : { from: 2, toEx: 5 };
        default: // winter
            return north ? { from: 11, toEx: 14 } : { from: 5, toEx: 8 }; // north: Dec → Feb next year
    }
}

/**
 * Compute the core (unwidened) window for a snapped date + resolution + part.
 *
 * Part boundaries (documented conventions):
 *   decade  early = years 0–3, mid = 4–6, late = 7–9
 *   year    early = Jan–Apr, mid = May–Aug, late = Sep–Dec; seasons via hemisphere
 *           (winter belongs to the year it STARTS in: "Winter 1998" = Dec 1998 – Feb 1999)
 *   month   early = 1–10, mid = 11–20, late = 21–end
 *   day     morning 05–11, afternoon 12–16, evening 17–20, night 21–23 (same date)
 */
function coreWindow(
    snapped: Date,
    resolution: DateResolution,
    part: DatePart | null,
    hemisphere: Hemisphere,
): UtcWindow {
    const y = snapped.getUTCFullYear();
    const mo = snapped.getUTCMonth();
    const d = snapped.getUTCDate();
    const h = snapped.getUTCHours();
    const mi = snapped.getUTCMinutes();
    const s = snapped.getUTCSeconds();

    switch (resolution) {
        case 'decade': {
            const start = y - (y % 10);
            if (part === 'early') return { start: utc(start), endEx: utc(start + 4) };
            if (part === 'mid') return { start: utc(start + 4), endEx: utc(start + 7) };
            if (part === 'late') return { start: utc(start + 7), endEx: utc(start + 10) };
            return { start: utc(start), endEx: utc(start + 10) };
        }
        case 'year': {
            if (part === 'early') return { start: utc(y, 0), endEx: utc(y, 4) };
            if (part === 'mid') return { start: utc(y, 4), endEx: utc(y, 8) };
            if (part === 'late') return { start: utc(y, 8), endEx: utc(y + 1, 0) };
            if (part) {
                const { from, toEx } = seasonMonths(part, hemisphere);
                return { start: utc(y, from), endEx: utc(y, toEx) };
            }
            return { start: utc(y), endEx: utc(y + 1) };
        }
        case 'month': {
            if (part === 'early') return { start: utc(y, mo, 1), endEx: utc(y, mo, 11) };
            if (part === 'mid') return { start: utc(y, mo, 11), endEx: utc(y, mo, 21) };
            if (part === 'late') return { start: utc(y, mo, 21), endEx: utc(y, mo + 1, 1) };
            return { start: utc(y, mo, 1), endEx: utc(y, mo + 1, 1) };
        }
        case 'day': {
            if (part === 'morning') return { start: utc(y, mo, d, 5), endEx: utc(y, mo, d, 12) };
            if (part === 'afternoon') return { start: utc(y, mo, d, 12), endEx: utc(y, mo, d, 17) };
            if (part === 'evening') return { start: utc(y, mo, d, 17), endEx: utc(y, mo, d, 21) };
            if (part === 'night') return { start: utc(y, mo, d, 21), endEx: utc(y, mo, d + 1) };
            return { start: utc(y, mo, d), endEx: utc(y, mo, d + 1) };
        }
        case 'hour':
            return { start: utc(y, mo, d, h), endEx: utc(y, mo, d, h + 1) };
        case 'minute':
            return { start: utc(y, mo, d, h, mi), endEx: utc(y, mo, d, h, mi + 1) };
        default: // second
            return { start: utc(y, mo, d, h, mi, s), endEx: utc(y, mo, d, h, mi, s + 1) };
    }
}

/**
 * How much `approximate` widens the window on each side. Deliberately a fixed,
 * predictable table (in the sub-unit natural to each grain) rather than a
 * clever formula:
 *
 *   decade ±3y (with part ±1y) · year ±1y (±1mo) · month ±1mo (±3d)
 *   day ±1d (±2h) · hour ±1h · minute ±15min · second ±15s
 */
function widenWindow(win: UtcWindow, resolution: DateResolution, hasPart: boolean): UtcWindow {
    const shift = (date: Date, y: number, mo: number, d: number, h: number, mi: number, s: number, sign: 1 | -1) =>
        new Date(
            Date.UTC(
                date.getUTCFullYear() + sign * y,
                date.getUTCMonth() + sign * mo,
                date.getUTCDate() + sign * d,
                date.getUTCHours() + sign * h,
                date.getUTCMinutes() + sign * mi,
                date.getUTCSeconds() + sign * s,
            ),
        );

    let y = 0,
        mo = 0,
        d = 0,
        h = 0,
        mi = 0,
        s = 0;
    switch (resolution) {
        case 'decade':
            y = hasPart ? 1 : 3;
            break;
        case 'year':
            if (hasPart) mo = 1;
            else y = 1;
            break;
        case 'month':
            if (hasPart) d = 3;
            else mo = 1;
            break;
        case 'day':
            if (hasPart) h = 2;
            else d = 1;
            break;
        case 'hour':
            h = 1;
            break;
        case 'minute':
            mi = 15;
            break;
        default: // second
            s = 15;
            break;
    }

    return {
        start: shift(win.start, y, mo, d, h, mi, s, -1),
        endEx: shift(win.endEx, y, mo, d, h, mi, s, 1),
    };
}

// ---------------------------------------------------------------------------
// Human-readable labels
// ---------------------------------------------------------------------------

export interface FuzzyLabelOptions {
    part?: DatePart | null;
    approximate?: boolean;
}

/**
 * Build a human-readable label for a FuzzyDateTime.
 *
 * Phrasing is fully derived — there is no user-chosen "sometime/around" enum.
 * A plain coarse period reads as "Sometime in …" (that's what coarse precision
 * MEANS for a point event); a part reads as its own word ("Early 1996",
 * "Summer 1998", "Night of May 21, 2010"); `approximate` prefixes "Around".
 *
 * Examples:
 *   decade                → "Sometime in the 1990s"
 *   decade + early        → "Early 1990s"
 *   year + approximate    → "Around 1996"
 *   year + summer         → "Summer 1998"
 *   month                 → "Sometime in May 2010"
 *   month + late + approx → "Around late May 2010"
 *   day                   → "May 21, 2010"
 *   day + night           → "Night of May 21, 2010"
 *   minute                → "May 21, 2010 at 14:30"
 *   minute + approximate  → "Around 14:30 on May 21, 2010"
 */
export function buildFuzzyLabel(date: Date, resolution: DateResolution, options: FuzzyLabelOptions = {}): string {
    const part = options.part ?? null;
    const approx = !!options.approximate;

    const year = date.getUTCFullYear();
    const monthName = getMonthNames()[date.getUTCMonth()];
    const day = date.getUTCDate();
    const hours = pad2(date.getUTCHours());
    const minutes = pad2(date.getUTCMinutes());
    const seconds = pad2(date.getUTCSeconds());

    const partWord = part ? PART_LABELS[part] : '';
    const partLower = partWord.toLowerCase();

    switch (resolution) {
        case 'decade': {
            const decade = `${year - (year % 10)}s`;
            if (part && approx) return `Around the ${partLower} ${decade}`;
            if (part) return `${partWord} ${decade}`;
            if (approx) return `Around the ${decade}`;
            return `Sometime in the ${decade}`;
        }

        case 'year':
            if (part && approx) return `Around ${partLower} ${year}`;
            if (part) return `${partWord} ${year}`;
            if (approx) return `Around ${year}`;
            return `Sometime in ${year}`;

        case 'month':
            if (part && approx) return `Around ${partLower} ${monthName} ${year}`;
            if (part) return `${partWord} ${monthName} ${year}`;
            if (approx) return `Around ${monthName} ${year}`;
            return `Sometime in ${monthName} ${year}`;

        case 'day':
            if (part && approx) return `Around the ${partLower} of ${monthName} ${day}, ${year}`;
            if (part) return `${partWord} of ${monthName} ${day}, ${year}`;
            if (approx) return `Around ${monthName} ${day}, ${year}`;
            return `${monthName} ${day}, ${year}`;

        case 'hour':
            return approx
                ? `Around ${hours}:00 on ${monthName} ${day}, ${year}`
                : `${monthName} ${day}, ${year} at ${hours}:00`;

        case 'minute':
            return approx
                ? `Around ${hours}:${minutes} on ${monthName} ${day}, ${year}`
                : `${monthName} ${day}, ${year} at ${hours}:${minutes}`;

        default: // second
            return approx
                ? `Around ${hours}:${minutes}:${seconds} on ${monthName} ${day}, ${year}`
                : `${monthName} ${day}, ${year} at ${hours}:${minutes}:${seconds}`;
    }
}

// ---------------------------------------------------------------------------
// Create / normalize a FuzzyDateTime
// ---------------------------------------------------------------------------

export interface CreateFuzzyOptions {
    /** Terminal part-of-period refinement — silently dropped if invalid for the resolution */
    part?: DatePart | null;
    /** "~ish" — widens the window */
    approximate?: boolean;
    /** Season → month mapping. Default: 'north' */
    hemisphere?: Hemisphere;
    /** Override label generation */
    formatLabel?: FuzzyLabelFormatter;
}

/**
 * Create a FuzzyDateTime. Snaps the date to the resolution period, narrows by
 * `part`, computes the [earliest, latest] interval (widened when `approximate`),
 * and generates a label.
 */
export function createFuzzyDateTime(
    date: Date,
    resolution: DateResolution,
    options: CreateFuzzyOptions = {},
): FuzzyDateTime {
    const hemisphere = options.hemisphere ?? 'north';
    const approximate = !!options.approximate;
    let part = options.part ?? null;
    if (part && !isValidPart(resolution, part)) part = null;

    const snapped = snapToResolution(date, resolution);
    const core = coreWindow(snapped, resolution, part, hemisphere);
    const bounds = approximate ? widenWindow(core, resolution, part != null) : core;

    const fuzzy: Omit<FuzzyDateTime, 'label'> = {
        timestamp: Math.floor(core.start.getTime() / 1000),
        resolution,
        earliest: Math.floor(bounds.start.getTime() / 1000),
        latest: Math.floor(bounds.endEx.getTime() / 1000) - 1,
        ...(part ? { part } : {}),
        ...(approximate ? { approximate: true } : {}),
    };

    const label = options.formatLabel
        ? options.formatLabel(fuzzy)
        : buildFuzzyLabel(snapped, resolution, { part, approximate });

    return { ...fuzzy, label };
}

/**
 * Parse a FuzzyDateTime back to editable components.
 * The returned date is the core-window start (part-narrowed), which always
 * falls inside the named period.
 */
export function parseFuzzyDateTime(fuzzy: FuzzyDateTime): {
    date: Date;
    resolution: DateResolution;
    part: DatePart | null;
    approximate: boolean;
} {
    return {
        date: new Date(fuzzy.timestamp * 1000),
        resolution: fuzzy.resolution,
        part: fuzzy.part ?? null,
        approximate: !!fuzzy.approximate,
    };
}

/**
 * Recompute the derived fields (label + interval) of a FuzzyDateTime,
 * e.g. after editing or when rendering with a different label formatter.
 */
export function refreshFuzzyLabel(
    fuzzy: FuzzyDateTime,
    options: Pick<CreateFuzzyOptions, 'hemisphere' | 'formatLabel'> = {},
): FuzzyDateTime {
    const { date, resolution, part, approximate } = parseFuzzyDateTime(fuzzy);
    return createFuzzyDateTime(date, resolution, { ...options, part, approximate });
}

// ---------------------------------------------------------------------------
// Serialization — compact canonical string encoding (EDTF-inspired)
// ---------------------------------------------------------------------------

/**
 * Encode a FuzzyDateTime as a compact, human-readable string:
 *
 *   "199X"              decade          "199X:early~"    early 1990s, roughly
 *   "1996"              year            "1998:summer"    Summer 1998
 *   "2010-05"           month           "2010-05:late"   Late May 2010
 *   "2010-05-21"        day             "2010-05-21:night"
 *   "2010-05-21T14"     hour            "2010-05-21T14:30:45"  second
 *
 * `:part` suffixes the named period; a trailing `~` marks approximate.
 * Time forms use `T`; parts never apply at time resolutions, so `:` after `T`
 * is always a time separator.
 */
export function encodeFuzzyDateTime(fuzzy: FuzzyDateTime): string {
    const d = new Date(fuzzy.timestamp * 1000);
    const y = d.getUTCFullYear();
    const mo = pad2(d.getUTCMonth() + 1);
    const day = pad2(d.getUTCDate());

    let core: string;
    switch (fuzzy.resolution) {
        case 'decade':
            core = `${Math.floor(y / 10)}X`;
            break;
        case 'year':
            core = `${y}`;
            break;
        case 'month':
            core = `${y}-${mo}`;
            break;
        case 'day':
            core = `${y}-${mo}-${day}`;
            break;
        case 'hour':
            core = `${y}-${mo}-${day}T${pad2(d.getUTCHours())}`;
            break;
        case 'minute':
            core = `${y}-${mo}-${day}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
            break;
        default: // second
            core = `${y}-${mo}-${day}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
            break;
    }

    if (fuzzy.part) core += `:${fuzzy.part}`;
    if (fuzzy.approximate) core += '~';
    return core;
}

/**
 * Decode a compact fuzzy-date string back to a full FuzzyDateTime.
 * Returns null for anything malformed (strict — guarantees round-trip integrity).
 */
export function decodeFuzzyDateTime(
    input: string,
    options: Pick<CreateFuzzyOptions, 'hemisphere' | 'formatLabel'> = {},
): FuzzyDateTime | null {
    let str = input.trim();
    let approximate = false;
    if (str.endsWith('~')) {
        approximate = true;
        str = str.slice(0, -1);
    }

    const build = (date: Date, resolution: DateResolution, part: DatePart | null) => {
        if (part && !isValidPart(resolution, part)) return null;
        return createFuzzyDateTime(date, resolution, { ...options, part, approximate });
    };

    // Time forms — parts never apply, ':' is a time separator
    if (str.includes('T')) {
        const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})(?::(\d{2})(?::(\d{2}))?)?$/.exec(str);
        if (!m) return null;
        const [, ys, mos, ds, hs, mis, ss] = m;
        const date = utc(+ys, +mos - 1, +ds, +hs, mis ? +mis : 0, ss ? +ss : 0);
        // Reject overflowed dates/times (e.g. month 13, hour 25)
        if (date.getUTCMonth() !== +mos - 1 || date.getUTCDate() !== +ds || date.getUTCHours() !== +hs) return null;
        if (mis && date.getUTCMinutes() !== +mis) return null;
        const resolution: DateResolution = ss ? 'second' : mis ? 'minute' : 'hour';
        return build(date, resolution, null);
    }

    // Date forms — optional ':part' suffix
    let part: DatePart | null = null;
    const partMatch = /^(.+?):([a-z]+)$/.exec(str);
    if (partMatch) {
        str = partMatch[1];
        part = partMatch[2] as DatePart;
        if (!(part in PART_LABELS)) return null;
    }

    let m = /^(\d{3})X$/.exec(str);
    if (m) return build(utc(+m[1] * 10), 'decade', part);

    m = /^(\d{4})$/.exec(str);
    if (m) return build(utc(+m[1]), 'year', part);

    m = /^(\d{4})-(\d{2})$/.exec(str);
    if (m) {
        const date = utc(+m[1], +m[2] - 1);
        if (date.getUTCMonth() !== +m[2] - 1) return null;
        return build(date, 'month', part);
    }

    m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
    if (m) {
        const date = utc(+m[1], +m[2] - 1, +m[3]);
        if (date.getUTCMonth() !== +m[2] - 1 || date.getUTCDate() !== +m[3]) return null;
        return build(date, 'day', part);
    }

    return null;
}

// ---------------------------------------------------------------------------
// Resolution labels for UI
// ---------------------------------------------------------------------------

export const RESOLUTION_LABELS: Record<DateResolution, string> = {
    decade: 'Decade',
    year: 'Year',
    month: 'Month',
    day: 'Day',
    hour: 'Hour',
    minute: 'Minute',
    second: 'Second',
};
