/**
 * @ottabase/ottadate: DateRangePicker
 *
 * A first day and a last day, on two months side by side. The first click
 * starts a draft (the result line says so, nothing is stored), the second
 * stores the range in order and closes. Presets, when given, sit beside the
 * months and store at once. Typed ranges work too ("5 jan to 12 jan",
 * "last 7 days").
 *
 *   const picker = OttaDate.createDateRangePicker(container, {
 *       presets: getDefaultRangePresets(),
 *       onChange: ({ start, end }) => console.log(start, end),
 *   });
 */

import { addMonths, differenceInCalendarDays, startOfDay, startOfMonth } from 'date-fns';
import { parseExactDate } from '../core/parse-exact';
import type { DateRange, DateRangePickerInstance, DateRangePickerOptions, DateRangePreset } from '../core/types';
import { formatDisplay, fromDate, isDateInBounds, isSameDay, toDate } from '../core/utils';
import { btn, div } from '../dom/helpers';
import { frame, monthGrid } from './calendar';
import { boundsHint } from './DatePicker';
import { createShell, type ShellBody, type ShellContext, type ShellParse } from './shell';

interface Range {
    start: Date;
    end: Date;
}

type Ctx = ShellContext<Range, DateRangePickerOptions>;

const RANGE_CLASSES = ['ottadate-day--range-start', 'ottadate-day--range-end', 'ottadate-day--range-middle'];

const ordered = (a: Date, b: Date): Range => (b < a ? { start: b, end: a } : { start: a, end: b });

function fmt(day: Date, ctx: Ctx) {
    return formatDisplay(day, ctx.config.displayFormat, ctx.config.locale);
}

/** "Jan 5, 2026 to Jan 12, 2026", or just the day when both are the same */
function rangeLabel(range: Range, ctx: Ctx): string {
    return isSameDay(range.start, range.end)
        ? fmt(range.start, ctx)
        : `${fmt(range.start, ctx)} to ${fmt(range.end, ctx)}`;
}

const presetMatches = (preset: DateRangePreset, range: Range) => {
    const r = preset.range();
    return isSameDay(r.start, range.start) && isSameDay(r.end, range.end);
};

function describe(range: Range, ctx: Ctx) {
    const days = differenceInCalendarDays(range.end, range.start) + 1;
    const preset = (ctx.config.presets ?? []).find((p) => presetMatches(p, range));
    const span = days === 1 ? '1 day' : `${days} days`;
    return { label: rangeLabel(range, ctx), sub: preset ? `${preset.label}, ${span}` : span };
}

/** A preset by name, or one or two days: "5 jan to 12 jan", "jan 5 - jan 12 2026", "tomorrow" */
function parseRange(raw: string, ctx: Ctx): ShellParse<Range> {
    const f = frame(ctx.config);
    const preset = (ctx.config.presets ?? []).find((p) => p.label.toLowerCase() === raw.trim().toLowerCase());
    let range: Range | null = null;
    if (preset) {
        const r = preset.range();
        range = ordered(r.start, r.end);
    } else {
        const parts = raw.split(/\s+(?:to|until|through)\s+|\s+-\s+/i);
        if (parts.length > 2) return null;
        const days = parts.map((p) => parseExactDate(p, { now: f.today(), time: false }));
        if (days.some((d) => !d)) return null;
        range = ordered(days[0]!, days[1] ?? days[0]!);
    }
    if (!isDateInBounds(range.start, f.min, f.max) || !isDateInBounds(range.end, f.min, f.max)) {
        return { error: 'Outside the allowed dates', hint: boundsHint(ctx.config) };
    }
    return { value: range, label: rangeLabel(range, ctx) };
}

function rangeBody(ctx: Ctx): ShellBody {
    /** The first day picked, while the last is still to come */
    let anchor: Date | null = null;
    let hover: Date | null = null;
    let left = new Date();
    let last: HTMLElement | null = null;

    function reset() {
        anchor = null;
        hover = null;
        left = startOfMonth(ctx.value?.start ?? frame(ctx.config).today());
    }

    /** The span to paint: the stored range, or the draft from the anchor to the hovered day */
    function span(): Range | null {
        if (anchor) return ordered(anchor, hover ?? anchor);
        return ctx.value;
    }

    function dayClass(day: Date): string {
        const s = span();
        if (!s) return '';
        const cls: string[] = [];
        if (isSameDay(day, s.start)) cls.push(RANGE_CLASSES[0]);
        if (isSameDay(day, s.end)) cls.push(RANGE_CLASSES[1]);
        if (!cls.length && day > s.start && day < s.end) cls.push(RANGE_CLASSES[2]);
        return cls.join(' ');
    }

    /** Repaint the span in place while the pointer moves (no re-render) */
    function paint() {
        last?.querySelectorAll<HTMLButtonElement>('.ottadate-day').forEach((b) => {
            b.classList.remove(...RANGE_CLASSES);
            const cls = dayClass(new Date(Number(b.dataset.time)));
            if (cls) b.classList.add(...cls.split(' '));
        });
    }

    function pick(day: Date) {
        if (!anchor) {
            anchor = day;
            hover = null;
            ctx.draft({ label: `${fmt(day, ctx)} to …`, sub: 'Now pick the last day' });
            ctx.render();
            return;
        }
        const range = ordered(anchor, day);
        anchor = null;
        hover = null;
        ctx.commit(range, true);
    }

    function render(): HTMLElement {
        const f = frame(ctx.config);
        const today = f.today();
        const wrap = div('ottadate-range');

        const presets = ctx.config.presets ?? [];
        if (presets.length) {
            const side = div('ottadate-range-presets');
            side.setAttribute('role', 'group');
            side.setAttribute('aria-label', 'Quick ranges');
            presets.forEach((preset, i) => {
                const b = btn('ottadate-range-preset', preset.label, () => {
                    const r = preset.range();
                    anchor = null;
                    ctx.commit(ordered(r.start, r.end), true);
                });
                b.dataset.key = `preset:${i}`;
                b.setAttribute('aria-pressed', String(!anchor && !!ctx.value && presetMatches(preset, ctx.value)));
                b.disabled = !!ctx.config.disabled;
                side.appendChild(b);
            });
            wrap.appendChild(side);
        }

        const months = div('ottadate-range-calendars');
        const nav = {
            prev: () => {
                left = addMonths(left, -1);
                ctx.render();
            },
            next: () => {
                left = addMonths(left, 1);
                ctx.render();
            },
        };
        [left, addMonths(left, 1)].forEach((view, i) =>
            months.appendChild(
                monthGrid({
                    key: i ? 'b' : 'a',
                    view,
                    config: ctx.config,
                    today,
                    min: f.min,
                    max: f.max,
                    dayClass,
                    focusDay: anchor,
                    onPick: pick,
                    onHover(day) {
                        if (!anchor) return;
                        hover = day;
                        paint();
                    },
                    nav,
                }),
            ),
        );
        wrap.appendChild(months);
        last = wrap;
        return wrap;
    }

    return { render, reset };
}

export function createDateRangePicker(
    container: HTMLElement,
    options: DateRangePickerOptions = {},
): DateRangePickerInstance {
    return createShell<Range, DateRangePickerOptions>(
        container,
        { placeholder: 'Select range…', ...options },
        {
            className: `ottadate--range${options.presets?.length ? ' ottadate--range-presets' : ''}`,
            dialogLabel: 'Choose a date range',
            clearLabel: 'Clear range',
            done: false,
            entry: {
                placeholder: 'Type it: 5 jan to 12 jan, last 7 days…',
                label: 'Type a date range',
                hint: 'Try: 5 jan to 12 jan, 2026-01-05 to 2026-01-12, or a preset by name',
                parse: parseRange,
            },
            empty: { label: 'Pick the first day', sub: 'Then the last one', muted: true },
            label: rangeLabel,
            describe,
            today(ctx) {
                const day = startOfDay(frame(ctx.config).today());
                return { start: day, end: day };
            },
            input(value, ctx) {
                const tz = frame(ctx.config).tz;
                const r = (value ?? null) as DateRange | null;
                const start = toDate(r?.start, tz);
                const end = toDate(r?.end, tz);
                return start && end ? ordered(start, end) : null;
            },
            output(range, ctx) {
                const { tz } = frame(ctx.config);
                const format = ctx.config.timestampFormat;
                return {
                    start: fromDate(range?.start ?? null, format, tz),
                    end: fromDate(range?.end ?? null, format, tz),
                };
            },
            body: rangeBody,
        },
    ) as DateRangePickerInstance;
}
