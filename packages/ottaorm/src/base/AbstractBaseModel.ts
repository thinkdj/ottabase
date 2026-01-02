// ============================================================
// @ottabase/ottaorm - Abstract Base Model
// ============================================================
// Shared functionality for all model types (SQL, NoSQL, etc.)
// Extracted from BaseModel to support multi-database patterns
// ============================================================

export type ModelFieldType = 'string' | 'number' | 'integer' | 'float' | 'date' | 'datetime' | 'boolean' | 'id' | 'json' | 'array';

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

export interface ModelFieldDescriptor {
  type: ModelFieldType;
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
    defaultValue?: any;
  };
  formConfig?: {
    fieldType?: 'input' | 'textarea' | 'select' | 'multiselect' | 'date' | 'datetime' | 'json' | 'boolean' | 'number' | 'email' | 'password' | 'url' | 'tel' | 'time' | 'file' | 'image' | 'hidden' | 'readonly';
    visible?: boolean;
    order?: number;
    /** Relationship config for select/multiselect */
    relationship?: RelationshipConfig;
    /** Static options for select (if not using relationship) */
    options?: Array<{ id: string; name: string; [key: string]: any }>;
    /** Placeholder text override */
    placeholder?: string;
    /** Help text below field */
    helpText?: string;
    /** Accepted file types (for file/image) */
    accept?: string;
    /** Max file size in bytes */
    maxSize?: number;
    /** Number of rows (for textarea) */
    rows?: number;
    /** Min value (for number) or min length (for password) */
    min?: number;
    /** Max value (for number) */
    max?: number;
    /** Step value (for number) */
    step?: number;
    /** Show password strength hints (for password fields) */
    showPasswordHints?: boolean;
    /** Custom upload endpoint for file/image fields */
    uploadEndpoint?: string;
  };
  tableConfig?: {
    visible?: boolean;
    order?: number;
    colWidth?: string | number;
    /** Custom format for display */
    format?: 'date' | 'datetime' | 'currency' | 'percentage' | 'boolean' | 'image' | 'link';
  };
  validation?: {
    /** Validation rules as pipe-separated string (e.g., "required|email|min:8") */
    rules?: string;
    /** Custom error messages keyed by rule name */
    messages?: Record<string, string>;
  };
}

export type ModelFields = {
  [key: string]: ModelFieldDescriptor;
};

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Abstract Base Model - Shared functionality for all models
 *
 * This class contains all database-agnostic functionality:
 * - Type casting
 * - Serialization
 * - Attribute access
 * - Model metadata
 *
 * Subclasses (BaseModel, MongoBaseModel) implement database-specific operations.
 *
 * @abstract
 */
export abstract class AbstractBaseModel {

  // ============================================================
  // STATIC PROPERTIES - Model Metadata
  // ============================================================

  /**
   * Entity name (table/collection name)
   */
  static entity: string;

  /**
   * Primary key field name
   * @default "id"
   */
  static primaryKey: string = "id";

  /**
   * Database connection name
   * @default "default"
   */
  static connection: string = "default";

  // ============================================================
  // STATIC PROPERTIES - UI/Forms Metadata
  // ============================================================

  /**
   * Display name (singular) for UI
   * @example "User", "Blog Post"
   * If not set, derived from entity name
   */
  static displayName?: string;

  /**
   * Display name (plural) for UI
   * @example "Users", "Blog Posts"
   * If not set, derived from entity name
   */
  static displayNamePlural?: string;

  /**
   * Default sort field for list views
   * @example "createdAt"
   */
  static defaultSort?: string;

  /**
   * Default sort direction for list views
   * @default "asc"
   */
  static defaultSortDirection?: "asc" | "desc";

  /**
   * Type casting rules for attributes
   * @example
   * ```typescript
   * static casts = {
   *   createdAt: 'date',
   *   published: 'boolean',
   *   metadata: 'json'
   * }
   * ```
   */
  protected static casts: { [key: string]: ModelFieldType } = {};

  /**
   * Relationship definitions (for future use)
   */
  protected static connect: string[] = [];

  /**
   * Default eager loading relationships (for future use)
   */
  protected static with: string[] = [];

  /**
   * Complete field metadata for UI generation, forms, tables, etc.
   */
  protected static fields: ModelFields = {};

  /**
   * Validation rules
   */
  protected static validationRules: any = {};

  /**
   * Get field metadata for this model
   * Used by @ottabase/forms for auto-generating CRUD forms
   */
  static getFields(): ModelFields {
    return this.fields;
  }

  /**
   * Get model configuration for forms package
   */
  static getModelConfig() {
    return {
      entity: this.entity,
      primaryKey: this.primaryKey,
      fields: this.fields,
      defaults: this.defaults,
      validationRules: this.validationRules,
      // UI/Forms metadata
      displayName: this.displayName,
      displayNamePlural: this.displayNamePlural,
      defaultSort: this.defaultSort,
      defaultSortDirection: this.defaultSortDirection,
    };
  }

  /**
   * Default values for new records
   * @example
   * ```typescript
   * static defaults = {
   *   status: 'active',
   *   createdAt: () => new Date()
   * }
   * ```
   */
  protected static defaults: { [key: string]: any } = {};

  // ============================================================
  // INSTANCE PROPERTIES
  // ============================================================

  /**
   * Model attributes (actual data)
   */
  protected attributes: { [key: string]: any } = {};

  /**
   * Accessor fields to append to JSON output
   */
  protected appends: string[] = [];

  /**
   * Fields to hide from JSON output
   */
  protected hidden: string[] = [];

  // ============================================================
  // INSTANCE METHODS - Data Manipulation
  // ============================================================

  /**
   * Fill model with data and apply type casting
   *
   * @param data - Data to fill the model with
   */
  fill(data: { [key: string]: any }): void {
    for (const key in data) {
      this.attributes[key] = this.castAttributeValue(key, data[key]);
    }
  }

  /**
   * Get attribute value
   *
   * @param key - Attribute key
   * @returns Attribute value
   */
  get(key: string): any {
    return this.attributes[key];
  }

  /**
   * Set attribute value with type casting
   *
   * @param key - Attribute key
   * @param value - Value to set
   */
  set(key: string, value: any): void {
    this.attributes[key] = this.castAttributeValue(key, value);
  }

  /**
   * Cast attribute value based on casts configuration
   *
   * @param key - Attribute key
   * @param value - Value to cast
   * @returns Cast value
   */
  protected castAttributeValue(key: string, value: any): any {
    const casts = (this.constructor as typeof AbstractBaseModel).casts;
    const castType = casts[key];

    if (!castType || value === null || value === undefined) {
      return value;
    }

    // Skip if already correct type
    if (typeof value === castType ||
        (castType === 'number' && typeof value === 'number') ||
        (castType === 'integer' && Number.isInteger(value)) ||
        (castType === 'float' && typeof value === 'number' && !Number.isInteger(value))) {
      return value;
    }

    try {
      switch (castType) {
        case 'number':
        case 'integer':
          return parseInt(value);
        case 'float':
          return parseFloat(value);
        case 'string':
          return String(value);
        case 'boolean':
          if (typeof value === 'string') {
            return value.toLowerCase() === 'true' || value === '1';
          }
          return Boolean(value);
        case 'date':
        case 'datetime':
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            throw new Error(`Invalid date value for ${key}`);
          }
          return date;
        case 'json':
          return typeof value === 'string' ? JSON.parse(value) : value;
        case 'array':
          if (Array.isArray(value)) return value;
          if (typeof value === 'string') return value.split(/\s*,\s*/);
          return [value];
        default:
          return value;
      }
    } catch (e) {
      throw new Error(`Failed to cast ${key} with value: ${value} to type: ${castType}`);
    }
  }

  /**
   * Make hidden fields visible for this instance
   *
   * @param fields - Field or array of fields to make visible
   * @returns This instance for chaining
   */
  makeVisible(fields: string | string[]): this {
    const fieldsToMakeVisible = Array.isArray(fields) ? fields : [fields];
    this.hidden = this.hidden.filter(attr => !fieldsToMakeVisible.includes(attr));
    return this;
  }

  /**
   * Convert to JSON, applying hidden fields and accessors
   *
   * @returns JSON representation of the model
   */
  toJson(): Record<string, any> {
    const visibleAttributes: { [key: string]: any } = {};

    // Copy non-hidden attributes
    for (const key in this.attributes) {
      if (!this.hidden.includes(key)) {
        visibleAttributes[key] = this.attributes[key];
      }
    }

    // Apply accessors (appends)
    for (const appendKey of this.appends) {
      const accessorMethod = `get${appendKey.charAt(0).toUpperCase()}${appendKey.slice(1)}`;
      if (typeof (this as any)[accessorMethod] === 'function') {
        visibleAttributes[appendKey] = (this as any)[accessorMethod]();
      }
    }

    return visibleAttributes;
  }

  /**
   * Get model name (entity)
   *
   * @returns Model entity name
   */
  getModelName(): string {
    return (this.constructor as typeof AbstractBaseModel).entity;
  }

  // ============================================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // ============================================================

  /**
   * Save instance (create or update)
   * Implementation depends on database type (SQL vs NoSQL)
   *
   * @param driver - Optional driver override
   * @returns This instance with updated data
   */
  abstract save(driver?: any): Promise<this>;

  /**
   * Delete instance from database
   * Implementation depends on database type (SQL vs NoSQL)
   *
   * @param driver - Optional driver override
   * @returns True if deleted successfully
   */
  abstract destroy(driver?: any): Promise<boolean>;

  /**
   * Reload instance from database
   * Implementation depends on database type (SQL vs NoSQL)
   *
   * @param driver - Optional driver override
   * @returns This instance with fresh data
   */
  abstract refresh(driver?: any): Promise<this>;
}
