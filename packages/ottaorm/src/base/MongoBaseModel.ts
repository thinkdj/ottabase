// ============================================================
// @ottabase/ottaorm - Mongo Base Model
// ============================================================
// MongoDB-specific implementation using native mongodb driver
// Schema-less approach with ORM-like interface
// ============================================================

import {
    AbstractBaseModel,
    PaginationResult,
    ModelFieldType,
    ModelFields,
    ModelFieldDescriptor,
    PackageType,
} from './AbstractBaseModel';
import { getConnection } from '../context';
import type { MongoDriver } from '@ottabase/db/mongodb';
import { ObjectId } from 'mongodb';

export interface IMongoModelConstructorParams {
    entity: string;
    data: { [key: string]: any };
}

// Re-export types for convenience
export type { ModelFieldType, ModelFieldDescriptor, ModelFields, PaginationResult, PackageType };

/**
 * Type guard to check if a connection is a MongoDB driver
 */
function isMongoDriver(driver: any): driver is MongoDriver {
    return driver && typeof driver.getCollection === 'function';
}

/**
 * Mongo Base Model class - Fat Model Pattern for MongoDB
 *
 * All metadata lives in the model class as static properties:
 * - entity: collection name
 * - collection: explicit collection name (optional, defaults to entity)
 * - primaryKey: primary key field name (default: "_id")
 * - connection: database connection name (default: "default")
 * - casts: type casting rules
 * - fields: complete field metadata
 * - validationRules: validation rules (not enforced, for UI/forms only)
 * - defaults: default values
 *
 * @example
 * ```typescript
 * export class Log extends MongoBaseModel {
 *   static entity = "logs";
 *   static connection = "mongodb";
 *   static primaryKey = "_id";
 *
 *   static casts = {
 *     timestamp: 'date',
 *     metadata: 'json'
 *   };
 *
 *   static fields: ModelFields = {
 *     _id: { type: 'id', primaryKey: true },
 *     level: { type: 'string' },
 *     message: { type: 'string' },
 *     timestamp: { type: 'datetime' }
 *   };
 * }
 * ```
 */
export class MongoBaseModel extends AbstractBaseModel {
    // MongoDB-specific static property
    /**
     * Explicit collection name (optional)
     * If not set, uses entity as collection name
     */
    static collection?: string;

    // Override default primary key for MongoDB
    static primaryKey: string = '_id';

    constructor(params: IMongoModelConstructorParams) {
        super();
        this.fill(params.data);
    }

    // ============================================================
    // HELPER METHODS
    // ============================================================

    /**
     * Get collection name
     * Returns explicit collection name or falls back to entity
     */
    protected static getCollectionName(): string {
        return this.collection || this.entity;
    }

    /**
     * Get MongoDB driver for this model's connection
     * Uses the connection specified in static connection property
     */
    protected static getDriver(driver?: MongoDriver): MongoDriver {
        if (driver) return driver;

        const connection = getConnection(this.connection);
        if (!isMongoDriver(connection)) {
            throw new Error(
                `Connection '${this.connection}' is not a MongoDB driver for model ${this.entity}. ` +
                    `Make sure you registered a MongoDriver for this connection.`,
            );
        }
        return connection;
    }

    /**
     * Convert value to ObjectId if it's a string and this is the primary key
     */
    protected static toObjectIdIfNeeded(value: string | ObjectId, key?: string): string | ObjectId {
        // Only convert for _id field
        if (key === '_id' || key === this.primaryKey) {
            if (typeof value === 'string') {
                try {
                    return new ObjectId(value);
                } catch {
                    // If conversion fails, return as-is
                    return value;
                }
            }
        }
        return value;
    }

    // ============================================================
    // STATIC QUERY METHODS
    // ============================================================

    /**
     * Find record by primary key
     *
     * @param id - Document ID (string or ObjectId)
     * @param driver - Optional driver override
     * @returns Model instance or null
     */
    static async find<T extends typeof MongoBaseModel>(
        this: T,
        id: string | ObjectId,
        driver?: MongoDriver,
    ): Promise<InstanceType<T> | null> {
        const mongo = this.getDriver(driver);
        const collection = this.getCollectionName();

        const objectId = this.toObjectIdIfNeeded(id, this.primaryKey) as ObjectId;

        const result = await mongo.findOne(collection, {
            [this.primaryKey]: objectId,
        });

        if (!result) return null;

        return new this({ entity: this.entity, data: result }) as InstanceType<T>;
    }

    /**
     * Get first record matching conditions
     *
     * @param where - Query filter
     * @param driver - Optional driver override
     * @returns Model instance or null
     */
    static async first<T extends typeof MongoBaseModel>(
        this: T,
        where?: Record<string, any>,
        driver?: MongoDriver,
    ): Promise<InstanceType<T> | null> {
        const mongo = this.getDriver(driver);
        const collection = this.getCollectionName();

        const result = await mongo.findOne(collection, where || {});

        if (!result) return null;

        return new this({ entity: this.entity, data: result }) as InstanceType<T>;
    }

    /**
     * Get all records matching conditions
     *
     * @param where - Query filter
     * @param options - Query options (orderBy, orderDirection, limit, offset)
     * @param driver - Optional driver override
     * @returns Array of model instances
     */
    static async where<T extends typeof MongoBaseModel>(
        this: T,
        where: Record<string, any>,
        options?: {
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
            limit?: number;
            offset?: number;
        },
        driver?: MongoDriver,
    ): Promise<InstanceType<T>[]> {
        const mongo = this.getDriver(driver);
        const collection = this.getCollectionName();

        const mongoOptions: any = {};

        // Apply ordering
        if (options?.orderBy) {
            mongoOptions.sort = {
                [options.orderBy]: options.orderDirection === 'desc' ? -1 : 1,
            };
        }

        // Apply limit and offset
        if (options?.limit) mongoOptions.limit = options.limit;
        if (options?.offset) mongoOptions.skip = options.offset;

        const results = await mongo.find(collection, where, mongoOptions);

        return results.map((row: any) => new this({ entity: this.entity, data: row }) as InstanceType<T>);
    }

    /**
     * Get all records
     *
     * @param options - Query options
     * @param driver - Optional driver override
     * @returns Array of model instances
     */
    static async all<T extends typeof MongoBaseModel>(
        this: T,
        options?: {
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
            limit?: number;
            offset?: number;
        },
        driver?: MongoDriver,
    ): Promise<InstanceType<T>[]> {
        return this.where({}, options, driver);
    }

    /**
     * Create a new record
     *
     * @param data - Record data
     * @param driver - Optional driver override
     * @returns Created model instance
     */
    static async create<T extends typeof MongoBaseModel>(
        this: T,
        data: Record<string, any>,
        driver?: MongoDriver,
    ): Promise<InstanceType<T>> {
        const mongo = this.getDriver(driver);
        const collection = this.getCollectionName();

        // Merge with defaults
        const createData = { ...this.defaults, ...data };

        // Call defaults that are functions
        for (const key in createData) {
            if (typeof createData[key] === 'function') {
                createData[key] = createData[key]();
            }
        }

        const result = await mongo.insertOne(collection, createData);

        return new this({ entity: this.entity, data: result }) as InstanceType<T>;
    }

    /**
     * Update a record by primary key
     *
     * @param id - Document ID
     * @param data - Data to update
     * @param driver - Optional driver override
     * @returns Updated model instance
     */
    static async update<T extends typeof MongoBaseModel>(
        this: T,
        id: string | ObjectId,
        data: Record<string, any>,
        driver?: MongoDriver,
    ): Promise<InstanceType<T>> {
        const mongo = this.getDriver(driver);
        const collection = this.getCollectionName();

        const objectId = this.toObjectIdIfNeeded(id, this.primaryKey) as ObjectId;

        await mongo.updateOne(collection, { [this.primaryKey]: objectId }, { $set: data });

        // Fetch updated document
        const updated = await this.find(id, driver);

        if (!updated) {
            throw new Error(`Failed to fetch updated ${this.entity} with id ${id}`);
        }

        return updated;
    }

    /**
     * Delete a record by primary key
     *
     * @param id - Document ID
     * @param driver - Optional driver override
     * @returns True if deleted successfully
     */
    static async delete(id: string | ObjectId, driver?: MongoDriver): Promise<boolean> {
        const mongo = this.getDriver(driver);
        const collection = this.getCollectionName();

        const objectId = this.toObjectIdIfNeeded(id, this.primaryKey) as ObjectId;

        return mongo.deleteOne(collection, {
            [this.primaryKey]: objectId,
        });
    }

    /**
     * Count records matching conditions
     *
     * @param where - Query filter
     * @param driver - Optional driver override
     * @returns Document count
     */
    static async count(where?: Record<string, any>, driver?: MongoDriver): Promise<number> {
        const mongo = this.getDriver(driver);
        const collection = this.getCollectionName();

        return mongo.count(collection, where || {});
    }

    /**
     * Paginate results
     *
     * @param page - Page number (1-indexed)
     * @param perPage - Results per page
     * @param where - Query filter
     * @param options - Query options
     * @param driver - Optional driver override
     * @returns Pagination result
     */
    static async paginate<T extends typeof MongoBaseModel>(
        this: T,
        page: number = 1,
        perPage: number = 15,
        where?: Record<string, any>,
        options?: {
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
        },
        driver?: MongoDriver,
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
     *
     * @param driver - Optional driver override
     * @returns This instance with updated data
     */
    async save(driver?: MongoDriver): Promise<this> {
        const ModelClass = this.constructor as typeof MongoBaseModel;
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
     * Delete instance from database
     *
     * @param driver - Optional driver override
     * @returns True if deleted successfully
     */
    async destroy(driver?: MongoDriver): Promise<boolean> {
        const ModelClass = this.constructor as typeof MongoBaseModel;
        const pk = this.get(ModelClass.primaryKey);

        if (!pk) {
            throw new Error('Cannot delete record without primary key');
        }

        return ModelClass.delete(pk, driver);
    }

    /**
     * Reload instance from database
     *
     * @param driver - Optional driver override
     * @returns This instance with fresh data
     */
    async refresh(driver?: MongoDriver): Promise<this> {
        const ModelClass = this.constructor as typeof MongoBaseModel;
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
}
