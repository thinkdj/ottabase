// ============================================================
// @ottabase/forms - ModelForm Component
// ============================================================
// Auto-generated create/edit form from model metadata
// ============================================================

import React, { useState, useMemo, useCallback } from "react";
import { clsx } from "clsx";
import { Loader2, Save, X } from "lucide-react";
import { FormField } from "./FormField";
import type { ModelFormProps, ModelFieldDescriptor } from "../types";

// Re-export for backwards compatibility
export type { ModelFormProps } from "../types";

interface FieldEntry {
  key: string;
  field: ModelFieldDescriptor;
  order: number;
}

/**
 * ModelForm - Auto-generated form for creating/editing model records
 */
export function ModelForm<T extends Record<string, unknown>>({
  config,
  mode,
  initialData = {},
  onSubmit,
  onCancel,
  isLoading = false,
  className,
  apiBasePath = "/api/ottaorm",
}: ModelFormProps<T>) {
  // Initialize form data with defaults for create, or initialData for edit
  const [formData, setFormData] = useState<Partial<T>>(() => {
    if (mode === "edit") {
      return { ...initialData };
    }
    // Apply defaults for create mode
    const defaults: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(config.fields)) {
      if (field.uiConfig?.defaultValue !== undefined) {
        defaults[key] = field.uiConfig.defaultValue;
      }
    }
    return defaults as Partial<T>;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get visible form fields sorted by order
  const visibleFields = useMemo(() => {
    const fields: FieldEntry[] = [];

    for (const [key, field] of Object.entries(config.fields)) {
      // Skip if form visibility is explicitly false
      if (field.formConfig?.visible === false) continue;

      // Skip primary key in create mode
      if (mode === "create" && field.primaryKey) continue;

      // Skip non-editable fields in edit mode (except for display)
      if (mode === "edit" && field.editable === false && !field.primaryKey) continue;

      // For edit mode, make primary key readonly
      const adjustedField = { ...field };
      if (mode === "edit" && field.primaryKey) {
        adjustedField.formConfig = {
          ...adjustedField.formConfig,
          fieldType: "readonly",
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

  // Handle field value change
  const handleChange = useCallback((key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    // Clear error when field is modified
    setErrors((prev) => {
      if (prev[key]) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return prev;
    });
  }, []);

  // Validate form
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    for (const { key, field } of visibleFields) {
      const value = formData[key as keyof T];
      const rules = field.validation?.rules;

      if (rules) {
        // Simple required validation
        if (rules.includes("required")) {
          if (value === undefined || value === null || value === "") {
            const label = field.uiConfig?.label || key;
            newErrors[key] = field.validation?.messages?.required || `${label} is required`;
          }
        }

        // Email validation
        if (rules.includes("email") && value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(String(value))) {
            newErrors[key] = field.validation?.messages?.email || "Invalid email format";
          }
        }

        // URL validation
        if (rules.includes("url") && value) {
          try {
            new URL(String(value));
          } catch {
            newErrors[key] = field.validation?.messages?.url || "Invalid URL format";
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [visibleFields, formData]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      // Filter out readonly and non-editable fields for submission
      const submitData: Partial<T> = {};
      for (const { key, field } of visibleFields) {
        if (field.editable !== false || (mode === "create" && !field.primaryKey)) {
          const value = formData[key as keyof T];
          if (value !== undefined) {
            (submitData as Record<string, unknown>)[key] = value;
          }
        }
      }

      await onSubmit(submitData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayName = config.displayName || capitalize(singularize(config.entity));
  const title = mode === "create" ? `Create ${displayName}` : `Edit ${displayName}`;
  const loading = isLoading || isSubmitting;

  return (
    <form onSubmit={handleSubmit} className={clsx("space-y-6", className)}>
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

      {/* Form Fields */}
      <div className="space-y-4">
        {visibleFields.map(({ key, field }) => (
          <FormField
            key={key}
            name={key}
            label={field.uiConfig?.label || capitalize(key)}
            value={formData[key as keyof T]}
            onChange={(value) => handleChange(key, value)}
            field={field}
            error={errors[key]}
            disabled={loading || field.formConfig?.fieldType === "readonly"}
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
              "px-4 py-2 rounded-lg font-medium transition-colors",
              "text-gray-700 dark:text-gray-300",
              "bg-gray-100 dark:bg-gray-800",
              "hover:bg-gray-200 dark:hover:bg-gray-700",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className={clsx(
            "px-4 py-2 rounded-lg font-medium transition-colors",
            "text-white",
            "bg-blue-600 hover:bg-blue-700",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "flex items-center gap-2"
          )}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {mode === "create" ? "Creating..." : "Saving..."}
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {mode === "create" ? "Create" : "Save Changes"}
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
  if (str.endsWith("ies")) return str.slice(0, -3) + "y";
  if (str.endsWith("s")) return str.slice(0, -1);
  return str;
}

export default ModelForm;
