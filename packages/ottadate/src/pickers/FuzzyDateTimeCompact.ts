/**
 * @ottabase/ottadate: FuzzyDateTimeCompact
 *
 * The small-footprint fuzzy picker for forms and sidebars: the same shell as
 * FuzzyDateTimePicker (type-to-parse, result line, ~ Roughly, footer) with a
 * body of native <select>s in the order the label reads. Native selects mean
 * the OS wheel on phones.
 *
 *   [ Late      ▾ ] [ May     ▾ ]      → "Late May 2010"
 *   [ Any day   ▾ ] [ 2010    ▾ ]
 *   [ hh ] : [ mm ]                    ← once a day is named
 *
 * "Sometime" is the no-part answer, "Any month" / "Any day" keep it coarse,
 * and the year list is grouped by decade (with "1990s" itself selectable when
 * decades are allowed). Every change auto-applies.
 */

import { PART_LABELS, resolutionIndex } from '../core/fuzzy';
import type { DatePart, FuzzyDateTimePickerInstance, FuzzyDateTimePickerOptions } from '../core/types';
import { getIntlLocale, getMonthNames } from '../core/utils';
import { div, el, iconChevronDown, span } from '../dom/helpers';
import { createFuzzyShell, timeFields, type FuzzyBody, type FuzzyBodyContext } from './fuzzy-shell';

/** Year list range: fuzzy recall is past-heavy, so reach far back */
const YEARS_AHEAD = 10;
const YEARS_BACK = 100;

type Option = { value: string; label: string };
type Group = { label: string; options: Option[] };

function compactBody(ctx: FuzzyBodyContext): FuzzyBody {
    /** Themed native <select> (custom chevron, mirrors ui-shadcn's NativeSelect) */
    function select(key: string, label: string, items: (Option | Group)[], value: string, apply: (v: string) => void) {
        const wrapper = div(`ottadate-fzc-select ottadate-fzc-select--${key}`);
        const s = el('select', { className: 'ottadate-fzc-native', 'aria-label': label }) as HTMLSelectElement;
        s.dataset.key = `select:${key}`; // keeps keyboard focus across re-renders
        s.disabled = !!ctx.config.disabled;
        const option = (o: Option) => {
            const opt = el('option', { value: o.value }) as HTMLOptionElement;
            opt.textContent = o.label;
            return opt;
        };
        for (const item of items) {
            if ('options' in item) {
                const group = el('optgroup', { label: item.label });
                item.options.forEach((o) => group.appendChild(option(o)));
                s.appendChild(group);
            } else {
                s.appendChild(option(item));
            }
        }
        s.value = value;
        s.addEventListener('change', () => {
            apply(s.value);
            ctx.commit();
        });
        const chevron = span('ottadate-fzc-chevron', '');
        chevron.innerHTML = iconChevronDown();
        wrapper.append(s, chevron);
        return wrapper;
    }

    /** Years grouped by decade, newest first; "1990s" itself is an option when decades are allowed */
    function whenItems(): (Option | Group)[] {
        const { sel } = ctx;
        const s = sel.state;
        const decadeMode = sel.base === 'decade';
        const now = new Date().getFullYear();
        const newest = Math.max(now + YEARS_AHEAD, s.year);
        const oldest = Math.min(now - YEARS_BACK, s.year);
        const items: (Option | Group)[] = s.hasSelection ? [] : [{ value: '', label: 'Year' }];

        for (let d = newest - (newest % 10); d >= oldest - (oldest % 10); d -= 10) {
            const options: Option[] = decadeMode ? [{ value: `d${d}`, label: `${d}s` }] : [];
            if (sel.levelAllowed('year')) {
                for (let y = Math.min(d + 9, newest); y >= Math.max(d, oldest); y--) {
                    options.push({ value: `y${y}`, label: String(y) });
                }
            }
            items.push(...(sel.levelAllowed('year') ? [{ label: `${d}s`, options }] : options));
        }
        return items;
    }

    function render(): HTMLElement {
        const { sel } = ctx;
        const s = sel.state;
        const wrap = div('ottadate-fzc');
        const grid = div('ottadate-fzc-grid');

        // 1. Part: "Sometime" (none) or the parts of the current level
        const parts = sel.partOptions();
        if (parts.length || s.part) {
            const none = sel.resolution() === 'day' ? 'All day' : 'Sometime';
            grid.appendChild(
                select(
                    'part',
                    'How sure',
                    [{ value: '', label: none }, ...parts.map((p) => ({ value: p, label: PART_LABELS[p] }))],
                    s.part ?? '',
                    (v) => sel.setPart(v ? (v as DatePart) : null),
                ),
            );
        }

        // 2. Month, once a year is named
        if (sel.levelAllowed('month') && s.hasSelection && s.yearSet) {
            const required = resolutionIndex(sel.base) >= resolutionIndex('month');
            const months = getMonthNames(getIntlLocale(ctx.config.locale)).map((name, i) => ({
                value: String(i),
                label: name,
            }));
            grid.appendChild(
                select(
                    'month',
                    'Month',
                    required ? months : [{ value: '', label: 'Any month' }, ...months],
                    s.monthSet ? String(s.month) : '',
                    (v) => (v === '' ? sel.clearMonth() : sel.setMonth(parseInt(v, 10))),
                ),
            );
        }

        // 3. Day, once a month is named
        if (sel.levelAllowed('day') && s.monthSet) {
            const days: Option[] = [];
            for (let d = 1; d <= sel.daysInMonth(); d++) days.push({ value: String(d), label: String(d) });
            const required = resolutionIndex(sel.base) >= resolutionIndex('day');
            grid.appendChild(
                select(
                    'day',
                    'Day',
                    required ? days : [{ value: '', label: 'Any day' }, ...days],
                    s.daySet ? String(s.day) : '',
                    (v) => (v === '' ? sel.clearDay() : sel.setDay(parseInt(v, 10))),
                ),
            );
        }

        // 4. Year (or decade): last, like the label reads
        const when = !s.hasSelection ? '' : s.yearSet ? `y${s.year}` : `d${s.year - (s.year % 10)}`;
        grid.appendChild(
            select('year', 'Year', whenItems(), when, (v) => {
                const n = parseInt(v.slice(1), 10);
                // A year keeps the rest of the date ("same day, another year"); a decade starts over
                if (v.startsWith('d')) sel.select('decade', { year: n });
                else sel.setYear(n);
            }),
        );
        wrap.appendChild(grid);

        // Time cascade, once a day is named
        if (sel.levelAllowed('hour') && s.daySet) {
            const time = div('ottadate-fz-exact');
            time.append(span('ottadate-fz-exact-label', 'Time'), timeFields(ctx, true));
            wrap.appendChild(time);
        }
        return wrap;
    }

    return { render, reset() {} };
}

export function createFuzzyDateTimeCompact(
    container: HTMLElement,
    options: FuzzyDateTimePickerOptions = {},
): FuzzyDateTimePickerInstance {
    return createFuzzyShell(container, options, { className: 'ottadate--fuzzy ottadate--compact', body: compactBody });
}
