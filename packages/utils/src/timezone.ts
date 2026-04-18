/**
 * Timezone utilities for standardizing date/time operations
 *
 * Core principles:
 * - Server/DB: Always store in UTC
 * - Client: Convert to user's timezone for display
 * - Type-safe: Full TypeScript support
 *
 * @module @ottabase/utils/timezone
 */

import { parseISO, isValid } from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone, getTimezoneOffset } from 'date-fns-tz';

/**
 * Common timezone type for IANA timezone identifiers
 * @example 'America/New_York', 'Europe/London', 'Asia/Tokyo'
 */
export type Timezone = string;

/**
 * Date input type - accepts Date, string (ISO), or number (timestamp)
 */
export type DateInput = Date | string | number;

/**
 * Timezone configuration interface
 */
export interface TimezoneConfig {
    /** Default timezone to use when none is specified */
    defaultTimezone?: Timezone;
    /** User's current timezone */
    userTimezone?: Timezone;
}

/**
 * Default timezone configuration
 * Uses UTC as the default and attempts to detect user's timezone
 */
const defaultConfig: TimezoneConfig = {
    defaultTimezone: 'UTC',
    userTimezone: undefined,
};

let currentConfig = { ...defaultConfig };

/**
 * Set timezone configuration
 * @param config - Timezone configuration options
 *
 * @example
 * ```typescript
 * setTimezoneConfig({
 *   defaultTimezone: 'UTC',
 *   userTimezone: 'America/New_York'
 * });
 * ```
 */
export function setTimezoneConfig(config: Partial<TimezoneConfig>): void {
    currentConfig = { ...currentConfig, ...config };
}

/**
 * Get current timezone configuration
 * @returns Current timezone configuration
 */
export function getTimezoneConfig(): TimezoneConfig {
    return { ...currentConfig };
}

/**
 * Get user's timezone from browser (client-side only)
 * Falls back to configured user timezone or default timezone
 *
 * @returns IANA timezone string
 *
 * @example
 * ```typescript
 * const userTz = getUserTimezone(); // 'America/New_York'
 * ```
 */
export function getUserTimezone(): Timezone {
    // Check configured user timezone first
    if (currentConfig.userTimezone) {
        return currentConfig.userTimezone;
    }

    // Try to detect from browser
    if (typeof window !== 'undefined' && typeof Intl !== 'undefined') {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch (e) {
            // Fallback to default
        }
    }

    return currentConfig.defaultTimezone || 'UTC';
}

/**
 * Validate and convert a date input to a Date object
 * Handles Date objects, ISO strings, and timestamps
 *
 * @param date - Date input (Date, ISO string, or timestamp)
 * @returns Valid Date object or null if invalid
 */
function validateAndConvertToDate(date: DateInput): Date | null {
    if (date instanceof Date) {
        return isValid(date) ? date : null;
    }

    if (typeof date === 'string') {
        const parsed = parseISO(date);
        return isValid(parsed) ? parsed : null;
    }

    if (typeof date === 'number') {
        const parsed = new Date(date);
        return isValid(parsed) ? parsed : null;
    }

    return null;
}

/**
 * Convert a date from any timezone to UTC
 * Use this when storing dates in the database
 *
 * @param date - Date in any timezone
 * @param timezone - Source timezone (defaults to user's timezone)
 * @returns Date object in UTC
 *
 * @example
 * ```typescript
 * // User enters "2024-01-15 14:30" in their timezone (EST)
 * const utcDate = toUTC('2024-01-15T14:30:00', 'America/New_York');
 * // Store utcDate in database
 * ```
 */
export function toUTC(date: DateInput, timezone?: Timezone): Date | null {
    const dateObj = validateAndConvertToDate(date);
    if (!dateObj) return null;

    const tz = timezone || getUserTimezone();

    try {
        // Convert from zoned time to UTC
        return fromZonedTime(dateObj, tz);
    } catch (e) {
        console.error('Error converting to UTC:', e);
        return null;
    }
}

/**
 * Convert a UTC date to a specific timezone
 * Use this when displaying dates to users
 *
 * @param date - UTC date from database
 * @param timezone - Target timezone (defaults to user's timezone)
 * @returns Date object in target timezone
 *
 * @example
 * ```typescript
 * // Get UTC date from database
 * const utcDate = new Date('2024-01-15T19:30:00Z');
 * // Convert to user's timezone for display
 * const userDate = fromUTC(utcDate, 'America/New_York');
 * // Shows "2024-01-15 14:30:00" (EST is UTC-5)
 * ```
 */
export function fromUTC(date: DateInput, timezone?: Timezone): Date | null {
    const dateObj = validateAndConvertToDate(date);
    if (!dateObj) return null;

    const tz = timezone || getUserTimezone();

    try {
        // Convert from UTC to zoned time
        return toZonedTime(dateObj, tz);
    } catch (e) {
        console.error('Error converting from UTC:', e);
        return null;
    }
}

/**
 * Format a UTC date in a specific timezone
 * Combines conversion and formatting in one step
 *
 * @param date - UTC date from database
 * @param formatStr - Format string (date-fns format tokens)
 * @param timezone - Target timezone (defaults to user's timezone)
 * @returns Formatted date string
 *
 * @example
 * ```typescript
 * const utcDate = new Date('2024-01-15T19:30:00Z');
 *
 * // Format in user's timezone
 * formatInUserTimezone(utcDate, 'PPpp');
 * // "Jan 15, 2024, 2:30:00 PM" (in EST)
 *
 * // Format with custom format
 * formatInUserTimezone(utcDate, 'yyyy-MM-dd HH:mm:ss');
 * // "2024-01-15 14:30:00"
 * ```
 */
export function formatInUserTimezone(date: DateInput, formatStr: string = 'PPpp', timezone?: Timezone): string | null {
    const dateObj = validateAndConvertToDate(date);
    if (!dateObj) return null;

    const tz = timezone || getUserTimezone();

    try {
        return formatInTimeZone(dateObj, tz, formatStr);
    } catch (e) {
        console.error('Error formatting date:', e);
        return null;
    }
}

/**
 * Preset format functions for common date/time display patterns
 * These are convenience wrappers around formatInUserTimezone with predefined formats
 */

/**
 * Format date as "Aug 10, 2025 11:10 AM"
 * Pattern: Short month, day, year, 12-hour time with AM/PM
 *
 * @param date - UTC date from database
 * @param timezone - Target timezone (defaults to user's timezone)
 * @returns Formatted string like "Aug 10, 2025 11:10 AM"
 *
 * @example
 * ```typescript
 * formatShortDateTime(new Date('2024-01-15T19:30:00Z'));
 * // "Jan 15, 2024 2:30 PM" (in EST)
 * ```
 */
export function formatShortDateTime(date: DateInput, timezone?: Timezone): string | null {
    return formatInUserTimezone(date, 'MMM d, yyyy h:mm a', timezone);
}

/**
 * Format date as "10-Aug-2025 11:10 AM"
 * Pattern: Day-month-year with 12-hour time and uppercase AM/PM
 *
 * @param date - UTC date from database
 * @param timezone - Target timezone (defaults to user's timezone)
 * @returns Formatted string like "10-Aug-2025 11:10 AM"
 *
 * @example
 * ```typescript
 * formatDayMonthDateTime(new Date('2024-01-15T19:30:00Z'));
 * // "15-Jan-2024 2:30 PM" (in EST)
 * ```
 */
export function formatDayMonthDateTime(date: DateInput, timezone?: Timezone): string | null {
    const formatted = formatInUserTimezone(date, 'dd-MMM-yyyy h:mm a', timezone);
    return formatted ? formatted.toUpperCase().replace(/AM|PM/, (match) => match.toUpperCase()) : null;
}

/**
 * Format date as "August 10, 2025 11:10 AM"
 * Pattern: Full month name, day, year, 12-hour time with AM/PM
 *
 * @param date - UTC date from database
 * @param timezone - Target timezone (defaults to user's timezone)
 * @returns Formatted string like "August 10, 2025 11:10 AM"
 *
 * @example
 * ```typescript
 * formatLongDateTime(new Date('2024-01-15T19:30:00Z'));
 * // "January 15, 2024 2:30 PM" (in EST)
 * ```
 */
export function formatLongDateTime(date: DateInput, timezone?: Timezone): string | null {
    return formatInUserTimezone(date, 'MMMM d, yyyy h:mm a', timezone);
}

/**
 * Format date as "Aug 10, 2025"
 * Pattern: Short month, day, year (date only, no time)
 *
 * @param date - UTC date from database
 * @param timezone - Target timezone (defaults to user's timezone)
 * @returns Formatted string like "Aug 10, 2025"
 *
 * @example
 * ```typescript
 * formatShortDate(new Date('2024-01-15T19:30:00Z'));
 * // "Jan 15, 2024" (in EST)
 * ```
 */
export function formatShortDate(date: DateInput, timezone?: Timezone): string | null {
    return formatInUserTimezone(date, 'MMM d, yyyy', timezone);
}

/**
 * Format date as "10/Aug/2025"
 * Pattern: Day/month/year with slashes
 *
 * @param date - UTC date from database
 * @param timezone - Target timezone (defaults to user's timezone)
 * @returns Formatted string like "10/Aug/2025"
 *
 * @example
 * ```typescript
 * formatSlashDate(new Date('2024-01-15T19:30:00Z'));
 * // "15/Jan/2024" (in EST)
 * ```
 */
export function formatSlashDate(date: DateInput, timezone?: Timezone): string | null {
    return formatInUserTimezone(date, 'dd/MMM/yyyy', timezone);
}

/**
 * Format date as "2025-08-10 11:10 AM"
 * Pattern: ISO-style date with 12-hour time
 *
 * @param date - UTC date from database
 * @param timezone - Target timezone (defaults to user's timezone)
 * @returns Formatted string like "2025-08-10 11:10 AM"
 *
 * @example
 * ```typescript
 * formatISODateTime(new Date('2024-01-15T19:30:00Z'));
 * // "2024-01-15 2:30 PM" (in EST)
 * ```
 */
export function formatISODateTime(date: DateInput, timezone?: Timezone): string | null {
    return formatInUserTimezone(date, 'yyyy-MM-dd h:mm a', timezone);
}

/**
 * Format date as "11:10 AM"
 * Pattern: 12-hour time only with AM/PM
 *
 * @param date - UTC date from database
 * @param timezone - Target timezone (defaults to user's timezone)
 * @returns Formatted string like "11:10 AM"
 *
 * @example
 * ```typescript
 * formatTime12Hour(new Date('2024-01-15T19:30:00Z'));
 * // "2:30 PM" (in EST)
 * ```
 */
export function formatTime12Hour(date: DateInput, timezone?: Timezone): string | null {
    return formatInUserTimezone(date, 'h:mm a', timezone);
}

/**
 * Format date as "14:30"
 * Pattern: 24-hour time only
 *
 * @param date - UTC date from database
 * @param timezone - Target timezone (defaults to user's timezone)
 * @returns Formatted string like "14:30"
 *
 * @example
 * ```typescript
 * formatTime24Hour(new Date('2024-01-15T19:30:00Z'));
 * // "14:30" (in EST)
 * ```
 */
export function formatTime24Hour(date: DateInput, timezone?: Timezone): string | null {
    return formatInUserTimezone(date, 'HH:mm', timezone);
}

/**
 * Format date as "Monday, August 10, 2025"
 * Pattern: Full weekday, full month, day, year
 *
 * @param date - UTC date from database
 * @param timezone - Target timezone (defaults to user's timezone)
 * @returns Formatted string like "Monday, August 10, 2025"
 *
 * @example
 * ```typescript
 * formatFullDate(new Date('2024-01-15T19:30:00Z'));
 * // "Monday, January 15, 2024" (in EST)
 * ```
 */
export function formatFullDate(date: DateInput, timezone?: Timezone): string | null {
    return formatInUserTimezone(date, 'EEEE, MMMM d, yyyy', timezone);
}

/**
 * Format date as "Mon, Aug 10, 2025 11:10 AM"
 * Pattern: Short weekday, short month, day, year, 12-hour time
 *
 * @param date - UTC date from database
 * @param timezone - Target timezone (defaults to user's timezone)
 * @returns Formatted string like "Mon, Aug 10, 2025 11:10 AM"
 *
 * @example
 * ```typescript
 * formatCompactDateTime(new Date('2024-01-15T19:30:00Z'));
 * // "Mon, Jan 15, 2024 2:30 PM" (in EST)
 * ```
 */
export function formatCompactDateTime(date: DateInput, timezone?: Timezone): string | null {
    return formatInUserTimezone(date, 'EEE, MMM d, yyyy h:mm a', timezone);
}

/**
 * Format date as "Aug 10 at 11:10 AM"
 * Pattern: Short month, day with "at" separator and time
 * Useful for compact displays like "Today at 3:30 PM"
 *
 * @param date - UTC date from database
 * @param timezone - Target timezone (defaults to user's timezone)
 * @returns Formatted string like "Aug 10 at 11:10 AM"
 *
 * @example
 * ```typescript
 * formatDateAtTime(new Date('2024-01-15T19:30:00Z'));
 * // "Jan 15 at 2:30 PM" (in EST)
 * ```
 */
export function formatDateAtTime(date: DateInput, timezone?: Timezone): string | null {
    return formatInUserTimezone(date, "MMM d 'at' h:mm a", timezone);
}

/**
 * Get the current date/time in UTC
 * Use this when creating new records with timestamps
 *
 * @returns Current date in UTC (JavaScript Date objects internally store UTC timestamps)
 *
 * @example
 * ```typescript
 * const now = nowUTC();
 * // Store in database: { createdAt: now }
 * // The Date object represents the current UTC time
 * // When stored in database, it will be stored as UTC
 * ```
 *
 * @note JavaScript Date objects always store time as UTC timestamps internally.
 * This function returns `new Date()` which represents the current UTC time.
 * When serialized (e.g., toISOString()), it outputs UTC format.
 */
export function nowUTC(): Date {
    return new Date();
}

/**
 * Get the current date/time in user's timezone
 *
 * @param timezone - Target timezone (defaults to user's timezone)
 * @returns Current date in specified timezone
 *
 * @example
 * ```typescript
 * const now = nowInTimezone('America/New_York');
 * ```
 */
export function nowInTimezone(timezone?: Timezone): Date {
    const tz = timezone || getUserTimezone();
    return toZonedTime(new Date(), tz);
}

/**
 * Parse a date string with timezone awareness
 * Useful for parsing user input
 *
 * @param dateStr - Date string to parse
 * @param timezone - Timezone of the input string (defaults to user's timezone)
 * @returns Date object in UTC (ready for storage)
 *
 * @example
 * ```typescript
 * // User enters "2024-01-15" in their timezone
 * const utcDate = parseInTimezone('2024-01-15', 'America/New_York');
 * // Converts to UTC for storage
 * ```
 */
export function parseInTimezone(dateStr: string, timezone?: Timezone): Date | null {
    try {
        const parsed = parseISO(dateStr);
        if (!isValid(parsed)) return null;

        const tz = timezone || getUserTimezone();
        return fromZonedTime(parsed, tz);
    } catch (e) {
        console.error('Error parsing date:', e);
        return null;
    }
}

/**
 * Get timezone offset in minutes for a specific timezone
 *
 * @param timezone - Target timezone (defaults to user's timezone)
 * @param date - Date to get offset for (defaults to now)
 * @returns Offset in minutes
 *
 * @example
 * ```typescript
 * getTimezoneOffset('America/New_York'); // -300 (UTC-5)
 * getTimezoneOffset('Europe/London'); // 0 (UTC+0)
 * getTimezoneOffset('Asia/Tokyo'); // 540 (UTC+9)
 * ```
 */
export function getTimezoneOffsetMinutes(timezone?: Timezone, date?: DateInput): number {
    const tz = timezone || getUserTimezone();
    const dateObj = date ? validateAndConvertToDate(date) : new Date();

    if (!dateObj) return 0;

    try {
        const offset = getTimezoneOffset(tz, dateObj);
        return offset / (1000 * 60); // Convert milliseconds to minutes
    } catch (e) {
        console.error('Error getting timezone offset:', e);
        return 0;
    }
}

/**
 * Check if a timezone string is valid
 *
 * @param timezone - Timezone string to validate
 * @returns true if valid IANA timezone
 *
 * @example
 * ```typescript
 * isValidTimezone('America/New_York'); // true
 * isValidTimezone('Invalid/Timezone'); // false
 * ```
 */
export function isValidTimezone(timezone: string): boolean {
    try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Get a list of common timezones with their current offset
 * Useful for timezone selector dropdowns
 *
 * @returns Array of timezone objects with name and offset
 *
 * @example
 * ```typescript
 * const timezones = getCommonTimezones();
 * // [
 * //   { name: 'America/New_York', offset: -300, label: 'Eastern Time (UTC-5:00)' },
 * //   { name: 'America/Chicago', offset: -360, label: 'Central Time (UTC-6:00)' },
 * //   ...
 * // ]
 * ```
 */
export function getCommonTimezones(): Array<{
    name: Timezone;
    offset: number;
    label: string;
}> {
    const commonTzs: Timezone[] = [
        'UTC',
        // Americas
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'America/Phoenix',
        'America/Anchorage',
        'Pacific/Honolulu',
        'America/Toronto',
        'America/Vancouver',
        'America/Edmonton',
        'America/Winnipeg',
        'America/Montreal',
        'America/Mexico_City',
        'America/Bogota',
        'America/Lima',
        'America/Caracas',
        'America/Sao_Paulo',
        'America/Buenos_Aires',
        // Europe
        'Europe/London',
        'Europe/Dublin',
        'Europe/Paris',
        'Europe/Berlin',
        'Europe/Amsterdam',
        'Europe/Brussels',
        'Europe/Rome',
        'Europe/Madrid',
        'Europe/Stockholm',
        'Europe/Oslo',
        'Europe/Copenhagen',
        'Europe/Helsinki',
        'Europe/Athens',
        'Europe/Istanbul',
        'Europe/Moscow',
        'Europe/Kyiv',
        // Africa
        'Africa/Cairo',
        'Africa/Johannesburg',
        'Africa/Lagos',
        'Africa/Nairobi',
        'Africa/Casablanca',
        // Middle East
        'Asia/Dubai',
        'Asia/Riyadh',
        'Asia/Jerusalem',
        // Asia
        'Asia/Kolkata',
        'Asia/Karachi',
        'Asia/Dhaka',
        'Asia/Bangkok',
        'Asia/Singapore',
        'Asia/Jakarta',
        'Asia/Manila',
        'Asia/Hong_Kong',
        'Asia/Shanghai',
        'Asia/Seoul',
        'Asia/Tokyo',
        // Oceania
        'Australia/Perth',
        'Australia/Adelaide',
        'Australia/Brisbane',
        'Australia/Sydney',
        'Australia/Melbourne',
        'Pacific/Auckland',
        'Pacific/Fiji',
        'Pacific/Guam',
    ];

    return commonTzs.map((tz) => {
        const offset = getTimezoneOffsetMinutes(tz);
        const hours = Math.floor(Math.abs(offset) / 60);
        const minutes = Math.abs(offset) % 60;
        // Negative offset means behind UTC (e.g., EST is -300, shown as UTC-05:00)
        // Positive offset means ahead of UTC (e.g., Tokyo is 540, shown as UTC+09:00)
        const sign = offset < 0 ? '-' : '+';
        const offsetStr = `UTC${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

        return {
            name: tz,
            offset,
            label: `${tz.replace(/_/g, ' ')} (${offsetStr})`,
        };
    });
}

/**
 * Get all IANA timezones (when supported) or common timezones as fallback.
 * Use for searchable timezone selectors.
 *
 * @param options.preferredTimezone - IANA timezone to show first (e.g. browser guess or saved user preference)
 */
export function getTimezonesForSelect(options?: {
    preferredTimezone?: Timezone;
}): Array<{ name: Timezone; offset: number; label: string }> {
    const preferred = options?.preferredTimezone?.trim();
    const buildList = () => {
        try {
            if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
                const all = (Intl as any).supportedValuesOf('timeZone') as string[];
                return all.map((tz) => {
                    const offset = getTimezoneOffsetMinutes(tz);
                    const hours = Math.floor(Math.abs(offset) / 60);
                    const minutes = Math.abs(offset) % 60;
                    const sign = offset < 0 ? '-' : '+';
                    const offsetStr = `UTC${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                    return { name: tz, offset, label: `${tz.replace(/_/g, ' ')} (${offsetStr})` };
                });
            }
        } catch {
            // Fallback to common list
        }
        return getCommonTimezones();
    };
    const list = buildList();
    if (!preferred) return list;
    const idx = list.findIndex((t) => t.name === preferred);
    if (idx <= 0) return list;
    const [preferredItem] = list.splice(idx, 1);
    return [preferredItem, ...list];
}

/**
 * Convert a date between two timezones
 *
 * @param date - Date to convert
 * @param fromTimezone - Source timezone
 * @param toTimezone - Target timezone
 * @returns Converted date
 *
 * @example
 * ```typescript
 * // Convert from EST to PST
 * const estDate = new Date('2024-01-15T14:30:00');
 * const pstDate = convertTimezone(estDate, 'America/New_York', 'America/Los_Angeles');
 * ```
 */
export function convertTimezone(date: DateInput, fromTimezone: Timezone, toTimezone: Timezone): Date | null {
    const dateObj = validateAndConvertToDate(date);
    if (!dateObj) return null;

    try {
        // First convert to UTC from source timezone
        const utcDate = fromZonedTime(dateObj, fromTimezone);
        // Then convert to target timezone
        return toZonedTime(utcDate, toTimezone);
    } catch (e) {
        console.error('Error converting between timezones:', e);
        return null;
    }
}

/**
 * Format a date with timezone abbreviation
 *
 * @param date - Date to format
 * @param formatStr - Format string
 * @param timezone - Timezone (defaults to user's timezone)
 * @returns Formatted string with timezone abbreviation
 *
 * @example
 * ```typescript
 * formatWithTimezone(new Date(), 'PPpp zzz');
 * // "Jan 15, 2024, 2:30:00 PM EST"
 * ```
 */
export function formatWithTimezone(
    date: DateInput,
    formatStr: string = 'PPpp zzz',
    timezone?: Timezone,
): string | null {
    return formatInUserTimezone(date, formatStr, timezone);
}

/**
 * Check if a date is in daylight saving time for a timezone
 * Works for both northern and southern hemisphere timezones
 *
 * @param date - Date to check
 * @param timezone - Timezone to check (defaults to user's timezone)
 * @returns true if date is in DST
 *
 * @example
 * ```typescript
 * isDST(new Date('2024-06-15'), 'America/New_York'); // true (northern summer)
 * isDST(new Date('2024-12-15'), 'America/New_York'); // false (northern winter)
 * isDST(new Date('2024-12-15'), 'Australia/Sydney'); // true (southern summer)
 * ```
 */
export function isDST(date: DateInput, timezone?: Timezone): boolean {
    const dateObj = validateAndConvertToDate(date);
    if (!dateObj) return false;

    const tz = timezone || getUserTimezone();

    try {
        // Get offsets for January and July
        const jan = new Date(dateObj.getFullYear(), 0, 1);
        const jul = new Date(dateObj.getFullYear(), 6, 1);
        const janOffset = getTimezoneOffset(tz, jan);
        const julOffset = getTimezoneOffset(tz, jul);

        // Get offset for current date
        const currentOffset = getTimezoneOffset(tz, dateObj);

        // DST is active when offset differs from standard time
        // Standard time is the larger offset (further from UTC)
        const standardOffset = Math.max(janOffset, julOffset);

        // If current offset is less than standard offset, we're in DST
        return currentOffset < standardOffset;
    } catch (e) {
        console.error('Error checking DST:', e);
        return false;
    }
}
