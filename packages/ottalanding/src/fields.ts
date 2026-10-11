/**
 * Field descriptors — the single source of truth for landing content shapes.
 *
 * One descriptor drives three things: the TypeScript type of the data (`Data<F>`),
 * its runtime validation (`toZod(F)`), and the admin form that edits it.
 */

import { z } from 'zod';

type Base = { label: string; help?: string; placeholder?: string };

export type ScalarField =
    | (Base & { kind: 'text' | 'textarea'; required?: boolean })
    /** `absolute`: only a full http(s) address (e.g. a site's public URL), not a path or mailto:. */
    | (Base & { kind: 'url'; required?: boolean; absolute?: boolean })
    /**
     * An uploaded (media library) or linked image. `altKey` names a sibling text field that
     * describes it; picking from the library fills that in from the image's alt text.
     */
    | (Base & { kind: 'image'; required?: boolean; altKey?: string })
    /** `#rrggbb`, or empty for "the theme's own". */
    | (Base & { kind: 'color' })
    | (Base & { kind: 'lines' })
    | (Base & { kind: 'boolean' })
    | (Base & { kind: 'select'; options: readonly { value: string; label: string }[] });

export type ListField = Base & { kind: 'list'; itemLabel: string; max: number; fields: Record<string, ScalarField> };
/** A named set of fields stored together as one object, e.g. the site's social image. Always optional. */
export type GroupField = Base & { kind: 'group'; fields: Record<string, ScalarField> };

export type Field = ScalarField | ListField | GroupField;
export type Fields = Record<string, Field>;

type Value<F> = F extends { kind: 'list'; fields: infer S extends Fields }
    ? Data<S>[]
    : F extends { kind: 'group'; fields: infer S extends Fields }
      ? Data<S>
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
/** A full site address: http(s) scheme plus a host. */
const ABSOLUTE_OR_EMPTY = /^$|^https?:\/\/[^/\s]+/i;
/** Image sources: absolute http(s) or site-relative (uploads are served at /api/upload/file/…). */
const IMAGE_OR_EMPTY = /^$|^(https?:\/\/|\/(?![/\\]))/i;
const COLOR_OR_EMPTY = /^$|^#[0-9a-f]{6}$/i;

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
        case 'color':
            return z.string().trim().regex(COLOR_OR_EMPTY, 'Use a hex color like #2563eb').optional();
        default: {
            let s = z
                .string()
                .trim()
                .max(field.kind === 'textarea' ? 4000 : field.kind === 'text' ? 200 : 2048);
            if (field.kind === 'image') {
                s = s.regex(IMAGE_OR_EMPTY, 'Upload an image, or use an https:// or /path address');
            } else if (field.kind === 'url') {
                s = field.absolute
                    ? s.regex(ABSOLUTE_OR_EMPTY, 'Use a full address starting with https://')
                    : s.regex(HREF_OR_EMPTY, 'Use https://…, /path, #anchor, mailto: or tel:');
            }
            return field.required ? s.min(1, 'Required') : s.optional();
        }
    }
}

/** Build the Zod schema for a set of field descriptors. */
export function toZod<S extends Fields>(fields: S): z.ZodType<Data<S>> {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const [key, field] of Object.entries(fields)) {
        shape[key] =
            field.kind === 'list'
                ? z.array(toZod(field.fields)).max(field.max).optional()
                : field.kind === 'group'
                  ? toZod(field.fields).optional()
                  : scalarToZod(field);
    }
    return z.object(shape) as unknown as z.ZodType<Data<S>>;
}

/**
 * Parse stored data without letting one bad value take the rest down: every valid field is
 * kept, invalid list items are dropped, and only an invalid (or missing required) field falls
 * back to `fallback`. Use for data read back from storage after the schema may have evolved.
 */
export function parseLenient<S extends Fields>(fields: S, value: unknown, fallback: Data<S>): Data<S> {
    const input = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    const defaults = fallback as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(fields)) {
        if (field.kind === 'list' && Array.isArray(input[key])) {
            const item = toZod(field.fields);
            out[key] = (input[key] as unknown[])
                .flatMap((v) => {
                    const r = item.safeParse(v);
                    return r.success ? [r.data] : [];
                })
                .slice(0, field.max);
            continue;
        }
        if (field.kind === 'group') {
            // Field by field inside the group too: one stale value must not drop its siblings.
            if (input[key] && typeof input[key] === 'object') {
                out[key] = parseLenient(field.fields, input[key], (defaults[key] ?? {}) as Data<Fields>);
            } else if (defaults[key] !== undefined) out[key] = defaults[key];
            continue;
        }
        const r = toZod({ [key]: field } as Fields).safeParse({ [key]: input[key] });
        const kept = r.success ? (r.data as Record<string, unknown>)[key] : defaults[key];
        if (kept !== undefined) out[key] = kept;
    }
    return out as Data<S>;
}

/** Flatten a ZodError into `{ 'items.0.title': ['Required'] }` for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const issue of error.issues) (out[issue.path.join('.') || '_'] ??= []).push(issue.message);
    return out;
}
