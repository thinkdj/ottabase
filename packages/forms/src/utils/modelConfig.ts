// ============================================================
// @ottabase/forms - Model Configuration Utilities
// ============================================================
// Utilities for extracting configuration from OttaORM models
// ============================================================

import { buildZodSchema } from '@ottabase/ottaorm';
import type { ModelConfig, ModelFields } from '../types';
import { entityNames } from '../utils/names';

// Alias for clarity
type FormFields = ModelFields;

/**
 * OttaORM model class interface
 */
export interface OttaModelClass {
    entity: string;
    primaryKey: string;
    // UI/Forms metadata (optional - derived from entity if not set)
    displayName?: string;
    displayNamePlural?: string;
    defaultSort?: string;
    defaultSortDirection?: 'asc' | 'desc';
    // Methods
    getFields?: () => FormFields;
    getModelConfig?: () => {
        entity: string;
        primaryKey: string;
        fields: FormFields;
        defaults?: Record<string, unknown>;
        // UI/Forms metadata
        displayName?: string;
        displayNamePlural?: string;
        defaultSort?: string;
        defaultSortDirection?: 'asc' | 'desc';
    };
}

/**
 * Extract ModelConfig from an OttaORM model class
 *
 * Automatically builds Zod schemas from field metadata for validation.
 *
 * @example
 * ```typescript
 * import { Tag } from "@ottabase/ottaorm/models";
 * import { createModelConfig } from "@ottabase/forms";
 *
 * const tagConfig = createModelConfig(Tag, {
 *   displayName: "Topic",
 *   displayNamePlural: "Topics",
 * });
 *
 * // Use in ModelCrud
 * <ModelCrud config={tagConfig} />
 * ```
 */
export function createModelConfig<T = Record<string, unknown>>(
    model: OttaModelClass,
    options?: Partial<ModelConfig<T>>,
): ModelConfig<T> {
    // Get full config from model (includes UI metadata)
    const modelConfig = model.getModelConfig?.() || {
        entity: model.entity,
        primaryKey: model.primaryKey,
        fields: model.getFields?.() || {},
        displayName: model.displayName,
        displayNamePlural: model.displayNamePlural,
        defaultSort: model.defaultSort,
        defaultSortDirection: model.defaultSortDirection,
    };

    const fields = modelConfig.fields as FormFields;
    const writable = (model as any).writable;

    // Build Zod schemas from field metadata
    let zodCreateSchema = options?.zodCreateSchema;
    let zodUpdateSchema = options?.zodUpdateSchema;
    try {
        if (!zodCreateSchema) zodCreateSchema = buildZodSchema(fields, 'create', writable);
        if (!zodUpdateSchema) zodUpdateSchema = buildZodSchema(fields, 'update', writable);
    } catch {
        // Schema building is best-effort - forms still work without it
    }

    // Priority: options override > model config > derived defaults
    const names = entityNames({
        entity: modelConfig.entity,
        displayName: options?.displayName || modelConfig.displayName,
        displayNamePlural: options?.displayNamePlural || modelConfig.displayNamePlural,
    });
    return {
        entity: modelConfig.entity,
        primaryKey: modelConfig.primaryKey,
        fields,
        defaults: modelConfig.defaults,
        displayName: names.singular,
        displayNamePlural: names.plural,
        apiPath: options?.apiPath,
        defaultSort: options?.defaultSort || modelConfig.defaultSort,
        defaultSortDirection: options?.defaultSortDirection || modelConfig.defaultSortDirection,
        searchFields: options?.searchFields || getSearchableFields(fields),
        zodCreateSchema,
        zodUpdateSchema,
        prepare: options?.prepare,
    };
}

/**
 * Create ModelConfig from a plain object (for custom configurations)
 *
 * Automatically builds Zod schemas from field metadata.
 *
 * @example
 * ```typescript
 * const productConfig = defineModelConfig({
 *   entity: "products",
 *   displayName: "Product",
 *   fields: {
 *     id: { type: "id", primaryKey: true },
 *     name: { type: "string", editable: true, searchable: true },
 *     price: { type: "number", editable: true },
 *   },
 * });
 * ```
 */
export function defineModelConfig<T = Record<string, unknown>>(
    config: Partial<ModelConfig<T>> & { entity: string; fields: FormFields },
): ModelConfig<T> {
    // Build Zod schemas from field metadata
    let zodCreateSchema = config.zodCreateSchema;
    let zodUpdateSchema = config.zodUpdateSchema;
    try {
        if (!zodCreateSchema) zodCreateSchema = buildZodSchema(config.fields, 'create');
        if (!zodUpdateSchema) zodUpdateSchema = buildZodSchema(config.fields, 'update');
    } catch {
        // Schema building is best-effort
    }

    const names = entityNames(config);
    return {
        entity: config.entity,
        primaryKey: config.primaryKey || 'id',
        fields: config.fields,
        defaults: config.defaults,
        displayName: names.singular,
        displayNamePlural: names.plural,
        apiPath: config.apiPath,
        defaultSort: config.defaultSort,
        defaultSortDirection: config.defaultSortDirection,
        searchFields: config.searchFields || getSearchableFields(config.fields),
        zodCreateSchema,
        zodUpdateSchema,
    };
}

/**
 * Get searchable field names from fields configuration
 */
function getSearchableFields(fields: FormFields): string[] {
    return Object.entries(fields)
        .filter(([_, field]) => field.searchable)
        .map(([key]) => key);
}
