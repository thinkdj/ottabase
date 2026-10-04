/**
 * @ottabase/ottadate: FuzzyDateTimePicker
 *
 * For dates the user only partly remembers. One fixed-size panel that zooms
 * like a map: decades → years → months → days → hours.
 *
 *   ‹      1998 ⌃      ›          ← title zooms out, arrows browse
 *   [Sometime][Early][Mid][Late]   ← how sure you are about 1998
 *   [Spring][Summer][Autumn][Winter]
 *    Jan  Feb  Mar  Apr            ← or name a month to zoom in
 *    May [Jun][Jul][Aug]           ← "Summer" shows as a band
 *    Sep  Oct  Nov  Dec
 *
 * Rules (the whole IA):
 *   - Browse freely: the title and the arrows never change the value.
 *   - Tap a cell to name that period and zoom into it.
 *   - Tap a chip to answer at the level on screen: "Sometime" (just this
 *     period, which is how you become less precise) or a part
 *     (early/mid/late, seasons, morning…night). Tap an active part to drop it.
 *   - Parts and "~ Roughly" are drawn as bands on the grid, and the result
 *     line spells out the stored range.
 *
 * Resolution is derived from how deep the value goes (core/fuzzy-selection.ts).
 */

import { createFuzzyDateTime, PART_LABELS, partsForResolution, resolutionIndex } from '../core/fuzzy';
import type { DatePart, DateResolution, FuzzyDateTimePickerInstance, FuzzyDateTimePickerOptions } from '../core/types';
import { getIntlLocale, getMonthNames, getMonthNamesShort, getWeekdayLabels, pad2 } from '../core/utils';
import { btn, div, iconChevronDown, iconChevronLeft, iconChevronRight, span } from '../dom/helpers';
import { createFuzzyShell, timeFields, type FuzzyBody, type FuzzyBodyContext } from './fuzzy-shell';

type ZoomView = 'decades' | 'years' | 'months' | 'days' | 'hours';

/** View i shows level i as cells and zooms inside level i − 1 */
const VIEWS: ZoomView[] = ['decades', 'years', 'months', 'days', 'hours'];
const LEVELS: DateResolution[] = ['decade', 'year', 'month', 'day', 'hour'];
/** Decades per page (a fixed 120-year page keeps the grid stable while browsing) */
const DECADE_PAGE = 12;

interface At {
    year: number;
    month: number;
    day: number;
    hour?: number;
}

const ri = resolutionIndex;
const utcSec = (y: number, mo = 0, d = 1, h = 0) => Date.UTC(y, mo, d, h) / 1000;
const decadeOf = (year: number) => year - (year % 10);
const clampYear = (year: number) => Math.max(1, Math.min(9999, year));

function zoomBody(ctx: FuzzyBodyContext): FuzzyBody {
    let view: ZoomView = 'years';
    let at: At = { year: new Date().getFullYear(), month: 0, day: 1 };

    const sel = () => ctx.sel;
    const locale = () => getIntlLocale(ctx.config.locale);

    /** The value may stop at this level (inside the configured bounds) */
    const storable = (level: DateResolution) => ri(level) >= ri(sel().base) && sel().levelAllowed(level);
    const partsOf = (level: DateResolution) => (ctx.config.parts === false ? [] : partsForResolution(level));
    const viewIndex = () => VIEWS.indexOf(view);
    const container = (): DateResolution | null => LEVELS[viewIndex() - 1] ?? null;

    /** A view is worth showing when it has cells to name or chips to answer with */
    function hasContent(v: ZoomView): boolean {
        const i = VIEWS.indexOf(v);
        if (sel().levelAllowed(LEVELS[i])) return true;
        const inside = LEVELS[i - 1];
        return !!inside && storable(inside) && partsOf(inside).length > 0;
    }

    /** Whether the value names `level` at these coordinates (the value's path) */
    function onPath(level: DateResolution, c: At): boolean {
        const s = sel().state;
        if (!s.hasSelection || ri(sel().resolution()) < ri(level)) return false;
        if (decadeOf(s.year) !== decadeOf(c.year)) return false;
        if (level === 'decade') return true;
        if (s.year !== c.year) return false;
        if (level === 'year') return true;
        if (s.month !== c.month) return false;
        if (level === 'month') return true;
        if (s.day !== c.day) return false;
        if (level === 'day') return true;
        return s.hour === c.hour;
    }

    function reset() {
        const s = sel().state;
        if (!s.hasSelection) {
            const now = new Date();
            at = { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
            view = VIEWS[Math.min(ri(sel().base), VIEWS.length - 1)];
            return;
        }
        at = { year: s.year, month: s.month, day: s.day };
        const deepest = ri(sel().resolution());
        const inside = VIEWS[deepest + 1];
        view = inside && hasContent(inside) ? inside : VIEWS[Math.min(deepest, VIEWS.length - 1)];
    }

    // --- Actions ---

    function page(delta: number) {
        switch (view) {
            case 'decades':
                at.year = clampYear(at.year + delta * DECADE_PAGE * 10);
                break;
            case 'years':
                at.year = clampYear(at.year + delta * 10);
                break;
            case 'months':
                at.year = clampYear(at.year + delta);
                break;
            default: {
                const d = new Date(Date.UTC(at.year, at.month + (view === 'days' ? delta : 0), 1));
                const dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
                const day = view === 'hours' ? at.day + delta : Math.min(at.day, dim);
                const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), day));
                at = { year: clampYear(next.getUTCFullYear()), month: next.getUTCMonth(), day: next.getUTCDate() };
            }
        }
        ctx.render();
    }

    function zoomOut() {
        if (viewIndex() > 0) view = VIEWS[viewIndex() - 1];
        ctx.render();
    }

    /** Tap a cell: name that period (unless it is already on the value's path) and zoom into it */
    function pick(level: DateResolution, coords: Partial<At>) {
        at = { ...at, ...coords };
        const changed = storable(level) && !onPath(level, at);
        if (changed) sel().select(level, at);
        const inside = VIEWS[ri(level) + 1];
        if (inside && hasContent(inside)) view = inside;
        if (changed) ctx.commit();
        else ctx.render();
    }

    /** Tap a chip: answer at the level on screen. null = "Sometime" (just this period). */
    function answer(part: DatePart | null) {
        const level = container()!;
        const wasActive = chipActive(part);
        sel().select(level, at);
        if (part && !wasActive) sel().setPart(part);
        ctx.commit();
    }

    function chipActive(part: DatePart | null): boolean {
        const level = container();
        return (
            !!level &&
            sel().state.hasSelection &&
            sel().resolution() === level &&
            onPath(level, at) &&
            (sel().state.part ?? null) === part
        );
    }

    // --- Rendering ---

    function title(): string {
        const months = getMonthNames(locale());
        switch (view) {
            case 'decades': {
                const start = Math.floor(decadeOf(at.year) / (DECADE_PAGE * 10)) * DECADE_PAGE * 10;
                return `${start}s to ${start + (DECADE_PAGE - 1) * 10}s`;
            }
            case 'years':
                return `${decadeOf(at.year)}s`;
            case 'months':
                return String(at.year);
            case 'days':
                return `${months[at.month]} ${at.year}`;
            default: {
                const weekday = new Intl.DateTimeFormat(locale(), { weekday: 'short', timeZone: 'UTC' }).format(
                    new Date(Date.UTC(at.year, at.month, at.day)),
                );
                return `${weekday}, ${getMonthNamesShort(locale())[at.month]} ${at.day}, ${at.year}`;
            }
        }
    }

    function renderNav(): HTMLElement {
        const nav = div('ottadate-fz-nav');
        const arrow = (dir: -1 | 1) => {
            const b = btn('ottadate-nav-btn', '', () => page(dir));
            b.innerHTML = dir < 0 ? iconChevronLeft() : iconChevronRight();
            b.setAttribute('aria-label', dir < 0 ? 'Previous' : 'Next');
            b.dataset.key = dir < 0 ? 'nav:prev' : 'nav:next';
            return b;
        };

        const heading = btn('ottadate-fz-title', '', zoomOut);
        heading.appendChild(span('ottadate-fz-title-text', title()));
        heading.dataset.key = 'nav:title';
        if (viewIndex() === 0) {
            heading.disabled = true;
        } else {
            heading.setAttribute('aria-label', `${title()}, zoom out`);
            const icon = span('ottadate-fz-title-icon', '');
            icon.innerHTML = iconChevronDown();
            heading.appendChild(icon);
        }

        nav.append(arrow(-1), heading, arrow(1));
        return nav;
    }

    /** "Sometime" + part chips: the answers for the period on screen */
    function renderChips(): HTMLElement | null {
        const level = container();
        if (!level || !storable(level)) return null;
        const parts = partsOf(level);
        const chips = div('ottadate-fz-chips');
        chips.setAttribute('role', 'group');
        chips.setAttribute('aria-label', `When in ${title()}?`);
        chips.classList.add(`ottadate-fz-chips--${level}`);

        const chip = (part: DatePart | null) => {
            const label = part ? PART_LABELS[part] : level === 'day' ? 'All day' : 'Sometime';
            const c = btn(`ottadate-fz-chip${part ? '' : ' ottadate-fz-chip--whole'}`, label, () => answer(part));
            c.setAttribute('aria-pressed', String(chipActive(part)));
            c.dataset.key = `chip:${part ?? 'whole'}`;
            if (part) c.dataset.part = part;
            return c;
        };
        chips.appendChild(chip(null));
        parts.forEach((p) => chips.appendChild(chip(p)));
        return chips;
    }

    /** The stored windows, for drawing parts and "~ Roughly" as bands */
    function windows() {
        const value = sel().build();
        if (!value) return null;
        const core = createFuzzyDateTime(new Date(value.timestamp * 1000), value.resolution, {
            part: value.part,
            hemisphere: ctx.config.hemisphere,
        });
        // A part band only on the view where its chip lives
        const level = container();
        const band = !!value.part && level === value.resolution && onPath(level, at);
        return { core, value, band };
    }

    function renderGrid(): HTMLElement | null {
        const level = LEVELS[viewIndex()];
        if (!sel().levelAllowed(level)) return null;

        const now = new Date();
        const win = windows();
        const grid = div(`ottadate-fz-grid ottadate-fz-grid--${view}`);
        grid.setAttribute('role', 'group');
        grid.setAttribute('aria-label', title());
        const cells: HTMLButtonElement[] = [];

        const cell = (label: string, coords: Partial<At>, start: number, endEx: number, isNow: boolean) => {
            const c = { ...at, ...coords };
            const b = btn('ottadate-fz-cell', label, () => pick(level, coords));
            b.dataset.key = `cell:${level}:${cells.length}`;
            b.tabIndex = -1;
            const selected = onPath(level, c);
            if (selected) b.setAttribute('aria-current', 'true');
            if (isNow) b.classList.add('ottadate-fz-cell--now');
            if (win && !selected) {
                const inCore = start >= win.core.earliest && endEx - 1 <= win.core.latest;
                if (win.band && inCore) b.classList.add('ottadate-fz-cell--band');
                else if (
                    win.value.approximate &&
                    !inCore &&
                    start <= win.value.latest &&
                    endEx - 1 >= win.value.earliest
                ) {
                    b.classList.add('ottadate-fz-cell--approx');
                }
            }
            cells.push(b);
            grid.appendChild(b);
        };

        switch (view) {
            case 'decades': {
                const start = Math.floor(decadeOf(at.year) / (DECADE_PAGE * 10)) * DECADE_PAGE * 10;
                for (let i = 0; i < DECADE_PAGE; i++) {
                    const d = start + i * 10;
                    cell(`${d}s`, { year: d }, utcSec(d), utcSec(d + 10), decadeOf(now.getFullYear()) === d);
                }
                break;
            }
            case 'years': {
                const start = decadeOf(at.year);
                for (let y = start; y < start + 10; y++) {
                    cell(String(y), { year: y }, utcSec(y), utcSec(y + 1), now.getFullYear() === y);
                }
                break;
            }
            case 'months':
                getMonthNamesShort(locale()).forEach((name, m) => {
                    const isNow = now.getFullYear() === at.year && now.getMonth() === m;
                    cell(name, { month: m }, utcSec(at.year, m), utcSec(at.year, m + 1), isNow);
                });
                break;
            case 'days': {
                const firstDay = ctx.config.firstDayOfWeek ?? 1;
                getWeekdayLabels(firstDay, locale()).forEach((w) => grid.appendChild(span('ottadate-fz-weekday', w)));
                const lead = (new Date(Date.UTC(at.year, at.month, 1)).getUTCDay() - firstDay + 7) % 7;
                for (let i = 0; i < lead; i++) grid.appendChild(span('ottadate-fz-blank', ''));
                const dim = new Date(Date.UTC(at.year, at.month + 1, 0)).getUTCDate();
                const thisMonth = now.getFullYear() === at.year && now.getMonth() === at.month;
                for (let d = 1; d <= dim; d++) {
                    cell(
                        String(d),
                        { day: d },
                        utcSec(at.year, at.month, d),
                        utcSec(at.year, at.month, d + 1),
                        thisMonth && now.getDate() === d,
                    );
                }
                break;
            }
            default: {
                const today = now.getFullYear() === at.year && now.getMonth() === at.month && now.getDate() === at.day;
                for (let h = 0; h < 24; h++) {
                    cell(
                        `${pad2(h)}:00`,
                        { hour: h },
                        utcSec(at.year, at.month, at.day, h),
                        utcSec(at.year, at.month, at.day, h + 1),
                        today && now.getHours() === h,
                    );
                }
            }
        }

        // Roving tabindex: one tab stop per grid (selected, else now, else first); arrows move inside
        const stop =
            cells.find((c) => c.hasAttribute('aria-current')) ??
            cells.find((c) => c.classList.contains('ottadate-fz-cell--now')) ??
            cells[0];
        if (stop) {
            stop.tabIndex = 0;
            stop.dataset.roving = 'true';
        }
        const cols = view === 'days' ? 7 : view === 'hours' ? 6 : view === 'years' ? 5 : 4;
        grid.addEventListener('keydown', (e) => {
            const i = cells.indexOf(document.activeElement as HTMLButtonElement);
            if (i < 0) return;
            const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols };
            const next =
                e.key === 'Home' ? 0 : e.key === 'End' ? cells.length - 1 : e.key in step ? i + step[e.key] : -1;
            if (next < 0 || next >= cells.length) return;
            e.preventDefault();
            cells[i].tabIndex = -1;
            cells[next].tabIndex = 0;
            cells[next].focus();
        });
        return grid;
    }

    function render(): HTMLElement {
        const wrap = div(`ottadate-fz-zoom ottadate-fz-zoom--${view}`);
        wrap.addEventListener('keydown', (e) => {
            if (e.key === 'PageUp' || e.key === 'PageDown') {
                e.preventDefault();
                page(e.key === 'PageUp' ? -1 : 1);
            }
        });
        wrap.appendChild(renderNav());
        const chips = renderChips();
        if (chips) wrap.appendChild(chips);
        const grid = renderGrid();
        if (grid) wrap.appendChild(grid);

        // Exact time below the hour grid, for minute/second precision
        if (view === 'hours' && sel().levelAllowed('minute')) {
            const exact = div('ottadate-fz-exact');
            exact.appendChild(span('ottadate-fz-exact-label', 'Exact time'));
            exact.appendChild(
                timeFields(ctx, onPath('day', at), () => {
                    if (!onPath('day', at)) sel().select('day', at);
                }),
            );
            wrap.appendChild(exact);
        }
        return wrap;
    }

    return { render, reset };
}

export function createFuzzyDateTimePicker(
    container: HTMLElement,
    options: FuzzyDateTimePickerOptions = {},
): FuzzyDateTimePickerInstance {
    return createFuzzyShell(container, options, { className: 'ottadate--fuzzy', body: zoomBody });
}
