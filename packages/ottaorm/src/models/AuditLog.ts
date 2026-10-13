// ============================================================
// @ottabase/ottaorm - AuditLog Model
// ============================================================

import type { DbDriver } from '@ottabase/db/drizzle';
import { BaseModel, ModelFields, type PackageType } from '../base/BaseModel';
import { ValidationError } from '../validation';
import { auditLogsTable } from './AuditLog.schema';

export { auditLogsTable, type AuditLogType, type NewAuditLogType } from './AuditLog.schema';

/**
 * AuditLog model for tracking all system actions
 *
 * @example
 * ```typescript
 * import { AuditLog } from "@ottabase/ottaorm/models";
 *
 * // Log an action
 * await AuditLog.log({
 *   userId: "user-id",
 *   userEmail: "user@example.com",
 *   action: "update",
 *   resourceType: "user",
 *   resourceId: "user-id",
 *   changes: { name: { from: "Old Name", to: "New Name" } },
 *   ipAddress: "127.0.0.1"
 * });
 *
 * // Query audit logs
 * const logs = await AuditLog.where({ userId: "user-id" });
 * const userLogs = await AuditLog.getByUser("user-id");
 * const resourceLogs = await AuditLog.getByResource("user", "user-id");
 * ```
 */
export class AuditLog extends BaseModel {
    static entity = 'audit_logs';
    static table = auditLogsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottaorm';
    static packageType: PackageType = 'core';

    // UI/Forms metadata
    static displayName = 'Audit Log';
    static displayNamePlural = 'Audit Logs';
    static defaultSort = 'createdAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        createdAt: 'date' as const,
        changes: 'json' as const,
        metadata: 'json' as const,
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: {
                label: 'ID',
            },
        },
        userId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: {
                label: 'User ID',
            },
            tableConfig: {
                visible: true,
            },
        },
        userEmail: {
            type: 'string',
            editable: false,
            searchable: true,
            uiConfig: {
                label: 'User Email',
            },
            tableConfig: {
                visible: true,
            },
        },
        organizationId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: {
                label: 'Organization ID',
                description: 'Organization/tenant context',
            },
            tableConfig: {
                visible: true,
            },
        },
        action: {
            type: 'string',
            editable: false,
            searchable: true,
            filterable: true,
            uiConfig: {
                label: 'Action',
                description: 'Action performed (e.g., create, update, delete)',
            },
            tableConfig: {
                visible: true,
            },
        },
        resourceType: {
            type: 'string',
            editable: false,
            searchable: true,
            filterable: true,
            uiConfig: {
                label: 'Resource Type',
                description: 'Type of resource affected',
            },
            tableConfig: {
                visible: true,
            },
        },
        resourceId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: {
                label: 'Resource ID',
            },
            tableConfig: {
                visible: true,
            },
        },
        changes: {
            type: 'json',
            editable: false,
            uiConfig: {
                label: 'Changes',
                description: 'Before/after values',
            },
            tableConfig: {
                visible: false,
            },
        },
        metadata: {
            type: 'json',
            editable: false,
            uiConfig: {
                label: 'Metadata',
                description: 'Additional context',
            },
            tableConfig: {
                visible: false,
            },
        },
        ipAddress: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'IP Address',
            },
            tableConfig: {
                visible: true,
            },
        },
        userAgent: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'User Agent',
            },
            tableConfig: {
                visible: false,
            },
        },
        status: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: {
                label: 'Status',
            },
            tableConfig: {
                visible: true,
            },
        },
        errorMessage: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Error Message',
            },
            tableConfig: {
                visible: false,
            },
        },
        createdAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Created At',
            },
            tableConfig: {
                visible: true,
            },
        },
    };

    // ============================================================
    // RELATIONSHIPS
    // ============================================================

    /**
     * Get the user who performed this action (BelongsTo User)
     */
    async user() {
        const userId = this.get('userId');
        if (!userId) return null;

        const { User } = await import('./User');
        return User.find(userId);
    }

    // ============================================================
    // HELPER METHODS
    // ============================================================

    /**
     * Get changes as object
     */
    getChanges(): Record<string, any> {
        const changes = this.get('changes');
        if (typeof changes === 'string') {
            try {
                return JSON.parse(changes);
            } catch {
                return {};
            }
        }
        return changes || {};
    }

    /**
     * Get metadata as object
     */
    getMetadata(): Record<string, any> {
        const metadata = this.get('metadata');
        if (typeof metadata === 'string') {
            try {
                return JSON.parse(metadata);
            } catch {
                return {};
            }
        }
        return metadata || {};
    }

    /**
     * Log an action (multi-tenant aware)
     */
    static async log(data: {
        userId?: string;
        userEmail?: string;
        organizationId?: string; // Organization/tenant context
        appId?: string; // App context
        action: string;
        resourceType: string;
        resourceId?: string;
        changes?: Record<string, any>;
        metadata?: Record<string, any>;
        ipAddress?: string;
        userAgent?: string;
        status?: 'success' | 'failure' | 'error';
        errorMessage?: string;
    }) {
        const logData: any = {
            ...data,
            changes: data.changes ? JSON.stringify(data.changes) : undefined,
            metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
        };

        return this.create(logData);
    }

    /**
     * Delete this app's audit rows older than `days` (retention). Returns the number of rows removed.
     *
     * Audit rows are append-only, so without this the table grows without bound toward D1's
     * database size limit. The app runs it from a scheduled task (`audit:prune` in otta-web);
     * the retention window is the task payload, not a config key, so an operator changes it in
     * the Cron admin. `days` is validated because that payload is operator input.
     *
     * Scope: rows stamped with `appId` plus unowned rows (`app_id IS NULL` — logger transport and
     * plain `log()` writes carry no app). Another app sharing the database keeps its own trail
     * under its own window. Unowned rows are pruned by EVERY app's run, so in a shared database
     * they live only as long as the shortest window any app sets.
     */
    static async pruneOlderThan(days: number, appId: string, driver?: DbDriver): Promise<number> {
        if (!Number.isFinite(days) || days <= 0) {
            throw new ValidationError({
                days: `Audit retention must be a positive number of days, got ${String(days)}`,
            });
        }
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        // executeRaw binds params; Drizzle's getDb().run(string) would silently drop them.
        // ponytail: one DELETE per run; batch by `id IN (SELECT … LIMIT n)` if a run ever exceeds D1's statement time.
        const result = await (driver ?? this.getDriver()).executeRaw(
            `DELETE FROM ${this.entity} WHERE created_at < ? AND (app_id = ? OR app_id IS NULL)`,
            [cutoff, appId],
        );
        return result?.meta?.changes ?? 0;
    }

    /**
     * Get audit logs by user
     */
    static async getByUser(userId: string, limit?: number) {
        return this.where({ userId }, { orderBy: 'createdAt', orderDirection: 'desc', limit });
    }

    /**
     * Get audit logs by resource
     */
    static async getByResource(resourceType: string, resourceId: string, limit?: number) {
        return this.where({ resourceType, resourceId }, { orderBy: 'createdAt', orderDirection: 'desc', limit });
    }

    /**
     * Get audit logs by action
     */
    static async getByAction(action: string, limit?: number) {
        return this.where({ action }, { orderBy: 'createdAt', orderDirection: 'desc', limit });
    }

    /**
     * Get recent audit logs
     */
    static async getRecent(limit: number = 100) {
        return this.where({}, { orderBy: 'createdAt', orderDirection: 'desc', limit });
    }

    /**
     * Get failed actions
     */
    static async getFailures(limit?: number) {
        return this.where({ status: 'failure' }, { orderBy: 'createdAt', orderDirection: 'desc', limit });
    }

    /**
     * Get audit logs in date range
     */
    static async getByDateRange(startDate: Date, endDate: Date, limit: number = 1000) {
        return this.where(
            {
                createdAt: {
                    $gte: startDate.getTime(),
                    $lte: endDate.getTime(),
                },
            },
            { orderBy: 'createdAt', orderDirection: 'desc', limit },
        );
    }

    /**
     * Get audit logs by organization (multi-tenant)
     */
    static async getByOrganization(organizationId: string, limit?: number) {
        return this.where({ organizationId }, { orderBy: 'createdAt', orderDirection: 'desc', limit });
    }

    /**
     * Get audit logs by user in organization (multi-tenant)
     */
    static async getByUserInOrganization(userId: string, organizationId: string, limit?: number) {
        return this.where({ userId, organizationId }, { orderBy: 'createdAt', orderDirection: 'desc', limit });
    }

    /**
     * Get audit logs by resource in organization (multi-tenant)
     */
    static async getByResourceInOrganization(
        resourceType: string,
        resourceId: string,
        organizationId: string,
        limit?: number,
    ) {
        return this.where(
            { resourceType, resourceId, organizationId },
            { orderBy: 'createdAt', orderDirection: 'desc', limit },
        );
    }
}
