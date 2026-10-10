// Renders an editing form from @ottabase/ottalanding field descriptors — the same
// descriptors that type and validate the content, so form, types and validation can't drift.

import type { Fields, ListField, ScalarField } from '@ottabase/ottalanding';
import { Button, Input, Label, NativeSelect, NativeSelectOption, Switch, Textarea } from '@ottabase/ui-shadcn';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useId } from 'react';

type Value = Record<string, unknown>;
export type FieldErrors = Record<string, string[] | undefined>;

type FieldsFormProps = {
    fields: Fields;
    value: Value;
    onChange: (next: Value) => void;
    /** Server/Zod errors keyed by dotted path, e.g. `sections.2.data.items.0.title`. */
    errors?: FieldErrors;
    /** Prefix of this form's keys within `errors`. */
    path?: string;
    omit?: string[];
};

export function FieldsForm({ fields, value, onChange, errors = {}, path = '', omit = [] }: FieldsFormProps) {
    const id = useId();
    const set = (key: string, next: unknown) => onChange({ ...value, [key]: next });
    return (
        <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
            {Object.entries(fields)
                .filter(([key]) => !omit.includes(key))
                .map(([key, field]) =>
                    field.kind === 'list' ? (
                        <ListEditor
                            key={key}
                            field={field}
                            items={(value[key] as Value[] | undefined) ?? []}
                            onChange={(items) => set(key, items)}
                            errors={errors}
                            path={`${path}${key}`}
                        />
                    ) : (
                        <ScalarInput
                            key={key}
                            id={`${id}-${key}`}
                            field={field}
                            value={value[key]}
                            onChange={(next) => set(key, next)}
                            error={errors[`${path}${key}`]?.[0]}
                        />
                    ),
                )}
        </div>
    );
}

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
    onChange: (next: unknown) => void;
    error?: string;
}) {
    const wide = field.kind === 'textarea' || field.kind === 'lines';
    const describedBy = error ? `${id}-error` : field.help ? `${id}-help` : undefined;
    const common = { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy };

    if (field.kind === 'boolean') {
        return (
            <div className="flex items-center gap-3 sm:col-span-2">
                <Switch {...common} checked={Boolean(value)} onCheckedChange={onChange} />
                <Label htmlFor={id}>{field.label}</Label>
            </div>
        );
    }

    let control;
    if (field.kind === 'textarea' || field.kind === 'lines') {
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
                inputMode={field.kind === 'url' ? 'url' : undefined}
                placeholder={field.placeholder}
                value={(value as string) ?? ''}
                onChange={(e) => onChange(e.target.value)}
            />
        );
    }

    return (
        <div className={`space-y-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
            <Label htmlFor={id}>
                {field.label}
                {'required' in field && field.required && <span className="text-muted-foreground"> (required)</span>}
            </Label>
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

function ListEditor({
    field,
    items,
    onChange,
    errors,
    path,
}: {
    field: ListField;
    items: Value[];
    onChange: (items: Value[]) => void;
    errors: FieldErrors;
    path: string;
}) {
    const move = (from: number, to: number) => {
        const next = [...items];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        onChange(next);
    };
    const listError = errors[path]?.[0];

    return (
        <fieldset className="space-y-3 sm:col-span-2">
            <legend className="mb-1.5 text-sm font-medium">{field.label}</legend>
            {items.map((item, i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-muted-foreground">
                            {field.itemLabel} {i + 1}
                        </span>
                        <div className="flex gap-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={i === 0}
                                onClick={() => move(i, i - 1)}
                                aria-label={`Move ${field.itemLabel.toLowerCase()} ${i + 1} up`}
                            >
                                <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={i === items.length - 1}
                                onClick={() => move(i, i + 1)}
                                aria-label={`Move ${field.itemLabel.toLowerCase()} ${i + 1} down`}
                            >
                                <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => onChange(items.filter((_, j) => j !== i))}
                                aria-label={`Remove ${field.itemLabel.toLowerCase()} ${i + 1}`}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                    <FieldsForm
                        fields={field.fields}
                        value={item}
                        onChange={(next) => onChange(items.map((it, j) => (j === i ? next : it)))}
                        errors={errors}
                        path={`${path}.${i}.`}
                    />
                </div>
            ))}
            {listError && <p className="text-sm text-destructive">{listError}</p>}
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={items.length >= field.max}
                onClick={() => onChange([...items, {}])}
            >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add {field.itemLabel.toLowerCase()}
            </Button>
        </fieldset>
    );
}
