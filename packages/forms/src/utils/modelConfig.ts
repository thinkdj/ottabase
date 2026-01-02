// ============================================================
// @ottabase/forms - Model Configuration Utilities
// ============================================================
// Utilities for extracting configuration from OttaORM models
// ============================================================

import type { ModelConfig, ModelFields } from "../types";

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
  defaultSortDirection?: "asc" | "desc";
  // Methods
  getFields?: () => FormFields;
  getModelConfig?: () => {
    entity: string;
    primaryKey: string;
    fields: FormFields;
    defaults?: Record<string, unknown>;
    validationRules?: Record<string, unknown>;
    // UI/Forms metadata
    displayName?: string;
    displayNamePlural?: string;
    defaultSort?: string;
    defaultSortDirection?: "asc" | "desc";
  };
}

/**
 * Extract ModelConfig from an OttaORM model class
 *
 * @example
 * ```typescript
 * import { User } from "@ottabase/ottaorm/models";
 * import { createModelConfig } from "@ottabase/forms";
 *
 * const userConfig = createModelConfig(User, {
 *   displayName: "User",
 *   displayNamePlural: "Users",
 * });
 *
 * // Use in ModelCrud
 * <ModelCrud config={userConfig} />
 * ```
 */
export function createModelConfig<T = Record<string, unknown>>(
  model: OttaModelClass,
  options?: Partial<ModelConfig<T>>
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

  // Priority: options override > model config > derived defaults
  return {
    entity: modelConfig.entity,
    primaryKey: modelConfig.primaryKey,
    fields: modelConfig.fields as FormFields,
    displayName: options?.displayName || modelConfig.displayName || capitalize(singularize(modelConfig.entity)),
    displayNamePlural: options?.displayNamePlural || modelConfig.displayNamePlural || capitalize(modelConfig.entity),
    apiPath: options?.apiPath,
    defaultSort: options?.defaultSort || modelConfig.defaultSort,
    defaultSortDirection: options?.defaultSortDirection || modelConfig.defaultSortDirection,
    searchFields: options?.searchFields || getSearchableFields(modelConfig.fields as FormFields),
    fetchFn: options?.fetchFn,
  };
}

/**
 * Create ModelConfig from a plain object (for custom configurations)
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
  config: Partial<ModelConfig<T>> & { entity: string; fields: FormFields }
): ModelConfig<T> {
  return {
    entity: config.entity,
    primaryKey: config.primaryKey || "id",
    fields: config.fields,
    displayName: config.displayName || capitalize(singularize(config.entity)),
    displayNamePlural: config.displayNamePlural || capitalize(config.entity),
    apiPath: config.apiPath,
    defaultSort: config.defaultSort,
    defaultSortDirection: config.defaultSortDirection,
    searchFields: config.searchFields || getSearchableFields(config.fields),
    fetchFn: config.fetchFn,
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

/**
 * Utility to capitalize a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Utility to singularize a string
 * Handles common irregular plurals
 */
function singularize(str: string): string {
  // Irregular plurals mapping
  const irregulars: Record<string, string> = {
    people: "person",
    children: "child",
    men: "man",
    women: "woman",
    feet: "foot",
    teeth: "tooth",
    geese: "goose",
    mice: "mouse",
    lice: "louse",
    leaves: "leaf",
    lives: "life",
    knives: "knife",
    wives: "wife",
    halves: "half",
    selves: "self",
    calves: "calf",
    loaves: "loaf",
    potatoes: "potato",
    tomatoes: "tomato",
    heroes: "hero",
    echoes: "echo",
    vetoes: "veto",
    analyses: "analysis",
    bases: "basis",
    crises: "crisis",
    diagnoses: "diagnosis",
    hypotheses: "hypothesis",
    oases: "oasis",
    parentheses: "parenthesis",
    synopses: "synopsis",
    theses: "thesis",
    criteria: "criterion",
    phenomena: "phenomenon",
    data: "datum",
    media: "medium",
    indices: "index",
    vertices: "vertex",
    matrices: "matrix",
    appendices: "appendix",
  };

  const lower = str.toLowerCase();

  // Check irregular plurals first
  if (irregulars[lower]) {
    // Preserve original case
    return str.charAt(0) + irregulars[lower].slice(1);
  }

  // Regular rules
  if (str.endsWith("ies")) return str.slice(0, -3) + "y";
  if (str.endsWith("ves")) return str.slice(0, -3) + "f";
  if (str.endsWith("es") && (str.endsWith("shes") || str.endsWith("ches") || str.endsWith("xes") || str.endsWith("zes") || str.endsWith("sses"))) {
    return str.slice(0, -2);
  }
  if (str.endsWith("s") && !str.endsWith("ss")) return str.slice(0, -1);

  return str;
}
