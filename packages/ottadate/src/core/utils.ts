/**
 * @ottabase/ottadate — Date utility helpers
 *
 * Thin wrappers around date-fns for common calendar operations.
 * All internal dates use JS Date objects; conversion to/from unix timestamps
 * happens at the boundary (getValue / setValue / onChange).
 */

import {
    addMonths,
    addYears,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format as fnsFormat,
    getDate,
    getHours,
    getMinutes,
    getMonth,
    getSeconds,
    getYear,
    isAfter,
    isBefore,
    isSameDay,
    isSameMonth,
    isValid,
    isWithinInterval,
    setDate,
    setHours,
    setMinutes,
    setMonth,
    setSeconds,
    setYear,
    startOfMonth,
    startOfWeek,
    subMonths,
    subYears,
} from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import type { OttaDateConfig, TimestampFormat } from './types';

// ---------------------------------------------------------------------------
// Config defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: Required<
    Pick<
        OttaDateConfig,
        | 'timezone'
        | 'timestampFormat'
        | 'firstDayOfWeek'
        | 'displayFormat'
        | 'timeDisplayFormat'
        | 'classPrefix'
        | 'inline'
        | 'placeholder'
        | 'disabled'
    >
> & { locale: any } = {
    timezone: 'auto',
    timestampFormat: 'unix',
    locale: 'en-US',
    firstDayOfWeek: 1,
    displayFormat: 'MMM d, yyyy',
    timeDisplayFormat: 'HH:mm',
    classPrefix: 'ottadate',
    inline: false,
    placeholder: 'Select date…',
    disabled: false,
};

/** Merge user config with defaults */
export function resolveConfig<T extends OttaDateConfig>(options: T): T & typeof DEFAULT_CONFIG {
    return { ...DEFAULT_CONFIG, ...options };
}

/** Extract string locale from config.locale */
export function getIntlLocale(locale: any): string {
    if (typeof locale === 'string') return locale;
    if (locale && typeof locale.code === 'string') return locale.code;
    return 'en-US';
}

// ---------------------------------------------------------------------------
// Timezone helpers
// ---------------------------------------------------------------------------

/** Detect the user's IANA timezone from the browser */
export function detectTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        return 'UTC';
    }
}

/** Resolve 'auto' to the user's detected timezone */
export function resolveTimezone(tz: string | 'auto'): string {
    return tz === 'auto' ? detectTimezone() : tz;
}

// ---------------------------------------------------------------------------
// Timestamp conversion — boundary layer (external ↔ internal Date)
// ---------------------------------------------------------------------------

/**
 * Convert an external value to a JS Date.
 * Handles unix seconds, ISO strings, and Date objects.
 */
export function toDate(value: number | string | Date | null | undefined, timeZone?: string): Date | null {
    if (value == null) return null;
    let d: Date | null = null;
    if (value instanceof Date) {
        d = isValid(value) ? value : null;
    } else if (typeof value === 'string') {
        const parsed = new Date(value);
        d = isValid(parsed) ? parsed : null;
    } else if (typeof value === 'number') {
        // Unix seconds → ms
        const parsed = new Date(value * 1000);
        d = isValid(parsed) ? parsed : null;
    }

    if (d && timeZone) {
        return toZonedTime(d, timeZone);
    }
    return d;
}

/** Convert a JS Date back to the configured output format */
export function fromDate(date: Date | null, format: TimestampFormat, timeZone?: string): number | string | Date | null {
    if (!date || !isValid(date)) return null;
    const realDate = timeZone ? fromZonedTime(date, timeZone) : date;
    switch (format) {
        case 'unix':
            return Math.floor(realDate.getTime() / 1000);
        case 'iso':
            return realDate.toISOString();
        case 'date':
            return realDate;
        default:
            return Math.floor(realDate.getTime() / 1000);
    }
}

// ---------------------------------------------------------------------------
// Calendar grid helpers
// ---------------------------------------------------------------------------

/**
 * Build the 6-week calendar grid for a given month.
 * Returns a flat array of Date objects (always 42 days for consistent grid).
 */
export function buildCalendarGrid(year: number, month: number, weekStartsOn: 0 | 1 = 1): Date[] {
    const monthStart = startOfMonth(new Date(year, month));
    const monthEnd = endOfMonth(monthStart);
    const gridStart = startOfWeek(monthStart, { weekStartsOn });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn });

    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

    // Pad to 42 days (6 rows × 7 cols) for consistent grid height
    while (days.length < 42) {
        const lastDay = days[days.length - 1];
        days.push(new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1));
    }
    return days;
}

/** Get short weekday labels, respecting weekStartsOn */
export function getWeekdayLabels(weekStartsOn: 0 | 1 = 1, localeStr: string = 'en-US'): string[] {
    const formatter = new Intl.DateTimeFormat(localeStr, { weekday: 'short' });
    // Jan 3 2021 is Sunday
    const dates = Array.from({ length: 7 }, (_, i) => new Date(2021, 0, 3 + i));
    const labels = dates.map((d) => {
        const label = formatter.format(d);
        // Truncate to 2 characters for common calendar headers (e.g., "Mon" -> "Mo")
        return label.slice(0, 2);
    });
    if (weekStartsOn === 1) {
        return [...labels.slice(1), labels[0]];
    }
    return labels;
}

/** Generate array of month names */
export function getMonthNames(localeStr: string = 'en-US'): string[] {
    const formatter = new Intl.DateTimeFormat(localeStr, { month: 'long' });
    return Array.from({ length: 12 }, (_, i) => formatter.format(new Date(2021, i, 1)));
}

/** Generate array of abbreviated month names */
export function getMonthNamesShort(localeStr: string = 'en-US'): string[] {
    const formatter = new Intl.DateTimeFormat(localeStr, { month: 'short' });
    return Array.from({ length: 12 }, (_, i) => formatter.format(new Date(2021, i, 1)));
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

/** Format a date using date-fns format string */
export function formatDate(date: Date | null, formatStr: string, localeObj?: any): string {
    if (!date || !isValid(date)) return '';
    const options =
        localeObj && typeof localeObj === 'object' && localeObj.localize ? { locale: localeObj } : undefined;
    return fnsFormat(date, formatStr, options);
}

/** Format a date for display with user's timezone context */
export function formatDisplay(date: Date | null, displayFormat: string, localeObj?: any): string {
    return formatDate(date, displayFormat, localeObj);
}

/** Format time portion */
export function formatTime(date: Date | null, timeFormat: string, localeObj?: any): string {
    return formatDate(date, timeFormat, localeObj);
}

// ---------------------------------------------------------------------------
// Date comparison helpers
// ---------------------------------------------------------------------------

export {
    addMonths,
    addYears,
    getDate,
    getHours,
    getMinutes,
    getMonth,
    getSeconds,
    getYear,
    isAfter,
    isBefore,
    isSameDay,
    isSameMonth,
    isValid,
    isWithinInterval,
    setDate,
    setHours,
    setMinutes,
    setMonth,
    setSeconds,
    setYear,
    subMonths,
    subYears,
};

// ---------------------------------------------------------------------------
// Constraint helpers
// ---------------------------------------------------------------------------

/** Check if a date is within min/max bounds */
export function isDateInBounds(date: Date, minDate?: Date | null, maxDate?: Date | null): boolean {
    if (minDate && isBefore(date, minDate)) return false;
    if (maxDate && isAfter(date, maxDate)) return false;
    return true;
}

// ---------------------------------------------------------------------------
// Hour/minute/second generation helpers
// ---------------------------------------------------------------------------

/** Generate hours array (0–23) */
export function getHoursList(): number[] {
    return Array.from({ length: 24 }, (_, i) => i);
}

/** Generate minutes array with step */
export function getMinutesList(step: number = 1): number[] {
    const mins: number[] = [];
    for (let i = 0; i < 60; i += step) {
        mins.push(i);
    }
    return mins;
}

/** Generate seconds array */
export function getSecondsList(): number[] {
    return Array.from({ length: 60 }, (_, i) => i);
}

/** Pad a number to 2 digits */
export function pad2(n: number): string {
    return n.toString().padStart(2, '0');
}

/** Format hour for 12h display */
export function formatHour12(hour: number): string {
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? 'AM' : 'PM';
    return `${h} ${ampm}`;
}

// ---------------------------------------------------------------------------
// Year range helper
// ---------------------------------------------------------------------------

/** Generate a range of years around a center year */
export function getYearRange(centerYear: number, range: number = 10): number[] {
    const start = centerYear - range;
    const end = centerYear + range;
    const years: number[] = [];
    for (let y = start; y <= end; y++) {
        years.push(y);
    }
    return years;
}
