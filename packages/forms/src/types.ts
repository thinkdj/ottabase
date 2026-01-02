// ============================================================
// @ottabase/forms - Type Definitions
// ============================================================
// Extended types for form generation from OttaORM models
// ============================================================

import type { OttaSelectItem } from "@ottabase/ottaselect";

/**
 * Field types supported by the form system
 */
export type FormFieldType =
  | "input"
  | "textarea"
  | "number"
  | "email"
  | "password"
  | "url"
  | "tel"
  | "date"
  | "datetime"
  | "time"
  | "boolean"
  | "select"
  | "multiselect"
  | "file"
  | "image"
  | "json"
  | "hidden"
  | "readonly";

/**
 * Relationship configuration for select/multiselect fields
 */
export interface RelationshipConfig {
  /** Related model entity name (e.g., "users") */
  entity: string;
  /** API endpoint to fetch options (defaults to /api/ottaorm/{entity}) */
  endpoint?: string;
  /** Field to use as display label (defaults to "name") */
  labelField?: string;
  /** Field to use as value (defaults to "id") */
  valueField?: string;
  /** Additional fields to include in search */
  searchFields?: string[];
  /** Pre-filter options */
  where?: Record<string, unknown>;
}

/**
 * Extended form configuration with relationship support
 */
export interface ExtendedFormConfig {
  fieldType?: FormFieldType;
  visible?: boolean;
  order?: number;
  /** Relationship config for select/multiselect */
  relationship?: RelationshipConfig;
  /** Static options for select (if not using relationship) */
  options?: OttaSelectItem[];
  /** Custom component to render */
  component?: React.ComponentType<FormFieldProps>;
  /** Placeholder text */
  placeholder?: string;
  /** Help text below field */
  helpText?: string;
  /** Accepted file types (for file/image) */
  accept?: string;
  /** Max file size in bytes */
  maxSize?: number;
  /** Number of rows (for textarea) */
  rows?: number;
  /** Min value (for number) */
  min?: number;
  /** Max value (for number) */
  max?: number;
  /** Step value (for number) */
  step?: number;
}

/**
 * Model field metadata (matches OttaORM ModelFieldDescriptor)
 */
export interface FormFieldDescriptor {
  type: "string" | "number" | "integer" | "float" | "date" | "datetime" | "boolean" | "id" | "json" | "array";
  primaryKey?: boolean;
  unique?: boolean;
  editable?: boolean;
  searchable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  uiConfig?: {
    label?: string;
    description?: string;
    placeholder?: string;
    hint?: string;
    defaultValue?: unknown;
  };
  formConfig?: ExtendedFormConfig;
  tableConfig?: {
    visible?: boolean;
    order?: number;
    colWidth?: string | number;
    /** Custom cell renderer */
    render?: (value: unknown, record: Record<string, unknown>) => React.ReactNode;
  };
  validation?: {
    rules?: string;
    messages?: Record<string, string>;
  };
}

export type FormFields = Record<string, FormFieldDescriptor>;

/**
 * Props passed to form field components
 */
export interface FormFieldProps {
  /** Field name/key */
  name: string;
  /** Field label */
  label: string;
  /** Current value */
  value: unknown;
  /** Change handler */
  onChange: (value: unknown) => void;
  /** Field configuration */
  field: FormFieldDescriptor;
  /** Error message */
  error?: string;
  /** Is field disabled */
  disabled?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Model configuration for CRUD generation
 */
export interface ModelConfig<T = Record<string, unknown>> {
  /** Model entity name */
  entity: string;
  /** Display name (singular) */
  displayName?: string;
  /** Display name (plural) */
  displayNamePlural?: string;
  /** Primary key field */
  primaryKey?: string;
  /** Field metadata */
  fields: FormFields;
  /** API base path */
  apiPath?: string;
  /** Default sort field */
  defaultSort?: string;
  /** Default sort direction */
  defaultSortDirection?: "asc" | "desc";
  /** Fields to search on */
  searchFields?: string[];
  /** Custom fetch function */
  fetchFn?: typeof fetch;
}

/**
 * CRUD view modes
 */
export type CrudViewMode = "list" | "detail" | "create" | "edit";

/**
 * CRUD component props
 */
export interface ModelCrudProps<T = Record<string, unknown>> {
  /** Model configuration */
  config: ModelConfig<T>;
  /** Initial view mode */
  initialMode?: CrudViewMode;
  /** Callback when record is created */
  onCreate?: (record: T) => void;
  /** Callback when record is updated */
  onUpdate?: (record: T) => void;
  /** Callback when record is deleted */
  onDelete?: (id: string | number) => void;
  /** Custom header component */
  header?: React.ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * List view props
 */
export interface ModelTableProps<T = Record<string, unknown>> {
  config: ModelConfig<T>;
  data?: T[];
  isLoading?: boolean;
  onRowClick?: (record: T) => void;
  onEdit?: (record: T) => void;
  onDelete?: (record: T) => void;
  selectedIds?: (string | number)[];
  onSelectionChange?: (ids: (string | number)[]) => void;
  className?: string;
}

/**
 * Form props (create/edit)
 */
export interface ModelFormProps<T = Record<string, unknown>> {
  config: ModelConfig<T>;
  mode: "create" | "edit";
  initialData?: Partial<T>;
  onSubmit: (data: Partial<T>) => void | Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * Detail view props
 */
export interface ModelDetailProps<T = Record<string, unknown>> {
  config: ModelConfig<T>;
  data: T;
  onEdit?: () => void;
  onDelete?: () => void;
  onBack?: () => void;
  className?: string;
}

/**
 * Extract model config from OttaORM model class
 */
export interface OttaModelClass {
  entity: string;
  primaryKey: string;
  fields?: FormFields;
  getFields?: () => FormFields;
}
