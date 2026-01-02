// ============================================================
// @ottabase/forms - FormField Component
// ============================================================
// Auto-renders the correct input based on model field metadata
// ============================================================

import React, { useCallback } from "react";
import { clsx } from "clsx";
import { OttaSelect, type OttaSelectItem } from "@ottabase/ottaselect";
import type { FormFieldDescriptor } from "../types";
import { Calendar, Upload, Eye, EyeOff } from "lucide-react";

export interface FormFieldProps {
  name: string;
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  field: FormFieldDescriptor;
  error?: string;
  disabled?: boolean;
  className?: string;
  /** API base path for relationship fetches */
  apiBasePath?: string;
}

/**
 * FormField - Renders the appropriate input based on field type
 */
export function FormField({
  name,
  label,
  value,
  onChange,
  field,
  error,
  disabled = false,
  className,
  apiBasePath = "/api/ottaorm",
}: FormFieldProps) {
  const formConfig = field.formConfig || {};
  const uiConfig = field.uiConfig || {};
  const fieldType = formConfig.fieldType || inferFieldType(field);

  const placeholder = formConfig.placeholder || uiConfig.placeholder || `Enter ${label.toLowerCase()}`;
  const helpText = formConfig.helpText || uiConfig.hint;

  const baseInputClasses = clsx(
    "w-full px-3 py-2 rounded-lg border transition-colors duration-150",
    "bg-white dark:bg-gray-800",
    "text-gray-900 dark:text-gray-100",
    "placeholder:text-gray-400 dark:placeholder:text-gray-500",
    "focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent",
    error
      ? "border-red-500 dark:border-red-400"
      : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500",
    disabled && "opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-900"
  );

  const renderField = () => {
    switch (fieldType) {
      case "textarea":
        return (
          <textarea
            id={name}
            name={name}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            rows={formConfig.rows || 4}
            className={clsx(baseInputClasses, "resize-y min-h-[100px]")}
          />
        );

      case "number":
        return (
          <input
            type="number"
            id={name}
            name={name}
            value={value !== undefined && value !== null ? String(value) : ""}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            placeholder={placeholder}
            disabled={disabled}
            min={formConfig.min}
            max={formConfig.max}
            step={formConfig.step}
            className={baseInputClasses}
          />
        );

      case "email":
        return (
          <input
            type="email"
            id={name}
            name={name}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={baseInputClasses}
          />
        );

      case "password":
        return <PasswordField value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} name={name} className={baseInputClasses} />;

      case "url":
        return (
          <input
            type="url"
            id={name}
            name={name}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || "https://"}
            disabled={disabled}
            className={baseInputClasses}
          />
        );

      case "tel":
        return (
          <input
            type="tel"
            id={name}
            name={name}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={baseInputClasses}
          />
        );

      case "date":
        return (
          <div className="relative">
            <input
              type="date"
              id={name}
              name={name}
              value={formatDateValue(value)}
              onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null)}
              disabled={disabled}
              className={baseInputClasses}
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        );

      case "datetime":
        return (
          <input
            type="datetime-local"
            id={name}
            name={name}
            value={formatDateTimeValue(value)}
            onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null)}
            disabled={disabled}
            className={baseInputClasses}
          />
        );

      case "time":
        return (
          <input
            type="time"
            id={name}
            name={name}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={baseInputClasses}
          />
        );

      case "boolean":
        return (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              id={name}
              name={name}
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              disabled={disabled}
              className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
            <span className="text-gray-700 dark:text-gray-300">{uiConfig.description || label}</span>
          </label>
        );

      case "select":
        return (
          <SelectField
            value={value}
            onChange={onChange}
            field={field}
            disabled={disabled}
            placeholder={placeholder}
            apiBasePath={apiBasePath}
            mode="single"
          />
        );

      case "multiselect":
        return (
          <SelectField
            value={value}
            onChange={onChange}
            field={field}
            disabled={disabled}
            placeholder={placeholder}
            apiBasePath={apiBasePath}
            mode="multiple"
          />
        );

      case "file":
      case "image":
        return (
          <FileField
            name={name}
            value={value}
            onChange={onChange}
            disabled={disabled}
            accept={formConfig.accept || (fieldType === "image" ? "image/*" : undefined)}
            maxSize={formConfig.maxSize}
            isImage={fieldType === "image"}
          />
        );

      case "json":
        return (
          <textarea
            id={name}
            name={name}
            value={typeof value === "string" ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                onChange(JSON.parse(e.target.value));
              } catch {
                onChange(e.target.value);
              }
            }}
            placeholder={placeholder || "{}"}
            disabled={disabled}
            rows={formConfig.rows || 6}
            className={clsx(baseInputClasses, "font-mono text-sm resize-y min-h-[150px]")}
          />
        );

      case "hidden":
        return <input type="hidden" name={name} value={String(value || "")} />;

      case "readonly":
        return (
          <div className={clsx(baseInputClasses, "bg-gray-50 dark:bg-gray-900 cursor-not-allowed")}>
            {formatDisplayValue(value, field)}
          </div>
        );

      case "input":
      default:
        return (
          <input
            type="text"
            id={name}
            name={name}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={baseInputClasses}
          />
        );
    }
  };

  // Hidden fields don't need labels
  if (fieldType === "hidden") {
    return renderField();
  }

  return (
    <div className={clsx("space-y-1.5", className)}>
      {/* Label */}
      {fieldType !== "boolean" && (
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {field.validation?.rules?.includes("required") && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Field */}
      {renderField()}

      {/* Help text */}
      {helpText && !error && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{helpText}</p>
      )}

      {/* Error */}
      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
}

// ============================================================
// Helper Components
// ============================================================

function PasswordField({
  value,
  onChange,
  placeholder,
  disabled,
  name,
  className,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
  placeholder: string;
  disabled: boolean;
  name: string;
  className: string;
}) {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="relative">
      <input
        type={showPassword ? "text" : "password"}
        id={name}
        name={name}
        value={(value as string) || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={clsx(className, "pr-10")}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function SelectField({
  value,
  onChange,
  field,
  disabled,
  placeholder,
  apiBasePath,
  mode,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
  field: FormFieldDescriptor;
  disabled: boolean;
  placeholder: string;
  apiBasePath: string;
  mode: "single" | "multiple";
}) {
  const formConfig = field.formConfig || {};
  const relationship = formConfig.relationship;
  const staticOptions = formConfig.options;

  // Convert value to OttaSelectItem format
  const normalizedValue = React.useMemo(() => {
    if (!value) return null;

    if (mode === "single") {
      if (typeof value === "object" && value !== null) {
        return value as OttaSelectItem;
      }
      // If just an ID, we need to find the full item or create a placeholder
      return { id: String(value), name: String(value) };
    }

    if (Array.isArray(value)) {
      return value.map((v) => {
        if (typeof v === "object" && v !== null) return v as OttaSelectItem;
        return { id: String(v), name: String(v) };
      });
    }

    return null;
  }, [value, mode]);

  // Create fetch function for relationship fields
  const fetchCollection = useCallback(
    async (searchQuery: string) => {
      if (!relationship) return [];

      const endpoint = relationship.endpoint || `${apiBasePath}/${relationship.entity}`;
      const params = new URLSearchParams();

      if (searchQuery) {
        params.set("search", searchQuery);
      }

      if (relationship.where) {
        params.set("where", JSON.stringify(relationship.where));
      }

      const url = params.toString() ? `${endpoint}?${params}` : endpoint;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch options");
      }

      const data = await response.json();
      const items = data[relationship.entity] || data.data || data;

      // Map to OttaSelectItem format
      return items.map((item: Record<string, unknown>) => ({
        id: String(item[relationship.valueField || "id"]),
        name: String(item[relationship.labelField || "name"] || item.label || item.title || item.id),
        ...item,
      }));
    },
    [relationship, apiBasePath]
  );

  const handleChange = useCallback(
    (selected: OttaSelectItem | OttaSelectItem[] | null) => {
      if (mode === "single") {
        // Return just the ID for single select (or full object if needed)
        onChange(selected ? (selected as OttaSelectItem).id : null);
      } else {
        // Return array of IDs for multiselect
        onChange(selected ? (selected as OttaSelectItem[]).map((s) => s.id) : []);
      }
    },
    [mode, onChange]
  );

  return (
    <OttaSelect
      mode={mode}
      value={normalizedValue}
      onChange={handleChange}
      items={staticOptions}
      fetchCollection={relationship ? fetchCollection : undefined}
      placeholder={placeholder}
      disabled={disabled}
      searchable={true}
    />
  );
}

function FileField({
  name,
  value,
  onChange,
  disabled,
  accept,
  maxSize,
  isImage,
}: {
  name: string;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
  accept?: string;
  maxSize?: number;
  isImage: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isImage && typeof value === "string" && value) {
      setPreview(value);
    }
  }, [value, isImage]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    if (maxSize && file.size > maxSize) {
      setError(`File size exceeds ${formatFileSize(maxSize)}`);
      return;
    }

    if (isImage) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }

    onChange(file);
  };

  return (
    <div className="space-y-2">
      <div
        className={clsx(
          "flex items-center justify-center w-full",
          "border-2 border-dashed rounded-lg",
          "border-gray-300 dark:border-gray-600",
          "hover:border-gray-400 dark:hover:border-gray-500",
          "transition-colors cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        {isImage && preview ? (
          <div className="relative w-full p-2">
            <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPreview(null);
                onChange(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="absolute top-4 right-4 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
            >
              ×
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Click to upload {isImage ? "an image" : "a file"}
            </p>
            {accept && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Accepted: {accept}
              </p>
            )}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        name={name}
        onChange={handleChange}
        accept={accept}
        disabled={disabled}
        className="hidden"
      />

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Infer field type from model field descriptor
 */
function inferFieldType(field: FormFieldDescriptor): string {
  // Use explicit formConfig.fieldType if provided
  if (field.formConfig?.fieldType) {
    return field.formConfig.fieldType;
  }

  // Infer from base type
  switch (field.type) {
    case "boolean":
      return "boolean";
    case "number":
    case "integer":
    case "float":
      return "number";
    case "date":
      return "date";
    case "datetime":
      return "datetime";
    case "json":
      return "json";
    case "array":
      return "multiselect";
    case "id":
      return field.primaryKey ? "readonly" : "input";
    default:
      return "input";
  }
}

/**
 * Format date value for input[type="date"]
 */
function formatDateValue(value: unknown): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value as string);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

/**
 * Format datetime value for input[type="datetime-local"]
 */
function formatDateTimeValue(value: unknown): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value as string);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

/**
 * Format value for display in readonly fields
 */
function formatDisplayValue(value: unknown, field: FormFieldDescriptor): string {
  if (value === null || value === undefined) return "-";

  switch (field.type) {
    case "boolean":
      return value ? "Yes" : "No";
    case "date":
      return new Date(value as string).toLocaleDateString();
    case "datetime":
      return new Date(value as string).toLocaleString();
    case "json":
      return JSON.stringify(value, null, 2);
    case "array":
      return Array.isArray(value) ? value.join(", ") : String(value);
    default:
      return String(value);
  }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default FormField;
