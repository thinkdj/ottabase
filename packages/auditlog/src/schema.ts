/**
 * Database schema for audit logs using Cloudflare D1
 */

/**
 * SQL schema for creating the audit_logs table in D1
 *
 * Usage:
 * ```typescript
 * import { createAuditLogTable } from '@ottabase/auditlog/schema';
 * import { D1Client } from '@ottabase/cf/d1';
 *
 * const d1Client = new D1Client({ database: env.DB });
 * await d1Client.execute(createAuditLogTable);
 * ```
 */
export const createAuditLogTable = `
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  timestamp TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  action TEXT NOT NULL,
  model TEXT,
  model_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT,
  changes TEXT,
  description TEXT,
  session_id TEXT,
  organization_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`;

/**
 * SQL for creating indexes on audit_logs table
 */
export const createAuditLogIndexes = `
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_model ON audit_logs(model);
CREATE INDEX IF NOT EXISTS idx_audit_logs_model_id ON audit_logs(model_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON audit_logs(session_id);
`;

/**
 * Complete schema setup including table and indexes
 */
export const auditLogSchema = [createAuditLogTable, createAuditLogIndexes];

/**
 * Helper function to initialize audit log schema in D1
 *
 * @example
 * ```typescript
 * import { initAuditLogSchema } from '@ottabase/auditlog/schema';
 * import { D1Client } from '@ottabase/cf/d1';
 *
 * const d1Client = new D1Client({ database: env.DB });
 * const result = await initAuditLogSchema(d1Client);
 * ```
 */
export async function initAuditLogSchema(
  d1Client: { execute: (sql: string) => Promise<unknown> }
): Promise<{ success: boolean; error?: string }> {
  try {
    for (const sql of auditLogSchema) {
      await d1Client.execute(sql);
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
