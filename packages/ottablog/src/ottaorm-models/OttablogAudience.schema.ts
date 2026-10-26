/**
 * Audiences: named groups of readers of one blog ("Family", "Close friends"). An audience opens
 * the locked (invite-only) categories it is given, and their subcategories, to its members.
 */
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const ottablogAudiencesTable = sqliteTable(
    'ottablog_audiences',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        name: text('name').notNull(),
        appId: text('app_id').notNull(),
        // The blog this belongs to: an organization's blog, or null for the site blog.
        organizationId: text('organization_id'),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => [
        // Unique names per blog. SQLite treats NULLs as distinct in a unique index, so the site
        // blog (null org) needs its own partial index.
        uniqueIndex('ottablog_audiences_org_app_name_unique_idx')
            .on(table.organizationId, table.appId, table.name)
            .where(sql`${table.organizationId} IS NOT NULL`),
        uniqueIndex('ottablog_audiences_app_name_unique_no_org_idx')
            .on(table.appId, table.name)
            .where(sql`${table.organizationId} IS NULL`),
    ],
);

/** A reader in an audience. Any account can be one; no membership of the blog's organization needed. */
export const ottablogAudienceMembersTable = sqliteTable(
    'ottablog_audience_members',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        audienceId: text('audience_id').notNull(),
        userId: text('user_id').notNull(),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
    },
    (table) => [
        uniqueIndex('ottablog_audience_members_audience_user_unique_idx').on(table.audienceId, table.userId),
        index('ottablog_audience_members_user_idx').on(table.userId),
    ],
);

/** An audience given a locked category. */
export const ottablogCategoryAudiencesTable = sqliteTable(
    'ottablog_category_audiences',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        categoryId: text('category_id').notNull(),
        audienceId: text('audience_id').notNull(),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
    },
    (table) => [
        uniqueIndex('ottablog_category_audiences_category_audience_unique_idx').on(table.categoryId, table.audienceId),
        index('ottablog_category_audiences_audience_idx').on(table.audienceId),
    ],
);

export type OttablogAudienceType = typeof ottablogAudiencesTable.$inferSelect;
export type NewOttablogAudienceType = typeof ottablogAudiencesTable.$inferInsert;
