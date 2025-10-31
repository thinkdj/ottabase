import type {
  ModelMetadata,
  FieldMetadata,
  RelationMetadata,
} from '../base/types';

/**
 * Global registry for model metadata
 */
class ModelRegistry {
  private models = new Map<string, ModelMetadata>();

  /**
   * Register a model
   */
  registerModel(name: string, metadata: Partial<ModelMetadata>): void {
    const existing = this.models.get(name);

    this.models.set(name, {
      name,
      tableName: metadata.tableName || name.toLowerCase(),
      fields: metadata.fields || new Map(),
      relations: metadata.relations || new Map(),
      hidden: metadata.hidden || new Set(),
      appends: metadata.appends || new Set(),
      with: metadata.with || new Set(),
      timestamps: metadata.timestamps ?? true,
      primaryKey: metadata.primaryKey || 'id',
      softDeletes: metadata.softDeletes ?? false,
      ...existing,
      ...metadata,
    });
  }

  /**
   * Get model metadata
   */
  getModel(name: string): ModelMetadata | undefined {
    return this.models.get(name);
  }

  /**
   * Get or create model metadata
   */
  getOrCreateModel(name: string): ModelMetadata {
    let model = this.models.get(name);
    if (!model) {
      model = {
        name,
        tableName: name.toLowerCase(),
        fields: new Map(),
        relations: new Map(),
        hidden: new Set(),
        appends: new Set(),
        with: new Set(),
        timestamps: true,
        primaryKey: 'id',
        softDeletes: false,
      };
      this.models.set(name, model);
    }
    return model;
  }

  /**
   * Register a field for a model
   */
  registerField(
    modelName: string,
    fieldName: string,
    metadata: FieldMetadata
  ): void {
    const model = this.getOrCreateModel(modelName);
    model.fields.set(fieldName, metadata);

    // Auto-hide if specified
    if (metadata.hidden) {
      model.hidden.add(fieldName);
    }

    // Auto-detect primary key
    if (metadata.primaryKey) {
      model.primaryKey = fieldName;
    }
  }

  /**
   * Register a relation for a model
   */
  registerRelation(
    modelName: string,
    relationName: string,
    metadata: RelationMetadata
  ): void {
    const model = this.getOrCreateModel(modelName);
    model.relations.set(relationName, metadata);

    // Auto-eager load if specified
    if (metadata.eagerLoad) {
      model.with.add(relationName);
    }
  }

  /**
   * Get all registered models
   */
  getAllModels(): Map<string, ModelMetadata> {
    return this.models;
  }

  /**
   * Check if model exists
   */
  hasModel(name: string): boolean {
    return this.models.has(name);
  }

  /**
   * Clear all metadata (mainly for testing)
   */
  clear(): void {
    this.models.clear();
  }
}

// Singleton instance
export const modelRegistry = new ModelRegistry();

// Export the class for testing purposes
export { ModelRegistry };
