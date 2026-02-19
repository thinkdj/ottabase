// ============================================================
// @ottabase/ottaorm - OrganizationMember junction table schema
// ============================================================

import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { organizationsTable } from './Organization.schema';
import { usersTable } from './User.schema';

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
        invitedAt: integer('invited_at'),
        joinedAt: integer('joined_at')
            .$defaultFn(() => Date.now())
            .notNull(),
        metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
    },
    (table) => ({
        pk: primaryKey({ columns: [table.userId, table.organizationId] }),
    }),
);

/**
 * OrganizationMember model type
 */
export type OrganizationMemberType = typeof organizationMembersTable.$inferSelect;
export type NewOrganizationMemberType = typeof organizationMembersTable.$inferInsert;
