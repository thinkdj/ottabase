// ============================================================
// @ottabase/ottaorm - OrganizationMember junction table schema
// ============================================================

import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { organizationsTable } from './Organization.schema';
import { usersTable } from './User.schema';

/**
 * OrganizationMember junction table — a user's (or a pending email invite's) membership in an
 * organization. Shares the membership shape with `user_group_members`: a single `id` primary key,
 * a `status` lifecycle (`active` / `invited` / `suspended`), and email-first invites (`user_id` is
 * null for a pending `invited_email` until the invitee signs up and the invite is activated).
 */
export const organizationMembersTable = sqliteTable(
    'organization_members',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        organizationId: text('organization_id')
            .notNull()
            .references(() => organizationsTable.id, { onDelete: 'cascade' }),
        // Null for a pending email invite until the invitee signs up.
        userId: text('user_id').references(() => usersTable.id, { onDelete: 'cascade' }),
        invitedEmail: text('invited_email'),
        role: text('role').notNull().default('member'), // owner, admin, member
        status: text('status').notNull().default('active'), // active, invited, suspended
        invitedBy: text('invited_by'),
        invitedAt: integer('invited_at'),
        // Stamped on activation (when status becomes active), so it is null for pending invites.
        joinedAt: integer('joined_at'),
        metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
        createdAt: integer('created_at')
            .$defaultFn(() => Date.now())
            .notNull(),
        updatedAt: integer('updated_at')
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now())
            .notNull(),
    },
    (t) => ({
        // One membership per user per org, and one pending invite per email per org. (SQLite treats
        // the NULL "other identity" column as distinct, so user rows and invite rows never clash.)
        memberUserUnique: uniqueIndex('organization_members_org_user_unique').on(t.organizationId, t.userId),
        memberEmailUnique: uniqueIndex('organization_members_org_email_unique').on(t.organizationId, t.invitedEmail),
        userIdx: index('organization_members_user_idx').on(t.userId),
        orgIdx: index('organization_members_org_idx').on(t.organizationId),
        roleCheck: check('organization_members_role_check', sql`${t.role} IN ('owner', 'admin', 'member')`),
        statusCheck: check('organization_members_status_check', sql`${t.status} IN ('active', 'invited', 'suspended')`),
        pendingInviteStatusCheck: check(
            'organization_members_pending_invite_status_check',
            sql`(${t.userId} IS NULL AND ${t.status} = 'invited' AND ${t.invitedEmail} IS NOT NULL)
                OR (${t.userId} IS NOT NULL AND ${t.status} != 'invited')`,
        ),
    }),
);

/**
 * OrganizationMember model type
 */
export type OrganizationMemberType = typeof organizationMembersTable.$inferSelect;
export type NewOrganizationMemberType = typeof organizationMembersTable.$inferInsert;
