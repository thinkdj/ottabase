// A five-field cron expression in plain words: "Weekdays at 09:00", "Every 5 minutes on weekends".
// Times are read as they are written; the caller says which timezone that is.

import { parseCron } from './cron-parser';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

interface Field {
    /** The field is a wildcard */
    every: boolean;
    /** A step (star over n): the values run from the field's minimum to its end in steps of n */
    step: number | null;
    /** The values form an unbroken run */
    consecutive: boolean;
    values: number[];
}

function shape(values: number[], min: number, max: number): Field {
    const every = values.length === max - min + 1;
    const gap = values.length > 1 ? values[1] - values[0] : 0;
    const regular = gap > 0 && values.every((value, index) => value === values[0] + index * gap);
    const step = !every && regular && values[0] === min && values[values.length - 1] + gap > max ? gap : null;
    return { every, step, consecutive: regular && gap === 1, values };
}

const pad = (n: number) => String(n).padStart(2, '0');
const time = (hour: number, minute: number) => `${pad(hour)}:${pad(minute)}`;
const list = (items: string[]) =>
    items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
const ordinal = (n: number) => {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const rest = n % 100;
    return `${n}${suffixes[(rest - 20) % 10] ?? suffixes[rest] ?? suffixes[0]}`;
};
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const same = (a: number[], b: number[]) => a.length === b.length && a.every((value, index) => value === b[index]);

/** "Every 5 minutes" (an interval) or "at 09:00" (clock times); intervals take a trailing day phrase */
function timeWords(minutes: Field, hours: Field): { interval: boolean; text: string } {
    const hourSpan = hours.every
        ? ''
        : hours.consecutive
          ? ` from ${time(hours.values[0], 0)} to ${time(hours.values[hours.values.length - 1], 59)}`
          : ` at hours ${list(hours.values.map(pad))}`;

    // A few clock times read better than "every 30 minutes at hours 09 and 17"
    const fewTimes = !hours.every && !hours.consecutive && hours.values.length * minutes.values.length <= 6;

    if (minutes.every) return { interval: true, text: `Every minute${hourSpan}` };
    if (minutes.step && !fewTimes) return { interval: true, text: `Every ${minutes.step} minutes${hourSpan}` };

    if (minutes.values.length === 1) {
        const minute = minutes.values[0];
        const past = minute === 0 ? '' : ` at :${pad(minute)}`;
        if (hours.every) return { interval: true, text: `Every hour${past}` };
        if (hours.step) return { interval: true, text: `Every ${hours.step} hours${past}` };
        if (hours.consecutive && minute === 0) {
            const [first, last] = [hours.values[0], hours.values[hours.values.length - 1]];
            return { interval: true, text: `Every hour from ${time(first, 0)} to ${time(last, 0)}` };
        }
        return { interval: false, text: `at ${list(hours.values.map((hour) => time(hour, minute)))}` };
    }

    if (hours.every) {
        return { interval: true, text: `Every hour at ${list(minutes.values.map((minute) => `:${pad(minute)}`))}` };
    }
    if (hours.values.length * minutes.values.length <= 6) {
        const times = hours.values.flatMap((hour) => minutes.values.map((minute) => time(hour, minute)));
        return { interval: false, text: `at ${list(times)}` };
    }
    return {
        interval: false,
        text: `at minutes ${list(minutes.values.map(String))} past hours ${list(hours.values.map(pad))}`,
    };
}

/** The day part in two forms: as a sentence lead ("Weekdays") and as a trailer ("on weekdays") */
function dayWords(days: Field, weekdays: Field, months: Field): { lead: string; on: string } {
    const monthNames = months.every ? '' : list(months.values.map((month) => MONTHS[month - 1]));
    const parts: { lead: string; on: string }[] = [];

    if (!days.every) {
        const dates = `the ${list(days.values.map(ordinal))} of ${monthNames || 'every month'}`;
        parts.push({ lead: `On ${dates}`, on: `on ${dates}` });
    }
    if (!weekdays.every) {
        if (same(weekdays.values, [1, 2, 3, 4, 5])) parts.push({ lead: 'Weekdays', on: 'on weekdays' });
        else if (same(weekdays.values, [0, 6])) parts.push({ lead: 'Weekends', on: 'on weekends' });
        else {
            const names = weekdays.values.map((day) => WEEKDAYS[day]);
            parts.push({ lead: `Every ${list(names)}`, on: `on ${list(names.map((name) => `${name}s`))}` });
        }
    }

    if (parts.length === 0) {
        return monthNames
            ? { lead: `Every day in ${monthNames}`, on: `in ${monthNames}` }
            : { lead: 'Every day', on: '' };
    }
    // Both a date and a weekday restriction run as cron does: either one matches.
    const lead = parts.map((part, index) => (index === 0 ? part.lead : `or ${part.on}`)).join(' ');
    const on = parts.map((part) => part.on).join(' or ');
    const inMonths = monthNames && days.every ? ` in ${monthNames}` : '';
    return { lead: lead + inMonths, on: on + inMonths };
}

/**
 * Describe a five-field cron expression in plain words.
 *
 * ```ts
 * describeCron('0 9 * * 1-5'); // "Weekdays at 09:00"
 * describeCron('0 9-17 * * 1-5'); // "Every hour from 09:00 to 17:00 on weekdays"
 * describeCron('0 0 1 * *'); // "On the 1st of every month at 00:00"
 * ```
 *
 * Throws on an expression `parseCron` rejects.
 */
export function describeCron(expression: string): string {
    const cron = parseCron(expression);
    const minutes = shape(cron.minutes, 0, 59);
    const hours = shape(cron.hours, 0, 23);
    const days = dayWords(shape(cron.days, 1, 31), shape(cron.weekdays, 0, 6), shape(cron.months, 1, 12));
    const when = timeWords(minutes, hours);
    if (when.interval) return days.on ? `${when.text} ${days.on}` : when.text;
    return `${days.lead} ${lowerFirst(when.text)}`;
}
