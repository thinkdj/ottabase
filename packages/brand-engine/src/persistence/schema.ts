// ---------------------------------------------------------------------------
// Brand Engine – Persistence Schema (D1) – v2: Per-App scoping
// Brand Kit: scoped to appId (not org). One app = one brand/theme/layout.
// When users switch orgs, the app's brand stays the same.
// ---------------------------------------------------------------------------

import { foreignKey, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// ═══════════════════════════════════════════════════════════════════
// BRAND KITS – Self-contained: identity, logos, colors, fonts, theme
// Scoped by appId. System default has appId=null.
// ═══════════════════════════════════════════════════════════════════

export const brandKitsTable = sqliteTable('brand_kits', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),

    /** App this brand kit belongs to. null = system default fallback. */
    appId: text('app_id'),

    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),

    name: text('name').notNull(),
    slug: text('slug'),

    brandName: text('brand_name').notNull().default('My App'),
    tagline: text('tagline'),

    logoKey: text('logo_key'),
    logoDarkKey: text('logo_dark_key'),
    iconKey: text('icon_key'),
    ogImageKey: text('og_image_key'),
    emailLogoKey: text('email_logo_key'),

    themePresetId: text('theme_preset_id'),
    tokensJson: text('tokens_json'),

    defaultColorScheme: text('default_color_scheme').default('system'),
    allowDarkModeToggle: integer('allow_dark_mode_toggle', { mode: 'boolean' }).default(true),

    /** Parent Brand Kit for inheritance – child inherits all tokens/settings, overrides selectively */
    parentBrandKitId: text('parent_brand_kit_id'),

    customCss: text('custom_css'),
    hideOttabaseBranding: integer('hide_ottabase_branding', { mode: 'boolean' }).default(false),

    createdBy: text('created_by'),
    updatedBy: text('updated_by'),

    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type BrandKitType = typeof brandKitsTable.$inferSelect;
export type NewBrandKitType = typeof brandKitsTable.$inferInsert;

// ═══════════════════════════════════════════════════════════════════
// LAYOUT TEMPLATES – Scoped by appId only
// ═══════════════════════════════════════════════════════════════════

export const layoutTemplatesTable = sqliteTable('layout_templates', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    appId: text('app_id'),

    name: text('name').notNull(),
    componentKey: text('component_key').notNull(),
    configJson: text('config_json').notNull(),
    description: text('description'),

    createdBy: text('created_by'),
    updatedBy: text('updated_by'),

    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type LayoutTemplateType = typeof layoutTemplatesTable.$inferSelect;
export type NewLayoutTemplateType = typeof layoutTemplatesTable.$inferInsert;

// ═══════════════════════════════════════════════════════════════════
// ROUTE MAPPINGS – path → layout + brandKit per row, scoped by appId
// ═══════════════════════════════════════════════════════════════════

export const layoutRouteMappingsTable = sqliteTable('layout_route_mappings', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    appId: text('app_id'),

    pathPattern: text('path_pattern').notNull(),
    priority: integer('priority').default(0),
    layoutTemplateId: text('layout_template_id').notNull(),
    brandKitId: text('brand_kit_id').notNull(),

    /** Optional per-route token overrides – partial JSON applied on top of the brand kit's tokens */
    tokenOverridesJson: text('token_overrides_json'),

    createdBy: text('created_by'),

    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
});

export type LayoutRouteMappingType = typeof layoutRouteMappingsTable.$inferSelect;
export type NewLayoutRouteMappingType = typeof layoutRouteMappingsTable.$inferInsert;

// ═══════════════════════════════════════════════════════════════════
// MENU SLOT ASSIGNMENTS – Bind menus to named layout slots per app
// Slot names: 'header-nav', 'sidebar-nav', 'footer-nav', 'mobile-nav', etc.
// ═══════════════════════════════════════════════════════════════════

export const menuSlotAssignmentsTable = sqliteTable('menu_slot_assignments', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    appId: text('app_id'),

    /** Named slot in the layout (e.g. 'header-nav', 'sidebar-nav', 'footer-nav') */
    slotName: text('slot_name').notNull(),

    /** Menu to render in this slot (references menus.id) */
    menuId: text('menu_id').notNull(),

    /** How to render the menu: sidebar, mega, navbar, dropdown, flyout, footer */
    renderType: text('render_type').notNull().default('sidebar'),

    /** Sort order when multiple menus assigned to the same slot (lower = first) */
    sortOrder: integer('sort_order').default(0),

    createdBy: text('created_by'),

    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type MenuSlotAssignmentType = typeof menuSlotAssignmentsTable.$inferSelect;
export type NewMenuSlotAssignmentType = typeof menuSlotAssignmentsTable.$inferInsert;

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
        index('menu_items_appid_idx').on(t.appId),
        index('menu_items_menuid_idx').on(t.menuId),
    ],
);

export type MenuItemType = typeof menuItemsTable.$inferSelect;
export type NewMenuItemType = typeof menuItemsTable.$inferInsert;
