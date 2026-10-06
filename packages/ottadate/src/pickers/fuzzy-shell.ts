/**
 * @ottabase/ottadate: the fuzzy pickers on the shell
 *
 * Both fuzzy variants (the zoomable grid, the native-select sentence) share a
 * selection controller, a parser for typed memories, the "~ Roughly" toggle
 * and the cascading time fields. The shell does the rest.
 */

import { formatFuzzyRange, RESOLUTION_LABELS, resolutionIndex } from '../core/fuzzy';
import { createFuzzySelection, type FuzzySelection } from '../core/fuzzy-selection';
import { parseFuzzyInput } from '../core/parse';
import type { FuzzyDateTime, FuzzyDateTimePickerInstance, FuzzyDateTimePickerOptions } from '../core/types';
import { pad2 } from '../core/utils';
import { btn, div, el, span } from '../dom/helpers';
import { createShell, type ShellConfig, type ShellParse } from './shell';

export type FuzzyConfig = ShellConfig<FuzzyDateTimePickerOptions>;

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

export function createFuzzyShell(
    container: HTMLElement,
    options: FuzzyDateTimePickerOptions,
    spec: FuzzyShellSpec,
): FuzzyDateTimePickerInstance {
    let sel: FuzzySelection;
    const build = (config: FuzzyConfig, value: FuzzyDateTime | null) =>
        createFuzzySelection({
            resolutions: config.resolutions,
            parts: config.parts,
            hemisphere: config.hemisphere,
            formatLabel: config.formatLabel,
            value,
        });

    /** Typed memory: too vague for this field is a reason, unreadable is null */
    function parseEntry(raw: string, config: FuzzyConfig): ShellParse<FuzzyDateTime> {
        const parsed = parseFuzzyInput(raw, { hemisphere: config.hemisphere, formatLabel: config.formatLabel });
        if (!parsed) return null;
        if (resolutionIndex(parsed.resolution) < resolutionIndex(sel.base)) {
            return {
                error: 'Too vague for this field',
                hint: `Needs at least a ${RESOLUTION_LABELS[sel.base].toLowerCase()}`,
            };
        }
        return { value: parsed, label: parsed.label };
    }

    return createShell<FuzzyDateTime, FuzzyDateTimePickerOptions>(
        container,
        { placeholder: 'Select approximate date…', ...options },
        {
            className: spec.className,
            dialogLabel: 'Choose an approximate date',
            clearLabel: 'Clear date',
            entry: {
                placeholder: 'Type it: summer 98, early 90s…',
                label: 'Type an approximate date',
                hint: 'Try: early 90s, summer 98, may 21 2010',
                parse: (raw, ctx) => parseEntry(raw, ctx.config),
            },
            empty: { label: 'Pick what you remember', sub: 'As roughly as you like', muted: true },
            label: (value) => value.label,
            describe: (value) => ({ label: value.label, sub: describeFuzzy(value) }),
            today() {
                sel.setToday();
                return sel.build();
            },
            input: (value) => (value as FuzzyDateTime | null | undefined) ?? null,
            output: (value) => value,
            extra(ctx) {
                const element = btn('ottadate-fz-approx', '~ Roughly', () => {
                    if (ctx.config.disabled) return;
                    sel.toggleApproximate();
                    ctx.commit(sel.build());
                });
                element.title = 'Not sure of the edges: widens the stored range';
                element.dataset.key = 'approx';
                return {
                    element,
                    update() {
                        if (ctx.config.allowApproximate === false) element.hidden = true;
                        element.setAttribute('aria-pressed', String(sel.state.approximate));
                        element.disabled = !!ctx.config.disabled;
                    },
                };
            },
            onOptions(changed, ctx) {
                // Constraint changes need a fresh selection controller
                if (
                    changed.resolutions !== undefined ||
                    changed.parts !== undefined ||
                    changed.hemisphere !== undefined ||
                    changed.formatLabel !== undefined
                ) {
                    sel = build(ctx.config, ctx.value);
                }
            },
            body(ctx) {
                sel = build(ctx.config, null);
                const fuzzyCtx: FuzzyBodyContext = {
                    get sel() {
                        return sel;
                    },
                    get config() {
                        return ctx.config;
                    },
                    commit: () => ctx.commit(sel.build()),
                    render: ctx.render,
                };
                const inner = spec.body(fuzzyCtx);
                return {
                    render: () => inner.render(),
                    reset() {
                        // The shell's value is the truth; the selection follows it
                        if (ctx.value) sel.load(ctx.value);
                        else sel.clear();
                        inner.reset();
                    },
                };
            },
        },
    ) as FuzzyDateTimePickerInstance;
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
            placeholder: '--',
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
