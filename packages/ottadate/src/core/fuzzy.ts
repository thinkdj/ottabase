/**
 * @ottabase/ottadate — FuzzyDateTime core logic
 *
 * Handles dates where the user only remembers part of the date.
 * e.g. "Sometime in 2018", "Around May 2020", "Exactly 11:30 May 20 2025"
 *
 * Resolution levels (finest unit the user specified):
 *   year   → "Sometime in 2018"          → stores Jan 1 2018 00:00:00 UTC
 *   month  → "Sometime in May 2020"      → stores May 1 2020 00:00:00 UTC
 *   day    → "Around May 20, 2025"       → stores May 20 2025 00:00:00 UTC
 *   hour   → "Around 11am, May 20 2025"  → stores May 20 2025 11:00:00 UTC
 *   minute → "Around 11:30, May 20 2025" → stores May 20 2025 11:30:00 UTC
 *   second → Exact timestamp             → stores exact time
 */

import type { DateApproximation, DateResolution, FuzzyDateTime } from './types';
import { getMonthNames, pad2 } from './utils';

// ---------------------------------------------------------------------------
// Ordered resolution levels (coarsest → finest)
// ---------------------------------------------------------------------------

export const RESOLUTION_ORDER: DateResolution[] = ['year', 'month', 'day', 'hour', 'minute', 'second'];

/** Get the numeric index of a resolution (lower = coarser) */
export function resolutionIndex(res: DateResolution): number {
    return RESOLUTION_ORDER.indexOf(res);
}

/** Check if resolution A is finer than or equal to resolution B */
export function isResolutionFinerOrEqual(a: DateResolution, b: DateResolution): boolean {
    return resolutionIndex(a) >= resolutionIndex(b);
}

// ---------------------------------------------------------------------------
// Human-readable labels
// ---------------------------------------------------------------------------

const APPROX_LABELS: Record<DateApproximation, string> = {
    exact: '',
    around: 'Around',
    sometime: 'Sometime in',
};

/**
 * Build a human-readable label for a FuzzyDateTime.
 *
 * Examples:
 *   { resolution: 'year',   approximation: 'sometime', ... } → "Sometime in 2018"
 *   { resolution: 'month',  approximation: 'sometime', ... } → "Sometime in May 2020"
 *   { resolution: 'day',    approximation: 'around',   ... } → "Around May 20, 2025"
 *   { resolution: 'hour',   approximation: 'around',   ... } → "Around 11:00, May 20, 2025"
 *   { resolution: 'minute', approximation: 'exact',    ... } → "May 20, 2025 at 11:30"
 *   { resolution: 'second', approximation: 'exact',    ... } → "May 20, 2025 at 11:30:45"
 */
export function buildFuzzyLabel(date: Date, resolution: DateResolution, approximation: DateApproximation): string {
    const year = date.getUTCFullYear();
    const monthName = getMonthNames()[date.getUTCMonth()];
    const day = date.getUTCDate();
    const hours = pad2(date.getUTCHours());
    const minutes = pad2(date.getUTCMinutes());
    const seconds = pad2(date.getUTCSeconds());

    const prefix = APPROX_LABELS[approximation];

    switch (resolution) {
        case 'year':
            return prefix ? `${prefix} ${year}` : `${year}`;

        case 'month':
            return prefix ? `${prefix} ${monthName} ${year}` : `${monthName} ${year}`;

        case 'day':
            if (prefix && approximation !== 'exact') {
                return `${prefix} ${monthName} ${day}, ${year}`;
            }
            return `${monthName} ${day}, ${year}`;

        case 'hour':
            if (prefix && approximation !== 'exact') {
                return `${prefix} ${hours}:00, ${monthName} ${day}, ${year}`;
            }
            return `${monthName} ${day}, ${year} at ${hours}:00`;

        case 'minute':
            if (prefix && approximation !== 'exact') {
                return `${prefix} ${hours}:${minutes}, ${monthName} ${day}, ${year}`;
            }
            return `${monthName} ${day}, ${year} at ${hours}:${minutes}`;

        case 'second':
            if (prefix && approximation !== 'exact') {
                return `${prefix} ${hours}:${minutes}:${seconds}, ${monthName} ${day}, ${year}`;
            }
            return `${monthName} ${day}, ${year} at ${hours}:${minutes}:${seconds}`;

        default:
            return `${monthName} ${day}, ${year}`;
    }
}

// ---------------------------------------------------------------------------
// Create / normalize a FuzzyDateTime
// ---------------------------------------------------------------------------

/**
 * Snap a Date to the start of the given resolution period.
 * e.g. resolution 'month' → zeroes out day/hour/minute/second
 */
export function snapToResolution(date: Date, resolution: DateResolution): Date {
    const d = new Date(date.getTime());

    // Always work in UTC to avoid timezone drift
    switch (resolution) {
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

/**
 * Create a FuzzyDateTime object.
 * Snaps the date to the start of the resolution period and generates a label.
 */
export function createFuzzyDateTime(
    date: Date,
    resolution: DateResolution,
    approximation: DateApproximation = 'sometime',
): FuzzyDateTime {
    const snapped = snapToResolution(date, resolution);
    const timestamp = Math.floor(snapped.getTime() / 1000);
    const label = buildFuzzyLabel(snapped, resolution, approximation);

    return { timestamp, resolution, approximation, label };
}

/**
 * Parse a FuzzyDateTime back to a Date for editing.
 * Returns { date, resolution, approximation }.
 */
export function parseFuzzyDateTime(fuzzy: FuzzyDateTime): {
    date: Date;
    resolution: DateResolution;
    approximation: DateApproximation;
} {
    return {
        date: new Date(fuzzy.timestamp * 1000),
        resolution: fuzzy.resolution,
        approximation: fuzzy.approximation,
    };
}

/**
 * Regenerate the label of a FuzzyDateTime (e.g. after editing).
 */
export function refreshFuzzyLabel(fuzzy: FuzzyDateTime): FuzzyDateTime {
    const date = new Date(fuzzy.timestamp * 1000);
    const label = buildFuzzyLabel(date, fuzzy.resolution, fuzzy.approximation);
    return { ...fuzzy, label };
}

// ---------------------------------------------------------------------------
// Resolution labels for UI
// ---------------------------------------------------------------------------

export const RESOLUTION_LABELS: Record<DateResolution, string> = {
    year: 'Year',
    month: 'Month',
    day: 'Day',
    hour: 'Hour',
    minute: 'Minute',
    second: 'Second',
};

export const APPROXIMATION_LABELS: Record<DateApproximation, string> = {
    exact: 'Exactly',
    around: 'Around',
    sometime: 'Sometime in',
};

/** Get user-friendly description of resolution + approximation combo */
export function getResolutionDescription(resolution: DateResolution): string {
    switch (resolution) {
        case 'year':
            return 'I remember the year';
        case 'month':
            return 'I remember the month and year';
        case 'day':
            return 'I remember the exact date';
        case 'hour':
            return 'I remember the approximate hour';
        case 'minute':
            return 'I remember the time';
        case 'second':
            return 'I know the exact second';
        default:
            return '';
    }
}
