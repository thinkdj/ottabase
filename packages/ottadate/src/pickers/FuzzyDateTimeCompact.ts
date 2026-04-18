/**
 * @ottabase/ottadate — FuzzyDateTimeCompact
 *
 * A space-efficient fuzzy date picker using native <select> dropdowns
 * instead of chip grids. Ideal for forms, sidebars, and inline usage
 * where screen real-estate is limited.
 *
 * Layout:
 *   [ Sometime in ▾ ]  [ Month ▾ ]     ← two selects: approximation + resolution
 *   [ 2026 ▾ ] [ March ▾ ] [ 29 ▾ ]    ← native selects for date parts (shown based on resolution)
 *   [ 14 ] : [ 30 ]                    ← time inputs (shown if resolution >= hour)
 *   "Sometime in March 2026"            ← live preview label
 *   [ Now ] [ Clear ]                  ← footer
 *
 * Usage:
 *   const picker = OttaDate.createFuzzyDateTimeCompact(container, {
 *       onChange: (fuzzy) => console.log(fuzzy),
 *   });
 */

import {
    APPROXIMATION_LABELS,
    createFuzzyDateTime,
    isResolutionFinerOrEqual,
    parseFuzzyDateTime,
    RESOLUTION_LABELS,
    RESOLUTION_ORDER,
} from '../core/fuzzy';
import type {
    DateApproximation,
    DateResolution,
    FuzzyDateTime,
    FuzzyDateTimePickerInstance,
    FuzzyDateTimePickerOptions,
} from '../core/types';
import { getIntlLocale, getMonthNames, getYearRange, pad2, resolveConfig } from '../core/utils';
import { btn, clearChildren, div, el, iconCalendar, iconX, onClickOutside, onEscape, span } from '../dom/helpers';

export function createFuzzyDateTimeCompact(
    container: HTMLElement,
    options: FuzzyDateTimePickerOptions = {},
): FuzzyDateTimePickerInstance {
    let config = resolveConfig({
        placeholder: 'Select approximate date…',
        resolutions: [...RESOLUTION_ORDER],
        approximations: ['exact', 'around', 'sometime'] as DateApproximation[],
        ...options,
    });

    // State
    let resolution: DateResolution = 'month';
    let approximation: DateApproximation = 'sometime';
    let selectedYear = new Date().getFullYear();
    let selectedMonth = 0;
    let selectedDay = 1;
    let selectedHour = 12;
    let selectedMinute = 0;
    let selectedSecond = 0;
    let currentFuzzy: FuzzyDateTime | null = null;

    // Initialize from existing value
    if (config.value) {
        const parsed = parseFuzzyDateTime(config.value);
        resolution = parsed.resolution;
        approximation = parsed.approximation;
        selectedYear = parsed.date.getUTCFullYear();
        selectedMonth = parsed.date.getUTCMonth();
        selectedDay = parsed.date.getUTCDate();
        selectedHour = parsed.date.getUTCHours();
        selectedMinute = parsed.date.getUTCMinutes();
        selectedSecond = parsed.date.getUTCSeconds();
        currentFuzzy = config.value;
    }

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

    // --- Helpers ---

    /** Build a Date from the current selection state */
    function buildDate(): Date {
        return new Date(
            Date.UTC(selectedYear, selectedMonth, selectedDay, selectedHour, selectedMinute, selectedSecond),
        );
    }

    /** Build the current FuzzyDateTime from state */
    function buildFuzzy(): FuzzyDateTime {
        return createFuzzyDateTime(buildDate(), resolution, approximation);
    }

    /** Create a themed <select> element */
    function createSelect(
        className: string,
        optionItems: { value: string; label: string }[],
        currentValue: string,
        onChange: (value: string) => void,
    ): HTMLSelectElement {
        const select = el('select', {
            className: `ottadate-compact-select ${className}`,
        }) as HTMLSelectElement;

        if (config.disabled) select.disabled = true;

        for (const opt of optionItems) {
            const option = el('option', { value: opt.value }) as HTMLOptionElement;
            option.textContent = opt.label;
            if (opt.value === currentValue) option.selected = true;
            select.appendChild(option);
        }

        select.addEventListener('change', () => onChange(select.value));
        return select;
    }

    // --- Rendering ---

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

    /** Row 1: Two side-by-side selects — approximation + resolution */
    function renderModeSelects(): HTMLElement {
        const row = div('ottadate-compact-row');

        // Approximation select (Exact / Around / Sometime in)
        const approxItems = (config.approximations ?? ['exact', 'around', 'sometime']).map((a) => ({
            value: a,
            label: APPROXIMATION_LABELS[a],
        }));
        const approxSelect = createSelect('ottadate-compact-approx', approxItems, approximation, (val) => {
            approximation = val as DateApproximation;
            autoApplyAndRender();
        });
        row.appendChild(approxSelect);

        // Resolution select (Year / Month / Day / Hour / Minute / Second)
        const resItems = (config.resolutions ?? [...RESOLUTION_ORDER]).map((r) => ({
            value: r,
            label: RESOLUTION_LABELS[r],
        }));
        const resSelect = createSelect('ottadate-compact-res', resItems, resolution, (val) => {
            resolution = val as DateResolution;
            autoApplyAndRender();
        });
        row.appendChild(resSelect);

        return row;
    }

    /** Row 2: Description text under the combo */
    function renderDescription(): HTMLElement {
        const fuzzy = buildFuzzy();
        return span('ottadate-compact-desc', fuzzy.label);
    }

    /** Row 3: Date selectors row (year / month / day — based on resolution) */
    function renderDateRow(): HTMLElement {
        const row = div('ottadate-compact-row');

        // Year select — always shown
        const years = getYearRange(selectedYear, 5);
        const yearSelect = createSelect(
            'ottadate-compact-year',
            years.map((y) => ({ value: String(y), label: String(y) })),
            String(selectedYear),
            (val) => {
                selectedYear = parseInt(val, 10);
                autoApplyAndRender();
            },
        );
        row.appendChild(yearSelect);

        // Month select — if resolution >= month
        if (isResolutionFinerOrEqual(resolution, 'month')) {
            const localeStr = getIntlLocale(config.locale);
            const months = getMonthNames(localeStr);
            const monthSelect = createSelect(
                'ottadate-compact-month',
                months.map((name, idx) => ({ value: String(idx), label: name })),
                String(selectedMonth),
                (val) => {
                    selectedMonth = parseInt(val, 10);
                    autoApplyAndRender();
                },
            );
            row.appendChild(monthSelect);
        }

        // Day select — if resolution >= day
        if (isResolutionFinerOrEqual(resolution, 'day')) {
            const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
            // Clamp selected day
            if (selectedDay > daysInMonth) selectedDay = daysInMonth;
            const dayItems: { value: string; label: string }[] = [];
            for (let d = 1; d <= daysInMonth; d++) {
                dayItems.push({ value: String(d), label: String(d) });
            }
            const daySelect = createSelect('ottadate-compact-day', dayItems, String(selectedDay), (val) => {
                selectedDay = parseInt(val, 10);
                autoApplyAndRender();
            });
            row.appendChild(daySelect);
        }

        return row;
    }

    /** Row 4: Time inputs — if resolution >= hour */
    function renderTimeRow(): HTMLElement | null {
        if (!isResolutionFinerOrEqual(resolution, 'hour')) return null;

        const row = div('ottadate-compact-row');

        // Hour
        const hourInput = el('input', {
            className: 'ottadate-time-input',
            type: 'number',
        }) as HTMLInputElement;
        hourInput.min = '0';
        hourInput.max = '23';
        hourInput.value = pad2(selectedHour);
        if (config.disabled) hourInput.disabled = true;
        hourInput.addEventListener('change', () => {
            selectedHour = Math.max(0, Math.min(23, parseInt(hourInput.value, 10) || 0));
            hourInput.value = pad2(selectedHour);
            autoApplyAndRender();
        });
        row.appendChild(hourInput);

        // Minute
        if (isResolutionFinerOrEqual(resolution, 'minute')) {
            row.appendChild(span('ottadate-time-separator', ':'));

            const minInput = el('input', {
                className: 'ottadate-time-input',
                type: 'number',
            }) as HTMLInputElement;
            minInput.min = '0';
            minInput.max = '59';
            minInput.value = pad2(selectedMinute);
            if (config.disabled) minInput.disabled = true;
            minInput.addEventListener('change', () => {
                selectedMinute = Math.max(0, Math.min(59, parseInt(minInput.value, 10) || 0));
                minInput.value = pad2(selectedMinute);
                autoApplyAndRender();
            });
            row.appendChild(minInput);
        }

        // Second
        if (isResolutionFinerOrEqual(resolution, 'second')) {
            row.appendChild(span('ottadate-time-separator', ':'));

            const secInput = el('input', {
                className: 'ottadate-time-input',
                type: 'number',
            }) as HTMLInputElement;
            secInput.min = '0';
            secInput.max = '59';
            secInput.value = pad2(selectedSecond);
            if (config.disabled) secInput.disabled = true;
            secInput.addEventListener('change', () => {
                selectedSecond = Math.max(0, Math.min(59, parseInt(secInput.value, 10) || 0));
                secInput.value = pad2(selectedSecond);
                autoApplyAndRender();
            });
            row.appendChild(secInput);
        }

        return row;
    }

    /** Row 5: Side-by-side Resolution info + metadata preview */
    function renderInfoRow(): HTMLElement {
        const row = div('ottadate-compact-info');

        const resInfo = span('ottadate-compact-info-label', '');
        resInfo.innerHTML =
            `<strong>Resolution:</strong> ${RESOLUTION_LABELS[resolution]} &middot; ` +
            `<strong>Stored Meta:</strong> ${APPROXIMATION_LABELS[approximation]}`;

        row.appendChild(resInfo);
        return row;
    }

    function renderFooter(): HTMLElement {
        const footer = div('ottadate-footer');

        const nowBtn = btn('ottadate-footer-btn ottadate-footer-btn--primary', 'Now', () => {
            if (config.disabled) return;
            const now = new Date();
            selectedYear = now.getFullYear();
            selectedMonth = now.getMonth();
            selectedDay = now.getDate();
            selectedHour = now.getHours();
            selectedMinute = now.getMinutes();
            selectedSecond = now.getSeconds();
            autoApplyAndRender();
        });

        const clearBtn = btn('ottadate-footer-btn', 'Clear', () => {
            if (config.disabled) return;
            currentFuzzy = null;
            updateTriggerText();
            emitChange();
            render();
        });

        footer.append(nowBtn, clearBtn);
        return footer;
    }

    function render() {
        clearChildren(popover);

        const wrapper = div('ottadate-compact-wrapper');

        // 1. Approximation + Resolution selects (two dropdowns side-by-side)
        wrapper.appendChild(renderModeSelects());

        // 2. Description text
        wrapper.appendChild(renderDescription());

        // 3. Date selectors row
        wrapper.appendChild(renderDateRow());

        // 4. Time row (if resolution >= hour)
        const timeRow = renderTimeRow();
        if (timeRow) wrapper.appendChild(timeRow);

        // 5. Info row (resolution + stored metadata)
        wrapper.appendChild(renderInfoRow());

        popover.appendChild(wrapper);
        popover.appendChild(renderFooter());
    }

    /** Auto-apply on every change (compact mode = immediate feedback) */
    function autoApplyAndRender() {
        currentFuzzy = buildFuzzy();
        updateTriggerText();
        emitChange();
        render();
    }

    // --- Actions ---

    function emitChange() {
        if (config.onChange) {
            config.onChange(currentFuzzy);
        }
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
        currentFuzzy = null;
        updateTriggerText();
        emitChange();
        if (isOpen) render();
    });

    // --- Initial render ---

    updateTriggerText();
    if (config.inline) render();

    // --- Public API ---

    return {
        open: openPicker,
        close: closePicker,
        toggle() {
            if (isOpen) closePicker();
            else openPicker();
        },
        setValue(value: FuzzyDateTime | null) {
            if (value) {
                const parsed = parseFuzzyDateTime(value);
                resolution = parsed.resolution;
                approximation = parsed.approximation;
                selectedYear = parsed.date.getUTCFullYear();
                selectedMonth = parsed.date.getUTCMonth();
                selectedDay = parsed.date.getUTCDate();
                selectedHour = parsed.date.getUTCHours();
                selectedMinute = parsed.date.getUTCMinutes();
                selectedSecond = parsed.date.getUTCSeconds();
                currentFuzzy = value;
            } else {
                currentFuzzy = null;
            }
            updateTriggerText();
            if (isOpen) render();
        },
        getValue() {
            return currentFuzzy;
        },
        setOptions(newOptions) {
            config = resolveConfig({ ...config, ...newOptions });
            if (newOptions.value !== undefined) {
                if (newOptions.value) {
                    const parsed = parseFuzzyDateTime(newOptions.value);
                    resolution = parsed.resolution;
                    approximation = parsed.approximation;
                    selectedYear = parsed.date.getUTCFullYear();
                    selectedMonth = parsed.date.getUTCMonth();
                    selectedDay = parsed.date.getUTCDate();
                    selectedHour = parsed.date.getUTCHours();
                    selectedMinute = parsed.date.getUTCMinutes();
                    selectedSecond = parsed.date.getUTCSeconds();
                    currentFuzzy = newOptions.value;
                } else {
                    currentFuzzy = null;
                }
            }
            updateTriggerText();
            if (isOpen) render();
        },
        destroy() {
            closePicker();
            root.remove();
        },
        isOpen: () => isOpen,
        element: root,
    };
}
