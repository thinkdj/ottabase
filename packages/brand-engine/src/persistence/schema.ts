// ---------------------------------------------------------------------------
// Brand Engine – Persistence Schema (D1)
// Brand Kit model: self-contained look-and-feel. Route mappings: path → layout + brandKit.
// ---------------------------------------------------------------------------

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// ═══════════════════════════════════════════════════════════════════
// BRAND KITS – Self-contained: identity, logos, colors, fonts, theme
// ═══════════════════════════════════════════════════════════════════

export const brandKitsTable = sqliteTable('brand_kits', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id'),

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
// LAYOUT TEMPLATES
// ═══════════════════════════════════════════════════════════════════

export const layoutTemplatesTable = sqliteTable('layout_templates', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id'),
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
// ROUTE MAPPINGS – path → layout + brandKit per row
// ═══════════════════════════════════════════════════════════════════

export const layoutRouteMappingsTable = sqliteTable('layout_route_mappings', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id'),
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
