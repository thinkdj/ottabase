// ============================================================
// @ottabase/ottaorm - Base Model (Fat Model Pattern)
// ============================================================
// SQL-specific implementation using Drizzle ORM
// ============================================================

import type { DbDriver } from '@ottabase/db/drizzle';
import { and, asc, desc, eq, inArray, isNotNull, isNull, like, ne, or, sql } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { getConnection } from '../context';
import { ValidationError } from '../validation';
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

    /**
     * Enable soft deletes for this model.
     * When true, `delete()` sets `deletedAt` instead of removing the row,
     * and all queries automatically exclude soft-deleted records.
     * The table must have a `deletedAt` column (integer timestamp or null).
     */
    static softDeletes: boolean = false;

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
     * Return a scoped query object that includes soft-deleted records.
     * Thread-safe: no shared mutable state is used.
     *
     * @example
     * ```typescript
     * const allPosts = await Post.withTrashed().where({});
     * ```
     */
    static withTrashed<T extends typeof BaseModel>(this: T) {
        return {
            find: (id: string | number, driver?: DbDriver) => this.find(id, driver, true),
            first: (where?: Record<string, any>, driver?: DbDriver) => this.first(where, driver, true),
            where: (
                where: Record<string, any>,
                options?: { orderBy?: string; orderDirection?: 'asc' | 'desc'; limit?: number; offset?: number },
                driver?: DbDriver,
            ) => this.where(where, options, driver, true),
            whereIn: (
                field: string,
                values: any[],
                options?: { orderBy?: string; orderDirection?: 'asc' | 'desc'; limit?: number; offset?: number },
                driver?: DbDriver,
            ) => this.whereIn(field, values, options, driver, true),
            all: (
                options?: { orderBy?: string; orderDirection?: 'asc' | 'desc'; limit?: number; offset?: number },
                driver?: DbDriver,
            ) => this.all(options, driver, true),
            count: (where?: Record<string, any>, driver?: DbDriver) => this.count(where, driver, true),
            search: (
                search: string,
                fields: string[],
                where?: Record<string, any>,
                options?: { orderBy?: string; orderDirection?: 'asc' | 'desc'; limit?: number; offset?: number },
                driver?: DbDriver,
            ) => this.search(search, fields, where, options, driver, true),
            searchPaginate: (
                search: string,
                fields: string[],
                page?: number,
                perPage?: number,
                where?: Record<string, any>,
                options?: { orderBy?: string; orderDirection?: 'asc' | 'desc' },
                driver?: DbDriver,
            ) => this.searchPaginate(search, fields, page, perPage, where, options, driver, true),
        };
    }

    /**
     * Query only soft-deleted records.
     *
     * @example
     * ```typescript
     * const deleted = await Post.onlyTrashed({});
     * ```
     */
    static onlyTrashed<T extends typeof BaseModel>(
        this: T,
        where?: Record<string, any>,
        options?: {
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
            limit?: number;
            offset?: number;
        },
        driver?: DbDriver,
    ): Promise<InstanceType<T>[]> {
        const trashedWhere = { ...where, deletedAt: { $ne: null } };
        // includeTrashed = true so the auto-filter doesn't exclude the $ne: null condition
        return this.where(trashedWhere, options, driver, true);
    }

    /**
     * Build the soft-delete exclusion condition if applicable.
     * Pure function — no shared mutable state.
     *
     * @param includeTrashed - When true, skip the soft-delete filter
     */
    protected static getSoftDeleteCondition(includeTrashed?: boolean): ReturnType<typeof isNull> | null {
        if (!this.softDeletes) return null;
        if (includeTrashed) return null;
        const table = this.getTable();
        const deletedAtCol = (table as any).deletedAt;
        if (!deletedAtCol) return null;
        return isNull(deletedAtCol);
    }

    /**
     * Find record by primary key
     */
    static async find<T extends typeof BaseModel>(
        this: T,
        id: string | number,
        driver?: DbDriver,
        includeTrashed?: boolean,
    ): Promise<InstanceType<T> | null> {
        const db = this.getDriver(driver).getDb();
        const table = this.getTable();
        const pkColumn = (table as any)[this.primaryKey];

        if (!pkColumn) {
            throw new Error(`Primary key column ${this.primaryKey} not found in table ${this.entity}`);
        }

        const conditions: any[] = [eq(pkColumn, id)];
        const softDeleteCond = this.getSoftDeleteCondition(includeTrashed);
        if (softDeleteCond) conditions.push(softDeleteCond);

        const results = await db
            .select()
            .from(table)
            .where(and(...conditions))
            .limit(1);

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
        includeTrashed?: boolean,
    ): Promise<InstanceType<T> | null> {
        const db = this.getDriver(driver).getDb();
        const table = this.getTable();

        let query = db.select().from(table);

        const conditions = this.buildWhereConditions(where || {});
        const softDeleteCond = this.getSoftDeleteCondition(includeTrashed);
        if (softDeleteCond) conditions.push(softDeleteCond);

        if (conditions.length > 0) {
            query = query.where(and(...conditions));
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
        includeTrashed?: boolean,
    ): Promise<InstanceType<T>[]> {
        const db = this.getDriver(driver).getDb();
        const table = this.getTable();

        let query = db.select().from(table);

        // Apply where conditions + soft delete filter
        const conditions = this.buildWhereConditions(where);
        const softDeleteCond = this.getSoftDeleteCondition(includeTrashed);
        if (softDeleteCond) conditions.push(softDeleteCond);
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
        includeTrashed?: boolean,
    ): Promise<InstanceType<T>[]> {
        const db = this.getDriver(driver).getDb();
        const table = this.getTable();

        const fieldColumn = (table as any)[field];
        if (!fieldColumn) {
            throw new Error(`Field "${field}" does not exist on table "${this.entity}"`);
        }

        const whereConditions: any[] = [inArray(fieldColumn, values)];
        const softDeleteCond = this.getSoftDeleteCondition(includeTrashed);
        if (softDeleteCond) whereConditions.push(softDeleteCond);

        let query = db
            .select()
            .from(table)
            .where(and(...whereConditions));

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
        includeTrashed?: boolean,
    ): Promise<InstanceType<T>[]> {
        return this.where({}, options, driver, includeTrashed);
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
                conditions.push(isNull(column));
                continue;
            }

            if (Array.isArray(value)) {
                if (value.length > 0) {
                    conditions.push(inArray(column, value));
                }
                continue;
            }

            if (value && typeof value === 'object' && '$ne' in value) {
                const neValue = (value as { $ne: unknown }).$ne;
                // $ne: null → IS NOT NULL (SQL: col != NULL always yields NULL)
                conditions.push(neValue === null ? isNotNull(column) : ne(column, neValue));
                continue;
            }

            conditions.push(eq(column, value));
        }

        return conditions;
    }

    /**
     * Build OR search condition across fields using LIKE
     */
    protected static buildSearchCondition(search: string, fields: string[]) {
        if (!search || fields.length === 0) return null;
        const table = this.getTable();
        const conditions = fields
            .map((field) => {
                const column = (table as any)[field];
                if (!column) return null;
                return like(column, `%${search}%`);
            })
            .filter(Boolean) as any[];

        if (conditions.length === 0) return null;
        return or(...conditions);
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
     * Create a new record (validates against Zod schema if fields are defined)
     */
    static async create<T extends typeof BaseModel>(
        this: T,
        data: Record<string, any>,
        driver?: DbDriver,
    ): Promise<InstanceType<T>> {
        // Validate before create if fields are defined
        let validatedData = data;
        if (Object.keys(this.fields).length > 0) {
            const result = this.validate(data, 'create');
            if (!result.success) {
                throw new ValidationError(result.errors);
            }
            // Use the validated/coerced data from Zod (guaranteed to exist when success=true)
            validatedData = result.data!;
        }

        const db = this.getDriver(driver).getDb();
        const table = this.getTable();

        // Merge with defaults and prepare for database
        const createData = this.prepareForDatabase({ ...this.defaults, ...validatedData });

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
     * Update a record by primary key (validates against Zod schema if fields are defined)
     */
    static async update<T extends typeof BaseModel>(
        this: T,
        id: string | number,
        data: Record<string, any>,
        driver?: DbDriver,
    ): Promise<InstanceType<T>> {
        // Validate before update if fields are defined
        let validatedData = data;
        if (Object.keys(this.fields).length > 0) {
            const result = this.validate(data, 'update');
            if (!result.success) {
                throw new ValidationError(result.errors);
            }
            // Use the validated/coerced data from Zod (guaranteed to exist when success=true)
            validatedData = result.data!;
        }

        const db = this.getDriver(driver).getDb();
        const table = this.getTable();
        const pkColumn = (table as any)[this.primaryKey];

        if (!pkColumn) {
            throw new Error(`Primary key column ${this.primaryKey} not found`);
        }

        // Auto-add updatedAt if model has it in casts and value not provided
        if (this.casts && this.casts.updatedAt && validatedData.updatedAt === undefined) {
            validatedData.updatedAt = Date.now();
        }

        // Prepare data for database (convert string dates, etc.)
        const updateData = this.prepareForDatabase(validatedData);

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
     * Delete a record by primary key.
     * Uses soft delete (sets `deletedAt`) when `softDeletes` is enabled.
     */
    static async delete(id: string | number, driver?: DbDriver): Promise<boolean> {
        const db = this.getDriver(driver).getDb();
        const table = this.getTable();
        const pkColumn = (table as any)[this.primaryKey];

        if (!pkColumn) {
            throw new Error(`Primary key column ${this.primaryKey} not found`);
        }

        if (this.softDeletes) {
            const deletedAtCol = (table as any).deletedAt;
            if (!deletedAtCol) {
                throw new Error(`Model "${this.entity}" has softDeletes enabled but table has no "deletedAt" column.`);
            }
            await db.update(table).set({ deletedAt: Date.now() }).where(eq(pkColumn, id));
        } else {
            await db.delete(table).where(eq(pkColumn, id));
        }

        return true;
    }

    /**
     * Permanently delete a record, bypassing soft deletes.
     */
    static async forceDelete(id: string | number, driver?: DbDriver): Promise<boolean> {
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
     * Restore a soft-deleted record by clearing `deletedAt`.
     */
    static async restore(id: string | number, driver?: DbDriver): Promise<boolean> {
        if (!this.softDeletes) {
            throw new Error(`Model "${this.entity}" does not have soft deletes enabled.`);
        }

        const db = this.getDriver(driver).getDb();
        const table = this.getTable();
        const pkColumn = (table as any)[this.primaryKey];
        const deletedAtCol = (table as any).deletedAt;

        if (!pkColumn) {
            throw new Error(`Primary key column ${this.primaryKey} not found`);
        }
        if (!deletedAtCol) {
            throw new Error(`Table "${this.entity}" has no "deletedAt" column.`);
        }

        await db.update(table).set({ deletedAt: null }).where(eq(pkColumn, id));
        return true;
    }

    /**
     * Count records matching conditions
     */
    static async count(where?: Record<string, any>, driver?: DbDriver, includeTrashed?: boolean): Promise<number> {
        const db = this.getDriver(driver).getDb();
        const table = this.getTable();

        let query = db.select({ count: sql<number>`count(*)` }).from(table);

        const conditions = this.buildWhereConditions(where || {});
        const softDeleteCond = this.getSoftDeleteCondition(includeTrashed);
        if (softDeleteCond) conditions.push(softDeleteCond);
        if (conditions.length > 0) {
            query = query.where(and(...conditions));
        }

        const results = await query;
        return Number(results[0]?.count ?? 0);
    }

    /**
     * Search records with LIKE across searchable fields
     */
    static async search<T extends typeof BaseModel>(
        this: T,
        search: string,
        fields: string[],
        where?: Record<string, any>,
        options?: {
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
            limit?: number;
            offset?: number;
        },
        driver?: DbDriver,
        includeTrashed?: boolean,
    ): Promise<InstanceType<T>[]> {
        const db = this.getDriver(driver).getDb();
        const table = this.getTable();

        const searchCondition = this.buildSearchCondition(search, fields);
        if (!searchCondition) {
            return this.where(where || {}, options, driver, includeTrashed);
        }

        const conditions = this.buildWhereConditions(where || {});
        const softDeleteCond = this.getSoftDeleteCondition(includeTrashed);
        if (softDeleteCond) conditions.push(softDeleteCond);
        let query = db.select().from(table);

        if (conditions.length > 0) {
            query = query.where(and(...conditions, searchCondition));
        } else {
            query = query.where(searchCondition);
        }

        if (options?.orderBy) {
            const orderColumn = (table as any)[options.orderBy];
            if (orderColumn) {
                query = query.orderBy(options.orderDirection === 'desc' ? desc(orderColumn) : asc(orderColumn));
            }
        }

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
     * Paginate search results
     */
    static async searchPaginate<T extends typeof BaseModel>(
        this: T,
        search: string,
        fields: string[],
        page: number = 1,
        perPage: number = 15,
        where?: Record<string, any>,
        options?: { orderBy?: string; orderDirection?: 'asc' | 'desc' },
        driver?: DbDriver,
        includeTrashed?: boolean,
    ): Promise<PaginationResult<InstanceType<T>>> {
        const offset = (page - 1) * perPage;
        const table = this.getTable();
        const db = this.getDriver(driver).getDb();

        const searchCondition = this.buildSearchCondition(search, fields);
        const whereConditions = this.buildWhereConditions(where || {});
        const softDeleteCond = this.getSoftDeleteCondition(includeTrashed);
        if (softDeleteCond) whereConditions.push(softDeleteCond);

        let combinedCondition = searchCondition || undefined;
        if (whereConditions.length > 0) {
            combinedCondition = searchCondition ? and(...whereConditions, searchCondition) : and(...whereConditions);
        }

        let dataQuery = db.select().from(table);
        if (combinedCondition) {
            dataQuery = dataQuery.where(combinedCondition);
        }
        if (options?.orderBy) {
            const orderColumn = (table as any)[options.orderBy];
            if (orderColumn) {
                dataQuery = dataQuery.orderBy(options.orderDirection === 'desc' ? desc(orderColumn) : asc(orderColumn));
            }
        }
        dataQuery = dataQuery.limit(perPage).offset(offset);

        let countQuery = db.select({ count: sql<number>`count(*)` }).from(table);
        if (combinedCondition) {
            countQuery = countQuery.where(combinedCondition);
        }

        const [data, countResult] = await Promise.all([dataQuery, countQuery]);
        const total = Number(countResult[0]?.count ?? 0);
        const totalPages = Math.max(1, Math.ceil(total / perPage));

        return {
            data: data.map((row: any) => new this({ entity: this.entity, data: row }) as InstanceType<T>),
            total,
            page,
            perPage,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        };
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
        includeTrashed?: boolean,
    ): Promise<PaginationResult<InstanceType<T>>> {
        const offset = (page - 1) * perPage;

        const [data, total] = await Promise.all([
            this.where(where || {}, { ...options, limit: perPage, offset }, driver, includeTrashed),
            this.count(where, driver, includeTrashed),
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
    // BATCH / TRANSACTION
    // ============================================================

    /**
     * Execute multiple raw SQL statements as an atomic batch.
     * Uses D1's native batch API — all succeed or all fail.
     *
     * @example
     * ```typescript
     * await BaseModel.batch([
     *     "INSERT INTO todos (id, title) VALUES ('1', 'First')",
     *     "INSERT INTO todos (id, title) VALUES ('2', 'Second')",
     * ]);
     * ```
     */
    static async batch(sqls: string[], driver?: DbDriver): Promise<any> {
        const d = this.getDriver(driver);
        if (typeof d.executeBatch !== 'function') {
            throw new Error('Driver does not support executeBatch. D1Driver supports atomic batches natively.');
        }
        return d.executeBatch(sqls);
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

    /**
     * Eager-load one or more relationships by name.
     * Relationship methods must be defined as instance methods (e.g. `async author()`).
     * Results are attached to `attributes` under the relationship name.
     *
     * @example
     * ```typescript
     * const post = await Post.find('post-id');
     * await post.load('author', 'comments');
     * console.log(post.get('author')); // User instance data
     * console.log(post.get('comments')); // Comment[] data
     * ```
     */
    async load(...relations: string[]): Promise<this> {
        const results = await Promise.all(
            relations.map(async (rel) => {
                const method = (this as any)[rel];
                if (typeof method !== 'function') {
                    throw new Error(
                        `Relationship "${rel}" is not defined on model "${(this.constructor as typeof BaseModel).entity}".`,
                    );
                }
                const result = await method.call(this);
                return { rel, result };
            }),
        );

        for (const { rel, result } of results) {
            if (result === null || result === undefined) {
                this.set(rel, null);
            } else if (Array.isArray(result)) {
                this.set(
                    rel,
                    result.map((r: any) => (typeof r.toJson === 'function' ? r.toJson() : r)),
                );
            } else if (typeof result.toJson === 'function') {
                this.set(rel, result.toJson());
            } else {
                this.set(rel, result);
            }
        }

        return this;
    }

    /**
     * Eager-load relationships for a collection of model instances.
     * Loads each instance's relationships in parallel (N+1 per relation).
     * For truly batched loading, use `whereIn` directly.
     *
     * @example
     * ```typescript
     * const posts = await Post.where({});
     * await Post.loadAll(posts, 'author');
     * ```
     */
    static async loadAll<T extends BaseModel>(instances: T[], ...relations: string[]): Promise<T[]> {
        // For each instance, call load() in parallel
        await Promise.all(instances.map((instance) => instance.load(...relations)));
        return instances;
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
            // List available columns for debugging
            const availableColumns = Object.keys(pivotTable).filter(
                (k) => !k.startsWith('_') && typeof (pivotTable as any)[k]?.name === 'string',
            );
            const missing = [!pivotFkColumn && foreignKey, !pivotOtherColumn && otherKey].filter(Boolean);
            throw new Error(
                `Pivot table column(s) not found: ${missing.join(', ')}. ` +
                    `Available columns: ${availableColumns.join(', ') || '(none)'}. ` +
                    `Use the foreignKey/otherKey options to specify custom column names.`,
            );
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
