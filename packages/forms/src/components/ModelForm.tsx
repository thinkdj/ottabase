// ============================================================
// @ottabase/forms - ModelForm Component
// ============================================================
// Auto-generated create/edit form from model metadata
// Uses Zod schemas (from field metadata) for real-time validation
// Supports standalone use via action prop (POST/PATCH to endpoint)
// ============================================================

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { clsx } from 'clsx';
import { Loader2, Save, X, AlertCircle } from 'lucide-react';
import { validateField } from '@ottabase/ottaorm';
import { FormField } from './FormField';
import type { ModelFormProps, ModelFieldDescriptor } from '../types';

// Re-export for backwards compatibility
export type { ModelFormProps } from '../types';

interface FieldEntry {
    key: string;
    field: ModelFieldDescriptor;
    order: number;
}

/**
 * ModelForm - Auto-generated form for creating/editing model records
 *
 * Features:
 * - Auto-generated fields from model metadata
 * - Real-time Zod validation (on blur per field, on submit for all)
 * - Standalone mode: set `action` prop to POST/PATCH directly to an endpoint
 * - Works with ModelCrud or independently
 *
 * @example Standalone usage
 * ```tsx
 * <ModelForm
 *   config={userConfig}
 *   mode="create"
 *   action="/api/ottaorm/users"
 *   onSuccess={(user) => router.push(`/users/${user.id}`)}
 *   onError={(err) => toast.error(err.message)}
 * />
 * ```
 */
export function ModelForm<T extends Record<string, unknown>>({
    config,
    mode,
    initialData = {},
    onSubmit,
    onCancel,
    isLoading = false,
    className,
    apiBasePath = '/api/ottaorm',
    action,
    method,
    onSuccess,
    onError,
    serverErrors,
}: ModelFormProps<T>) {
    // Validate that at least one submit handler is provided
    if (!action && !onSubmit) {
        console.warn(
            'ModelForm: Neither `action` nor `onSubmit` prop is provided. Form submission will be a no-op. ' +
                'Please provide either `action` (for standalone mode) or `onSubmit` (for callback mode).',
        );
    }

    // Initialize form data with defaults for create, or initialData for edit
    const [formData, setFormData] = useState<Partial<T>>(() => {
        if (mode === 'edit') {
            return { ...initialData };
        }
        // Apply defaults for create mode
        const defaults: Record<string, unknown> = {};

        if (config.defaults) {
            for (const [key, value] of Object.entries(config.defaults)) {
                defaults[key] = typeof value === 'function' ? value() : value;
            }
        }

        for (const [key, field] of Object.entries(config.fields)) {
            if (field.uiConfig?.defaultValue !== undefined) {
                defaults[key] = field.uiConfig.defaultValue;
            }
        }
        return defaults as Partial<T>;
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const touchedRef = useRef<Set<string>>(new Set());

    // Merge external server errors into displayed errors
    const displayErrors = useMemo(() => {
        if (!serverErrors || Object.keys(serverErrors).length === 0) return errors;
        return { ...errors, ...serverErrors };
    }, [errors, serverErrors]);

    // Get visible form fields sorted by order
    const visibleFields = useMemo(() => {
        const fields: FieldEntry[] = [];

        for (const [key, field] of Object.entries(config.fields)) {
            // Skip if form visibility is explicitly false
            if (field.formConfig?.visible === false) continue;

            // Skip primary key in create mode
            if (mode === 'create' && field.primaryKey) continue;

            // Skip non-editable fields in edit mode (except for display)
            if (mode === 'edit' && field.editable === false && !field.primaryKey) continue;

            // For edit mode, make primary key readonly
            const adjustedField = { ...field };
            if (mode === 'edit' && field.primaryKey) {
                adjustedField.formConfig = {
                    ...adjustedField.formConfig,
                    fieldType: 'readonly',
                };
            }

            fields.push({
                key,
                field: adjustedField,
                order: field.formConfig?.order ?? 999,
            });
        }

        return fields.sort((a, b) => a.order - b.order);
    }, [config.fields, mode]);

    // Validate a single field using Zod (via ottaorm validateField)
    const validateSingleField = useCallback(
        (key: string, value: unknown): string | null => {
            const field = config.fields[key];
            if (!field) return null;
            return validateField(field, value);
        },
        [config.fields],
    );

    // Handle field blur - validate the field
    const handleBlur = useCallback(
        (key: string) => {
            touchedRef.current.add(key);
            const value = formData[key as keyof T];
            const error = validateSingleField(key, value);
            setErrors((prev) => {
                if (error) return { ...prev, [key]: error };
                const { [key]: _, ...rest } = prev;
                return rest;
            });
        },
        [formData, validateSingleField],
    );

    // Handle field value change
    const handleChange = useCallback(
        (key: string, value: unknown) => {
            setFormData((prev) => ({ ...prev, [key]: value }));
            setSubmitError(null);
            // If field was touched (blurred before), validate on change too
            if (touchedRef.current.has(key)) {
                const error = validateSingleField(key, value);
                setErrors((prev) => {
                    if (error) return { ...prev, [key]: error };
                    const { [key]: _, ...rest } = prev;
                    return rest;
                });
            }
        },
        [validateSingleField],
    );

    // Validate all fields using Zod schema from config
    const validateAll = useCallback((): boolean => {
        const schema = mode === 'create' ? config.zodCreateSchema : config.zodUpdateSchema;

        if (schema) {
            // Use the pre-built Zod schema
            const result = schema.safeParse(formData);
            if (!result.success) {
                const fieldErrors = result.error.flatten().fieldErrors;
                const newErrors: Record<string, string> = {};
                for (const [key, messages] of Object.entries(fieldErrors)) {
                    if (messages && messages.length > 0) {
                        newErrors[key] = messages[0];
                    }
                }
                setErrors(newErrors);
                // Mark all fields as touched
                for (const { key } of visibleFields) {
                    touchedRef.current.add(key);
                }
                return false;
            }
            setErrors({});
            return true;
        }

        // Fallback: validate each field individually
        const newErrors: Record<string, string> = {};
        for (const { key, field } of visibleFields) {
            if (field.editable === false) continue;
            const value = formData[key as keyof T];
            const error = validateField(field, value);
            if (error) newErrors[key] = error;
        }

        setErrors(newErrors);
        for (const { key } of visibleFields) {
            touchedRef.current.add(key);
        }
        return Object.keys(newErrors).length === 0;
    }, [mode, config.zodCreateSchema, config.zodUpdateSchema, formData, visibleFields]);

    // Build submit data (filter out readonly and non-editable fields)
    const buildSubmitData = useCallback((): Partial<T> => {
        const submitData: Record<string, unknown> = {};
        for (const { key, field } of visibleFields) {
            // Always exclude non-editable/readonly fields
            if (field.editable === false) {
                continue;
            }
            // On create, always exclude primary key fields
            if (mode === 'create' && field.primaryKey) {
                continue;
            }
            const value = formData[key as keyof T];
            if (value !== undefined) {
                submitData[key] = value;
            }
        }
        return submitData as Partial<T>;
    }, [visibleFields, formData, mode]);

    // Handle standalone action submit (POST/PATCH to endpoint)
    // Parses server-side field errors from 422 responses (e.g. { errors: { email: "already exists" } })
    const submitToAction = useCallback(
        async (data: Partial<T>) => {
            if (!action) return;

            const httpMethod = method || (mode === 'create' ? 'POST' : 'PATCH');
            const fetchFn = config.fetchFn || fetch;

            const response = await fetchFn(action, {
                method: httpMethod,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const body = await response.json().catch(() => ({ error: response.statusText }));

                // Parse server-side field errors (422 validation errors)
                // Supports: { errors: { field: "msg" } }, { errors: { field: ["msg"] } },
                // or OttaORM format: { fieldErrors: { field: ["msg"] } }
                const fieldErrors = body.errors || body.fieldErrors;
                if (fieldErrors && typeof fieldErrors === 'object' && !Array.isArray(fieldErrors)) {
                    const serverFieldErrors: Record<string, string> = {};
                    for (const [key, val] of Object.entries(fieldErrors)) {
                        serverFieldErrors[key] = Array.isArray(val) ? val[0] : String(val);
                    }
                    if (Object.keys(serverFieldErrors).length > 0) {
                        setErrors((prev) => ({ ...prev, ...serverFieldErrors }));
                        // Mark those fields as touched so they show errors
                        for (const key of Object.keys(serverFieldErrors)) {
                            touchedRef.current.add(key);
                        }
                    }
                }

                throw new Error(body.error || body.message || `Request failed: ${response.status}`);
            }

            const result = await response.json();
            return result;
        },
        [action, method, mode, config.fetchFn],
    );

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError(null);

        if (!validateAll()) return;

        setIsSubmitting(true);
        try {
            const submitData = buildSubmitData();

            if (action) {
                // Standalone mode: submit to action endpoint
                const result = await submitToAction(submitData);
                onSuccess?.(result);
            } else if (onSubmit) {
                // Callback mode: call onSubmit handler
                await onSubmit(submitData);
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setSubmitError(error.message);
            onError?.(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const displayName = config.displayName || capitalize(singularize(config.entity));
    const title = mode === 'create' ? `Create ${displayName}` : `Edit ${displayName}`;
    const loading = isLoading || isSubmitting;

    return (
        <form onSubmit={handleSubmit} className={clsx('space-y-6', className)} noValidate>
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Submit Error Banner */}
            {submitError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{submitError}</span>
                </div>
            )}

            {/* Form Fields */}
            <div className="space-y-4">
                {visibleFields.map(({ key, field }) => (
                    <FormField
                        key={key}
                        name={key}
                        label={field.uiConfig?.label || capitalize(key)}
                        value={formData[key as keyof T]}
                        onChange={(value) => handleChange(key, value)}
                        onBlur={() => handleBlur(key)}
                        field={field}
                        error={displayErrors[key]}
                        disabled={loading || field.formConfig?.fieldType === 'readonly'}
                        apiBasePath={apiBasePath}
                    />
                ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className={clsx(
                            'px-4 py-2 rounded-lg font-medium transition-colors',
                            'text-gray-700 dark:text-gray-300',
                            'bg-gray-100 dark:bg-gray-800',
                            'hover:bg-gray-200 dark:hover:bg-gray-700',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                        )}
                    >
                        Cancel
                    </button>
                )}
                <button
                    type="submit"
                    disabled={loading}
                    className={clsx(
                        'px-4 py-2 rounded-lg font-medium transition-colors',
                        'text-white',
                        'bg-blue-600 hover:bg-blue-700',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'flex items-center gap-2',
                    )}
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {mode === 'create' ? 'Creating...' : 'Saving...'}
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            {mode === 'create' ? 'Create' : 'Save Changes'}
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}

// ============================================================
// Utility Functions
// ============================================================

function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function singularize(str: string): string {
    if (str.endsWith('ies')) return str.slice(0, -3) + 'y';
    if (str.endsWith('s')) return str.slice(0, -1);
    return str;
}

export default ModelForm;
