// ============================================================
// @ottabase/forms - Type Definitions
// ============================================================
// Types for form generation from OttaORM models
// ============================================================

import type React from 'react';

// Re-export types from OttaORM for convenience
export type { ModelFieldType, ModelFieldDescriptor, ModelFields, RelationshipConfig } from '@ottabase/ottaorm';

/**
 * Field types supported by the form system
 */
export type FormFieldType =
    | 'input'
    | 'textarea'
    | 'number'
    | 'email'
    | 'password'
    | 'url'
    | 'tel'
    | 'date'
    | 'datetime'
    | 'time'
    | 'boolean'
    | 'select'
    | 'multiselect'
    | 'file'
    | 'image'
    | 'json'
    | 'hidden'
    | 'readonly';

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
    /** Field configuration (ModelFieldDescriptor from OttaORM) */
    field: import('@ottabase/ottaorm').ModelFieldDescriptor;
    /** Error message */
    error?: string;
    /** Is field disabled */
    disabled?: boolean;
    /** Additional className */
    className?: string;
    /** API base path for relationship fetches */
    apiBasePath?: string;
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
    fields: import('@ottabase/ottaorm').ModelFields;
    /** API base path */
    apiPath?: string;
    /** Default sort field */
    defaultSort?: string;
    /** Default sort direction */
    defaultSortDirection?: 'asc' | 'desc';
    /** Fields to search on */
    searchFields?: string[];
    /** Custom fetch function */
    fetchFn?: typeof fetch;
}

/**
 * CRUD view modes
 */
export type CrudViewMode = 'list' | 'detail' | 'create' | 'edit';

/**
 * CRUD component props
 */
export interface ModelCrudProps<T = Record<string, unknown>> {
    /** Model configuration */
    config: ModelConfig<T>;
    /** Initial view mode */
    initialMode?: CrudViewMode;
    /** Initially selected record ID (for detail/edit modes) */
    initialRecordId?: string | number;
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
    /** API base path */
    apiBasePath?: string;
    /** Items per page */
    perPage?: number;
    /** Enable row selection */
    selectable?: boolean;
    /** Custom fetch function */
    fetchFn?: typeof fetch;
}

/**
 * List view props
 */
export interface ModelTableProps<T = Record<string, unknown>> {
    /** Model configuration */
    config: ModelConfig<T>;
    /** Data to display */
    data?: T[];
    /** Loading state */
    isLoading?: boolean;
    /** Total count for pagination */
    total?: number;
    /** Current page */
    page?: number;
    /** Items per page */
    perPage?: number;
    /** Page change handler */
    onPageChange?: (page: number) => void;
    /** Row click handler */
    onRowClick?: (record: T) => void;
    /** View action handler */
    onView?: (record: T) => void;
    /** Edit action handler */
    onEdit?: (record: T) => void;
    /** Delete action handler */
    onDelete?: (record: T) => void;
    /** Create action handler */
    onCreate?: () => void;
    /** Sort change handler */
    onSortChange?: (field: string, direction: 'asc' | 'desc') => void;
    /** Current sort field */
    sortField?: string;
    /** Current sort direction */
    sortDirection?: 'asc' | 'desc';
    /** Search handler */
    onSearch?: (query: string) => void;
    /** Search placeholder */
    searchPlaceholder?: string;
    /** Enable row selection */
    selectable?: boolean;
    /** Selected row IDs */
    selectedIds?: (string | number)[];
    /** Selection change handler */
    onSelectionChange?: (ids: (string | number)[]) => void;
    /** Additional className */
    className?: string;
    /** Empty state message */
    emptyMessage?: string;
}

/**
 * Form props (create/edit)
 */
export interface ModelFormProps<T = Record<string, unknown>> {
    /** Model configuration */
    config: ModelConfig<T>;
    /** Form mode: create or edit */
    mode: 'create' | 'edit';
    /** Initial form data (for edit mode) */
    initialData?: Partial<T>;
    /** Submit handler */
    onSubmit: (data: Partial<T>) => void | Promise<void>;
    /** Cancel handler */
    onCancel?: () => void;
    /** Loading state */
    isLoading?: boolean;
    /** Additional className */
    className?: string;
    /** API base path for relationship fetches */
    apiBasePath?: string;
}

/**
 * Detail view props
 */
export interface ModelDetailProps<T = Record<string, unknown>> {
    /** Model configuration */
    config: ModelConfig<T>;
    /** Record data to display */
    data: T;
    /** Edit action handler */
    onEdit?: () => void;
    /** Delete action handler */
    onDelete?: () => void;
    /** Back/close handler */
    onBack?: () => void;
    /** Loading state */
    isLoading?: boolean;
    /** Additional className */
    className?: string;
}
