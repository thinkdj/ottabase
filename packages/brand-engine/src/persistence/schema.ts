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

    /** Full design tokens (JSON) - color, typography, spacing, radius, shadow, motion, cursors */
    tokensJson: text('tokens_json'), // Partial<DesignTokens> + cursors

    /** Layout configuration (JSON) */
    layoutJson: text('layout_json'), // Partial<LayoutConfig>

    /** Base theme preset name (default, neo, artisan, etc.) – admin picks one; tokensJson overrides on top */
    themePresetId: text('theme_preset_id'), // null = use DEFAULT_BRAND_THEME

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
    // PRESETS (name != null = named preset; name = null = default config)
    // ═══════════════════════════════════════════════════════════════════

    /** Preset name (e.g. "Christmas 2024"); null = default for org/app */
    name: text('name'),
    /** Optional slug for API */
    slug: text('slug'),
    /** Is this the active preset for org/app? At most one per org/app */
    isActive: integer('is_active', { mode: 'boolean' }).default(false),
    /** Theme variant ID (links to theme_variants) */
    themeVariantId: text('theme_variant_id'),
    /** Route mappings (JSON) - overrides layout_data when set */
    routeMappingsJson: text('route_mappings_json'),
    /** Layout templates snapshot (JSON) - overrides layout_data when set */
    layoutTemplatesSnapshotJson: text('layout_templates_snapshot_json'),

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

// ═══════════════════════════════════════════════════════════════════
// THEME VARIANTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Theme Variants - Color/token overlays that can apply to any layout
 * Use case: Christmas theme, Black Friday, seasonal campaigns
 */
export const themeVariantsTable = sqliteTable('theme_variants', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id'),
    appId: text('app_id'),

    /** Display name (e.g. "Christmas", "Black Friday") */
    name: text('name').notNull(),

    /** Optional slug for API (e.g. "christmas-2024") */
    slug: text('slug'),

    /** Design tokens (colors, typography overrides) - JSON, partial DesignTokens */
    tokensJson: text('tokens_json').notNull(),

    /** Optional: date range for auto-activation (future) */
    activeFrom: integer('active_from'),
    activeUntil: integer('active_until'),

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

export type ThemeVariantType = typeof themeVariantsTable.$inferSelect;
export type NewThemeVariantType = typeof themeVariantsTable.$inferInsert;
