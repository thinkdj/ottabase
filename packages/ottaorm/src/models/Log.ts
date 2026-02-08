// ============================================================
// @ottabase/ottaorm - Log Model (MongoDB Example)
// ============================================================

import { ModelFields, MongoBaseModel, type PackageType } from '../base/MongoBaseModel';

/**
 * Log model - MongoDB example
 *
 * Demonstrates MongoDB usage with OttaORM:
 * - Schema-less design
 * - Uses MongoDB ObjectId for _id
 * - Fields metadata for UI only (not enforced)
 * - No table definition required
 * - Connection specified via static property
 *
 * @example
 * ```typescript
 * import { registerConnection, Log } from "@ottabase/ottaorm";
 * import { createMongoDriver } from "@ottabase/db/mongodb";
 *
 * // Setup MongoDB connection
 * const mongoDriver = await createMongoDriver(
 *   process.env.MONGODB_URI,
 *   "myapp"
 * );
 * registerConnection('mongodb', mongoDriver);
 *
 * // Create log entry
 * const log = await Log.create({
 *   level: "info",
 *   message: "User logged in",
 *   userId: "user-123",
 *   metadata: { ip: "192.168.1.1" }
 * });
 *
 * // Query logs
 * const errorLogs = await Log.where({ level: "error" });
 * const recentLogs = await Log.paginate(1, 50, {}, {
 *   orderBy: 'timestamp',
 *   orderDirection: 'desc'
 * });
 *
 * // Use custom helper methods
 * const errors = await Log.errors({ limit: 10 });
 * const userLogs = await Log.forUser("user-123");
 * ```
 */
export class Log extends MongoBaseModel {
    static entity = 'logs';
    static connection = 'mongodb'; // Use MongoDB connection
    static primaryKey = '_id';
    static packageName = '@ottabase/ottaorm';
    static packageType: PackageType = 'core';

    static casts = {
        timestamp: 'date' as const,
        metadata: 'json' as const,
    };

    static defaults = {
        timestamp: () => Date.now(),
        level: 'info',
    };

    // Fields metadata (for UI generation, not validation)
    protected static fields: ModelFields = {
        _id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: {
                label: 'ID',
            },
            tableConfig: {
                visible: false,
            },
        },
        level: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: {
                label: 'Level',
                description: 'Log level (info, warn, error)',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
                order: 1,
            },
            tableConfig: {
                visible: true,
                order: 1,
                colWidth: 100,
            },
        },
        message: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Message',
                description: 'Log message',
            },
            formConfig: {
                visible: true,
                fieldType: 'textarea',
                order: 2,
            },
            tableConfig: {
                visible: true,
                order: 2,
            },
        },
        userId: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: {
                label: 'User ID',
                description: 'ID of the user who triggered this log',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
                order: 3,
            },
            tableConfig: {
                visible: true,
                order: 3,
                colWidth: 150,
            },
        },
        metadata: {
            type: 'json',
            editable: true,
            uiConfig: {
                label: 'Metadata',
                description: 'Additional log data',
            },
            formConfig: {
                visible: true,
                fieldType: 'json',
                order: 4,
            },
            tableConfig: {
                visible: false,
            },
        },
        timestamp: {
            type: 'datetime',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Timestamp',
                description: 'When this log was created',
            },
            tableConfig: {
                visible: true,
                order: 4,
                colWidth: 200,
            },
        },
    };

    // ============================================================
    // CUSTOM METHODS
    // ============================================================

    /**
     * Get all error logs
     *
     * @param options - Query options
     * @returns Array of error log instances
     */
    static async errors(options?: { limit?: number; orderBy?: string; orderDirection?: 'asc' | 'desc' }) {
        return this.where(
            { level: 'error' },
            {
                orderBy: options?.orderBy || 'timestamp',
                orderDirection: options?.orderDirection || 'desc',
                limit: options?.limit,
            },
        );
    }

    /**
     * Get all warning logs
     *
     * @param options - Query options
     * @returns Array of warning log instances
     */
    static async warnings(options?: { limit?: number; orderBy?: string; orderDirection?: 'asc' | 'desc' }) {
        return this.where(
            { level: 'warn' },
            {
                orderBy: options?.orderBy || 'timestamp',
                orderDirection: options?.orderDirection || 'desc',
                limit: options?.limit,
            },
        );
    }

    /**
     * Get logs for a specific user
     *
     * @param userId - User ID
     * @param options - Query options
     * @returns Array of log instances for the user
     */
    static async forUser(
        userId: string,
        options?: {
            limit?: number;
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
        },
    ) {
        return this.where(
            { userId },
            {
                orderBy: options?.orderBy || 'timestamp',
                orderDirection: options?.orderDirection || 'desc',
                limit: options?.limit,
            },
        );
    }

    /**
     * Create an error log
     *
     * @param message - Error message
     * @param metadata - Additional metadata
     * @returns Created log instance
     */
    static async logError(message: string, metadata?: any) {
        return this.create({
            level: 'error',
            message,
            metadata: metadata || {},
        });
    }

    /**
     * Create an info log
     *
     * @param message - Info message
     * @param metadata - Additional metadata
     * @returns Created log instance
     */
    static async logInfo(message: string, metadata?: any) {
        return this.create({
            level: 'info',
            message,
            metadata: metadata || {},
        });
    }

    /**
     * Create a warning log
     *
     * @param message - Warning message
     * @param metadata - Additional metadata
     * @returns Created log instance
     */
    static async logWarn(message: string, metadata?: any) {
        return this.create({
            level: 'warn',
            message,
            metadata: metadata || {},
        });
    }

    /**
     * Get recent logs (last 24 hours)
     *
     * @param options - Query options
     * @returns Array of recent log instances
     */
    static async recent(options?: { hours?: number; level?: string; limit?: number }) {
        const hours = options?.hours || 24;
        const cutoff = Date.now() - hours * 60 * 60 * 1000;

        const where: any = {
            timestamp: { $gte: cutoff },
        };

        if (options?.level) {
            where.level = options.level;
        }

        return this.where(where, {
            orderBy: 'timestamp',
            orderDirection: 'desc',
            limit: options?.limit || 100,
        });
    }
}
