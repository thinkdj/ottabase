// ============================================================
// @ottabase/ottaorm - UserGroup junction tables schema
// ============================================================
//
// A generic, reusable "group of users within an organization". App features attach their own
// entity to a group via a `user_group_id` FK (e.g. an expense group, a project, a trip), so the
// member / role / invite machinery lives here ONCE and is shared across features instead of every
// app re-implementing membership.
// ============================================================

import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { organizationsTable } from './Organization.schema';
import { usersTable } from './User.schema';

/**
 * user_groups: a named grouping of users inside one organization, optionally scoped to a single
 * app (`app_id` null = shared across the org's apps).
 */
export const userGroupsTable = sqliteTable(
    'user_groups',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        name: text('name').notNull(),
        slug: text('slug').notNull(),
        description: text('description'),
        organizationId: text('organization_id')
            .notNull()
            .references(() => organizationsTable.id, { onDelete: 'cascade' }),
        // Optional app scope; null = an org-wide group shared across the org's apps.
        appId: text('app_id'),
        createdBy: text('created_by').references(() => usersTable.id, { onDelete: 'set null' }),
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
        // Slug is unique per organization + app. NOTE: SQLite treats rows with a NULL app_id as
        // distinct, so the model layer also guards slug uniqueness for org-wide (app_id null) groups.
        slugUnique: uniqueIndex('user_groups_org_app_slug_unique').on(t.organizationId, t.appId, t.slug),
        orgIdx: index('user_groups_org_idx').on(t.organizationId),
    }),
);

/**
 * user_group_members: a user's (or a pending email invite's) membership in a user_group.
 *
 * Mirrors organization_members: a free-form `role` (apps define the vocabulary; defaults to
 * "member"), a status lifecycle (`invited` → `active`, or `suspended`), and email-first invites
 * (`user_id` is null for a pending `invited_email` until the invitee signs up and the invite is
 * activated). `organization_id` is denormalized so tenant-scoped RLS needs no join.
 */
export const userGroupMembersTable = sqliteTable(
    'user_group_members',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        groupId: text('group_id')
            .notNull()
            .references(() => userGroupsTable.id, { onDelete: 'cascade' }),
        organizationId: text('organization_id')
            .notNull()
            .references(() => organizationsTable.id, { onDelete: 'cascade' }),
        userId: text('user_id').references(() => usersTable.id, { onDelete: 'cascade' }),
        invitedEmail: text('invited_email'),
        role: text('role').notNull().default('member'),
        status: text('status').notNull().default('invited'), // invited | active | suspended
        invitedBy: text('invited_by'),
        invitedAt: integer('invited_at'),
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
        // A given user appears at most once per group; a given pending email invite at most once per
        // group. (The "other" identity column is NULL in each case, which SQLite treats as distinct,
        // so the two uniques don't clash for user-vs-invite rows.)
        memberUserUnique: uniqueIndex('user_group_members_group_user_unique').on(t.groupId, t.userId),
        memberEmailUnique: uniqueIndex('user_group_members_group_email_unique').on(t.groupId, t.invitedEmail),
        groupIdx: index('user_group_members_group_idx').on(t.groupId),
        userIdx: index('user_group_members_user_idx').on(t.userId),
        orgIdx: index('user_group_members_org_idx').on(t.organizationId),
    }),
);

export type UserGroupType = typeof userGroupsTable.$inferSelect;
export type NewUserGroupType = typeof userGroupsTable.$inferInsert;
export type UserGroupMemberType = typeof userGroupMembersTable.$inferSelect;
export type NewUserGroupMemberType = typeof userGroupMembersTable.$inferInsert;
