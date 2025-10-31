import { z } from 'zod';

// Import Prisma dynamically to avoid build-time errors
let prisma: any;
try {
  prisma = require('@ottabase/db').prisma;
} catch (e) {
  // Prisma client not generated yet
  prisma = null;
}
import type {
  FieldMetadata,
  RelationMetadata,
  QueryOptions,
  WhereCondition,
} from './types';
import { QueryBuilder } from './QueryBuilder';
import { modelRegistry } from '../metadata/ModelRegistry';

/**
 * Base Model class that all models should extend
 *
 * Provides ActiveRecord-style interface with:
 * - Fluent query builder
 * - Relationships
 * - Validation
 * - Serialization
 * - CRUD operations
 *
 * @example
 * ```typescript
 * @Model({ tableName: 'posts' })
 * class Post extends BaseModel<Post> {
 *   @Field({ type: 'string', required: true })
 *   title!: string;
 *
 *   @HasMany('Tag')
 *   tags?: Tag[];
 * }
 *
 * const posts = await Post.query()
 *   .with('tags')
 *   .where('published', true)
 *   .get();
 * ```
 */
export abstract class BaseModel<T = any> {
  // Internal state
  private _attributes: Record<string, any> = {};
  private _original: Record<string, any> = {};
  private _relations: Record<string, any> = {};
  private _isDirty = false;
  private _exists = false;

  // Static metadata (populated by decorators)
  static _fields: Map<string, FieldMetadata>;
  static _relations: Map<string, RelationMetadata>;
  static _hidden: Set<string>;
  static _appends: Set<string>;
  static _modelOptions: any;

  constructor(data?: Partial<T>) {
    if (data) {
      this.fill(data);
      this._exists = true;
      this._original = { ...this._attributes };
    }
  }

  /**
   * Get model name
   */
  static getModelName(): string {
    return this.name;
  }

  /**
   * Get table name from metadata
   */
  static getTableName(): string {
    const metadata = modelRegistry.getModel(this.name);
    return metadata?.tableName || this.name.toLowerCase();
  }

  /**
   * Get primary key field name
   */
  static getPrimaryKey(): string {
    const metadata = modelRegistry.getModel(this.name);
    return metadata?.primaryKey || 'id';
  }

  /**
   * Get Prisma delegate for this model
   */
  protected static getPrismaDelegate(): any {
    const tableName = this.getTableName();
    return (prisma as any)[tableName];
  }

  /**
   * Get field metadata
   */
  static getField(name: string): FieldMetadata | undefined {
    const metadata = modelRegistry.getModel(this.name);
    return metadata?.fields.get(name);
  }

  /**
   * Get all fields
   */
  static getAllFields(): Map<string, FieldMetadata> {
    const metadata = modelRegistry.getModel(this.name);
    return metadata?.fields || new Map();
  }

  /**
   * Get relation metadata
   */
  static getRelation(name: string): RelationMetadata | undefined {
    const metadata = modelRegistry.getModel(this.name);
    return metadata?.relations.get(name);
  }

  /**
   * Get all relations
   */
  static getAllRelations(): Map<string, RelationMetadata> {
    const metadata = modelRegistry.getModel(this.name);
    return metadata?.relations || new Map();
  }

  /**
   * Create a new query builder
   */
  static query<M extends BaseModel>(): QueryBuilder<M> {
    return new QueryBuilder<M>(this, async (options: QueryOptions) => {
      return this.executeQuery(options);
    });
  }

  /**
   * Shorthand for query().limit(n)
   */
  static fetch<M extends BaseModel>(limit: number): QueryBuilder<M> {
    return this.query<M>().limit(limit);
  }

  /**
   * Execute a query with options
   */
  protected static async executeQuery<M extends BaseModel>(
    options: QueryOptions
  ): Promise<M[]> {
    const delegate = this.getPrismaDelegate();
    if (!delegate) {
      throw new Error(`No Prisma delegate found for model ${this.name}`);
    }

    // Build Prisma query
    const query: any = {};

    // Where conditions
    if (options.where) {
      query.where = options.where;
    }

    // Include relations
    if (options.with && options.with.length > 0) {
      query.include = {};
      for (const relation of options.with) {
        query.include[relation] = true;
      }
    }

    // Order by
    if (options.orderBy && options.orderBy.length > 0) {
      query.orderBy = options.orderBy.map((o) => ({
        [o.field]: o.direction,
      }));
    }

    // Limit
    if (options.limit !== undefined) {
      query.take = options.limit;
    }

    // Offset/skip
    if (options.offset !== undefined) {
      query.skip = options.offset;
    } else if (options.skip !== undefined) {
      query.skip = options.skip;
    }

    // Select fields
    if (options.select && options.select.length > 0) {
      query.select = {};
      for (const field of options.select) {
        query.select[field] = true;
      }
    }

    // Execute query
    const results = await delegate.findMany(query);

    // Convert to model instances
    return results.map((data: any) => new (this as any)(data));
  }

  /**
   * Find by primary key
   */
  static async find<M extends BaseModel>(
    id: string | number
  ): Promise<M | null> {
    const delegate = this.getPrismaDelegate();
    const primaryKey = this.getPrimaryKey();

    const result = await delegate.findUnique({
      where: { [primaryKey]: id },
    });

    return result ? new (this as any)(result) : null;
  }

  /**
   * Find by primary key or throw
   */
  static async findOrFail<M extends BaseModel>(
    id: string | number
  ): Promise<M> {
    const result = await this.find<M>(id);
    if (!result) {
      throw new Error(`${this.name} with id ${id} not found`);
    }
    return result;
  }

  /**
   * Find first matching record
   */
  static async findOne<M extends BaseModel>(
    where: WhereCondition
  ): Promise<M | null> {
    return this.query<M>().where(where).first();
  }

  /**
   * Find all matching records
   */
  static async findMany<M extends BaseModel>(
    where?: WhereCondition
  ): Promise<M[]> {
    const builder = this.query<M>();
    if (where) {
      builder.where(where);
    }
    return builder.get();
  }

  /**
   * Get all records
   */
  static async all<M extends BaseModel>(): Promise<M[]> {
    return this.query<M>().get();
  }

  /**
   * Create a new record
   */
  static async create<M extends BaseModel>(data: any): Promise<M> {
    const delegate = this.getPrismaDelegate();

    // Validate data
    const validated = this.validate(data);

    // Create record
    const result = await delegate.create({
      data: validated,
    });

    return new (this as any)(result);
  }

  /**
   * Create multiple records
   */
  static async createMany<M extends BaseModel>(
    data: any[]
  ): Promise<number> {
    const delegate = this.getPrismaDelegate();

    const validated = data.map((item) => this.validate(item));

    const result = await delegate.createMany({
      data: validated,
    });

    return result.count;
  }

  /**
   * Update records matching condition
   */
  static async updateMany(
    where: WhereCondition,
    data: any
  ): Promise<number> {
    const delegate = this.getPrismaDelegate();

    const result = await delegate.updateMany({
      where,
      data,
    });

    return result.count;
  }

  /**
   * Delete records matching condition
   */
  static async deleteMany(where: WhereCondition): Promise<number> {
    const delegate = this.getPrismaDelegate();

    const result = await delegate.deleteMany({
      where,
    });

    return result.count;
  }

  /**
   * Validate data against model schema
   */
  static validate(data: any): any {
    // TODO: Implement Zod validation based on field metadata
    // For now, just return data as-is
    return data;
  }

  /**
   * Get validation schema
   */
  static getValidationSchema(): z.ZodObject<any> {
    const fields = this.getAllFields();
    const shape: Record<string, z.ZodType<any>> = {};

    for (const [name, metadata] of fields.entries()) {
      if (metadata.validation) {
        shape[name] = metadata.validation;
      } else {
        // Auto-generate Zod schema based on field type
        let schema: z.ZodType<any> = z.any();

        switch (metadata.type) {
          case 'string':
          case 'text':
          case 'email':
          case 'url':
            schema = z.string();
            if (metadata.minLength) schema = (schema as z.ZodString).min(metadata.minLength);
            if (metadata.maxLength) schema = (schema as z.ZodString).max(metadata.maxLength);
            if (metadata.pattern) schema = (schema as z.ZodString).regex(new RegExp(metadata.pattern));
            if (metadata.type === 'email') schema = (schema as z.ZodString).email();
            if (metadata.type === 'url') schema = (schema as z.ZodString).url();
            break;
          case 'number':
          case 'integer':
          case 'float':
          case 'decimal':
            schema = z.number();
            if (metadata.type === 'integer') schema = (schema as z.ZodNumber).int();
            if (metadata.min !== undefined) schema = (schema as z.ZodNumber).min(metadata.min);
            if (metadata.max !== undefined) schema = (schema as z.ZodNumber).max(metadata.max);
            break;
          case 'boolean':
            schema = z.boolean();
            break;
          case 'date':
          case 'datetime':
          case 'timestamp':
            schema = z.date();
            break;
          case 'array':
            schema = z.array(z.any());
            break;
          case 'json':
            schema = z.record(z.any());
            break;
          case 'enum':
            if (metadata.enumValues) {
              schema = z.enum(metadata.enumValues as [string, ...string[]]);
            }
            break;
        }

        if (!metadata.required) {
          schema = schema.optional();
        }

        shape[name] = schema;
      }
    }

    return z.object(shape);
  }

  // Instance methods

  /**
   * Fill model with data
   */
  fill(data: Partial<T>): this {
    for (const [key, value] of Object.entries(data)) {
      this.setAttribute(key, value);
    }
    return this;
  }

  /**
   * Get attribute value
   */
  get(field: string): any {
    const metadata = (this.constructor as any).getField(field);

    let value = this._attributes[field];

    // Apply getter if defined
    if (metadata?.get) {
      value = metadata.get(value);
    }

    return value;
  }

  /**
   * Set attribute value
   */
  set(field: string, value: any): void {
    this.setAttribute(field, value);
  }

  /**
   * Set attribute value (internal)
   */
  protected setAttribute(field: string, value: any): void {
    const metadata = (this.constructor as any).getField(field);

    // Apply setter if defined
    if (metadata?.set) {
      value = metadata.set(value);
    }

    this._attributes[field] = value;
    this._isDirty = true;
  }

  /**
   * Update and save
   */
  async update(data: Partial<T>): Promise<this> {
    this.fill(data);
    return this.save();
  }

  /**
   * Save changes to database
   */
  async save(): Promise<this> {
    const delegate = (this.constructor as any).getPrismaDelegate();
    const primaryKey = (this.constructor as any).getPrimaryKey();
    const id = this._attributes[primaryKey];

    if (this._exists && id) {
      // Update existing record
      const result = await delegate.update({
        where: { [primaryKey]: id },
        data: this._attributes,
      });
      this.fill(result);
    } else {
      // Create new record
      const result = await delegate.create({
        data: this._attributes,
      });
      this.fill(result);
      this._exists = true;
    }

    this._original = { ...this._attributes };
    this._isDirty = false;

    return this;
  }

  /**
   * Delete the record
   */
  async delete(): Promise<boolean> {
    const delegate = (this.constructor as any).getPrismaDelegate();
    const primaryKey = (this.constructor as any).getPrimaryKey();
    const id = this._attributes[primaryKey];

    if (!id) {
      throw new Error('Cannot delete record without primary key');
    }

    await delegate.delete({
      where: { [primaryKey]: id },
    });

    this._exists = false;
    return true;
  }

  /**
   * Reload from database
   */
  async reload(): Promise<this> {
    const primaryKey = (this.constructor as any).getPrimaryKey();
    const id = this._attributes[primaryKey];

    if (!id) {
      throw new Error('Cannot reload record without primary key');
    }

    const result = await (this.constructor as any).find(id);
    if (result) {
      this.fill(result._attributes);
      this._original = { ...this._attributes };
      this._isDirty = false;
    }

    return this;
  }

  /**
   * Load relationships
   */
  async load(...relations: string[]): Promise<this> {
    const delegate = (this.constructor as any).getPrismaDelegate();
    const primaryKey = (this.constructor as any).getPrimaryKey();
    const id = this._attributes[primaryKey];

    if (!id) {
      throw new Error('Cannot load relations without primary key');
    }

    const include: any = {};
    for (const relation of relations) {
      include[relation] = true;
    }

    const result = await delegate.findUnique({
      where: { [primaryKey]: id },
      include,
    });

    if (result) {
      // Store relations
      for (const relation of relations) {
        this._relations[relation] = result[relation];
      }
    }

    return this;
  }

  /**
   * Convert to JSON (respects hidden and appends)
   */
  toJSON(): Record<string, any> {
    const metadata = modelRegistry.getModel(this.constructor.name);
    const json: Record<string, any> = {};

    // Add regular attributes
    for (const [key, value] of Object.entries(this._attributes)) {
      if (!metadata?.hidden.has(key)) {
        json[key] = value;
      }
    }

    // Add relations
    for (const [key, value] of Object.entries(this._relations)) {
      json[key] = value;
    }

    // Add appends (computed properties)
    if (metadata?.appends) {
      for (const key of metadata.appends) {
        const getter = Object.getOwnPropertyDescriptor(
          Object.getPrototypeOf(this),
          key
        )?.get;
        if (getter) {
          json[key] = getter.call(this);
        }
      }
    }

    return json;
  }

  /**
   * Convert to plain object
   */
  toObject(): T {
    return { ...this._attributes, ...this._relations } as T;
  }

  /**
   * Check if model has been modified
   */
  isDirty(): boolean {
    return this._isDirty;
  }

  /**
   * Check if model exists in database
   */
  exists(): boolean {
    return this._exists;
  }
}
