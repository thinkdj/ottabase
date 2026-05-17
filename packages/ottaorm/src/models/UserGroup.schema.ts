import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { organizationsTable } from './Organization.schema';
import { usersTable } from './User.schema';

export const userGroupsTable = sqliteTable('user_groups', {
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
});

export const userGroupMembersTable = sqliteTable('user_group_members', {
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
});

export type UserGroupType = typeof userGroupsTable.$inferSelect;
export type NewUserGroupType = typeof userGroupsTable.$inferInsert;
export type UserGroupMemberType = typeof userGroupMembersTable.$inferSelect;
export type NewUserGroupMemberType = typeof userGroupMembersTable.$inferInsert;
