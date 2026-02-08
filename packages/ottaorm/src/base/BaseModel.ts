// ============================================================
// @ottabase/ottaorm - Base Model (Fat Model Pattern)
// ============================================================
// SQL-specific implementation using Drizzle ORM
// ============================================================

import type { DbDriver } from '@ottabase/db/drizzle';
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { getConnection } from '../context';
import {
    AbstractBaseModel,
    ModelFieldDescriptor,
    ModelFieldType,
    ModelFields,
    PackageType,
    PaginationResult,
} from './AbstractBaseModel';

export interface IModelConstructorParams {
    entity: string;
    data: { [key: string]: any };
}

// Re-export types
export type { ModelFieldDescriptor, ModelFieldType, ModelFields, PackageType, PaginationResult };

/**
 * Type guard to check if a connection is a SQL driver
 */
function isSqlDriver(driver: any): driver is DbDriver {
    return driver && typeof driver.getDb === 'function';
}

/**
 * Base Model class - Fat Model Pattern for SQL databases
 *
 * All metadata lives in the model class as static properties:
 * - entity: table name
 * - table: Drizzle table definition
 * - primaryKey: primary key field name
 * - connection: database connection name (default: 'default')
 * - casts: type casting rules
 * - connect: relationship definitions
 * - with: default eager loading
 * - fields: complete field metadata
 * - validationRules: validation rules
 * - defaults: default values
 *
 * @example
 * ```typescript
 * export class Post extends BaseModel {
 *   static entity = "posts";
 *   static table = postsTable;
 *   static primaryKey = "id";
 *   static connection = "default";  // Optional, this is the default
 *
 *   static casts = {
 *     createdAt: 'date',
 *     published: 'boolean'
 *   };
 *
 *   static connect = [
 *     'author:id{name,email}',
 *     'tags[]:id{name,slug}>join:tag,model:Tag'
 *   ];
 *
 *   static fields: ModelFields = {
 *     title: {
 *       type: 'string',
 *       searchable: true,
 *       uiConfig: { label: 'Title' }
 *     }
 *   };
 * }
 * ```
 */
export class BaseModel extends AbstractBaseModel {
    // SQL-specific static property
    static table: SQLiteTable;

    constructor(params: IModelConstructorParams) {
        super();
        this.fill(params.data);
    }

    // ============================================================
    // STATIC QUERY METHODS
    // ============================================================

    /**
     * Get table definition
     */
    protected static getTable(): SQLiteTable {
        if (!this.table) {
            throw new Error(`Table not defined for ${this.entity}`);
        }
        return this.table;
    }

    /**
     * Get database driver for this model's connection
     * Uses the connection specified in static connection property
     */
    protected static getDriver(driver?: DbDriver): DbDriver {
        if (driver) return driver;

        const connection = getConnection(this.connection);
        if (!isSqlDriver(connection)) {
            throw new Error(
                `Connection '${this.connection}' is not a SQL driver for model ${this.entity}. ` +
                    `Make sure you registered a SQL driver (e.g., D1Driver) for this connection.`,
            );
        }
        return connection;
    }

    /**
     * Find record by primary key
     */
    static async find<T extends typeof BaseModel>(
        this: T,
        id: string | number,
        driver?: DbDriver,
    ): Promise<InstanceType<T> | null> {
        const db = this.getDriver(driver).getDb();
        const table = this.getTable();
        const pkColumn = (table as any)[this.primaryKey];

        if (!pkColumn) {
            throw new Error(`Primary key column ${this.primaryKey} not found in table ${this.entity}`);
        }

        const results = await db.select().from(table).where(eq(pkColumn, id)).limit(1);

        if (results.length === 0) return null;

        return new this({
            entity: this.entity,
            data: results[0],
        }) as InstanceType<T>;
    }

    /**
     * Get first record matching conditions
     */
    static async first<T extends typeof BaseModel>(
        this: T,
        where?: Record<string, any>,
        driver?: DbDriver,
    ): Promise<InstanceType<T> | null> {
        const db = this.getDriver(driver).getDb();
        const table = this.getTable();

        let query = db.select().from(table);

        if (where) {
            const conditions = this.buildWhereConditions(where);
            if (conditions.length > 0) {
                query = query.where(and(...conditions));
            }
        }

        const results = await query.limit(1);

        if (results.length === 0) return null;

        return new this({
            entity: this.entity,
            data: results[0],
        }) as InstanceType<T>;
    }

    /**
     * Get all records matching conditions
     */
    static async where<T extends typeof BaseModel>(
        this: T,
        where: Record<string, any>,
        options?: {
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
            limit?: number;
            offset?: number;
        },
        driver?: DbDriver,
    ): Promise<InstanceType<T>[]> {
        const db = this.getDriver(driver).getDb();
        const table = this.getTable();

        let query = db.select().from(table);

        // Apply where conditions
        const conditions = this.buildWhereConditions(where);
        if (conditions.length > 0) {
            query = query.where(and(...conditions));
        }

        // Apply ordering
        if (options?.orderBy) {
            const orderColumn = (table as any)[options.orderBy];
            if (orderColumn) {
                query = query.orderBy(options.orderDirection === 'desc' ? desc(orderColumn) : asc(orderColumn));
            }
        }

        // Apply limit/offset
        if (options?.limit) {
            query = query.limit(options.limit);
        }
        if (options?.offset) {
            query = query.offset(options.offset);
        }

        const results = await query;

        return results.map((row: any) => new this({ entity: this.entity, data: row }) as InstanceType<T>);
    }

    /**
     * Get all records where a field is in an array of values
     */
    static async whereIn<T extends typeof BaseModel>(
        this: T,
        field: string,
        values: any[],
        options?: {
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
            limit?: number;
            offset?: number;
        },
        driver?: DbDriver,
    ): Promise<InstanceType<T>[]> {
        const db = this.getDriver(driver).getDb();
        const table = this.getTable();

        const fieldColumn = (table as any)[field];
        if (!fieldColumn) {
            throw new Error(`Field "${field}" does not exist on table "${this.entity}"`);
        }

        let query = db.select().from(table).where(inArray(fieldColumn, values));

        // Apply ordering
        if (options?.orderBy) {
            const orderColumn = (table as any)[options.orderBy];
            if (orderColumn) {
                query = query.orderBy(options.orderDirection === 'desc' ? desc(orderColumn) : asc(orderColumn));
            }
        }

        // Apply limit/offset
        if (options?.limit) {
            query = query.limit(options.limit);
        }
        if (options?.offset) {
            query = query.offset(options.offset);
        }

        const results = await query;

        return results.map((row: any) => new this({ entity: this.entity, data: row }) as InstanceType<T>);
    }

    /**
     * Get all records
     */
    static async all<T extends typeof BaseModel>(
        this: T,
        options?: {
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
            limit?: number;
            offset?: number;
        },
        driver?: DbDriver,
    ): Promise<InstanceType<T>[]> {
        return this.where({}, options, driver);
    }

    /**
     * Check if a value is unique for a field, optionally scoped and excluding an id.
     */
    static async isUnique<T extends typeof BaseModel>(
        this: T,
        field: string,
        value: unknown,
        options?: {
            where?: Record<string, any>;
            ignoreId?: string | number;
            driver?: DbDriver;
        },
    ): Promise<boolean> {
        const db = this.getDriver(options?.driver).getDb();
        const table = this.getTable();
        const column = (table as any)[field];

        if (!column) {
            throw new Error(`Field '${field}' not found on model ${this.entity}`);
        }

        const conditions: any[] = [eq(column, value)];

        if (options?.where) {
            conditions.push(...this.buildWhereConditions(options.where));
        }

        if (options?.ignoreId !== undefined && options?.ignoreId !== null) {
            const pkColumn = (table as any)[this.primaryKey];
            if (pkColumn) {
                conditions.push(ne(pkColumn, options.ignoreId));
            }
        }

        const results = await db
            .select({ id: (table as any)[this.primaryKey] })
            .from(table)
            .where(and(...conditions))
            .limit(1);

        return results.length === 0;
    }

    /**
     * Build where conditions for Drizzle
     */
    protected static buildWhereConditions(where: Record<string, any>): any[] {
        const table = this.getTable();
        const conditions: any[] = [];

        for (const [key, value] of Object.entries(where)) {
            const column = (table as any)[key];
            if (!column) continue;

            if (value === null) {
                continue; // Skip null values
            }

            if (Array.isArray(value)) {
                if (value.length > 0) {
                    conditions.push(inArray(column, value));
                }
                continue;
            }

            conditions.push(eq(column, value));
        }

        return conditions;
    }

    /**
     * Prepare data for database operations
     * Converts string dates to Date objects based on model casts
     */
    protected static prepareForDatabase(data: Record<string, any>): Record<string, any> {
        const prepared = { ...data };

        if (this.casts) {
            for (const [key, castType] of Object.entries(this.casts)) {
                if (prepared[key] === undefined || prepared[key] === null) continue;

                const value = prepared[key];

                // For date/datetime casts, convert to Unix timestamp for SQLite
                if (castType === 'date' || castType === 'datetime') {
                    if (value instanceof Date) {
                        // Convert Date to Unix timestamp (milliseconds)
                        prepared[key] = value.getTime();
                        continue;
                    }

                    if (typeof value === 'string') {
                        // Parse string to Date and convert to timestamp
                        const date = new Date(value);
                        if (!isNaN(date.getTime())) {
                            prepared[key] = date.getTime();
                        }
                    } else if (typeof value === 'number') {
                        // Already a timestamp, leave as-is
                        continue;
                    }
                }
            }
        }

        return prepared;
    }

    /**
     * Create a new record
     */
    static async create<T extends typeof BaseModel>(
        this: T,
        data: Record<string, any>,
        driver?: DbDriver,
    ): Promise<InstanceType<T>> {
        const db = this.getDriver(driver).getDb();
        const table = this.getTable();

        // Merge with defaults and prepare for database
        const createData = this.prepareForDatabase({ ...this.defaults, ...data });

        // Cloudflare Workers (workerd) disallows random generation in module/global scope,
        // so model schemas avoid crypto.randomUUID() defaults. Generate ids at runtime.
        if (this.primaryKey === 'id' && (createData.id === undefined || createData.id === null)) {
            const uuidFn = globalThis.crypto?.randomUUID;
            if (typeof uuidFn !== 'function') {
                throw new Error(`Missing id for ${this.entity} and crypto.randomUUID is unavailable`);
            }
            createData.id = uuidFn.call(globalThis.crypto);
        }

        const result = await db.insert(table).values(createData).returning();

        if (result.length === 0) {
            throw new Error(`Failed to create ${this.entity}`);
        }

        return new this({
            entity: this.entity,
            data: result[0],
        }) as InstanceType<T>;
    }

    /**
     * Update a record by primary key
     */
    static async update<T extends typeof BaseModel>(
        this: T,
        id: string | number,
        data: Record<string, any>,
        driver?: DbDriver,
    ): Promise<InstanceType<T>> {
        const db = this.getDriver(driver).getDb();
        const table = this.getTable();
        const pkColumn = (table as any)[this.primaryKey];

        if (!pkColumn) {
            throw new Error(`Primary key column ${this.primaryKey} not found`);
        }

        // Auto-add updatedAt if model has it in casts and value not provided
        if (this.casts && this.casts.updatedAt && data.updatedAt === undefined) {
            data.updatedAt = Date.now();
        }

        // Prepare data for database (convert string dates, etc.)
        const updateData = this.prepareForDatabase(data);

        const result = await db.update(table).set(updateData).where(eq(pkColumn, id)).returning();

        if (result.length === 0) {
            throw new Error(`Failed to update ${this.entity} with id ${id}`);
        }

        return new this({
            entity: this.entity,
            data: result[0],
        }) as InstanceType<T>;
    }

    /**
     * Delete a record by primary key
     */
    static async delete(id: string | number, driver?: DbDriver): Promise<boolean> {
        const db = this.getDriver(driver).getDb();
        const table = this.getTable();
        const pkColumn = (table as any)[this.primaryKey];

        if (!pkColumn) {
            throw new Error(`Primary key column ${this.primaryKey} not found`);
        }

        await db.delete(table).where(eq(pkColumn, id));

        return true;
    }

    /**
     * Count records matching conditions
     */
    static async count(where?: Record<string, any>, driver?: DbDriver): Promise<number> {
        const db = this.getDriver(driver).getDb();
        const table = this.getTable();

        let query = db.select().from(table);

        if (where) {
            const conditions = this.buildWhereConditions(where);
            if (conditions.length > 0) {
                query = query.where(and(...conditions));
            }
        }

        const results = await query;
        return results.length;
    }

    /**
     * Paginate results
     */
    static async paginate<T extends typeof BaseModel>(
        this: T,
        page: number = 1,
        perPage: number = 15,
        where?: Record<string, any>,
        options?: { orderBy?: string; orderDirection?: 'asc' | 'desc' },
        driver?: DbDriver,
    ): Promise<PaginationResult<InstanceType<T>>> {
        const offset = (page - 1) * perPage;

        const [data, total] = await Promise.all([
            this.where(where || {}, { ...options, limit: perPage, offset }, driver),
            this.count(where, driver),
        ]);

        const totalPages = Math.ceil(total / perPage);

        return {
            data,
            total,
            page,
            perPage,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        };
    }

    // ============================================================
    // INSTANCE METHODS
    // ============================================================

    /**
     * Save instance (create or update)
     */
    async save(driver?: DbDriver): Promise<this> {
        const ModelClass = this.constructor as typeof BaseModel;
        const pk = this.get(ModelClass.primaryKey);

        if (pk) {
            // Update existing
            const updated = await ModelClass.update(pk, this.attributes, driver);
            this.fill(updated.attributes);
        } else {
            // Create new
            const created = await ModelClass.create(this.attributes, driver);
            this.fill(created.attributes);
        }

        return this;
    }

    /**
     * Delete instance
     */
    async destroy(driver?: DbDriver): Promise<boolean> {
        const ModelClass = this.constructor as typeof BaseModel;
        const pk = this.get(ModelClass.primaryKey);

        if (!pk) {
            throw new Error('Cannot delete record without primary key');
        }

        return ModelClass.delete(pk, driver);
    }

    /**
     * Reload instance from database
     */
    async refresh(driver?: DbDriver): Promise<this> {
        const ModelClass = this.constructor as typeof BaseModel;
        const pk = this.get(ModelClass.primaryKey);

        if (!pk) {
            throw new Error('Cannot refresh record without primary key');
        }

        const fresh = await ModelClass.find(pk, driver);

        if (!fresh) {
            throw new Error(`Record not found: ${ModelClass.entity}#${pk}`);
        }

        this.fill(fresh.attributes);
        return this;
    }

    // ============================================================
    // RELATIONSHIP HELPERS (Instance Methods)
    // ============================================================

    /**
     * BelongsTo relationship (many-to-one)
     *
     * @example
     * ```typescript
     * // Simple (auto-selects all fields)
     * async author() {
     *   return this.belongsTo(User, 'authorId');
     * }
     *
     * // With field selection (performance optimization)
     * async author() {
     *   return this.belongsTo(User, 'authorId', {
     *     select: ['id', 'name', 'email', 'image']
     *   });
     * }
     *
     * // Custom owner key (default is 'id')
     * async author() {
     *   return this.belongsTo(User, 'authorId', { ownerKey: 'uuid' });
     * }
     * ```
     */
    protected async belongsTo<T extends typeof BaseModel>(
        relatedModel: T,
        foreignKey: string,
        options?: {
            ownerKey?: string; // Primary key in related model (default: relatedModel.primaryKey)
            select?: string[]; // Fields to select from related model
            driver?: DbDriver;
        },
    ): Promise<InstanceType<T> | null> {
        const foreignValue = this.get(foreignKey);

        if (!foreignValue) {
            return null;
        }

        const ownerKey = options?.ownerKey || relatedModel.primaryKey;
        const driver = options?.driver || relatedModel.getDriver();
        const db = driver.getDb();
        const table = relatedModel.getTable();

        let query = db.select().from(table);

        // Apply field selection if specified
        if (options?.select && options.select.length > 0) {
            const selectObj: any = {};
            for (const field of options.select) {
                const column = (table as any)[field];
                if (column) {
                    selectObj[field] = column;
                }
            }
            query = db.select(selectObj).from(table);
        }

        const pkColumn = (table as any)[ownerKey];
        if (!pkColumn) {
            throw new Error(`Owner key ${ownerKey} not found in ${relatedModel.entity}`);
        }

        const results = await query.where(eq(pkColumn, foreignValue)).limit(1);

        if (results.length === 0) return null;

        return new relatedModel({
            entity: relatedModel.entity,
            data: results[0],
        }) as InstanceType<T>;
    }

    /**
     * HasMany relationship (one-to-many)
     *
     * @example
     * ```typescript
     * // Simple
     * async comments() {
     *   return this.hasMany(Comment, 'postId');
     * }
     *
     * // With field selection
     * async comments() {
     *   return this.hasMany(Comment, 'postId', {
     *     select: ['id', 'content', 'createdAt']
     *   });
     * }
     *
     * // With ordering
     * async comments() {
     *   return this.hasMany(Comment, 'postId', {
     *     orderBy: 'createdAt',
     *     orderDirection: 'desc'
     *   });
     * }
     * ```
     */
    protected async hasMany<T extends typeof BaseModel>(
        relatedModel: T,
        foreignKey: string,
        options?: {
            localKey?: string; // Primary key in this model (default: this.constructor.primaryKey)
            select?: string[]; // Fields to select from related model
            orderBy?: string; // Field to order by
            orderDirection?: 'asc' | 'desc';
            limit?: number; // Limit results
            driver?: DbDriver;
        },
    ): Promise<InstanceType<T>[]> {
        const ModelClass = this.constructor as typeof BaseModel;
        const localKey = options?.localKey || ModelClass.primaryKey;
        const localValue = this.get(localKey);

        if (!localValue) {
            return [];
        }

        const driver = options?.driver || relatedModel.getDriver();
        const db = driver.getDb();
        const table = relatedModel.getTable();

        let query = db.select().from(table);

        // Apply field selection if specified
        if (options?.select && options.select.length > 0) {
            const selectObj: any = {};
            for (const field of options.select) {
                const column = (table as any)[field];
                if (column) {
                    selectObj[field] = column;
                }
            }
            query = db.select(selectObj).from(table);
        }

        const fkColumn = (table as any)[foreignKey];
        if (!fkColumn) {
            throw new Error(`Foreign key ${foreignKey} not found in ${relatedModel.entity}`);
        }

        query = query.where(eq(fkColumn, localValue));

        // Apply ordering
        if (options?.orderBy) {
            const orderColumn = (table as any)[options.orderBy];
            if (orderColumn) {
                query = query.orderBy(options.orderDirection === 'desc' ? desc(orderColumn) : asc(orderColumn));
            }
        }

        // Apply limit
        if (options?.limit) {
            query = query.limit(options.limit);
        }

        const results = await query;

        return results.map(
            (row: any) =>
                new relatedModel({
                    entity: relatedModel.entity,
                    data: row,
                }) as InstanceType<T>,
        );
    }

    /**
     * BelongsToMany relationship (many-to-many via pivot table)
     *
     * @example
     * ```typescript
     * // Simple (infers keys from table names)
     * async tags() {
     *   return this.belongsToMany(Tag, postTagsTable);
     * }
     *
     * // With field selection
     * async tags() {
     *   return this.belongsToMany(Tag, postTagsTable, {
     *     select: ['id', 'name', 'slug']
     *   });
     * }
     *
     * // With custom keys
     * async tags() {
     *   return this.belongsToMany(Tag, postTagsTable, {
     *     foreignKey: 'postId',      // key in pivot table
     *     otherKey: 'tagId',         // key in pivot table
     *     localKey: 'id',            // key in this model
     *     relatedKey: 'id'           // key in related model
     *   });
     * }
     *
     * // With ordering
     * async tags() {
     *   return this.belongsToMany(Tag, postTagsTable, {
     *     orderBy: 'name',
     *     orderDirection: 'asc'
     *   });
     * }
     * ```
     */
    protected async belongsToMany<T extends typeof BaseModel>(
        relatedModel: T,
        pivotTable: SQLiteTable,
        options?: {
            foreignKey?: string; // Key in pivot table for this model (default: {entity}Id)
            otherKey?: string; // Key in pivot table for related model (default: {relatedEntity}Id)
            localKey?: string; // Primary key in this model (default: primaryKey)
            relatedKey?: string; // Primary key in related model (default: relatedModel.primaryKey)
            select?: string[]; // Fields to select from related model
            orderBy?: string; // Field to order by
            orderDirection?: 'asc' | 'desc';
            withPivot?: string[]; // Additional pivot fields to include
            driver?: DbDriver;
        },
    ): Promise<InstanceType<T>[]> {
        const ModelClass = this.constructor as typeof BaseModel;
        const localKey = options?.localKey || ModelClass.primaryKey;
        const localValue = this.get(localKey);

        if (!localValue) {
            return [];
        }

        const driver = options?.driver || relatedModel.getDriver();
        const db = driver.getDb();

        // Infer keys from model names if not provided
        const foreignKey = options?.foreignKey || `${ModelClass.entity.toLowerCase()}Id`;
        const otherKey = options?.otherKey || `${relatedModel.entity.toLowerCase()}Id`;
        const relatedKey = options?.relatedKey || relatedModel.primaryKey;

        // Get IDs from pivot table
        const pivotFkColumn = (pivotTable as any)[foreignKey];
        const pivotOtherColumn = (pivotTable as any)[otherKey];

        if (!pivotFkColumn || !pivotOtherColumn) {
            throw new Error(`Keys ${foreignKey} or ${otherKey} not found in pivot table`);
        }

        const pivotRows = await db.select().from(pivotTable).where(eq(pivotFkColumn, localValue));

        if (pivotRows.length === 0) {
            return [];
        }

        // Get related IDs from pivot
        const relatedIds = pivotRows.map((row: any) => row[otherKey]);

        if (relatedIds.length === 0) {
            return [];
        }

        // Fetch related records
        const relatedTable = relatedModel.getTable();
        const relatedPkColumn = (relatedTable as any)[relatedKey];

        if (!relatedPkColumn) {
            throw new Error(`Primary key ${relatedKey} not found in ${relatedModel.entity}`);
        }

        let query = db.select().from(relatedTable);

        // Apply field selection if specified
        if (options?.select && options.select.length > 0) {
            const selectObj: any = {};
            for (const field of options.select) {
                const column = (relatedTable as any)[field];
                if (column) {
                    selectObj[field] = column;
                }
            }
            query = db.select(selectObj).from(relatedTable);
        }

        query = query.where(inArray(relatedPkColumn, relatedIds));

        // Apply ordering
        if (options?.orderBy) {
            const orderColumn = (relatedTable as any)[options.orderBy];
            if (orderColumn) {
                query = query.orderBy(options.orderDirection === 'desc' ? desc(orderColumn) : asc(orderColumn));
            }
        }

        const results = await query;

        // Optionally attach pivot data
        if (options?.withPivot && options.withPivot.length > 0) {
            return results.map((row: any) => {
                const instance = new relatedModel({
                    entity: relatedModel.entity,
                    data: row,
                }) as InstanceType<T>;

                // Find matching pivot row
                const pivotRow = pivotRows.find((pr: any) => pr[otherKey] === row[relatedKey]);

                if (pivotRow) {
                    const pivotData: any = {};
                    for (const field of options.withPivot!) {
                        if (field in pivotRow) {
                            pivotData[field] = pivotRow[field];
                        }
                    }
                    // Store pivot data in a special property
                    (instance as any)._pivot = pivotData;
                }

                return instance;
            });
        }

        return results.map(
            (row: any) =>
                new relatedModel({
                    entity: relatedModel.entity,
                    data: row,
                }) as InstanceType<T>,
        );
    }

    /**
     * HasOne relationship (one-to-one)
     *
     * @example
     * ```typescript
     * async profile() {
     *   return this.hasOne(Profile, 'userId');
     * }
     * ```
     */
    protected async hasOne<T extends typeof BaseModel>(
        relatedModel: T,
        foreignKey: string,
        options?: {
            localKey?: string;
            select?: string[];
            driver?: DbDriver;
        },
    ): Promise<InstanceType<T> | null> {
        const results = await this.hasMany(relatedModel, foreignKey, {
            ...options,
            limit: 1,
        });

        return results.length > 0 ? results[0] : null;
    }
}
