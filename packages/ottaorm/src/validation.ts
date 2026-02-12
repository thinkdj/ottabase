// ============================================================
// @ottabase/ottaorm - Zod Validation Schema Builder
// ============================================================
// Builds Zod schemas from model field metadata (single source of truth)
// Used by both server-side (BaseModel.create/update) and client-side (@ottabase/forms)
// ============================================================

import { z } from 'zod';
import type { ModelFieldDescriptor, ModelFields } from './base/AbstractBaseModel';

/**
 * Validation result from model validation
 */
export interface ValidationResult {
    success: boolean;
    errors: Record<string, string>;
    data?: Record<string, unknown>;
}

/**
 * Structured validation error thrown by BaseModel.create/update
 * Contains field-level errors for API routes to return as { errors: { field: "msg" } }
 *
 * @example API route usage:
 * ```typescript
 * try {
 *   const user = await User.create(data);
 *   return json(user, 201);
 * } catch (err) {
 *   if (err instanceof ValidationError) {
 *     return json({ error: err.message, errors: err.fieldErrors }, 422);
 *   }
 *   throw err;
 * }
 * ```
 */
export class ValidationError extends Error {
    /** Field-level errors: { fieldName: "error message" } */
    readonly fieldErrors: Record<string, string>;

    constructor(fieldErrors: Record<string, string>) {
        const firstError = Object.values(fieldErrors)[0] || 'Validation failed';
        super(`Validation failed: ${firstError}`);
        this.name = 'ValidationError';
        this.fieldErrors = fieldErrors;
    }
}

/**
 * Parse pipe-separated validation rules string into a Map
 * e.g., "required|email|min:8|max:100" → Map { required: true, email: true, min: 8, max: 100 }
 */
function parseRules(rulesStr?: string): Map<string, number | boolean> {
    const map = new Map<string, number | boolean>();
    if (!rulesStr) return map;

    for (const rule of rulesStr.split('|')) {
        const [name, param] = rule.split(':');
        if (!name) continue;
        // Skip server-only rules (unique, alpha_dash, etc. - not expressible in Zod client-side)
        if (name === 'unique' || name === 'alpha_dash') continue;

        if (param === undefined) {
            // Flag-style rule (e.g., "required", "email")
            map.set(name, true);
        } else {
            const num = Number(param);
            // Only store numeric rules if the parameter is a finite number
            if (Number.isFinite(num)) {
                map.set(name, num);
            }
            // If not finite (NaN/Infinity), skip adding this rule
        }
    }
    return map;
}

/**
 * Build a Zod type for a single field based on its descriptor
 */
function buildFieldZod(field: ModelFieldDescriptor): z.ZodTypeAny {
    const rules = parseRules(field.validation?.rules);
    const msgs = field.validation?.messages || {};
    const isRequired = rules.has('required');
    const minVal = rules.get('min');
    const maxVal = rules.get('max');

    let schema: z.ZodTypeAny;

    switch (field.type) {
        case 'string':
        case 'id': {
            let s = z.string();
            if (rules.has('email')) s = s.email(msgs.email || 'Invalid email format');
            if (rules.has('url')) s = s.url(msgs.url || 'Invalid URL format');
            if (typeof minVal === 'number') s = s.min(minVal, msgs.min || `Must be at least ${minVal} characters`);
            if (typeof maxVal === 'number') s = s.max(maxVal, msgs.max || `Must be at most ${maxVal} characters`);
            if (isRequired && !minVal) s = s.min(1, msgs.required || 'This field is required');
            schema = isRequired
                ? s
                : z
                      .union([s, z.literal('')])
                      .optional()
                      .nullable();
            break;
        }
        case 'number':
        case 'integer':
        case 'float': {
            let n = z.number({ message: msgs.required || 'Must be a number' });
            if (field.type === 'integer') n = n.int('Must be a whole number');
            if (typeof minVal === 'number') n = n.min(minVal, msgs.min || `Must be at least ${minVal}`);
            if (typeof maxVal === 'number') n = n.max(maxVal, msgs.max || `Must be at most ${maxVal}`);
            // Allow coercion from string inputs
            const coerced = z.preprocess(
                (val) => {
                    if (val === '' || val === null || val === undefined) return undefined;
                    const num = Number(val);
                    return isNaN(num) ? val : num;
                },
                isRequired ? n : n.optional().nullable(),
            );
            schema = coerced;
            break;
        }
        case 'boolean': {
            schema = z.preprocess((val) => {
                if (typeof val === 'string') return val === 'true' || val === '1';
                return Boolean(val);
            }, z.boolean());
            if (!isRequired) schema = schema.optional();
            break;
        }
        case 'date':
        case 'datetime': {
            // Accept Date objects, timestamps, or date strings
            const dateSchema = z.preprocess(
                (val) => {
                    if (val === '' || val === null || val === undefined) return undefined;
                    if (val instanceof Date) return val;
                    const d = new Date(val as string | number);
                    return isNaN(d.getTime()) ? val : d;
                },
                isRequired
                    ? z.date({ message: msgs.required || 'Valid date is required' })
                    : z.date().optional().nullable(),
            );
            schema = dateSchema;
            break;
        }
        case 'json': {
            schema = isRequired
                ? z.any().refine((v) => v !== undefined && v !== null, msgs.required || 'Required')
                : z.any().optional().nullable();
            break;
        }
        case 'array': {
            schema = isRequired
                ? z.array(z.any()).min(1, msgs.required || 'At least one item is required')
                : z.array(z.any()).optional().nullable();
            break;
        }
        default: {
            schema = isRequired
                ? z.any().refine((v) => v !== undefined && v !== null && v !== '', msgs.required || 'Required')
                : z.any().optional().nullable();
        }
    }

    return schema;
}

/**
 * Build a Zod schema from model field metadata
 *
 * @param fields - Model fields metadata
 * @param mode - 'create' or 'update' (update makes all fields optional)
 * @param writable - Optional writable field allowlists
 * @returns Zod object schema for validation
 *
 * @example
 * ```typescript
 * import { buildZodSchema } from '@ottabase/ottaorm';
 * import { User } from '@ottabase/ottaorm/models';
 *
 * const createSchema = buildZodSchema(User.getFields(), 'create');
 * const result = createSchema.safeParse({ name: '', email: 'bad' });
 * // result.success === false
 * // result.error.flatten().fieldErrors === { name: ['Required'], email: ['Invalid email'] }
 * ```
 */
export function buildZodSchema(
    fields: ModelFields,
    mode: 'create' | 'update' = 'create',
    writable?: { create?: string[]; update?: string[] },
): z.ZodObject<any> {
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const [key, field] of Object.entries(fields)) {
        // Skip primary keys for create mode
        if (mode === 'create' && field.primaryKey) continue;
        // Skip non-editable fields (they won't be in form data)
        if (field.editable === false) continue;
        // Skip hidden form fields
        if (field.formConfig?.visible === false) continue;

        // Respect writable allowlist if defined
        if (writable) {
            const allowList = mode === 'create' ? writable.create : writable.update;
            if (allowList && !allowList.includes(key)) continue;
        }

        shape[key] = buildFieldZod(field);
    }

    if (mode === 'update') {
        // All fields optional for partial updates
        return z.object(shape).partial().passthrough();
    }

    // passthrough: preserve keys not in schema (e.g. editable:false fields like action/resourceType for AuditLog)
    return z.object(shape).passthrough();
}

/**
 * Validate data against a Zod schema, returning a flat error map
 */
export function validateWithSchema(schema: z.ZodObject<any>, data: Record<string, unknown>): ValidationResult {
    const result = schema.safeParse(data);

    if (result.success) {
        return { success: true, errors: {}, data: result.data };
    }

    const fieldErrors = result.error.flatten().fieldErrors;
    const errors: Record<string, string> = {};
    for (const [key, messages] of Object.entries(fieldErrors)) {
        if (messages && messages.length > 0) {
            errors[key] = messages[0];
        }
    }

    return { success: false, errors };
}

/**
 * Validate a single field value against its descriptor
 * Used for real-time per-field validation in forms
 */
export function validateField(field: ModelFieldDescriptor, value: unknown): string | null {
    const fieldSchema = buildFieldZod(field);
    const result = fieldSchema.safeParse(value);
    if (result.success) return null;

    const issues = result.error.issues;
    return issues.length > 0 ? issues[0].message : 'Invalid value';
}
