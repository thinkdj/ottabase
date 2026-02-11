// ---------------------------------------------------------------------------
// Brand Engine – Persistence Schema (D1)
// Stores brand settings with multi-tenant support (org/app level)
// ---------------------------------------------------------------------------

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Brand Settings Table
 * Stores all branding configuration with multi-tenant support
 */
export const brandSettingsTable = sqliteTable('brand_settings', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),

    // Multi-tenancy: null = system default, else organization/app specific
    organizationId: text('organization_id'),
    appId: text('app_id'), // Optional: app-specific overrides

    // ═══════════════════════════════════════════════════════════════════
    // IDENTITY
    // ═══════════════════════════════════════════════════════════════════

    /** Brand name (displayed in header, emails, etc.) */
    brandName: text('brand_name').notNull().default('My App'),

    /** Tagline / slogan */
    tagline: text('tagline'),

    // ═══════════════════════════════════════════════════════════════════
    // LOGOS (R2 keys)
    // ═══════════════════════════════════════════════════════════════════

    /** Primary logo (R2 key) */
    logoKey: text('logo_key'),

    /** Logo for dark mode (R2 key) */
    logoDarkKey: text('logo_dark_key'),

    /** Small icon/favicon (R2 key) */
    iconKey: text('icon_key'),

    /** Social share image (R2 key) */
    ogImageKey: text('og_image_key'),

    /** Email header logo (R2 key) */
    emailLogoKey: text('email_logo_key'),

    // ═══════════════════════════════════════════════════════════════════
    // DESIGN TOKENS (JSON - leverages existing brand-engine types)
    // ═══════════════════════════════════════════════════════════════════

    /** Full design tokens (JSON blob) - uses DesignTokens type */
    tokensJson: text('tokens_json'), // Partial<DesignTokens>

    /** Layout configuration (JSON) */
    layoutJson: text('layout_json'), // Partial<LayoutConfig>

    // ═══════════════════════════════════════════════════════════════════
    // APPEARANCE
    // ═══════════════════════════════════════════════════════════════════

    /** Default color scheme: 'light' | 'dark' | 'system' */
    defaultColorScheme: text('default_color_scheme').default('system'),

    /** Allow users to toggle dark mode */
    allowDarkModeToggle: integer('allow_dark_mode_toggle', { mode: 'boolean' }).default(true),

    // ═══════════════════════════════════════════════════════════════════
    // VERSIONING & DRAFT MODE
    // ═══════════════════════════════════════════════════════════════════

    /** Is this a draft (not published)? */
    isDraft: integer('is_draft', { mode: 'boolean' }).default(false),

    /** Version number (increments on publish) */
    version: integer('version').default(1),

    /** Previous version snapshot (JSON) for rollback */
    previousVersionJson: text('previous_version_json'),

    // ═══════════════════════════════════════════════════════════════════
    // ADVANCED
    // ═══════════════════════════════════════════════════════════════════

    /** Custom CSS (injected into <style>) */
    customCss: text('custom_css'),

    /** Custom meta tags (JSON) */
    customMetaJson: text('custom_meta_json'),

    /** White-label mode: hide "Powered by Ottabase" */
    hideOttabaseBranding: integer('hide_ottabase_branding', { mode: 'boolean' }).default(false),

    // ═══════════════════════════════════════════════════════════════════
    // METADATA
    // ═══════════════════════════════════════════════════════════════════

    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type BrandSettingsType = typeof brandSettingsTable.$inferSelect;
export type NewBrandSettingsType = typeof brandSettingsTable.$inferInsert;

// ═══════════════════════════════════════════════════════════════════
// LAYOUT TEMPLATES & ROUTE MAPPINGS
// ═══════════════════════════════════════════════════════════════════

/**
 * Layout Templates - Reusable layout definitions
 * Each template defines structure (header, nav, content width, etc.)
 */
export const layoutTemplatesTable = sqliteTable('layout_templates', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id'),
    appId: text('app_id'),

    /** Display name (e.g. "Homepage", "App Shell", "Docs") */
    name: text('name').notNull(),

    /** Registry key - maps to Layout component (e.g. "homepage", "app-shell", "docs") */
    componentKey: text('component_key').notNull(),

    /** Layout config (header, nav, contentWidth, etc.) - JSON */
    configJson: text('config_json').notNull(),

    /** Optional description */
    description: text('description'),

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

/**
 * Global/default route mappings (org-level or system-wide).
 * Maps path patterns to layout template IDs.
 */
export const layoutRouteMappingsTable = sqliteTable('layout_route_mappings', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id'),
    appId: text('app_id'),

    pathPattern: text('path_pattern').notNull(),
    /** Higher number = higher priority (checked first). Default catch-all /* should use 0 */
    priority: integer('priority').default(0),
    layoutTemplateId: text('layout_template_id').notNull(),

    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
});

export type LayoutRouteMappingType = typeof layoutRouteMappingsTable.$inferSelect;
export type NewLayoutRouteMappingType = typeof layoutRouteMappingsTable.$inferInsert;
