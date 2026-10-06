/**
 * @ottabase/ottadate: typed exact dates
 *
 * "2026-01-05", "5 jan 2026", "jan 5", "tomorrow", "next friday", with an
 * optional time at the end ("5 jan 14:30", "tomorrow 9am"). Strict: anything
 * else is null, never a guess. Dates are built in the caller's frame, so pass
 * a zoned `now` to get a zoned result.
 */
import { addDays, isValid, nextDay, parse, startOfDay, type Day } from 'date-fns';

export interface ParseExactOptions {
    /** The reference moment, in the frame the result should be in. Default: new Date() */
    now?: Date;
    /** Accept a trailing time ("14:30", "2:30 pm", "9am"). Default: true */
    time?: boolean;
}

const RELATIVE: Record<string, number> = { today: 0, tomorrow: 1, yesterday: -1 };
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
/** Unambiguous shapes only: ISO and month names. "5/1/2026" reads two ways, so it does not parse. */
const DATE_FORMATS = [
    'yyyy-MM-dd',
    'd MMM yyyy',
    'd MMMM yyyy',
    'MMM d yyyy',
    'MMMM d yyyy',
    'MMM d, yyyy',
    'MMMM d, yyyy',
    'd MMM',
    'd MMMM',
    'MMM d',
    'MMMM d',
];
const CLOCK_12 = /(?:^|\s)(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)$/;
const CLOCK_24 = /(?:^|\s)(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/** Parse one typed date; null when it is not readable as a single day (with an optional time). */
export function parseExactDate(raw: string, options: ParseExactOptions = {}): Date | null {
    const now = options.now ?? new Date();
    let text = raw.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!text) return null;

    let clock: [number, number, number] | null = null;
    if (options.time !== false) {
        const m = CLOCK_12.exec(text) ?? CLOCK_24.exec(text);
        if (m) {
            const pm = m[4];
            let hour = Number(m[1]);
            if (pm) {
                if (hour < 1 || hour > 12) return null;
                hour = (hour % 12) + (pm === 'pm' ? 12 : 0);
            }
            const minute = Number(m[2] ?? 0);
            const second = Number(m[3] ?? 0);
            if (hour > 23 || minute > 59 || second > 59) return null;
            clock = [hour, minute, second];
            text = text.slice(0, m.index).trim();
        }
    }

    let day: Date | null = null;
    if (!text) {
        day = clock ? startOfDay(now) : null;
    } else if (text in RELATIVE) {
        day = addDays(startOfDay(now), RELATIVE[text]);
    } else if (WEEKDAYS.includes(text.replace(/^next /, ''))) {
        day = nextDay(startOfDay(now), WEEKDAYS.indexOf(text.replace(/^next /, '')) as Day);
    } else {
        for (const format of DATE_FORMATS) {
            const parsed = parse(text, format, now);
            if (isValid(parsed)) {
                day = startOfDay(parsed);
                break;
            }
        }
    }
    if (!day) return null;
    if (clock) day.setHours(...clock, 0);
    return day;
}
