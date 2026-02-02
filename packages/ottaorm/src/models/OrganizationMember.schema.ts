// ============================================================
// @ottabase/ottaorm - OrganizationMember junction table schema
// ============================================================

import { integer, sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
import { usersTable } from './User.schema';
import { organizationsTable } from './Organization.schema';

/**
 * OrganizationMember junction table
 * Links users to organizations with membership role
 */
export const organizationMembersTable = sqliteTable(
    'organization_members',
    {
        userId: text('user_id')
            .notNull()
            .references(() => usersTable.id, { onDelete: 'cascade' }),
        organizationId: text('organization_id')
            .notNull()
            .references(() => organizationsTable.id, { onDelete: 'cascade' }),
        role: text('role').notNull().default('member'), // owner, admin, member
        status: text('status').notNull().default('active'), // active, invited, suspended
        invitedBy: text('invited_by'),
        invitedAt: integer('invited_at', { mode: 'timestamp' }),
        joinedAt: integer('joined_at', { mode: 'timestamp' })
            .$defaultFn(() => new Date())
            .notNull(),
        metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
    },
    (table) => ({
        pk: primaryKey({ columns: [table.userId, table.organizationId] }),
    })
);

/**
 * OrganizationMember model type
 */
export type OrganizationMemberType = typeof organizationMembersTable.$inferSelect;
export type NewOrganizationMemberType = typeof organizationMembersTable.$inferInsert;
