/**
 * @ottabase/auditlog
 * Auditing & changelog system for Ottabase applications
 * Cloudflare D1-first implementation
 */

import type { D1Client } from '@ottabase/cf';
import type {
  AuditLogEntry,
  AuditLogFilter,
  AuditLogResult,
  AuditLogQueryResult,
  AuditLogConfig,
  AuditAction,
} from './types';

export * from './types';
export * from './schema';

/**
 * Generate a unique ID for audit log entries
 */
function generateId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get current ISO timestamp
 */
function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * AuditLog class for managing audit logs with Cloudflare D1
 */
export class AuditLog {
  private d1Client: D1Client;
  private config: AuditLogConfig;

  constructor(d1Client: D1Client, config: AuditLogConfig = {}) {
    this.d1Client = d1Client;
    this.config = {
      enabled: true,
      captureIp: true,
      captureUserAgent: true,
      storeChanges: true,
      ...config,
    };
  }

  /**
   * Create an audit log entry
   *
   * @example
   * ```typescript
   * const audit = new AuditLog(d1Client);
   * await audit.log({
   *   userId: 'user_123',
   *   userName: 'John Doe',
   *   action: 'CREATE',
   *   model: 'Post',
   *   modelId: 'post_456',
   *   description: 'Created a new blog post',
   *   metadata: { title: 'My First Post' }
   * });
   * ```
   */
  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<AuditLogResult> {
    if (!this.config.enabled) {
      return { success: true };
    }

    try {
      const id = generateId();
      const timestamp = getCurrentTimestamp();

      // Apply config defaults
      const finalEntry: AuditLogEntry = {
        id,
        timestamp,
        ...entry,
        organizationId: entry.organizationId || this.config.defaultOrganizationId,
      };

      // Filter out captures based on config
      if (!this.config.captureIp) {
        delete finalEntry.ipAddress;
      }
      if (!this.config.captureUserAgent) {
        delete finalEntry.userAgent;
      }
      if (!this.config.storeChanges) {
        delete finalEntry.changes;
      }

      const sql = `
        INSERT INTO audit_logs (
          id, timestamp, user_id, user_name, action, model, model_id,
          ip_address, user_agent, metadata, changes, description,
          session_id, organization_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        finalEntry.id,
        finalEntry.timestamp,
        finalEntry.userId,
        finalEntry.userName || null,
        finalEntry.action,
        finalEntry.model || null,
        finalEntry.modelId || null,
        finalEntry.ipAddress || null,
        finalEntry.userAgent || null,
        finalEntry.metadata ? JSON.stringify(finalEntry.metadata) : null,
        finalEntry.changes ? JSON.stringify(finalEntry.changes) : null,
        finalEntry.description || null,
        finalEntry.sessionId || null,
        finalEntry.organizationId || null,
      ];

      const result = await this.d1Client.execute(sql, params);

      if (!result.success) {
        return {
          success: false,
          error: result.error?.message || 'Failed to create audit log',
        };
      }

      return {
        success: true,
        id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Query audit logs with filters
   *
   * @example
   * ```typescript
   * const result = await audit.query({
   *   userId: 'user_123',
   *   model: 'Post',
   *   action: 'CREATE',
   *   limit: 50
   * });
   * ```
   */
  async query(filter: AuditLogFilter = {}): Promise<AuditLogQueryResult> {
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (filter.userId) {
        conditions.push('user_id = ?');
        params.push(filter.userId);
      }
      if (filter.model) {
        conditions.push('model = ?');
        params.push(filter.model);
      }
      if (filter.modelId) {
        conditions.push('model_id = ?');
        params.push(filter.modelId);
      }
      if (filter.action) {
        conditions.push('action = ?');
        params.push(filter.action);
      }
      if (filter.organizationId) {
        conditions.push('organization_id = ?');
        params.push(filter.organizationId);
      }
      if (filter.startDate) {
        conditions.push('timestamp >= ?');
        params.push(filter.startDate);
      }
      if (filter.endDate) {
        conditions.push('timestamp <= ?');
        params.push(filter.endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const sortOrder = filter.sortOrder || 'DESC';
      const limit = filter.limit || 100;
      const offset = filter.offset || 0;

      const sql = `
        SELECT
          id, timestamp, user_id, user_name, action, model, model_id,
          ip_address, user_agent, metadata, changes, description,
          session_id, organization_id
        FROM audit_logs
        ${whereClause}
        ORDER BY timestamp ${sortOrder}
        LIMIT ? OFFSET ?
      `;

      const queryParams = [...params, limit, offset];
      const result = await this.d1Client.query<AuditLogEntry>(sql, queryParams);

      if (!result.success) {
        return {
          success: false,
          error: result.error?.message || 'Failed to query audit logs',
        };
      }

      // Parse JSON fields
      const entries = result.data.map((entry: AuditLogEntry) => ({
        ...entry,
        metadata: typeof entry.metadata === 'string' ? JSON.parse(entry.metadata) : entry.metadata,
        changes: typeof entry.changes === 'string' ? JSON.parse(entry.changes) : entry.changes,
      }));

      // Get total count
      const countSql = `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`;
      const countResult = await this.d1Client.queryFirst<{ total: number }>(countSql, params);
      const total = countResult.success ? countResult.data?.total || 0 : 0;

      return {
        success: true,
        entries,
        total,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get audit logs for a specific model record
   *
   * @example
   * ```typescript
   * const logs = await audit.getModelHistory('Post', 'post_456');
   * ```
   */
  async getModelHistory(
    model: string,
    modelId: string,
    limit = 50
  ): Promise<AuditLogQueryResult> {
    return this.query({ model, modelId, limit });
  }

  /**
   * Get audit logs for a specific user
   *
   * @example
   * ```typescript
   * const logs = await audit.getUserHistory('user_123', 100);
   * ```
   */
  async getUserHistory(userId: string, limit = 100): Promise<AuditLogQueryResult> {
    return this.query({ userId, limit });
  }

  /**
   * Delete old audit logs (data retention)
   *
   * @example
   * ```typescript
   * // Delete logs older than 90 days
   * const date = new Date();
   * date.setDate(date.getDate() - 90);
   * await audit.deleteOlderThan(date.toISOString());
   * ```
   */
  async deleteOlderThan(timestamp: string): Promise<AuditLogResult> {
    try {
      const sql = 'DELETE FROM audit_logs WHERE timestamp < ?';
      const result = await this.d1Client.execute(sql, [timestamp]);

      if (!result.success) {
        return {
          success: false,
          error: result.error?.message || 'Failed to delete old audit logs',
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Simple function-based API for quick audit logging
 *
 * @example
 * ```typescript
 * import { createAuditLogger } from '@ottabase/auditlog';
 * import { D1Client } from '@ottabase/cf/d1';
 *
 * const d1Client = new D1Client({ database: env.DB });
 * const auditlog = createAuditLogger(d1Client);
 *
 * // Log an action
 * await auditlog({
 *   userId: 'user_123',
 *   action: 'UPDATE',
 *   model: 'User',
 *   modelId: 'user_123',
 *   description: 'Updated user profile'
 * });
 * ```
 */
export function createAuditLogger(d1Client: D1Client, config?: AuditLogConfig) {
  const audit = new AuditLog(d1Client, config);
  return (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => audit.log(entry);
}

/**
 * Helper to create audit log for model operations
 *
 * @example
 * ```typescript
 * import { auditModel } from '@ottabase/auditlog';
 *
 * await auditModel(d1Client, {
 *   model: 'Post',
 *   modelId: 'post_123',
 *   action: 'UPDATE',
 *   user: { id: 'user_456', name: 'Jane Doe' },
 *   changes: {
 *     before: { title: 'Old Title' },
 *     after: { title: 'New Title' }
 *   }
 * });
 * ```
 */
export async function auditModel(
  d1Client: D1Client,
  options: {
    model: string;
    modelId: string;
    action: AuditAction;
    user: { id: string; name?: string };
    changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> };
    description?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    organizationId?: string;
  }
): Promise<AuditLogResult> {
  const audit = new AuditLog(d1Client);
  return audit.log({
    userId: options.user.id,
    userName: options.user.name,
    action: options.action,
    model: options.model,
    modelId: options.modelId,
    changes: options.changes,
    description: options.description,
    metadata: options.metadata,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    sessionId: options.sessionId,
    organizationId: options.organizationId,
  });
}
