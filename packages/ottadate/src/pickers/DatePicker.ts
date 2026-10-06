/**
 * @ottabase/ottadate: DatePicker
 *
 * One day. A click on a day stores it and closes the popover; the result line
 * names the day in words and says how far off it is. Typed dates work too
 * ("5 jan 2026", "tomorrow", "next friday").
 *
 *   const picker = OttaDate.createDatePicker(container, {
 *       value: 1704067200,
 *       onChange: (ts) => console.log(ts),
 *   });
 */

import { startOfDay } from 'date-fns';
import { parseExactDate } from '../core/parse-exact';
import type { DatePickerInstance, DatePickerOptions, OttaDateConfig } from '../core/types';
import { formatDisplay, fromDate, isDateInBounds, toDate } from '../core/utils';
import { calendarBody, frame, longDate, relativeDay } from './calendar';
import { createShell, type ShellConfig, type ShellContext, type ShellParse } from './shell';

type Ctx = ShellContext<Date, DatePickerOptions>;

/** A typed day: out of bounds is a reason, unreadable is null */
export function parseDay(raw: string, ctx: Ctx): ShellParse<Date> {
    const f = frame(ctx.config);
    const day = parseExactDate(raw, { now: f.today(), time: false });
    if (!day) return null;
    if (!isDateInBounds(day, f.min, f.max)) return { error: 'Outside the allowed dates', hint: boundsHint(ctx.config) };
    return { value: day, label: longDate(day, ctx.config) };
}

export function boundsHint(config: ShellConfig<OttaDateConfig>): string {
    const f = frame(config);
    const fmt = (d: Date) => formatDisplay(d, config.displayFormat, config.locale);
    if (f.min && f.max) return `Between ${fmt(f.min)} and ${fmt(f.max)}`;
    return f.min ? `From ${fmt(f.min)}` : f.max ? `Up to ${fmt(f.max)}` : '';
}

export function createDatePicker(container: HTMLElement, options: DatePickerOptions = {}): DatePickerInstance {
    return createShell<Date, DatePickerOptions>(container, options, {
        className: 'ottadate--date',
        dialogLabel: 'Choose a date',
        clearLabel: 'Clear date',
        done: false,
        entry: {
            placeholder: 'Type it: 5 jan 2026, tomorrow…',
            label: 'Type a date',
            hint: 'Try: 2026-01-05, 5 jan 2026, next friday',
            parse: parseDay,
        },
        empty: { label: 'Pick a day', sub: 'Or type one above', muted: true },
        label: (day, ctx) => formatDisplay(day, ctx.config.displayFormat, ctx.config.locale),
        describe: (day, ctx) => ({
            label: longDate(day, ctx.config),
            sub: relativeDay(day, frame(ctx.config).today()),
        }),
        today: (ctx) => startOfDay(frame(ctx.config).today()),
        input(value, ctx) {
            const day = toDate(value as number | string | Date | null | undefined, frame(ctx.config).tz);
            return day && startOfDay(day);
        },
        output: (day, ctx) => fromDate(day, ctx.config.timestampFormat, frame(ctx.config).tz),
        body: (ctx) => calendarBody(ctx, { onPickDay: (day) => ctx.commit(day, true) }),
    }) as DatePickerInstance;
}
