/**
 * @ottabase/ottadate — FuzzyDateTimeCompact
 *
 * Space-efficient fuzzy date picker for forms and sidebars. The controls are a
 * mad-lib sentence of native <select>s that literally reads as the stored
 * label, and — like the full picker — the resolution is DERIVED from how much
 * of the sentence the user fills in (see core/fuzzy-selection.ts):
 *
 *   [ Sometime ▾ ] [ Any month ▾ ] [ 2020 ▾ ]         → "Sometime in 2020"
 *   [ Sometime ▾ ] [ May ▾ ] [ Any day ▾ ] [ 2020 ▾ ] → "Sometime in May 2020"
 *   [ Around ▾ ]   [ May ▾ ] [ 20 ▾ ] [ 2020 ▾ ]      → "Around May 20, 2020"
 *   [ 14 ] : [ 30 ]                                    ← time cascade, appears once a day is set
 *   "Around 14:30 on May 20, 2020"                     ← live preview label
 *   [ Now ] [ Clear ]                                  ← footer
 *
 * Every change auto-applies.
 *
 * Usage:
 *   const picker = OttaDate.createFuzzyDateTimeCompact(container, {
 *       onChange: (fuzzy) => console.log(fuzzy),
 *   });
 */

import { APPROXIMATION_LABELS } from '../core/fuzzy';
import { createFuzzySelection, type FuzzySelection } from '../core/fuzzy-selection';
import type {
    DateApproximation,
    FuzzyDateTime,
    FuzzyDateTimePickerInstance,
    FuzzyDateTimePickerOptions,
} from '../core/types';
import { getIntlLocale, getMonthNames, pad2, resolveConfig } from '../core/utils';
import {
    btn,
    clearChildren,
    div,
    el,
    iconCalendar,
    iconChevronDown,
    iconX,
    onClickOutside,
    onEscape,
    span,
} from '../dom/helpers';

/** Year dropdown range — fuzzy dates are past-heavy, so reach far back */
const YEARS_AHEAD = 10;
const YEARS_BACK = 100;

export function createFuzzyDateTimeCompact(
    container: HTMLElement,
    options: FuzzyDateTimePickerOptions = {},
): FuzzyDateTimePickerInstance {
    let config = resolveConfig({
        placeholder: 'Select approximate date…',
        ...options,
    });

    let sel: FuzzySelection = createFuzzySelection({
        resolutions: config.resolutions,
        approximations: config.approximations,
        value: config.value,
    });
    let currentFuzzy: FuzzyDateTime | null = config.value ?? null;

    let isOpen = false;
    let removeClickOutside: (() => void) | null = null;
    let removeEscapeHandler: (() => void) | null = null;

    const root = div('ottadate');
    root.classList.add('ottadate--compact');
    if (config.inline) root.classList.add('ottadate--inline');
    container.appendChild(root);

    // Trigger
    const trigger = el('button', {
        className: 'ottadate-trigger',
        type: 'button',
        'aria-haspopup': 'dialog',
        'aria-expanded': 'false',
    }) as HTMLButtonElement;

    if (config.disabled) {
        trigger.setAttribute('aria-disabled', 'true');
    }

    const triggerIcon = span('ottadate-trigger-icon', '');
    triggerIcon.innerHTML = iconCalendar();
    const triggerText = span('ottadate-trigger-text', '');
    const triggerClear = el('button', {
        className: 'ottadate-trigger-clear',
        type: 'button',
        'aria-label': 'Clear',
    }) as HTMLButtonElement;
    triggerClear.innerHTML = iconX();
    triggerClear.style.display = 'none';

    trigger.append(triggerIcon, triggerText, triggerClear);
    if (!config.inline) root.appendChild(trigger);

    // Popover
    const popover = div('ottadate-popover');
    popover.style.display = config.inline ? '' : 'none';
    if (config.inline) isOpen = true;
    root.appendChild(popover);

    // --- Actions ---

    function emitChange() {
        if (config.onChange) {
            config.onChange(currentFuzzy);
        }
    }

    /** Every change auto-applies — each partial state is a valid fuzzy date */
    function commit() {
        currentFuzzy = sel.build();
        updateTriggerText();
        emitChange();
        render();
    }

    // --- Rendering helpers ---

    function updateTriggerText() {
        if (currentFuzzy) {
            triggerText.textContent = currentFuzzy.label;
            triggerText.classList.remove('ottadate-trigger-placeholder');
            triggerClear.style.display = '';
        } else {
            triggerText.textContent = config.placeholder!;
            triggerText.classList.add('ottadate-trigger-placeholder');
            triggerClear.style.display = 'none';
        }
    }

    /** Themed <select> with a custom chevron (mirrors ui-shadcn's NativeSelect) */
    function createSelect(
        className: string,
        optionItems: { value: string; label: string; disabled?: boolean }[],
        currentValue: string,
        onChange: (value: string) => void,
    ): HTMLElement {
        const wrapper = div(`ottadate-compact-select-wrapper ${className}`);

        const select = el('select', {
            className: 'ottadate-compact-select',
        }) as HTMLSelectElement;

        if (config.disabled) select.disabled = true;

        for (const opt of optionItems) {
            const option = el('option', { value: opt.value }) as HTMLOptionElement;
            option.textContent = opt.label;
            if (opt.value === currentValue) option.selected = true;
            if (opt.disabled) option.disabled = true;
            select.appendChild(option);
        }

        select.addEventListener('change', () => onChange(select.value));

        const chevron = span('ottadate-compact-select-chevron', '');
        chevron.innerHTML = iconChevronDown();

        wrapper.append(select, chevron);
        return wrapper;
    }

    /** The sentence row: [approximation] [month?] [day?] [year] */
    function renderSentenceRow(): HTMLElement {
        const row = div('ottadate-compact-row');

        // Approximation — 'sometime' greys out once a time is set
        const approxItems = sel.allowedApprox.map((a) => ({
            value: a,
            label: APPROXIMATION_LABELS[a],
            disabled: a === 'sometime' && sel.sometimeDisabled(),
        }));
        row.appendChild(
            createSelect('ottadate-compact-approx', approxItems, sel.state.approximation, (val) => {
                sel.setApproximation(val as DateApproximation);
                if (sel.state.hasSelection) commit();
                else render();
            }),
        );

        // Month — "Any month" keeps the selection at year resolution
        if (sel.levelAllowed('month')) {
            const monthRequired = sel.base !== 'year';
            const months = getMonthNames(getIntlLocale(config.locale));
            const monthItems = [
                ...(monthRequired ? [] : [{ value: '', label: 'Any month' }]),
                ...months.map((name, idx) => ({ value: String(idx), label: name })),
            ];
            row.appendChild(
                createSelect(
                    'ottadate-compact-month',
                    monthItems,
                    sel.state.monthSet ? String(sel.state.month) : '',
                    (val) => {
                        if (val === '') sel.clearMonth();
                        else sel.setMonth(parseInt(val, 10));
                        commit();
                    },
                ),
            );
        }

        // Day — appears only once a month is chosen
        if (sel.levelAllowed('day') && sel.state.monthSet) {
            const dayRequired = sel.base !== 'year' && sel.base !== 'month';
            const dayItems = [...(dayRequired ? [] : [{ value: '', label: 'Any day' }])];
            for (let d = 1; d <= sel.daysInMonth(); d++) {
                dayItems.push({ value: String(d), label: String(d) });
            }
            row.appendChild(
                createSelect('ottadate-compact-day', dayItems, sel.state.daySet ? String(sel.state.day) : '', (val) => {
                    if (val === '') sel.clearDay();
                    else sel.setDay(parseInt(val, 10));
                    commit();
                }),
            );
        }

        // Year — most recent first; fuzzy recall is almost always about the past
        const now = new Date().getFullYear();
        const yearItems: { value: string; label: string }[] = [];
        const maxYear = Math.max(now + YEARS_AHEAD, sel.state.year);
        const minYear = Math.min(now - YEARS_BACK, sel.state.year);
        for (let y = maxYear; y >= minYear; y--) {
            yearItems.push({ value: String(y), label: String(y) });
        }
        row.appendChild(
            createSelect('ottadate-compact-year', yearItems, String(sel.state.year), (val) => {
                sel.setYear(parseInt(val, 10));
                commit();
            }),
        );

        return row;
    }

    /** Cascading time inputs — blank = "don't remember"; appears once a day is set */
    function timeInput(
        value: number | null,
        enabled: boolean,
        ariaLabel: string,
        onCommit: (value: number | null) => void,
    ): HTMLInputElement {
        const input = el('input', {
            className: 'ottadate-time-input',
            type: 'number',
            placeholder: '––',
            'aria-label': ariaLabel,
        }) as HTMLInputElement;
        input.value = value != null ? pad2(value) : '';
        input.disabled = config.disabled || !enabled;
        input.addEventListener('change', () => {
            const raw = input.value.trim();
            if (raw === '') {
                onCommit(null);
            } else {
                const parsed = parseInt(raw, 10);
                onCommit(isNaN(parsed) ? null : parsed);
            }
            commit();
        });
        return input;
    }

    function renderTimeRow(): HTMLElement | null {
        if (!sel.levelAllowed('hour') || !sel.state.daySet) return null;

        const row = div('ottadate-compact-row');
        row.appendChild(timeInput(sel.state.hour, true, 'Hour', (v) => sel.setHour(v)));

        if (sel.levelAllowed('minute')) {
            row.appendChild(span('ottadate-time-separator', ':'));
            row.appendChild(timeInput(sel.state.minute, sel.state.hour != null, 'Minute', (v) => sel.setMinute(v)));
        }
        if (sel.levelAllowed('second')) {
            row.appendChild(span('ottadate-time-separator', ':'));
            row.appendChild(timeInput(sel.state.second, sel.state.minute != null, 'Second', (v) => sel.setSecond(v)));
        }

        return row;
    }

    /** Live preview of the stored label */
    function renderPreview(): HTMLElement {
        const preview = sel.build();
        return span('ottadate-compact-desc', preview ? preview.label : 'Pick what you remember…');
    }

    function renderFooter(): HTMLElement {
        const footer = div('ottadate-footer');

        const nowBtn = btn('ottadate-footer-btn ottadate-footer-btn--primary', 'Now', () => {
            if (config.disabled) return;
            sel.setNow();
            commit();
        });

        const clearBtn = btn('ottadate-footer-btn', 'Clear', () => {
            if (config.disabled) return;
            sel.clear();
            commit();
        });

        footer.append(nowBtn, clearBtn);
        return footer;
    }

    function render() {
        clearChildren(popover);

        const wrapper = div('ottadate-compact-wrapper');
        wrapper.appendChild(renderSentenceRow());

        const timeRow = renderTimeRow();
        if (timeRow) wrapper.appendChild(timeRow);

        wrapper.appendChild(renderPreview());

        popover.appendChild(wrapper);
        popover.appendChild(renderFooter());
    }

    function openPicker() {
        if (isOpen || config.disabled) return;
        isOpen = true;
        popover.style.display = '';
        trigger.setAttribute('aria-expanded', 'true');
        render();

        removeClickOutside = onClickOutside(root, closePicker);
        removeEscapeHandler = onEscape(closePicker);
    }

    function closePicker() {
        if (!isOpen || config.inline) return;
        isOpen = false;
        popover.style.display = 'none';
        trigger.setAttribute('aria-expanded', 'false');
        removeClickOutside?.();
        removeEscapeHandler?.();
        removeClickOutside = null;
        removeEscapeHandler = null;
    }

    // --- Events ---

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isOpen) closePicker();
        else openPicker();
    });

    triggerClear.addEventListener('click', (e) => {
        e.stopPropagation();
        sel.clear();
        currentFuzzy = null;
        updateTriggerText();
        emitChange();
        if (isOpen) render();
    });

    // --- Initial render ---

    updateTriggerText();
    if (config.inline) render();

    // --- Value plumbing ---

    function applyValue(value: FuzzyDateTime | null) {
        if (value) {
            sel.load(value);
            currentFuzzy = value;
        } else {
            sel.clear();
            currentFuzzy = null;
        }
        updateTriggerText();
        if (isOpen) render();
    }

    // --- Public API ---

    return {
        open: openPicker,
        close: closePicker,
        toggle() {
            if (isOpen) closePicker();
            else openPicker();
        },
        setValue: applyValue,
        getValue() {
            return currentFuzzy;
        },
        setOptions(newOptions) {
            config = resolveConfig({ ...config, ...newOptions });
            // Constraint changes need a fresh selection controller
            if (newOptions.resolutions !== undefined || newOptions.approximations !== undefined) {
                sel = createFuzzySelection({
                    resolutions: config.resolutions,
                    approximations: config.approximations,
                    value: currentFuzzy,
                });
            }
            if (newOptions.value !== undefined) {
                applyValue(newOptions.value);
            } else {
                updateTriggerText();
                if (isOpen) render();
            }
        },
        destroy() {
            closePicker();
            root.remove();
        },
        isOpen: () => isOpen,
        element: root,
    };
}
