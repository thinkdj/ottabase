/**
 * @ottabase/ottadate: the picker shell
 *
 * Everything every picker shares, so each one only supplies its body and a
 * few words:
 *
 *   [ Jan 5, 2026             × ]   ← field (popover mode): open button and clear button, siblings
 *   ┌───────────────────────────┐
 *   │ Type it: 5 jan, tomorrow… │   ← type-to-parse entry (quickEntry)
 *   │ <body>                    │   ← the calendar, the zoom grid, the selects
 *   │ Monday, January 5, 2026   │   ← result line: what is stored, live, plus an optional control
 *   │ In 3 days                 │
 *   │ Today  Clear         Done │   ← footer
 *   └───────────────────────────┘
 *
 * Body interactions store through `commit()`. Typed input is previewed live and
 * stored on Enter or blur; strict parsing means a bad entry is flagged, never
 * guessed. A body may show a pick in progress (a range with only its first
 * day) on the result line as a draft, without storing it.
 */

import type { OttaDateConfig, PickerInstance } from '../core/types';
import { resolveConfig } from '../core/utils';
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

export type ShellConfig<O extends OttaDateConfig> = ReturnType<typeof resolveConfig<O>>;

/** What the result line says */
export interface ShellResult {
    label: string;
    sub: string;
    muted?: boolean;
}

/** A typed entry: a value with its label, a reason it cannot be used, or null when unreadable */
export type ShellParse<V> = { value: V; label: string } | { error: string; hint: string } | null;

export interface ShellBody {
    /** Build the body DOM for the current state (called on every render) */
    render(): HTMLElement;
    /** The value changed outside the body (Today, Clear, typed entry, setValue): re-anchor view state */
    reset(): void;
}

export interface ShellContext<V, O extends OttaDateConfig> {
    readonly value: V | null;
    readonly config: ShellConfig<O>;
    /** Store a value: field, onChange, result line, re-render. `close` also shuts the popover. */
    commit(value: V | null, close?: boolean): void;
    /** Show a pick in progress on the result line without storing it; null clears it */
    draft(result: ShellResult | null): void;
    /** Re-render without touching the value (navigation) */
    render(): void;
    close(): void;
}

export interface ShellSpec<V, O extends OttaDateConfig> {
    /** Variant classes on the root, e.g. 'ottadate--date' */
    className: string;
    dialogLabel: string;
    clearLabel: string;
    /** A Done button in popover mode. Off for pickers that close on the pick. Default: true */
    done?: boolean;
    /** The type-to-parse entry; omitted, or `quickEntry: false`, hides it */
    entry?: {
        placeholder: string;
        label: string;
        hint: string;
        parse(raw: string, ctx: ShellContext<V, O>): ShellParse<V>;
    };
    /** Result line with no value */
    empty: ShellResult;
    /** Field text for a value */
    label(value: V, ctx: ShellContext<V, O>): string;
    /** Result line for a value */
    describe(value: V, ctx: ShellContext<V, O>): ShellResult;
    /** The value the Today button stores */
    today(ctx: ShellContext<V, O>): V | null;
    /** A caller's value (options.value, setValue) as the internal value */
    input(value: unknown, ctx: ShellContext<V, O>): V | null;
    /** The internal value as the caller sees it (getValue, onChange) */
    output(value: V | null, ctx: ShellContext<V, O>): unknown;
    /** A control on the result line (the fuzzy "~ Roughly"); `update` syncs it on every render */
    extra?(ctx: ShellContext<V, O>): { element: HTMLElement; update(): void };
    /** Options changed through setOptions, before the value is re-applied */
    onOptions?(changed: Partial<O>, ctx: ShellContext<V, O>): void;
    body(ctx: ShellContext<V, O>): ShellBody;
}

const ENTRY_INVALID = 'ottadate-entry--invalid';

export function createShell<V, O extends OttaDateConfig>(
    container: HTMLElement,
    options: O,
    spec: ShellSpec<V, O>,
): PickerInstance {
    let config = resolveConfig(options);
    let current: V | null = null;
    let draftResult: ShellResult | null = null;
    let isOpen = !!config.inline;
    let detach: (() => void)[] = [];
    let positioner: FixedPopoverPositioner | null = null;

    const ctx: ShellContext<V, O> = {
        get value() {
            return current;
        },
        get config() {
            return config;
        },
        commit: (value, close) => apply(value, { emit: true, close }),
        draft(result) {
            draftResult = result;
            renderResult();
        },
        render,
        close: () => closePicker(true),
    };
    const body = spec.body(ctx);
    const extra = spec.extra?.(ctx);
    current = spec.input((config as { value?: unknown }).value, ctx);

    // --- DOM ---

    const root = div(`ottadate ${spec.className}`);
    if (config.inline) root.classList.add('ottadate--inline');
    container.appendChild(root);

    // Field: the open button and the clear button are siblings, never nested
    const field = div('ottadate-trigger');
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
        'aria-label': spec.clearLabel,
    }) as HTMLButtonElement;
    triggerClear.innerHTML = iconX();
    field.append(trigger, triggerClear);
    if (!config.inline) root.appendChild(field);

    const popover = div('ottadate-popover ottadate-panel');
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', spec.dialogLabel);
    if (!config.inline) popover.style.display = 'none';

    const entry = el('input', {
        className: 'ottadate-entry',
        type: 'text',
        placeholder: spec.entry?.placeholder ?? '',
        'aria-label': spec.entry?.label ?? '',
        autocomplete: 'off',
        spellcheck: 'false',
    }) as HTMLInputElement;

    const bodyHost = div('ottadate-body');

    // Result line: persistent nodes, so typing or a pending click never loses them
    const result = div('ottadate-result');
    const resultText = div('ottadate-result-text');
    resultText.setAttribute('aria-live', 'polite');
    const resultLabel = div('ottadate-result-label');
    const resultSub = div('ottadate-result-sub');
    resultText.append(resultLabel, resultSub);
    result.appendChild(resultText);
    if (extra) result.appendChild(extra.element);

    const footer = div('ottadate-footer');
    const footerGroup = div('ottadate-footer-group');
    const todayBtn = btn('ottadate-footer-btn', 'Today', () => {
        if (config.disabled) return;
        apply(spec.today(ctx), { emit: true, reset: true, close: spec.done === false });
    });
    const clearBtn = btn('ottadate-footer-btn', 'Clear', () => {
        if (config.disabled) return;
        apply(null, { emit: true, reset: true });
    });
    footerGroup.append(todayBtn, clearBtn);
    footer.appendChild(footerGroup);
    if (!config.inline && spec.done !== false) {
        footer.appendChild(btn('ottadate-footer-btn ottadate-footer-btn--primary', 'Done', () => closePicker(true)));
    }

    popover.append(entry, bodyHost, result, footer);
    root.appendChild(popover);

    // --- Value plumbing ---

    function apply(value: V | null, opts: { emit?: boolean; reset?: boolean; close?: boolean }) {
        current = value;
        draftResult = null;
        entry.value = '';
        setEntryInvalid(false);
        if (opts.reset) body.reset();
        syncTrigger();
        if (opts.emit) (config as { onChange?: (value: unknown) => void }).onChange?.(spec.output(current, ctx));
        render();
        if (opts.close) closePicker(true);
    }

    function syncTrigger() {
        const has = current !== null;
        triggerText.textContent = has ? spec.label(current!, ctx) : config.placeholder;
        triggerText.classList.toggle('ottadate-trigger-placeholder', !has);
        triggerClear.style.display = has && !config.disabled ? '' : 'none';
        trigger.disabled = !!config.disabled;
        field.setAttribute('aria-disabled', String(!!config.disabled));
        root.classList.toggle('ottadate--disabled', !!config.disabled);
        // inert: no focus or activation inside a disabled panel (keyboard included)
        popover.toggleAttribute('inert', !!config.disabled);
    }

    // --- Type-to-parse entry ---

    function setEntryInvalid(invalid: boolean) {
        entry.classList.toggle(ENTRY_INVALID, invalid);
        if (invalid) entry.setAttribute('aria-invalid', 'true');
        else entry.removeAttribute('aria-invalid');
    }

    /** Store the typed text. Returns true when it was readable. */
    function applyEntry(): boolean {
        const raw = entry.value.trim();
        if (!raw || !spec.entry) return false;
        const parsed = spec.entry.parse(raw, ctx);
        if (!parsed || 'error' in parsed) {
            setEntryInvalid(true);
            return false;
        }
        apply(parsed.value, { emit: true, reset: true });
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
        let line: ShellResult;
        if (typed && spec.entry) {
            const parsed = spec.entry.parse(typed, ctx);
            line = !parsed
                ? { label: "Can't read that yet", sub: spec.entry.hint, muted: true }
                : 'error' in parsed
                  ? { label: parsed.error, sub: parsed.hint, muted: true }
                  : { label: parsed.label, sub: 'Press Enter to use it' };
        } else if (draftResult) {
            line = draftResult;
        } else {
            line = current !== null ? spec.describe(current, ctx) : spec.empty;
        }
        resultLabel.textContent = line.label;
        resultSub.textContent = line.sub;
        resultLabel.classList.toggle('ottadate-result-label--muted', !!line.muted);
        result.classList.toggle('ottadate-result--preview', !!typed);
        if (extra) {
            extra.element.hidden = !!typed || !!draftResult || current === null;
            extra.update();
        }
    }

    function render() {
        if (!isOpen) return;
        const active = document.activeElement as HTMLElement | null;
        const focusKey = active && bodyHost.contains(active) ? active.dataset.key : undefined;

        clearChildren(bodyHost);
        bodyHost.appendChild(body.render());
        entry.hidden = !spec.entry || config.quickEntry === false;
        entry.disabled = !!config.disabled;
        todayBtn.disabled = clearBtn.disabled = !!config.disabled;
        renderResult();

        // Keep keyboard focus where it was (same key), else on the body's roving cell
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
        // Desktop: type straight away. Touch: no autofocus, so the keyboard doesn't cover the body.
        if (!entry.hidden && window.matchMedia?.('(pointer: fine)').matches) entry.focus();
    }

    function closePicker(returnFocus: boolean) {
        if (!isOpen || config.inline) return;
        const hadFocus = popover.contains(document.activeElement);
        isOpen = false;
        draftResult = null;
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
        apply(null, { emit: true, reset: true });
        trigger.focus();
    });

    // --- Initial render ---

    body.reset();
    syncTrigger();
    render();

    return {
        open: openPicker,
        close: () => closePicker(false),
        toggle() {
            if (isOpen) closePicker(false);
            else openPicker();
        },
        setValue: (value: unknown) => apply(spec.input(value, ctx), { reset: true }),
        getValue: () => spec.output(current, ctx),
        setOptions(newOptions: Partial<O>) {
            config = resolveConfig({ ...config, ...newOptions });
            spec.onOptions?.(newOptions, ctx);
            if ((newOptions as { value?: unknown }).value !== undefined) {
                apply(spec.input((newOptions as { value?: unknown }).value, ctx), { reset: true });
            } else {
                body.reset();
                syncTrigger();
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
