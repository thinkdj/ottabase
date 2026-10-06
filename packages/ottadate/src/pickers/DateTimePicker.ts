/**
 * @ottabase/ottadate: DateTimePicker
 *
 * A day and a time. The calendar picks the day and keeps the time; the time
 * row below it (hour, minute, optional seconds, AM/PM on a 12-hour clock, and
 * three quick times) stores on every edit. Done closes. The result line names
 * the moment and the zone it is in. Typed moments work too ("tomorrow 9am").
 *
 *   const picker = OttaDate.createDateTimePicker(container, {
 *       value: 1704067200,
 *       onChange: (ts) => console.log(ts),
 *       use12Hour: false,
 *       showSeconds: false,
 *   });
 */

import { startOfDay } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { parseExactDate } from '../core/parse-exact';
import type { DateTimePickerInstance, DateTimePickerOptions } from '../core/types';
import { formatDisplay, formatTime, fromDate, isDateInBounds, pad2, toDate } from '../core/utils';
import { btn, div, el, iconClock, span } from '../dom/helpers';
import { calendarBody, frame, longDate } from './calendar';
import { boundsHint } from './DatePicker';
import { createShell, type ShellConfig, type ShellContext, type ShellParse } from './shell';

type Ctx = ShellContext<Date, DateTimePickerOptions>;
type Config = ShellConfig<DateTimePickerOptions>;

const timeFormat = (c: Config) =>
    c.use12Hour ? (c.showSeconds ? 'h:mm:ss a' : 'h:mm a') : c.showSeconds ? 'HH:mm:ss' : 'HH:mm';

/** Now, on the configured minute step, with no seconds */
function nowValue(ctx: Ctx): Date {
    const now = frame(ctx.config).today();
    const step = ctx.config.minuteStep ?? 1;
    now.setMinutes(now.getMinutes() - (now.getMinutes() % step), 0, 0);
    return now;
}

/** `day` at the time of `from` */
function withTime(day: Date, from: Date): Date {
    const d = new Date(day);
    d.setHours(from.getHours(), from.getMinutes(), from.getSeconds(), 0);
    return d;
}

/** "Asia/Kolkata (UTC+05:30)" */
function zoneLabel(date: Date, tz: string): string {
    if (tz === 'UTC') return 'UTC';
    const offset = formatInTimeZone(fromZonedTime(date, tz), tz, 'XXX');
    return `${tz} (UTC${offset === 'Z' ? '' : offset})`;
}

function parseMoment(raw: string, ctx: Ctx): ShellParse<Date> {
    const f = frame(ctx.config);
    const moment = parseExactDate(raw, { now: f.today() });
    if (!moment) return null;
    if (!isDateInBounds(moment, f.min, f.max))
        return { error: 'Outside the allowed dates', hint: boundsHint(ctx.config) };
    return { value: moment, label: describe(moment, ctx).label };
}

function describe(moment: Date, ctx: Ctx) {
    const c = ctx.config;
    return {
        label: `${longDate(moment, c)} at ${formatTime(moment, timeFormat(c), c.locale)}`,
        sub: zoneLabel(moment, frame(c).tz),
    };
}

/** Hour, minute, seconds, AM/PM, and three quick times; every edit stores */
function timeRow(ctx: Ctx): HTMLElement {
    const c = ctx.config;
    const shown = ctx.value ?? nowValue(ctx);
    const [h, m, s] = [shown.getHours(), shown.getMinutes(), shown.getSeconds()];
    const set = (hours: number, minutes: number, seconds: number) => {
        const d = new Date(ctx.value ?? startOfDay(shown));
        d.setHours(hours, minutes, seconds, 0);
        ctx.commit(d);
    };
    const field = (key: string, value: number, min: number, max: number, apply: (v: number) => void) => {
        const input = el('input', {
            className: 'ottadate-time-input',
            type: 'number',
            inputmode: 'numeric',
            min: String(min),
            max: String(max),
            'aria-label': key.charAt(0).toUpperCase() + key.slice(1),
        }) as HTMLInputElement;
        input.dataset.key = `time:${key}`;
        input.value = pad2(value);
        input.disabled = !!c.disabled;
        input.addEventListener('change', () => {
            const parsed = parseInt(input.value, 10);
            apply(Math.max(min, Math.min(max, isNaN(parsed) ? min : parsed)));
        });
        return input;
    };

    const row = div('ottadate-time');
    const label = span('ottadate-time-label', '');
    label.innerHTML = `${iconClock()}<span>Time</span>`;
    row.appendChild(label);
    const pm = h >= 12;
    if (c.use12Hour) {
        row.appendChild(field('hour', h % 12 || 12, 1, 12, (v) => set((v % 12) + (pm ? 12 : 0), m, s)));
    } else {
        row.appendChild(field('hour', h, 0, 23, (v) => set(v, m, s)));
    }
    row.append(
        span('ottadate-time-separator', ':'),
        field('minute', m, 0, 59, (v) => set(h, v, s)),
    );
    if (c.showSeconds) {
        row.append(
            span('ottadate-time-separator', ':'),
            field('second', s, 0, 59, (v) => set(h, m, v)),
        );
    }
    if (c.use12Hour) {
        const period = btn('ottadate-time-period', pm ? 'PM' : 'AM', () => set((h + 12) % 24, m, s));
        period.setAttribute('aria-label', pm ? 'PM, switch to AM' : 'AM, switch to PM');
        period.dataset.key = 'time:period';
        period.disabled = !!c.disabled;
        row.appendChild(period);
    }

    const quick = div('ottadate-time-presets');
    (
        [
            ['00:00', 0, 0, 0],
            ['12:00', 12, 0, 0],
            ['23:59', 23, 59, 59],
        ] as const
    ).forEach(([text, hh, mm, ss]) => {
        const b = btn('ottadate-footer-btn', text, () => set(hh, mm, ss));
        b.dataset.key = `time:${text}`;
        b.disabled = !!c.disabled;
        quick.appendChild(b);
    });

    return div('ottadate-time-block', row, quick);
}

export function createDateTimePicker(
    container: HTMLElement,
    options: DateTimePickerOptions = {},
): DateTimePickerInstance {
    return createShell<Date, DateTimePickerOptions>(
        container,
        { placeholder: 'Select date and time…', showSeconds: false, use12Hour: false, minuteStep: 1, ...options },
        {
            className: 'ottadate--datetime',
            dialogLabel: 'Choose a date and time',
            clearLabel: 'Clear date and time',
            entry: {
                placeholder: 'Type it: 5 jan 14:30, tomorrow 9am…',
                label: 'Type a date and time',
                hint: 'Try: 2026-01-05 14:30, 5 jan 9am, tomorrow',
                parse: parseMoment,
            },
            empty: { label: 'Pick a day and a time', sub: 'Or type them above', muted: true },
            label: (moment, ctx) => {
                const c = ctx.config;
                return `${formatDisplay(moment, c.displayFormat, c.locale)} ${formatTime(moment, timeFormat(c), c.locale)}`;
            },
            describe,
            today: nowValue,
            input: (value, ctx) => toDate(value as number | string | Date | null | undefined, frame(ctx.config).tz),
            output: (moment, ctx) => fromDate(moment, ctx.config.timestampFormat, frame(ctx.config).tz),
            body: (ctx) =>
                calendarBody(ctx, {
                    onPickDay: (day) => ctx.commit(withTime(day, ctx.value ?? nowValue(ctx))),
                    below: () => timeRow(ctx),
                }),
        },
    ) as DateTimePickerInstance;
}
