// ============================================================
// @ottabase/ottaorm - OrganizationMember junction table schema
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { organizationsTable } from './Organization.schema';
import { usersTable } from './User.schema';

/**
 * OrganizationMember junction table
 * Links users to organizations with membership role
 */
export const organizationMembersTable = sqliteTable('organization_members', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => usersTable.id, { onDelete: 'cascade' }),
    invitedEmail: text('invited_email'),
    organizationId: text('organization_id')
        .notNull()
        .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'), // owner, admin, member
    status: text('status').notNull().default('active'), // active, invited, suspended
    invitedBy: text('invited_by'),
    invitedAt: integer('invited_at'),
    joinedAt: integer('joined_at'),
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
});

/**
 * OrganizationMember model type
 */
export type OrganizationMemberType = typeof organizationMembersTable.$inferSelect;
export type NewOrganizationMemberType = typeof organizationMembersTable.$inferInsert;
