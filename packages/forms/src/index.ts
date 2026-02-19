// ============================================================
// @ottabase/forms - Auto-generated CRUD Forms for OttaORM Models
// ============================================================
// Complete CRUD interface from model metadata
// ============================================================

// Components
export { FormField } from './components/FormField';
export { ModelForm } from './components/ModelForm';
export { ModelTable } from './components/ModelTable';
export { ModelDetail } from './components/ModelDetail';
export { ModelCrud } from './components/ModelCrud';

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
