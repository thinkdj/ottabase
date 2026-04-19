// ============================================================
// @ottabase/ottaorm - Pending organization invites (email + token)
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { organizationsTable } from './Organization.schema';

/**
 * Email-based org invites: accept/decline via token; user may not exist yet.
 */
export const organizationInvitesTable = sqliteTable('organization_invites', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => `oinv-${crypto.randomUUID()}`),
    organizationId: text('organization_id')
        .notNull()
        .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull().default('member'),
    tokenHash: text('token_hash').notNull().unique(),
    status: text('status').notNull().default('pending'),
    invitedBy: text('invited_by'),
    invitedAt: integer('invited_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    expiresAt: integer('expires_at').notNull(),
    acceptedAt: integer('accepted_at'),
    declinedAt: integer('declined_at'),
    revokedAt: integer('revoked_at'),
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
});

export type OrganizationInviteType = typeof organizationInvitesTable.$inferSelect;
export type NewOrganizationInviteType = typeof organizationInvitesTable.$inferInsert;
