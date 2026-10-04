/**
 * @ottabase/ottadate: fuzzy picker shell
 *
 * Everything both fuzzy pickers share, so each variant only supplies its body
 * (the zoomable grid or the native-select sentence):
 *
 *   [ Summer 1998            × ]   ← trigger field (popover mode)
 *   ┌───────────────────────────┐
 *   │ Type it: summer 98…       │   ← type-to-parse entry
 *   │ <variant body>            │
 *   │ Summer 1998     ~ Roughly │   ← live result: label, stored range, approximate toggle
 *   │ Jun 1 to Aug 31, 1998     │
 *   │ Today  Clear         Done │
 *   └───────────────────────────┘
 *
 * Every body interaction auto-applies through `commit()`. Typed input is
 * previewed live and applied on Enter or blur; strict parsing means a bad
 * entry is flagged, never guessed.
 */

import { formatFuzzyRange, RESOLUTION_LABELS, resolutionIndex } from '../core/fuzzy';
import { createFuzzySelection, type FuzzySelection } from '../core/fuzzy-selection';
import { parseFuzzyInput } from '../core/parse';
import type { FuzzyDateTime, FuzzyDateTimePickerInstance, FuzzyDateTimePickerOptions } from '../core/types';
import { pad2, resolveConfig } from '../core/utils';
import {
    btn,
    clearChildren,
    createFixedPopoverPositioner,
    div,
    el,
    iconCalendar,
    iconX,
    onClickOutside,
    onEscape,
    span,
    type FixedPopoverPositioner,
} from '../dom/helpers';

export type FuzzyConfig = ReturnType<typeof resolveConfig<FuzzyDateTimePickerOptions>>;

/** What a body gets from the shell */
export interface FuzzyBodyContext {
    readonly sel: FuzzySelection;
    readonly config: FuzzyConfig;
    /** Build the value from the selection, emit onChange, re-render */
    commit(): void;
    /** Re-render without touching the value (navigation) */
    render(): void;
}

export interface FuzzyBody {
    /** Build the body DOM for the current state (called on every render) */
    render(): HTMLElement;
    /** The value changed from outside the body: re-anchor any view state */
    reset(): void;
}

export interface FuzzyShellSpec {
    /** Variant class on the root, e.g. 'ottadate--fuzzy' */
    className: string;
    body: (ctx: FuzzyBodyContext) => FuzzyBody;
}

const ENTRY_INVALID = 'ottadate-fz-entry--invalid';

export function createFuzzyShell(
    container: HTMLElement,
    options: FuzzyDateTimePickerOptions,
    spec: FuzzyShellSpec,
): FuzzyDateTimePickerInstance {
    let config: FuzzyConfig = resolveConfig({ placeholder: 'Select approximate date…', ...options });

    const buildSelection = (value: FuzzyDateTime | null) =>
        createFuzzySelection({
            resolutions: config.resolutions,
            parts: config.parts,
            hemisphere: config.hemisphere,
            formatLabel: config.formatLabel,
            value,
        });

    let sel = buildSelection(config.value ?? null);
    let current: FuzzyDateTime | null = config.value ?? null;
    let isOpen = !!config.inline;
    let detach: (() => void)[] = [];
    let positioner: FixedPopoverPositioner | null = null;

    const ctx: FuzzyBodyContext = {
        get sel() {
            return sel;
        },
        get config() {
            return config;
        },
        commit,
        render,
    };
    const body = spec.body(ctx);

    // --- DOM ---

    const root = div(`ottadate ${spec.className}`);
    if (config.inline) root.classList.add('ottadate--inline');
    container.appendChild(root);

    // Trigger: a field wrapper, so the clear button is a sibling of the open button (never nested)
    const field = div('ottadate-trigger ottadate-trigger--field');
    const trigger = el('button', {
        className: 'ottadate-trigger-main',
        type: 'button',
        'aria-haspopup': 'dialog',
        'aria-expanded': 'false',
    }) as HTMLButtonElement;
    const triggerIcon = span('ottadate-trigger-icon', '');
    triggerIcon.innerHTML = iconCalendar();
    const triggerText = span('ottadate-trigger-text', '');
    trigger.append(triggerIcon, triggerText);
    const triggerClear = el('button', {
        className: 'ottadate-trigger-clear',
        type: 'button',
        'aria-label': 'Clear date',
    }) as HTMLButtonElement;
    triggerClear.innerHTML = iconX();
    field.append(trigger, triggerClear);
    if (!config.inline) root.appendChild(field);

    const popover = div('ottadate-popover ottadate-fz');
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'Choose an approximate date');
    if (!config.inline) popover.style.display = 'none';

    const entry = el('input', {
        className: 'ottadate-fz-entry',
        type: 'text',
        placeholder: 'Type it: summer 98, early 90s…',
        'aria-label': 'Type an approximate date',
        autocomplete: 'off',
        spellcheck: 'false',
    }) as HTMLInputElement;

    const bodyHost = div('ottadate-fz-body');

    // Result line: persistent nodes, so typing or a pending click never loses them
    const result = div('ottadate-fz-result');
    const resultText = div('ottadate-fz-result-text');
    resultText.setAttribute('aria-live', 'polite');
    const resultLabel = div('ottadate-fz-label');
    const resultSub = div('ottadate-fz-sub');
    resultText.append(resultLabel, resultSub);
    const approx = btn('ottadate-fz-approx', '~ Roughly', () => {
        if (config.disabled) return;
        sel.toggleApproximate();
        commit();
    });
    approx.title = 'Not sure of the edges: widens the stored range';
    approx.dataset.key = 'approx';
    result.append(resultText, approx);

    const footer = div('ottadate-footer');
    const footerGroup = div('ottadate-footer-group');
    const todayBtn = btn('ottadate-footer-btn', 'Today', () => {
        if (config.disabled) return;
        sel.setToday();
        body.reset();
        commit();
    });
    const clearBtn = btn('ottadate-footer-btn', 'Clear', () => {
        if (config.disabled) return;
        sel.clear();
        body.reset();
        commit();
    });
    footerGroup.append(todayBtn, clearBtn);
    footer.appendChild(footerGroup);
    if (!config.inline) {
        footer.appendChild(btn('ottadate-footer-btn ottadate-footer-btn--primary', 'Done', () => closePicker(true)));
    }

    popover.append(entry, bodyHost, result, footer);
    root.appendChild(popover);

    // --- Value plumbing ---

    function commit() {
        if (config.disabled) return;
        current = sel.build();
        entry.value = '';
        setEntryInvalid(false);
        syncTrigger();
        config.onChange?.(current);
        render();
    }

    function syncTrigger() {
        const has = !!current;
        triggerText.textContent = has ? current!.label : config.placeholder!;
        triggerText.classList.toggle('ottadate-trigger-placeholder', !has);
        triggerClear.style.display = has && !config.disabled ? '' : 'none';
        trigger.disabled = !!config.disabled;
        field.setAttribute('aria-disabled', String(!!config.disabled));
        root.classList.toggle('ottadate--disabled', !!config.disabled);
        // inert: no focus or activation inside a disabled panel (keyboard included)
        popover.toggleAttribute('inert', !!config.disabled);
    }

    function applyValue(value: FuzzyDateTime | null) {
        if (value) sel.load(value);
        else sel.clear();
        current = value;
        entry.value = '';
        setEntryInvalid(false);
        syncTrigger();
        body.reset();
        render();
    }

    // --- Type-to-parse entry ---

    /** Parsed entry, 'coarse' when it is vaguer than this field allows, null when unreadable */
    function parseEntry(raw: string): FuzzyDateTime | 'coarse' | null {
        const parsed = parseFuzzyInput(raw, { hemisphere: config.hemisphere, formatLabel: config.formatLabel });
        if (!parsed) return null;
        return resolutionIndex(parsed.resolution) < resolutionIndex(sel.base) ? 'coarse' : parsed;
    }

    function setEntryInvalid(invalid: boolean) {
        entry.classList.toggle(ENTRY_INVALID, invalid);
        if (invalid) entry.setAttribute('aria-invalid', 'true');
        else entry.removeAttribute('aria-invalid');
    }

    /** Apply the typed text. Returns true when it was applied. */
    function applyEntry(): boolean {
        const raw = entry.value.trim();
        if (!raw) return false;
        const parsed = parseEntry(raw);
        if (!parsed || parsed === 'coarse') {
            setEntryInvalid(true);
            return false;
        }
        sel.load(parsed);
        body.reset();
        commit();
        return true;
    }

    entry.addEventListener('input', () => {
        setEntryInvalid(false);
        renderResult();
    });
    entry.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (applyEntry()) closePicker(true);
        } else if (e.key === 'Escape' && entry.value) {
            // First Escape drops the typed text; the next one closes the popover
            e.stopPropagation();
            entry.value = '';
            setEntryInvalid(false);
            renderResult();
        }
    });
    entry.addEventListener('change', applyEntry);

    // --- Rendering ---

    function renderResult() {
        const typed = entry.value.trim();
        let label: string;
        let sub: string;
        let muted = false;

        if (typed) {
            const parsed = parseEntry(typed);
            if (parsed === 'coarse') {
                label = 'Too vague for this field';
                sub = `Needs at least a ${RESOLUTION_LABELS[sel.base].toLowerCase()}`;
                muted = true;
            } else if (!parsed) {
                label = "Can't read that yet";
                sub = 'Try: early 90s, summer 98, may 21 2010';
                muted = true;
            } else {
                label = parsed.label;
                sub = 'Press Enter to use it';
            }
        } else if (current) {
            label = current.label;
            sub = describeFuzzy(current);
        } else {
            label = 'Pick what you remember';
            sub = 'As roughly as you like';
            muted = true;
        }

        resultLabel.textContent = label;
        resultSub.textContent = sub;
        resultLabel.classList.toggle('ottadate-fz-label--muted', muted);
        result.classList.toggle('ottadate-fz-result--preview', !!typed);
        approx.hidden = config.allowApproximate === false || !!typed || !current;
        approx.setAttribute('aria-pressed', String(sel.state.approximate));
        approx.disabled = !!config.disabled;
    }

    function render() {
        if (!isOpen) return;
        const active = document.activeElement as HTMLElement | null;
        const focusKey = active && bodyHost.contains(active) ? active.dataset.key : undefined;

        clearChildren(bodyHost);
        bodyHost.appendChild(body.render());
        entry.hidden = config.quickEntry === false;
        entry.disabled = !!config.disabled;
        todayBtn.disabled = clearBtn.disabled = !!config.disabled;
        renderResult();

        // Keep keyboard focus where it was (same key), else on the grid's roving cell
        if (active && focusKey !== undefined && !bodyHost.contains(document.activeElement)) {
            const same = bodyHost.querySelector<HTMLElement>(`[data-key="${focusKey}"]`);
            (same ?? bodyHost.querySelector<HTMLElement>('[data-roving="true"]'))?.focus();
        }
        positioner?.update();
    }

    // --- Open / close ---

    function openPicker() {
        if (isOpen || config.disabled) return;
        isOpen = true;
        popover.style.display = '';
        trigger.setAttribute('aria-expanded', 'true');
        body.reset();
        render();
        detach = [onClickOutside(root, () => closePicker(false)), onEscape(() => closePicker(true))];
        positioner = createFixedPopoverPositioner(field, popover);
        // Desktop: type straight away. Touch: no autofocus, so the keyboard doesn't cover the grid.
        if (config.quickEntry !== false && window.matchMedia?.('(pointer: fine)').matches) entry.focus();
    }

    function closePicker(returnFocus: boolean) {
        if (!isOpen || config.inline) return;
        const hadFocus = popover.contains(document.activeElement);
        isOpen = false;
        popover.style.display = 'none';
        trigger.setAttribute('aria-expanded', 'false');
        detach.forEach((off) => off());
        detach = [];
        positioner?.dispose();
        positioner = null;
        entry.value = '';
        setEntryInvalid(false);
        if (returnFocus && hadFocus) trigger.focus();
    }

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isOpen) closePicker(false);
        else openPicker();
    });
    trigger.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' && !isOpen) {
            e.preventDefault();
            openPicker();
        }
    });
    triggerClear.addEventListener('click', (e) => {
        e.stopPropagation();
        sel.clear();
        body.reset();
        commit();
        trigger.focus();
    });

    // --- Initial render ---

    syncTrigger();
    body.reset();
    render();

    return {
        open: openPicker,
        close: () => closePicker(false),
        toggle() {
            if (isOpen) closePicker(false);
            else openPicker();
        },
        setValue: applyValue,
        getValue: () => current,
        setOptions(newOptions) {
            config = resolveConfig({ ...config, ...newOptions });
            // Constraint changes need a fresh selection controller
            if (
                newOptions.resolutions !== undefined ||
                newOptions.parts !== undefined ||
                newOptions.hemisphere !== undefined ||
                newOptions.formatLabel !== undefined
            ) {
                sel = buildSelection(current);
            }
            if (newOptions.value !== undefined) {
                applyValue(newOptions.value);
            } else {
                syncTrigger();
                body.reset();
                render();
            }
        },
        destroy() {
            closePicker(false);
            root.remove();
        },
        isOpen: () => isOpen,
        element: root,
    };
}

/** Second line of the result: the stored range when it says something the label doesn't */
export function describeFuzzy(fuzzy: FuzzyDateTime): string {
    if (!fuzzy.part && !fuzzy.approximate) {
        return `Precise to the ${RESOLUTION_LABELS[fuzzy.resolution].toLowerCase()}`;
    }
    return formatFuzzyRange(fuzzy);
}

/**
 * Cascading hh : mm : ss inputs shared by both bodies. Blank means "don't
 * remember"; a finer field unlocks once the coarser one is filled.
 * `show` false renders blanks (the value's time belongs to another day);
 * `before` runs ahead of any edit (e.g. name the viewed day first).
 */
export function timeFields(ctx: FuzzyBodyContext, show: boolean, before?: () => void): HTMLElement {
    const { sel, config } = ctx;
    const s = sel.state;
    const row = div('ottadate-fz-time');

    const input = (value: number | null, enabled: boolean, label: string, apply: (v: number | null) => void) => {
        const field = el('input', {
            className: 'ottadate-time-input',
            type: 'number',
            inputmode: 'numeric',
            placeholder: '––',
            'aria-label': label,
        }) as HTMLInputElement;
        field.dataset.key = `time:${label}`;
        field.value = show && value != null ? pad2(value) : '';
        field.disabled = !!config.disabled || !enabled;
        field.addEventListener('change', () => {
            const parsed = parseInt(field.value.trim(), 10);
            before?.();
            apply(isNaN(parsed) ? null : parsed);
            ctx.commit();
        });
        return field;
    };

    row.appendChild(input(s.hour, true, 'Hour', (v) => sel.setHour(v)));
    if (sel.levelAllowed('minute')) {
        row.append(
            span('ottadate-time-separator', ':'),
            input(s.minute, show && s.hour != null, 'Minute', (v) => sel.setMinute(v)),
        );
    }
    if (sel.levelAllowed('second')) {
        row.append(
            span('ottadate-time-separator', ':'),
            input(s.second, show && s.minute != null, 'Second', (v) => sel.setSecond(v)),
        );
    }
    return row;
}
