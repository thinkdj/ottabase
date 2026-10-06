/**
 * @ottabase/ottadate: the exact calendar
 *
 * One month grid with keyboard roving (arrows, Home/End, PageUp/PageDown for
 * the months), and the day / month / year views the single-date pickers switch
 * between. Dates here are wall-clock Dates in the picker's time zone; the
 * conversion to and from the caller's timestamps happens at the shell's edges.
 */

import { addMonths, differenceInCalendarDays, formatDistanceStrict, startOfMonth } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { OttaDateConfig } from '../core/types';
import {
    buildCalendarGrid,
    formatDate,
    getIntlLocale,
    getMonthNames,
    getMonthNamesShort,
    getWeekdayLabels,
    getYearRange,
    isDateInBounds,
    isSameDay,
    isSameMonth,
    resolveTimezone,
    toDate,
} from '../core/utils';
import { btn, div, iconChevronLeft, iconChevronRight, span } from '../dom/helpers';
import type { ShellBody, ShellConfig, ShellContext } from './shell';

/** The picker's frame: zone, now, selectable bounds and locale, all from config */
export function frame(config: ShellConfig<OttaDateConfig>) {
    const tz = resolveTimezone(config.timezone);
    return {
        tz,
        today: () => toZonedTime(new Date(), tz),
        min: config.minDate ? toDate(config.minDate, tz) : null,
        max: config.maxDate ? toDate(config.maxDate, tz) : null,
        locale: getIntlLocale(config.locale),
    };
}

/** "Monday, January 5, 2026" */
export const longDate = (date: Date, config: OttaDateConfig) => formatDate(date, 'EEEE, MMMM d, yyyy', config.locale);

/** "Today", "Tomorrow", "In 3 days", "2 months ago" */
export function relativeDay(day: Date, today: Date): string {
    const n = differenceInCalendarDays(day, today);
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    if (n === -1) return 'Yesterday';
    const words = formatDistanceStrict(day, today, { addSuffix: true });
    return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Roving tabindex inside a grid: one tab stop, arrows move it, disabled cells are skipped */
function rove(grid: HTMLElement, cells: HTMLButtonElement[], cols: number, stop: number, page?: Nav) {
    const first = cells.findIndex((c, i) => i >= stop && !c.disabled);
    const start = first >= 0 ? first : cells.findIndex((c) => !c.disabled);
    if (start >= 0) {
        cells[start].tabIndex = 0;
        cells[start].dataset.roving = 'true';
    }
    grid.addEventListener('keydown', (e) => {
        if (page && (e.key === 'PageUp' || e.key === 'PageDown')) {
            e.preventDefault();
            (e.key === 'PageUp' ? page.prev : page.next)();
            return;
        }
        const i = cells.indexOf(document.activeElement as HTMLButtonElement);
        if (i < 0) return;
        const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols };
        let next = e.key === 'Home' ? 0 : e.key === 'End' ? cells.length - 1 : e.key in step ? i + step[e.key] : -1;
        if (next < 0 || next >= cells.length) return;
        const dir = next >= i ? 1 : -1;
        while (next >= 0 && next < cells.length && cells[next].disabled) next += dir;
        if (next < 0 || next >= cells.length) return;
        e.preventDefault();
        cells[i].tabIndex = -1;
        cells[next].tabIndex = 0;
        cells[next].focus();
    });
}

interface Nav {
    prev(): void;
    next(): void;
}

/** "‹  January 2026  ›"; the title is a button when it leads somewhere */
function header(title: string, nav: Nav, unit: string, key: string, onTitle?: () => void): HTMLElement {
    const head = div('ottadate-header');
    const arrow = (dir: -1 | 1) => {
        const b = btn('ottadate-nav-btn', '', dir < 0 ? nav.prev : nav.next);
        b.innerHTML = dir < 0 ? iconChevronLeft() : iconChevronRight();
        b.setAttribute('aria-label', `${dir < 0 ? 'Previous' : 'Next'} ${unit}`);
        b.dataset.key = `nav:${key}:${dir < 0 ? 'prev' : 'next'}`;
        return b;
    };
    let heading: HTMLElement;
    if (onTitle) {
        heading = btn('ottadate-header-title', title, onTitle);
        heading.dataset.key = `nav:${key}:title`;
    } else {
        heading = span('ottadate-header-title ottadate-header-title--static', title);
    }
    head.append(arrow(-1), heading, arrow(1));
    return head;
}

export interface MonthGridOptions {
    /** Namespaces focus keys when several months are on screen */
    key?: string;
    /** Any day of the month shown */
    view: Date;
    config: ShellConfig<OttaDateConfig>;
    today: Date;
    min: Date | null;
    max: Date | null;
    /** Extra classes for a day: selected, or the range endpoints and span */
    dayClass?(day: Date): string;
    /** The in-month day that gets the tab stop when none is marked (default: today) */
    focusDay?: Date | null;
    onPick(day: Date): void;
    onHover?(day: Date | null): void;
    nav: Nav;
    /** The title opens the month view when given */
    onTitle?(): void;
}

/** One month: header, weekday labels, the 6-week day grid */
export function monthGrid(o: MonthGridOptions): HTMLElement {
    const { config, view } = o;
    const locale = getIntlLocale(config.locale);
    const cal = div('ottadate-cal');
    const title = `${getMonthNames(locale)[view.getMonth()]} ${view.getFullYear()}`;
    cal.appendChild(header(title, o.nav, 'month', o.key ?? 'cal', o.onTitle));

    const weekdays = div('ottadate-weekdays');
    for (const label of getWeekdayLabels(config.firstDayOfWeek, locale)) {
        weekdays.appendChild(span('ottadate-weekday', label));
    }
    cal.appendChild(weekdays);

    const grid = div('ottadate-days');
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', title);
    const say = new Intl.DateTimeFormat(locale, { dateStyle: 'full' });
    const days = buildCalendarGrid(view.getFullYear(), view.getMonth(), config.firstDayOfWeek);
    const cells: HTMLButtonElement[] = [];
    let marked = -1;
    let focus = -1;
    let today = -1;
    let firstIn = -1;
    days.forEach((day, i) => {
        const b = btn('ottadate-day', String(day.getDate()), () => o.onPick(day));
        b.dataset.key = `day:${o.key ?? ''}:${day.getTime()}`;
        b.dataset.time = String(day.getTime());
        b.setAttribute('aria-label', say.format(day));
        b.tabIndex = -1;
        const inside = isSameMonth(day, view);
        if (!inside) b.classList.add('ottadate-day--outside');
        if (isSameDay(day, o.today)) b.classList.add('ottadate-day--today');
        if (!isDateInBounds(day, o.min, o.max)) {
            b.classList.add('ottadate-day--disabled');
            b.disabled = true;
        }
        const extra = o.dayClass?.(day);
        if (extra) b.className += ` ${extra}`;
        if (o.onHover) b.addEventListener('mouseenter', () => o.onHover!(day));
        if (inside && !b.disabled) {
            if (extra && marked < 0) marked = i;
            if (o.focusDay && isSameDay(day, o.focusDay)) focus = i;
            if (isSameDay(day, o.today)) today = i;
            if (firstIn < 0) firstIn = i;
        }
        cells.push(b);
        grid.appendChild(b);
    });
    if (o.onHover) grid.addEventListener('mouseleave', () => o.onHover!(null));
    rove(grid, cells, 7, [marked, focus, today, firstIn].find((i) => i >= 0) ?? 0, o.nav);
    cal.appendChild(grid);
    return cal;
}

/** The twelve months of a year */
function monthsGrid(year: number, selected: Date | null, today: Date, locale: string, onPick: (month: number) => void) {
    const grid = div('ottadate-months');
    const cells: HTMLButtonElement[] = [];
    let stop = -1;
    getMonthNamesShort(locale).forEach((name, m) => {
        const b = btn('ottadate-month-cell', name, () => onPick(m));
        b.dataset.key = `month:${m}`;
        b.tabIndex = -1;
        if (today.getFullYear() === year && today.getMonth() === m) b.classList.add('ottadate-month-cell--current');
        if (selected && selected.getFullYear() === year && selected.getMonth() === m) {
            b.classList.add('ottadate-month-cell--selected');
            stop = m;
        }
        cells.push(b);
        grid.appendChild(b);
    });
    rove(grid, cells, 3, stop >= 0 ? stop : today.getFullYear() === year ? today.getMonth() : 0);
    return grid;
}

/** Twenty-one years around a centre */
function yearsGrid(center: number, selected: Date | null, today: Date, onPick: (year: number) => void) {
    const grid = div('ottadate-years');
    const cells: HTMLButtonElement[] = [];
    const years = getYearRange(center, 10);
    years.forEach((year) => {
        const b = btn('ottadate-year-cell', String(year), () => onPick(year));
        b.dataset.key = `year:${year}`;
        b.tabIndex = -1;
        if (year === today.getFullYear()) b.classList.add('ottadate-year-cell--current');
        if (selected && year === selected.getFullYear()) b.classList.add('ottadate-year-cell--selected');
        cells.push(b);
        grid.appendChild(b);
    });
    const stop = years.indexOf(selected?.getFullYear() ?? today.getFullYear());
    rove(grid, cells, 3, stop >= 0 ? stop : 10);
    return grid;
}

export interface CalendarBodyOptions {
    /** A day was picked (00:00 in the picker's zone) */
    onPickDay(day: Date): void;
    /** Rows under the calendar (the time row) */
    below?(): HTMLElement | null;
}

/** The body of the single-date pickers: days, or the month and year views the title opens */
export function calendarBody<O extends OttaDateConfig>(
    ctx: ShellContext<Date, O>,
    opts: CalendarBodyOptions,
): ShellBody {
    let view: 'days' | 'months' | 'years' = 'days';
    let at = new Date();

    function reset() {
        view = 'days';
        at = startOfMonth(ctx.value ?? frame(ctx.config).today());
    }

    function render(): HTMLElement {
        const f = frame(ctx.config);
        const today = f.today();
        const selected = ctx.value;
        const wrap = div('ottadate-cal-body');
        const go = (next: Date, nextView: typeof view) => {
            at = next;
            view = nextView;
            ctx.render();
        };

        if (view === 'days') {
            wrap.appendChild(
                monthGrid({
                    view: at,
                    config: ctx.config,
                    today,
                    min: f.min,
                    max: f.max,
                    dayClass: (day) => (selected && isSameDay(day, selected) ? 'ottadate-day--selected' : ''),
                    onPick: opts.onPickDay,
                    nav: { prev: () => go(addMonths(at, -1), 'days'), next: () => go(addMonths(at, 1), 'days') },
                    onTitle: () => go(at, 'months'),
                }),
            );
        } else if (view === 'months') {
            const year = at.getFullYear();
            const nav = {
                prev: () => go(new Date(year - 1, at.getMonth(), 1), 'months'),
                next: () => go(new Date(year + 1, at.getMonth(), 1), 'months'),
            };
            wrap.appendChild(header(String(year), nav, 'year', 'cal', () => go(at, 'years')));
            wrap.appendChild(monthsGrid(year, selected, today, f.locale, (m) => go(new Date(year, m, 1), 'days')));
        } else {
            const year = at.getFullYear();
            const nav = {
                prev: () => go(new Date(year - 20, at.getMonth(), 1), 'years'),
                next: () => go(new Date(year + 20, at.getMonth(), 1), 'years'),
            };
            wrap.appendChild(header(`${year - 10} to ${year + 10}`, nav, '20 years', 'cal'));
            wrap.appendChild(yearsGrid(year, selected, today, (y) => go(new Date(y, at.getMonth(), 1), 'months')));
        }

        const below = opts.below?.();
        if (below) wrap.appendChild(below);
        return wrap;
    }

    return { render, reset };
}
