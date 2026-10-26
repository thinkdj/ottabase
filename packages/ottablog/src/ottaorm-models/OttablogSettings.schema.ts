/**
 * Blog-level configuration.
 *
 * The settings row is deliberately separate from themes/plugins: it is safe to
 * expose the language list to public readers while keeping the rest of Studio
 * state admin-only. It also holds the locked-category teaser policy.
 */
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { tolerantJsonText } from './tolerant-json-column';
import type { BlogLanguage, LockedTeaserField } from '../types';

export const ottablogSettingsTable = sqliteTable(
    'ottablog_settings',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        appId: text('app_id'),
        organizationId: text('organization_id'),
        defaultLanguage: text('default_language').notNull().default('en'),
        supportedLanguages: tolerantJsonText<BlogLanguage[]>('supported_languages'),
        fallbackToDefault: integer('fallback_to_default', { mode: 'boolean' }).notNull().default(true),
        // Fields of a locked post shown to readers without access. Null/empty = locked posts hidden.
        lockedTeaser: tolerantJsonText<LockedTeaserField[]>('locked_teaser'),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => [
        index('ottablog_settings_app_org_idx').on(table.appId, table.organizationId),
        uniqueIndex('ottablog_settings_scope_unique_idx').on(
            sql`coalesce(${table.appId}, '')`,
            sql`coalesce(${table.organizationId}, '')`,
        ),
        index('ottablog_settings_default_language_idx').on(table.defaultLanguage),
    ],
);

export type OttablogSettingsType = typeof ottablogSettingsTable.$inferSelect;
export type NewOttablogSettingsType = typeof ottablogSettingsTable.$inferInsert;
