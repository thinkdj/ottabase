// Renders an editing form from @ottabase/ottalanding field descriptors — the same
// descriptors that type and validate the content, so form, types and validation can't drift.

import type { Fields, ListField, ScalarField } from '@ottabase/ottalanding';
import { Button, Input, Label, NativeSelect, NativeSelectOption, Switch, Textarea } from '@ottabase/ui';
import type { FileSource } from '@ottabase/utils/media';
import { ArrowDown, ArrowUp, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { createContext, useContext, useId, useState } from 'react';
import { ImageField } from './ImageField';

type Value = Record<string, unknown>;

/** The class a full-width control spans the form with: none in a one-column form (a span there would add a column). */
const FullWidth = createContext('sm:col-span-2');
export type FieldErrors = Record<string, string[] | undefined>;

type FieldsFormProps = {
    fields: Fields;
    value: Value;
    onChange: (next: Value) => void;
    /** Server/Zod errors keyed by dotted path, e.g. `sections.2.data.items.0.title`. */
    errors?: FieldErrors;
    /** Prefix of this form's keys within `errors`. */
    path?: string;
    /** Render only these keys, in this order (for splitting one record across panels). */
    only?: string[];
    omit?: string[];
    /** Per-key placeholders that override the descriptor's, e.g. the value an empty field falls back to. */
    placeholders?: Record<string, string | undefined>;
    /** One column for narrow areas; two (the default) lets short fields pair up. */
    columns?: 1 | 2;
};

export function FieldsForm({
    fields,
    value,
    onChange,
    errors = {},
    path = '',
    only,
    omit = [],
    placeholders = {},
    columns = 2,
}: FieldsFormProps) {
    const id = useId();
    const set = (key: string, next: unknown) => onChange({ ...value, [key]: next });
    const keys = (only ?? Object.keys(fields)).filter((key) => fields[key] && !omit.includes(key));
    const full = columns === 2 ? 'sm:col-span-2' : '';
    return (
        <FullWidth.Provider value={full}>
            <div className={`grid gap-x-4 gap-y-5 ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
                {keys.map((key) => {
                    const field = fields[key];
                    if (field.kind === 'list') {
                        return (
                            <ListEditor
                                key={key}
                                field={field}
                                items={(value[key] as Value[] | undefined) ?? []}
                                onChange={(items) => set(key, items)}
                                errors={errors}
                                path={`${path}${key}`}
                            />
                        );
                    }
                    if (field.kind === 'group') {
                        return (
                            <fieldset key={key} className={`space-y-3 ${full}`}>
                                <legend className="mb-1.5 text-sm font-medium">{field.label}</legend>
                                <FieldsForm
                                    fields={field.fields}
                                    value={(value[key] as Value | undefined) ?? {}}
                                    onChange={(next) => set(key, next)}
                                    errors={errors}
                                    path={`${path}${key}.`}
                                />
                            </fieldset>
                        );
                    }
                    return (
                        <ScalarInput
                            key={key}
                            id={`${id}-${key}`}
                            field={placeholders[key] ? { ...field, placeholder: placeholders[key] } : field}
                            value={value[key]}
                            onChange={(next, alt) => {
                                // A picked image brings its library description; use it if none was written yet.
                                const altKey = field.kind === 'image' ? field.altKey : undefined;
                                onChange({
                                    ...value,
                                    [key]: next,
                                    ...(altKey && alt && !value[altKey] ? { [altKey]: alt } : {}),
                                });
                            }}
                            error={errors[`${path}${key}`]?.[0]}
                        />
                    );
                })}
            </div>
        </FullWidth.Provider>
    );
}

const HEX = /^#[0-9a-f]{6}$/i;

function ScalarInput({
    id,
    field,
    value,
    onChange,
    error,
}: {
    id: string;
    field: ScalarField;
    value: unknown;
    onChange: (next: unknown, alt?: string) => void;
    error?: string;
}) {
    const full = useContext(FullWidth);
    const wide = field.kind === 'textarea' || field.kind === 'lines';
    const describedBy = error ? `${id}-error` : field.help ? `${id}-help` : undefined;
    const required = 'required' in field && field.required ? true : undefined;
    const common = {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required,
    };

    if (field.kind === 'boolean') {
        return (
            <div className={`flex items-start gap-3 ${full}`}>
                <Switch {...common} checked={Boolean(value)} onCheckedChange={onChange} />
                <div className="space-y-0.5">
                    <Label htmlFor={id}>{field.label}</Label>
                    {field.help && (
                        <p id={`${id}-help`} className="text-xs text-muted-foreground">
                            {field.help}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    let control;
    if (field.kind === 'image') {
        control = (
            <ImageField {...common} label={field.label} value={value as FileSource | undefined} onChange={onChange} />
        );
    } else if (field.kind === 'color') {
        const hex = (value as string) ?? '';
        // An empty color means "the theme's own": show that color, not an arbitrary black.
        const shown = HEX.test(hex)
            ? hex
            : field.placeholder && HEX.test(field.placeholder)
              ? field.placeholder
              : '#888888';
        control = (
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    aria-label={`${field.label} picker`}
                    value={shown}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
                />
                <Input
                    {...common}
                    className="w-36"
                    placeholder="Theme default"
                    value={hex}
                    onChange={(e) => onChange(e.target.value)}
                />
                {hex && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
                        Reset
                    </Button>
                )}
            </div>
        );
    } else if (field.kind === 'textarea' || field.kind === 'lines') {
        control = (
            <Textarea
                {...common}
                rows={field.kind === 'lines' ? 4 : 3}
                placeholder={field.placeholder}
                value={
                    field.kind === 'lines'
                        ? ((value as string[] | undefined) ?? []).join('\n')
                        : ((value as string) ?? '')
                }
                onChange={(e) => onChange(field.kind === 'lines' ? e.target.value.split('\n') : e.target.value)}
            />
        );
    } else if (field.kind === 'select') {
        control = (
            <NativeSelect {...common} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
                {field.options.map((o) => (
                    <NativeSelectOption key={o.value} value={o.value}>
                        {o.label}
                    </NativeSelectOption>
                ))}
            </NativeSelect>
        );
    } else {
        control = (
            <Input
                {...common}
                type={field.kind === 'email' ? 'email' : undefined}
                inputMode={field.kind === 'url' ? 'url' : field.kind === 'email' ? 'email' : undefined}
                placeholder={field.placeholder}
                value={(value as string) ?? ''}
                onChange={(e) => onChange(e.target.value)}
            />
        );
    }

    return (
        <div className={`space-y-1.5 ${wide ? full : ''}`}>
            <Label htmlFor={id}>{field.label}</Label>
            {control}
            {error ? (
                <p id={`${id}-error`} className="text-sm text-destructive">
                    {error}
                </p>
            ) : (
                field.help && (
                    <p id={`${id}-help`} className="text-xs text-muted-foreground">
                        {field.help}
                    </p>
                )
            )}
        </div>
    );
}

// ── Lists ────────────────────────────────────────────────────────────────────

type ListProps = {
    field: ListField;
    items: Value[];
    onChange: (items: Value[]) => void;
    errors: FieldErrors;
    path: string;
};

/** Short, single-line fields (links: label + address) edit best as one compact row per item. */
const isRowList = (field: ListField) =>
    Object.values(field.fields).every((f) => f.kind === 'text' || f.kind === 'url' || f.kind === 'email');

function ListEditor(props: ListProps) {
    const { field, items, onChange, errors, path } = props;
    const full = useContext(FullWidth);
    // Expanded rich items, by index (moves and removals keep it in step).
    const [open, setOpen] = useState<boolean[]>([]);
    const move = (from: number, to: number) => {
        const reorder = <T,>(list: T[]) => {
            const next = [...list];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            return next;
        };
        onChange(reorder(items));
        setOpen((o) => reorder(items.map((_, i) => Boolean(o[i]))));
    };
    const remove = (i: number) => {
        onChange(items.filter((_, j) => j !== i));
        setOpen((o) => o.filter((_, j) => j !== i));
    };
    const add = () => {
        onChange([...items, {}]);
        setOpen((o) => [...items.map((_, i) => Boolean(o[i])), true]);
    };
    const item = field.itemLabel.toLowerCase();
    const listError = errors[path]?.[0];
    const rowErrors = (i: number) =>
        Object.entries(errors)
            .filter(([k]) => k.startsWith(`${path}.${i}.`))
            .flatMap(([, v]) => v ?? []);

    const actions = (i: number) => (
        <div className="flex shrink-0 items-center">
            <IconAction label={`Move ${item} ${i + 1} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>
                <ArrowUp className="h-3.5 w-3.5" />
            </IconAction>
            <IconAction
                label={`Move ${item} ${i + 1} down`}
                disabled={i === items.length - 1}
                onClick={() => move(i, i + 1)}
            >
                <ArrowDown className="h-3.5 w-3.5" />
            </IconAction>
            <IconAction label={`Remove ${item} ${i + 1}`} destructive onClick={() => remove(i)}>
                <Trash2 className="h-3.5 w-3.5" />
            </IconAction>
        </div>
    );

    const subFields = Object.entries(field.fields);
    return (
        <fieldset className={`min-w-0 space-y-2 ${full}`}>
            <legend className="mb-1.5 text-sm font-medium">{field.label}</legend>
            {field.help && <p className="-mt-1 text-xs text-muted-foreground">{field.help}</p>}

            {items.length === 0 && <p className="text-sm text-muted-foreground">No {item}s yet.</p>}

            {isRowList(field) ? (
                // One grid template for the headings and every row, so columns line up exactly:
                // the first field (a label) narrower than the rest, then the row's actions.
                <div
                    className="space-y-2"
                    style={{ '--cols': `2fr ${'3fr '.repeat(subFields.length - 1)}6rem` } as React.CSSProperties}
                >
                    {items.length > 0 && (
                        <div className="hidden gap-2 text-xs text-muted-foreground sm:grid sm:[grid-template-columns:var(--cols)]">
                            {subFields.map(([k, f]) => (
                                <span key={k}>{f.label}</span>
                            ))}
                        </div>
                    )}
                    {items.map((value, i) => {
                        const problems = rowErrors(i);
                        return (
                            <div key={i} className="space-y-1">
                                <div className="flex flex-col gap-2 rounded-lg border border-border p-2 sm:grid sm:items-center sm:border-0 sm:p-0 sm:[grid-template-columns:var(--cols)]">
                                    {subFields.map(([k, f]) => {
                                        const error = errors[`${path}.${i}.${k}`]?.[0];
                                        return (
                                            <Input
                                                key={k}
                                                aria-label={`${field.itemLabel} ${i + 1} ${f.label.toLowerCase()}`}
                                                aria-invalid={error ? true : undefined}
                                                aria-required={'required' in f && f.required ? true : undefined}
                                                className="min-w-0"
                                                inputMode={f.kind === 'url' ? 'url' : undefined}
                                                placeholder={f.placeholder ?? f.label}
                                                value={(value[k] as string) ?? ''}
                                                onChange={(e) =>
                                                    onChange(
                                                        items.map((it, j) =>
                                                            j === i ? { ...it, [k]: e.target.value } : it,
                                                        ),
                                                    )
                                                }
                                            />
                                        );
                                    })}
                                    {actions(i)}
                                </div>
                                {problems.length > 0 && (
                                    <p className="text-sm text-destructive">{[...new Set(problems)].join(' ')}</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="divide-y divide-border rounded-lg border border-border">
                    {items.map((value, i) => {
                        const problems = rowErrors(i).length > 0;
                        const expanded = Boolean(open[i]) || problems;
                        return (
                            <div key={i}>
                                <div className="flex items-center gap-1 py-1 pl-2 pr-1">
                                    <button
                                        type="button"
                                        aria-expanded={expanded}
                                        onClick={() =>
                                            setOpen((o) => items.map((_, j) => (j === i ? !expanded : Boolean(o[j]))))
                                        }
                                        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1.5 text-left text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <ChevronRight
                                            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
                                            aria-hidden
                                        />
                                        <span className="truncate">
                                            {summary(field, value) || (
                                                <span className="text-muted-foreground">
                                                    {field.itemLabel} {i + 1}
                                                </span>
                                            )}
                                        </span>
                                        {problems && (
                                            <span className="shrink-0 text-xs text-destructive">Needs attention</span>
                                        )}
                                    </button>
                                    {actions(i)}
                                </div>
                                {expanded && (
                                    <div className="border-t border-border bg-muted/20 p-4">
                                        <FieldsForm
                                            fields={field.fields}
                                            value={value}
                                            onChange={(next) => onChange(items.map((it, j) => (j === i ? next : it)))}
                                            errors={errors}
                                            path={`${path}.${i}.`}
                                            columns={full ? 2 : 1}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {listError && <p className="text-sm text-destructive">{listError}</p>}
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 text-muted-foreground hover:text-foreground"
                disabled={items.length >= field.max}
                onClick={add}
            >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add {item}
                {items.length >= field.max && <span className="ml-1">(up to {field.max})</span>}
            </Button>
        </fieldset>
    );
}

/** A rich item's one-line summary: its first filled-in text field. */
function summary(field: ListField, value: Value): string {
    for (const [k, f] of Object.entries(field.fields)) {
        if ((f.kind === 'text' || f.kind === 'textarea') && typeof value[k] === 'string' && value[k]) {
            return value[k] as string;
        }
    }
    return '';
}

function IconAction(props: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    destructive?: boolean;
    children: React.ReactNode;
}) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            className={`h-8 w-8 text-muted-foreground ${props.destructive ? 'hover:text-destructive' : ''}`}
            disabled={props.disabled}
            onClick={props.onClick}
            aria-label={props.label}
            title={props.label}
        >
            {props.children}
        </Button>
    );
}
