/**
 * @ottabase/ottadate — DateTimePicker
 *
 * Framework-agnostic date + time picker. Calendar with time inputs below.
 * Getter/setter works with UTC unix timestamps by default.
 *
 * Usage:
 *   const picker = OttaDate.createDateTimePicker(container, {
 *       value: 1704067200,
 *       onChange: (ts) => console.log(ts),
 *       showSeconds: false,
 *       use12Hour: false,
 *   });
 */

import { toZonedTime } from 'date-fns-tz';
import type { DateTimePickerInstance, DateTimePickerOptions } from '../core/types';
import {
    buildCalendarGrid,
    formatDisplay,
    formatTime,
    fromDate,
    getIntlLocale,
    getMonthNames,
    getMonthNamesShort,
    getWeekdayLabels,
    getYearRange,
    isDateInBounds,
    isSameDay,
    isSameMonth,
    pad2,
    resolveConfig,
    resolveTimezone,
    toDate,
} from '../core/utils';
import {
    btn,
    clearChildren,
    div,
    el,
    iconCalendar,
    iconChevronLeft,
    iconChevronRight,
    iconClock,
    iconX,
    onClickOutside,
    onEscape,
    span,
} from '../dom/helpers';

type ViewMode = 'days' | 'months' | 'years';

export function createDateTimePicker(
    container: HTMLElement,
    options: DateTimePickerOptions = {},
): DateTimePickerInstance {
    let config = resolveConfig({
        placeholder: 'Select date & time…',
        showSeconds: false,
        use12Hour: false,
        minuteStep: 1,
        ...options,
    });

    const tz = resolveTimezone(config.timezone!);
    let selectedDate = toDate(config.value, tz);
    let viewDate = selectedDate ? new Date(selectedDate) : tz ? toZonedTime(new Date(), tz) : new Date();
    let viewMode: ViewMode = 'days';
    let isOpen = false;
    let removeClickOutside: (() => void) | null = null;
    let removeEscapeHandler: (() => void) | null = null;

    const minDate = config.minDate ? toDate(config.minDate as any, tz) : null;
    const maxDate = config.maxDate ? toDate(config.maxDate as any, tz) : null;

    // Initialize time from selected date or now
    const initialTimeSource = selectedDate || (tz ? toZonedTime(new Date(), tz) : new Date());
    let hours = initialTimeSource.getHours();
    let minutes = initialTimeSource.getMinutes();
    let seconds = initialTimeSource.getSeconds();

    const root = div('ottadate');
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

    // --- Rendering ---

    function getDisplayText(): string {
        const localeStr = getIntlLocale(config.locale);
        if (!selectedDate) return '';
        const dateStr = formatDisplay(selectedDate, config.displayFormat!, config.locale);
        const timeFmt = config.showSeconds ? 'HH:mm:ss' : 'HH:mm';
        const formatStr12h = config.showSeconds ? 'hh:mm:ss a' : 'hh:mm a';
        const timeStr = formatTime(selectedDate, config.use12Hour ? formatStr12h : timeFmt, config.locale);
        return `${dateStr} ${timeStr}`;
    }

    function updateTriggerText() {
        const text = getDisplayText();
        if (text) {
            triggerText.textContent = text;
            triggerText.classList.remove('ottadate-trigger-placeholder');
            triggerClear.style.display = '';
        } else {
            triggerText.textContent = config.placeholder!;
            triggerText.classList.add('ottadate-trigger-placeholder');
            triggerClear.style.display = 'none';
        }
    }

    function renderHeader() {
        const header = div('ottadate-header');

        const prevBtn = btn('ottadate-nav-btn', '', () => {
            if (viewMode === 'days') {
                viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
            } else if (viewMode === 'months') {
                viewDate = new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1);
            } else {
                viewDate = new Date(viewDate.getFullYear() - 20, viewDate.getMonth(), 1);
            }
            render();
        });
        prevBtn.innerHTML = iconChevronLeft();

        let titleText: string;
        const localeStr = getIntlLocale(config.locale);
        if (viewMode === 'days') {
            titleText = `${getMonthNames(localeStr)[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
        } else if (viewMode === 'months') {
            titleText = `${viewDate.getFullYear()}`;
        } else {
            const start = viewDate.getFullYear() - 10;
            const end = viewDate.getFullYear() + 10;
            titleText = `${start} – ${end}`;
        }

        const titleBtn = btn('ottadate-header-title', titleText, () => {
            if (viewMode === 'days') viewMode = 'months';
            else if (viewMode === 'months') viewMode = 'years';
            else viewMode = 'days';
            render();
        });

        const nextBtn = btn('ottadate-nav-btn', '', () => {
            if (viewMode === 'days') {
                viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
            } else if (viewMode === 'months') {
                viewDate = new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1);
            } else {
                viewDate = new Date(viewDate.getFullYear() + 20, viewDate.getMonth(), 1);
            }
            render();
        });
        nextBtn.innerHTML = iconChevronRight();

        header.append(prevBtn, titleBtn, nextBtn);
        return header;
    }

    function renderDayGrid() {
        const fragment = document.createDocumentFragment();

        const weekdaysRow = div('ottadate-weekdays');
        const localeStr = getIntlLocale(config.locale);
        for (const label of getWeekdayLabels(config.firstDayOfWeek, localeStr)) {
            weekdaysRow.appendChild(span('ottadate-weekday', label));
        }
        fragment.appendChild(weekdaysRow);

        const daysGrid = div('ottadate-days');
        const days = buildCalendarGrid(viewDate.getFullYear(), viewDate.getMonth(), config.firstDayOfWeek);
        const today = tz ? toZonedTime(new Date(), tz) : new Date();

        for (const day of days) {
            const dayBtn = btn('ottadate-day', day.getDate().toString(), () => {
                selectDay(day);
            });

            if (!isSameMonth(day, viewDate)) {
                dayBtn.classList.add('ottadate-day--outside');
            }
            if (isSameDay(day, today)) {
                dayBtn.classList.add('ottadate-day--today');
            }
            if (selectedDate && isSameDay(day, selectedDate)) {
                dayBtn.classList.add('ottadate-day--selected');
            }
            if (!isDateInBounds(day, minDate, maxDate)) {
                dayBtn.classList.add('ottadate-day--disabled');
            }

            daysGrid.appendChild(dayBtn);
        }
        fragment.appendChild(daysGrid);
        return fragment;
    }

    function renderMonthGrid() {
        const grid = div('ottadate-months');
        const localeStr = getIntlLocale(config.locale);
        const months = getMonthNamesShort(localeStr);
        const today = tz ? toZonedTime(new Date(), tz) : new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();

        months.forEach((name, idx) => {
            const monthBtn = btn('ottadate-month-cell', name, () => {
                viewDate = new Date(viewDate.getFullYear(), idx, 1);
                viewMode = 'days';
                render();
            });
            if (viewDate.getFullYear() === currentYear && idx === currentMonth) {
                monthBtn.classList.add('ottadate-month-cell--current');
            }
            if (
                selectedDate &&
                viewDate.getFullYear() === selectedDate.getFullYear() &&
                idx === selectedDate.getMonth()
            ) {
                monthBtn.classList.add('ottadate-month-cell--selected');
            }
            grid.appendChild(monthBtn);
        });
        return grid;
    }

    function renderYearGrid() {
        const grid = div('ottadate-years');
        const years = getYearRange(viewDate.getFullYear(), 10);
        const today = tz ? toZonedTime(new Date(), tz) : new Date();
        const currentYear = today.getFullYear();

        for (const year of years) {
            const yearBtn = btn('ottadate-year-cell', year.toString(), () => {
                viewDate = new Date(year, viewDate.getMonth(), 1);
                viewMode = 'months';
                render();
            });
            if (year === currentYear) yearBtn.classList.add('ottadate-year-cell--current');
            if (selectedDate && year === selectedDate.getFullYear())
                yearBtn.classList.add('ottadate-year-cell--selected');
            grid.appendChild(yearBtn);
        }
        return grid;
    }

    function renderTimeSelector() {
        const timeRow = div('ottadate-time');

        const label = span('ottadate-time-label', '');
        label.innerHTML = iconClock() + ' <span>Time</span>';

        const scrollContainer = div('ottadate-time-scroll');

        // Compute display hour for 12h mode
        const displayHour = config.use12Hour ? hours % 12 || 12 : hours;
        const hourMax = config.use12Hour ? 12 : 23;
        const hourMin = config.use12Hour ? 1 : 0;

        // Hour input
        const hourInput = el('input', {
            className: 'ottadate-time-input',
            type: 'number',
        }) as HTMLInputElement;
        hourInput.min = String(hourMin);
        hourInput.max = String(hourMax);
        hourInput.value = pad2(displayHour);
        hourInput.addEventListener('change', () => {
            if (config.disabled) {
                hourInput.value = pad2(config.use12Hour ? hours % 12 || 12 : hours);
                return;
            }
            let val = parseInt(hourInput.value, 10) || 0;
            if (config.use12Hour) {
                val = Math.max(1, Math.min(12, val));
                const isPM = hours >= 12;
                hours = val === 12 ? (isPM ? 12 : 0) : isPM ? val + 12 : val;
            } else {
                hours = Math.max(0, Math.min(23, val));
            }
            hourInput.value = pad2(config.use12Hour ? hours % 12 || 12 : hours);
            applyTimeToSelected();
        });

        const sep1 = span('ottadate-time-separator', ':');

        // Minute input
        const minInput = el('input', {
            className: 'ottadate-time-input',
            type: 'number',
        }) as HTMLInputElement;
        minInput.min = '0';
        minInput.max = '59';
        minInput.value = pad2(minutes);
        minInput.addEventListener('change', () => {
            if (config.disabled) {
                minInput.value = pad2(minutes);
                return;
            }
            minutes = Math.max(0, Math.min(59, parseInt(minInput.value, 10) || 0));
            minInput.value = pad2(minutes);
            applyTimeToSelected();
        });

        scrollContainer.append(hourInput, sep1, minInput);

        // Optional seconds input
        if (config.showSeconds) {
            const sep2 = span('ottadate-time-separator', ':');
            const secInput = el('input', {
                className: 'ottadate-time-input',
                type: 'number',
            }) as HTMLInputElement;
            secInput.min = '0';
            secInput.max = '59';
            secInput.value = pad2(seconds);
            secInput.addEventListener('change', () => {
                if (config.disabled) {
                    secInput.value = pad2(seconds);
                    return;
                }
                seconds = Math.max(0, Math.min(59, parseInt(secInput.value, 10) || 0));
                secInput.value = pad2(seconds);
                applyTimeToSelected();
            });
            scrollContainer.append(sep2, secInput);
        }

        // 12-hour AM/PM toggle (shown when in 12h mode)
        if (config.use12Hour) {
            const period = hours < 12 ? 'AM' : 'PM';
            const periodBtn = btn('ottadate-time-period', period, () => {
                if (config.disabled) return;
                if (hours < 12) hours += 12;
                else hours -= 12;
                applyTimeToSelected();
                render();
            });
            scrollContainer.appendChild(periodBtn);
        }

        // 12h / 24h clock toggle — always visible
        const clockToggle = div('ottadate-clock-toggle');
        const btn12 = btn('ottadate-clock-toggle-btn', '12h', () => {
            if (config.disabled) return;
            if (config.use12Hour) return;
            config = resolveConfig({ ...config, use12Hour: true });
            render();
        });
        const btn24 = btn('ottadate-clock-toggle-btn', '24h', () => {
            if (config.disabled) return;
            if (!config.use12Hour) return;
            config = resolveConfig({ ...config, use12Hour: false });
            render();
        });
        if (config.use12Hour) btn12.classList.add('ottadate-clock-toggle-btn--active');
        else btn24.classList.add('ottadate-clock-toggle-btn--active');
        clockToggle.append(btn12, btn24);

        timeRow.append(label, scrollContainer, clockToggle);

        const container = div('ottadate-time-container');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.appendChild(timeRow);

        // Time Presets Row
        const presetsRow = div('ottadate-time-presets');
        presetsRow.style.display = 'flex';
        presetsRow.style.gap = '0.5rem';
        presetsRow.style.marginTop = '0.5rem';

        const btnStartOfDay = btn('ottadate-footer-btn', '00:00', () => {
            if (config.disabled) return;
            hours = 0;
            minutes = 0;
            seconds = 0;
            applyTimeToSelected();
            render();
        });
        const btnNoon = btn('ottadate-footer-btn', '12:00', () => {
            if (config.disabled) return;
            hours = 12;
            minutes = 0;
            seconds = 0;
            applyTimeToSelected();
            render();
        });
        const btnEndOfDay = btn('ottadate-footer-btn', '23:59', () => {
            if (config.disabled) return;
            hours = 23;
            minutes = 59;
            seconds = 59;
            applyTimeToSelected();
            render();
        });
        btnStartOfDay.style.flex = '1';
        btnNoon.style.flex = '1';
        btnEndOfDay.style.flex = '1';

        presetsRow.append(btnStartOfDay, btnNoon, btnEndOfDay);
        container.appendChild(presetsRow);

        return container;
    }

    function renderFooter() {
        const footer = div('ottadate-footer');

        const nowBtn = btn('ottadate-footer-btn ottadate-footer-btn--primary', 'Now', () => {
            if (config.disabled) return;
            const now = tz ? toZonedTime(new Date(), tz) : new Date();
            selectedDate = now;
            hours = now.getHours();
            minutes = now.getMinutes();
            seconds = now.getSeconds();
            viewDate = new Date(now);
            viewMode = 'days';
            updateTriggerText();
            emitChange();
            render();
        });

        const clearBtn = btn('ottadate-footer-btn', 'Clear', () => {
            if (config.disabled) return;
            selectedDate = null;
            updateTriggerText();
            emitChange();
            render();
        });

        footer.append(nowBtn, clearBtn);
        return footer;
    }

    function render() {
        clearChildren(popover);
        popover.appendChild(renderHeader());

        if (viewMode === 'days') {
            popover.appendChild(renderDayGrid());
            popover.appendChild(renderTimeSelector());
        } else if (viewMode === 'months') {
            popover.appendChild(renderMonthGrid());
        } else {
            popover.appendChild(renderYearGrid());
        }

        popover.appendChild(renderFooter());
    }

    // --- Actions ---

    function selectDay(date: Date) {
        if (config.disabled) return;
        // Preserve current time when selecting a new day
        selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, seconds);
        updateTriggerText();
        emitChange();
        render();
    }

    function applyTimeToSelected() {
        if (!selectedDate) {
            // If no date selected yet, use today
            const today = new Date();
            selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, seconds);
        } else {
            selectedDate = new Date(
                selectedDate.getFullYear(),
                selectedDate.getMonth(),
                selectedDate.getDate(),
                hours,
                minutes,
                seconds,
            );
        }
        updateTriggerText();
        emitChange();
    }

    function emitChange() {
        if (config.onChange) {
            config.onChange(fromDate(selectedDate, config.timestampFormat!, tz));
        }
    }

    function openPicker() {
        if (isOpen || config.disabled) return;
        isOpen = true;
        popover.style.display = '';
        trigger.setAttribute('aria-expanded', 'true');
        viewMode = 'days';
        if (selectedDate) {
            viewDate = new Date(selectedDate);
            hours = selectedDate.getHours();
            minutes = selectedDate.getMinutes();
            seconds = selectedDate.getSeconds();
        }
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
        selectedDate = null;
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
        setValue(value) {
            selectedDate = toDate(value, tz);
            if (selectedDate) {
                viewDate = new Date(selectedDate);
                hours = selectedDate.getHours();
                minutes = selectedDate.getMinutes();
                seconds = selectedDate.getSeconds();
            }
            updateTriggerText();
            if (isOpen) render();
        },
        getValue() {
            return fromDate(selectedDate, config.timestampFormat!, tz);
        },
        setOptions(newOptions) {
            config = resolveConfig({ ...config, ...newOptions });
            if (newOptions.value !== undefined) {
                selectedDate = toDate(newOptions.value, tz);
                if (selectedDate) {
                    viewDate = new Date(selectedDate);
                    hours = selectedDate.getHours();
                    minutes = selectedDate.getMinutes();
                    seconds = selectedDate.getSeconds();
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
