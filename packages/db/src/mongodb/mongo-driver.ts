// ============================================================
// @ottabase/db - MongoDB Driver
// ============================================================
// Wraps native MongoDB client for OttaORM integration
// ============================================================

import { MongoClient, Db, Collection, Document, ObjectId } from 'mongodb';

export interface MongoDriverConfig {
    log?: boolean | ('query' | 'info' | 'warn' | 'error')[];
}

/**
 * MongoDB Driver for OttaORM
 *
 * Wraps the native MongoDB client to provide a consistent interface
 * for database operations in OttaORM models.
 *
 * @example
 * ```typescript
 * import { createMongoDriver } from "@ottabase/db/mongodb";
 *
 * const driver = await createMongoDriver(
 *   "mongodb://localhost:27017",
 *   "myapp",
 *   { log: true }
 * );
 *
 * const results = await driver.find("users", { email: "test@example.com" });
 * ```
 */
export class MongoDriver {
    private client: MongoClient;
    private db: Db;
    private config: MongoDriverConfig;

    constructor(client: MongoClient, dbName: string, config: MongoDriverConfig = {}) {
        this.client = client;
        this.db = client.db(dbName);
        this.config = config;
    }

    /**
     * Get the native MongoDB database instance
     */
    getDb(): Db {
        return this.db;
    }

    /**
     * Get a collection from the database
     *
     * @param name - Collection name
     */
    getCollection<T extends Document = Document>(name: string): Collection<T> {
        return this.db.collection<T>(name);
    }

    /**
     * Find documents in a collection
     *
     * @param collection - Collection name
     * @param filter - Query filter
     * @param options - Query options (sort, limit, skip, projection)
     */
    async find<T extends Document = Document>(
        collection: string,
        filter: any = {},
        options: {
            sort?: any;
            limit?: number;
            skip?: number;
            projection?: any;
        } = {},
    ): Promise<T[]> {
        this.log(`find in ${collection}:`, { filter, options });

        const coll = this.getCollection<T>(collection);
        let cursor = coll.find(filter);

        if (options.projection) {
            cursor = cursor.project(options.projection);
        }
        if (options.sort) {
            cursor = cursor.sort(options.sort);
        }
        if (options.skip) {
            cursor = cursor.skip(options.skip);
        }
        if (options.limit) {
            cursor = cursor.limit(options.limit);
        }

        return cursor.toArray() as Promise<T[]>;
    }

    /**
     * Find a single document in a collection
     *
     * @param collection - Collection name
     * @param filter - Query filter
     * @param options - Query options (projection)
     */
    async findOne<T extends Document = Document>(
        collection: string,
        filter: any = {},
        options: {
            projection?: any;
        } = {},
    ): Promise<T | null> {
        this.log(`findOne in ${collection}:`, { filter, options });

        const coll = this.getCollection<T>(collection);
        const result = await coll.findOne(filter, options);
        return result as T | null;
    }

    /**
     * Insert a single document into a collection
     *
     * @param collection - Collection name
     * @param document - Document to insert
     * @returns The inserted document with generated _id
     */
    async insertOne<T extends Document = Document>(collection: string, document: any): Promise<T> {
        this.log(`insertOne in ${collection}:`, document);

        const coll = this.getCollection<T>(collection);
        const result = await coll.insertOne(document as any);

        return {
            ...document,
            _id: result.insertedId,
        } as T;
    }

    /**
     * Update a single document in a collection
     *
     * @param collection - Collection name
     * @param filter - Query filter
     * @param update - Update operations
     * @returns Update result
     */
    async updateOne(
        collection: string,
        filter: any,
        update: any,
    ): Promise<{ matchedCount: number; modifiedCount: number }> {
        this.log(`updateOne in ${collection}:`, { filter, update });

        const coll = this.getCollection(collection);
        const result = await coll.updateOne(filter, update);

        return {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
        };
    }

    /**
     * Delete a single document from a collection
     *
     * @param collection - Collection name
     * @param filter - Query filter
     * @returns True if a document was deleted
     */
    async deleteOne(collection: string, filter: any): Promise<boolean> {
        this.log(`deleteOne in ${collection}:`, filter);

        const coll = this.getCollection(collection);
        const result = await coll.deleteOne(filter);

        return result.deletedCount > 0;
    }

    /**
     * Count documents in a collection
     *
     * @param collection - Collection name
     * @param filter - Query filter
     * @returns Document count
     */
    async count(collection: string, filter: any = {}): Promise<number> {
        this.log(`count in ${collection}:`, filter);

        const coll = this.getCollection(collection);
        return coll.countDocuments(filter);
    }

    /**
     * Close the database connection
     */
    async close(): Promise<void> {
        this.log('Closing MongoDB connection');
        await this.client.close();
    }

    /**
     * Log a message based on config
     *
     * @param message - Message to log
     * @param data - Additional data
     */
    private log(message: string, data?: any): void {
        if (!this.config.log) return;

        if (this.config.log === true) {
            console.log(`[MongoDriver] ${message}`, data || '');
        } else if (Array.isArray(this.config.log)) {
            if (this.config.log.includes('query') || this.config.log.includes('info')) {
                console.log(`[MongoDriver] ${message}`, data || '');
            }
        }
    }
}

/**
 * Create a MongoDB driver instance
 *
 * @param connectionString - MongoDB connection string
 * @param dbName - Database name
 * @param config - Driver configuration
 * @returns MongoDriver instance
 *
 * @example
 * ```typescript
 * const driver = await createMongoDriver(
 *   "mongodb://localhost:27017",
 *   "myapp",
 *   { log: true }
 * );
 * ```
 */
export async function createMongoDriver(
    connectionString: string,
    dbName: string,
    config?: MongoDriverConfig,
): Promise<MongoDriver> {
    const client = new MongoClient(connectionString);
    await client.connect();

    return new MongoDriver(client, dbName, config);
}

/**
 * Check if an object is a valid MongoDB ObjectId
 *
 * @param value - Value to check
 */
export function isObjectId(value: any): value is ObjectId {
    return value instanceof ObjectId;
}

/**
 * Convert a string to MongoDB ObjectId if valid
 *
 * @param value - String or ObjectId
 * @returns ObjectId or null if invalid
 */
export function toObjectId(value: string | ObjectId): ObjectId | null {
    if (isObjectId(value)) return value;

    try {
        return new ObjectId(value);
    } catch {
        return null;
    }
}
