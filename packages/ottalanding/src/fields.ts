/**
 * Field descriptors — the single source of truth for landing content shapes.
 *
 * One descriptor drives three things: the TypeScript type of the data (`Data<F>`),
 * its runtime validation (`toZod(F)`), and the admin form that edits it.
 */

import { z } from 'zod';

type Base = { label: string; help?: string; placeholder?: string };

export type ScalarField =
    | (Base & { kind: 'text' | 'textarea' | 'url'; required?: boolean })
    | (Base & { kind: 'lines' })
    | (Base & { kind: 'boolean' })
    | (Base & { kind: 'select'; options: readonly { value: string; label: string }[] });

export type ListField = Base & { kind: 'list'; itemLabel: string; max: number; fields: Record<string, ScalarField> };

export type Field = ScalarField | ListField;
export type Fields = Record<string, Field>;

type Value<F> = F extends { kind: 'list'; fields: infer S extends Fields }
    ? Data<S>[]
    : F extends { kind: 'lines' }
      ? string[]
      : F extends { kind: 'boolean' }
        ? boolean
        : F extends { kind: 'select'; options: readonly { value: infer V }[] }
          ? V
          : string;

type RequiredKeys<S> = { [K in keyof S]: S[K] extends { required: true } | { kind: 'select' } ? K : never }[keyof S];

/** The data shape a set of field descriptors describes. */
export type Data<S extends Fields> = { -readonly [K in RequiredKeys<S>]: Value<S[K]> } & {
    -readonly [K in Exclude<keyof S, RequiredKeys<S>>]?: Value<S[K]>;
};

/** Identity helper that keeps descriptor literals narrow so `Data<>` can infer from them. */
export function defineFields<const S extends Fields>(fields: S): S {
    return fields;
}

/** Hrefs may be absolute http(s), site-relative (not protocol-relative), in-page anchors, mailto: or tel:. */
const HREF_OR_EMPTY = /^$|^(https?:\/\/|\/(?![/\\])|#|mailto:|tel:)/i;

function scalarToZod(field: ScalarField): z.ZodTypeAny {
    switch (field.kind) {
        case 'lines':
            return z
                .array(z.string().trim().max(200))
                .max(40)
                .transform((lines) => lines.filter(Boolean))
                .optional();
        case 'boolean':
            return z.boolean().optional();
        case 'select':
            return z.enum(field.options.map((o) => o.value) as [string, ...string[]]);
        default: {
            let s = z
                .string()
                .trim()
                .max(field.kind === 'textarea' ? 4000 : field.kind === 'url' ? 2048 : 200);
            if (field.kind === 'url') s = s.regex(HREF_OR_EMPTY, 'Use https://…, /path, #anchor, mailto: or tel:');
            return field.required ? s.min(1, 'Required') : s.optional();
        }
    }
}

/** Build the Zod schema for a set of field descriptors. */
export function toZod<S extends Fields>(fields: S): z.ZodType<Data<S>> {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const [key, field] of Object.entries(fields)) {
        shape[key] =
            field.kind === 'list' ? z.array(toZod(field.fields)).max(field.max).optional() : scalarToZod(field);
    }
    return z.object(shape) as unknown as z.ZodType<Data<S>>;
}

/** Flatten a ZodError into `{ 'items.0.title': ['Required'] }` for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const issue of error.issues) (out[issue.path.join('.') || '_'] ??= []).push(issue.message);
    return out;
}
