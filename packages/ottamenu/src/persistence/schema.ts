// ---------------------------------------------------------------------------
// Ottamenu – Persistence Schema (D1)
// Menus and menu items. Scoped by appId (like brand engine).
// ---------------------------------------------------------------------------

import { foreignKey, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// ═══════════════════════════════════════════════════════════════════
// MENUS – Container for menu items (e.g. sidebar, header, footer)
// slug identifies usage: 'sidebar', 'header', 'main-nav', etc.
// ═══════════════════════════════════════════════════════════════════

export const menusTable = sqliteTable('menus', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),

    /** App this menu belongs to. null = system default. */
    appId: text('app_id'),

    /** Display name (e.g. "Main Navigation") */
    name: text('name').notNull(),

    /** Identifier for layout usage: 'sidebar', 'header', 'main-nav', etc. */
    slug: text('slug').notNull(),

    /** Default render type: sidebar, flyout, etc. Menu can be rendered any way; this is the default. */
    type: text('type').notNull().default('sidebar'),

    /** First menu with this slug is used when slot is requested */
    isDefault: integer('is_default', { mode: 'boolean' }).default(true),

    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type MenuType = typeof menusTable.$inferSelect;
export type NewMenuType = typeof menusTable.$inferInsert;

// ═══════════════════════════════════════════════════════════════════
// MENU ITEMS – Strongly typed per-item fields
// ═══════════════════════════════════════════════════════════════════

export const menuItemsTable = sqliteTable(
    'menu_items',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        menuId: text('menu_id')
            .notNull()
            .references(() => menusTable.id, { onDelete: 'cascade' }),

        /** Denormalized from menu for RLS/security checks (avoids extra Menu fetch on update/delete) */
        appId: text('app_id'),

        /** Parent item for nesting; null = top-level */
        parentId: text('parent_id'),

        /** Display label */
        name: text('name').notNull(),

        /** Route path (e.g. /blog) or full URL */
        link: text('link').notNull(),

        /** Open in new tab */
        newTab: integer('new_tab', { mode: 'boolean' }).default(false),

        /** Require auth to show */
        authRequired: integer('auth_required', { mode: 'boolean' }).default(false),

        /** Optional description */
        description: text('description'),

        /** Optional image URL or R2 key */
        image: text('image'),

        /** Optional tooltip/hover text */
        tooltip: text('tooltip'),

        /** Sort order (lower = first) */
        sortOrder: integer('sort_order').default(0),

        createdAt: integer('created_at')
            .$defaultFn(() => Date.now())
            .notNull(),
        updatedAt: integer('updated_at')
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now())
            .notNull(),
    },
    (t) => [
        foreignKey({ columns: [t.parentId], foreignColumns: [t.id], name: 'menu_items_parent_fk' }).onDelete('cascade'),
    ],
);

export type MenuItemType = typeof menuItemsTable.$inferSelect;
export type NewMenuItemType = typeof menuItemsTable.$inferInsert;
