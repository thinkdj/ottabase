import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { organizationsTable } from './Organization.schema';
import { usersTable } from './User.schema';

/**
 * User groups — tenant-scoped collections of users for access control, feature flags,
 * notifications, etc. Membership can be by `userId` (registered) or `invitedEmail`
 * (pending invite that is auto-claimed when the user later signs up).
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
    (table) => [
        // Slug must be unique per organization (and per app when scoped)
        uniqueIndex('user_groups_org_app_slug_unique_idx').on(table.organizationId, table.appId, table.slug),
        // Common list query: groups within an organization, ordered by name
        index('user_groups_org_app_idx').on(table.organizationId, table.appId),
    ],
);

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
        /**
         * Lowercased email for pending invites. Always store via `invitedEmail.toLowerCase().trim()`
         * to make the unique index reliable across casings.
         */
        invitedEmail: text('invited_email'),
        role: text('role').notNull().default('member'),
        /** 'invited' | 'active' | 'declined' | 'removed' */
        status: text('status').notNull().default('invited'),
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
    (table) => [
        // A user can only be a member of a given group once
        uniqueIndex('user_group_members_group_user_unique_idx').on(table.groupId, table.userId),
        // A given email can only have one pending invite per group
        uniqueIndex('user_group_members_group_email_unique_idx').on(table.groupId, table.invitedEmail),
        // Lookups: members of a group / groups for a user / claim-by-email
        index('user_group_members_group_idx').on(table.groupId),
        index('user_group_members_user_idx').on(table.userId),
        index('user_group_members_email_idx').on(table.invitedEmail),
    ],
);

export type UserGroupType = typeof userGroupsTable.$inferSelect;
export type NewUserGroupType = typeof userGroupsTable.$inferInsert;
export type UserGroupMemberType = typeof userGroupMembersTable.$inferSelect;
export type NewUserGroupMemberType = typeof userGroupMembersTable.$inferInsert;
