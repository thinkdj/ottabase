/**
 * Core types for audit logging system
 */

/**
 * Supported audit actions
 */
export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'READ'
  | 'LOGIN'
  | 'LOGOUT'
  | 'EXPORT'
  | 'IMPORT'
  | 'CUSTOM';

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  /**
   * Unique identifier for the audit log entry
   */
  id?: string;

  /**
   * Timestamp when the action occurred (ISO 8601)
   */
  timestamp: string;

  /**
   * User ID who performed the action
   */
  userId: string;

  /**
   * Username or display name (optional)
   */
  userName?: string;

  /**
   * Action performed
   */
  action: AuditAction;

  /**
   * Model/entity name (e.g., 'User', 'Post', 'Order')
   */
  model?: string;

  /**
   * Model record ID
   */
  modelId?: string;

  /**
   * IP address of the user
   */
  ipAddress?: string;

  /**
   * User agent string
   */
  userAgent?: string;

  /**
   * Additional metadata (stored as JSON)
   */
  metadata?: Record<string, unknown>;

  /**
   * Changes made (before/after state)
   */
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };

  /**
   * Description of the action
   */
  description?: string;

  /**
   * Session ID (optional)
   */
  sessionId?: string;

  /**
   * Organization/tenant ID (for multi-tenant systems)
   */
  organizationId?: string;
}

/**
 * Audit log query filters
 */
export interface AuditLogFilter {
  /**
   * Filter by user ID
   */
  userId?: string;

  /**
   * Filter by model name
   */
  model?: string;

  /**
   * Filter by model record ID
   */
  modelId?: string;

  /**
   * Filter by action
   */
  action?: AuditAction;

  /**
   * Filter by organization ID
   */
  organizationId?: string;

  /**
   * Start date (ISO 8601)
   */
  startDate?: string;

  /**
   * End date (ISO 8601)
   */
  endDate?: string;

  /**
   * Limit number of results
   */
  limit?: number;

  /**
   * Offset for pagination
   */
  offset?: number;

  /**
   * Sort order (default: DESC)
   */
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Result of audit log operations
 */
export interface AuditLogResult {
  /**
   * Success flag
   */
  success: boolean;

  /**
   * Created audit log entry ID
   */
  id?: string;

  /**
   * Error message if operation failed
   */
  error?: string;
}

/**
 * Result of audit log queries
 */
export interface AuditLogQueryResult {
  /**
   * Success flag
   */
  success: boolean;

  /**
   * Audit log entries
   */
  entries?: AuditLogEntry[];

  /**
   * Total count (for pagination)
   */
  total?: number;

  /**
   * Error message if operation failed
   */
  error?: string;
}

/**
 * Audit log configuration
 */
export interface AuditLogConfig {
  /**
   * Enable/disable audit logging
   */
  enabled?: boolean;

  /**
   * Default organization ID
   */
  defaultOrganizationId?: string;

  /**
   * Auto-capture IP address
   */
  captureIp?: boolean;

  /**
   * Auto-capture user agent
   */
  captureUserAgent?: boolean;

  /**
   * Store changes (before/after state)
   */
  storeChanges?: boolean;
}
