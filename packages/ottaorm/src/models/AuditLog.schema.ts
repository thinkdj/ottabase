// ============================================================
// @ottabase/ottaorm - AuditLog table schema
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { usersTable } from './User.schema';

/**
 * AuditLog table schema for tracking all system actions
 *
 * Captures who did what, when, and what changed
 */
export const auditLogsTable = sqliteTable('audit_logs', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    // Who performed the action
    userId: text('user_id').references(() => usersTable.id, { onDelete: 'set null' }),
    userEmail: text('user_email'), // Denormalized for quick access
    // Multi-tenant and multi-app context (Tenant > App > User hierarchy)
    organizationId: text('organization_id'), // Organization/tenant scoping
    appId: text('app_id'), // App context (web, admin, api)
    // What action was performed
    action: text('action').notNull(), // e.g., 'create', 'update', 'delete', 'login', 'logout'
    // What resource was affected
    resourceType: text('resource_type').notNull(), // e.g., 'user', 'post', 'role'
    resourceId: text('resource_id'), // ID of the affected resource
    // Details about the change
    changes: text('changes'), // JSON string of before/after values
    metadata: text('metadata'), // JSON string of additional context
    // Request context
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    // Status
    status: text('status')
        .$defaultFn(() => 'success')
        .notNull(), // 'success', 'failure', 'error'
    errorMessage: text('error_message'),
    // Timestamp
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
});

/**
 * AuditLog model type
 */
export type AuditLogType = typeof auditLogsTable.$inferSelect;
export type NewAuditLogType = typeof auditLogsTable.$inferInsert;
