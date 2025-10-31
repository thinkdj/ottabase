import type { z } from 'zod';

/**
 * Supported field types for model fields
 */
export type FieldType =
  | 'string'
  | 'text'
  | 'number'
  | 'integer'
  | 'float'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'timestamp'
  | 'json'
  | 'enum'
  | 'uuid'
  | 'cuid'
  | 'email'
  | 'url'
  | 'file'
  | 'image'
  | 'array';

/**
 * Relationship types
 */
export type RelationType = 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany';

/**
 * Order direction for queries
 */
export type OrderDirection = 'asc' | 'desc';

/**
 * Field metadata configuration
 */
export interface FieldMetadata {
  /** Field type */
  type: FieldType;

  /** Display label for forms */
  label?: string;

  /** Placeholder text */
  placeholder?: string;

  /** Help text for forms */
  helpText?: string;

  /** Whether field is required */
  required?: boolean;

  /** Whether field is primary key */
  primaryKey?: boolean;

  /** Whether field is unique */
  unique?: boolean;

  /** Default value */
  default?: any;

  /** Zod validation schema */
  validation?: z.ZodType<any>;

  /** Whether field is hidden from JSON serialization */
  hidden?: boolean;

  /** Whether field is readonly */
  readonly?: boolean;

  /** Whether field is searchable */
  searchable?: boolean;

  /** Whether field is sortable */
  sortable?: boolean;

  /** Whether field is filterable */
  filterable?: boolean;

  /** Custom getter function */
  get?: (value: any) => any;

  /** Custom setter function */
  set?: (value: any) => any;

  /** Enum values (for enum type) */
  enumValues?: string[] | readonly string[];

  /** Minimum value (for number/integer) */
  min?: number;

  /** Maximum value (for number/integer) */
  max?: number;

  /** Min length (for string/text) */
  minLength?: number;

  /** Max length (for string/text) */
  maxLength?: number;

  /** Regex pattern (for string validation) */
  pattern?: RegExp | string;

  /** Custom validation function */
  customValidation?: (value: any) => boolean | string;

  /** Additional metadata for custom use */
  meta?: Record<string, any>;
}

/**
 * Relationship metadata configuration
 */
export interface RelationMetadata {
  /** Type of relationship */
  type: RelationType;

  /** Related model name or constructor */
  model: string | (new () => any);

  /** Foreign key field name */
  foreignKey?: string;

  /** Local key field name (usually 'id') */
  localKey?: string;

  /** Pivot table name (for belongsToMany) */
  through?: string;

  /** Pivot foreign key (for belongsToMany) */
  pivotForeignKey?: string;

  /** Pivot related key (for belongsToMany) */
  pivotRelatedKey?: string;

  /** Whether to eager load by default */
  eagerLoad?: boolean;

  /** Additional metadata */
  meta?: Record<string, any>;
}

/**
 * Model metadata registry
 */
export interface ModelMetadata {
  /** Model name */
  name: string;

  /** Table/collection name */
  tableName: string;

  /** Field definitions */
  fields: Map<string, FieldMetadata>;

  /** Relationship definitions */
  relations: Map<string, RelationMetadata>;

  /** Hidden fields (excluded from JSON) */
  hidden: Set<string>;

  /** Appended computed properties */
  appends: Set<string>;

  /** Default eager loaded relations */
  with: Set<string>;

  /** Timestamps enabled */
  timestamps: boolean;

  /** Primary key field name */
  primaryKey: string;

  /** Soft deletes enabled */
  softDeletes: boolean;
}

/**
 * Query builder options
 */
export interface QueryOptions {
  /** Relations to eager load */
  with?: string[];

  /** Where conditions */
  where?: Record<string, any>;

  /** Order by clauses */
  orderBy?: Array<{ field: string; direction: OrderDirection }>;

  /** Limit results */
  limit?: number;

  /** Offset/skip results */
  offset?: number;

  /** Skip results (alias for offset) */
  skip?: number;

  /** Select specific fields */
  select?: string[];

  /** Include soft deleted records */
  withTrashed?: boolean;

  /** Only soft deleted records */
  onlyTrashed?: boolean;
}

/**
 * Prisma-compatible where conditions
 */
export type WhereCondition = Record<string, any>;

/**
 * Model instance with data
 */
export interface ModelInstance<T = any> {
  /** Get field value */
  get(field: string): any;

  /** Set field value */
  set(field: string, value: any): void;

  /** Update multiple fields */
  update(data: Partial<T>): Promise<this>;

  /** Delete the record */
  delete(): Promise<boolean>;

  /** Save changes */
  save(): Promise<this>;

  /** Reload from database */
  reload(): Promise<this>;

  /** Convert to JSON */
  toJSON(): Record<string, any>;

  /** Convert to plain object */
  toObject(): T;

  /** Load relationships */
  load(...relations: string[]): Promise<this>;
}

/**
 * Static model interface for queries
 */
export interface ModelStatic<T = any> {
  /** Create a new instance */
  create(data: Partial<T>): Promise<T>;

  /** Find by primary key */
  find(id: string | number): Promise<T | null>;

  /** Find by primary key or throw */
  findOrFail(id: string | number): Promise<T>;

  /** Find first matching record */
  findOne(where: WhereCondition): Promise<T | null>;

  /** Find all matching records */
  findMany(where?: WhereCondition): Promise<T[]>;

  /** Get all records */
  all(): Promise<T[]>;

  /** Start query builder */
  query(): any; // QueryBuilder type

  /** Shorthand for query().limit(n) */
  fetch(limit: number): any; // QueryBuilder type

  /** Get field metadata */
  getField(name: string): FieldMetadata | undefined;

  /** Get all fields */
  getAllFields(): Map<string, FieldMetadata>;

  /** Get relation metadata */
  getRelation(name: string): RelationMetadata | undefined;

  /** Get all relations */
  getAllRelations(): Map<string, RelationMetadata>;

  /** Validate data against model schema */
  validate(data: Partial<T>): T;

  /** Get validation schema */
  getValidationSchema(): z.ZodObject<any>;
}

/**
 * Decorator metadata storage key
 */
export const METADATA_KEY = Symbol('ottabase:model:metadata');

/**
 * Field decorator metadata key
 */
export const FIELD_METADATA_KEY = Symbol('ottabase:field:metadata');

/**
 * Relation decorator metadata key
 */
export const RELATION_METADATA_KEY = Symbol('ottabase:relation:metadata');
