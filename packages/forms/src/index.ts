// ============================================================
// @ottabase/forms - Headless CRUD config for OttaORM Models
// ============================================================
// This is the PURE entry: config builders + Zod schema
// generation + types only. It imports ZERO rendered UI, so its
// whole import graph stays UI-free and tree-shakeable.
//
// The rendered components (FormField, ModelForm, ModelTable,
// ModelDetail, ModelCrud) live behind the '@ottabase/forms/react'
// subpath (see ./react). Import them from there.
// ============================================================

// Utilities
export { createModelConfig, defineModelConfig } from './utils/modelConfig';
export type { OttaModelClass } from './utils/modelConfig';

// Types
export type {
    FormFieldType,
    FormFieldProps,
    ModelConfig,
    CrudViewMode,
    ModelCrudProps,
    ModelTableProps,
    ModelFormProps,
    ModelDetailProps,
} from './types';

// Re-export OttaORM types for convenience
export type { ModelFieldType, ModelFieldDescriptor, ModelFields, RelationshipConfig } from './types';
