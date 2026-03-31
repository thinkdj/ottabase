/**
 * Page Schema
 *
 * A page is a configurable landing page that can be:
 * - Block-based: Composed of sections (hero, features, CTA, etc.)
 * - Content-based: Rich text content (links to ottablog Post for content)
 *
 * Example pages: homepage, about, pricing, features, contact
 */
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Page type determines how it's rendered
export type PageType = 'block' | 'content';

// Page status (similar to Post status)
export type PageStatus = 'draft' | 'published' | 'archived';

export const pagesTable = sqliteTable(
    'pages',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        // URL slug (e.g., 'homepage', 'about', 'pricing')
        // 'homepage' is the default landing page
        slug: text('slug').notNull().unique(),

        // Display title
        title: text('title').notNull(),

        // Page type: 'block' (section-based) or 'content' (rich text via ottablog)
        type: text('type').$type<PageType>().notNull().default('block'),

        // Publication status
        status: text('status').$type<PageStatus>().notNull().default('draft'),

        // For content-type pages, link to ottablog Post
        // This allows using the full ottablog editor for content pages
        postId: text('post_id'),

        // Theme preset for this page (overrides default)
        themePreset: text('theme_preset'),

        // SEO metadata
        seoTitle: text('seo_title'),
        seoDescription: text('seo_description'),
        seoKeywords: text('seo_keywords'),

        // Custom CSS for this page
        customCss: text('custom_css'),

        // Variant overrides for sections (JSON: { "hero": "centered", "features": "grid" })
        variantBySlotJson: text('variant_by_slot_json', { mode: 'json' }).$type<Record<string, string>>(),

        // Whether to show in main navigation
        showInNav: integer('show_in_nav', { mode: 'boolean' }).notNull().default(false),

        // Nav order (lower = first)
        navOrder: integer('nav_order').notNull().default(100),

        // Nav label (defaults to title if not set)
        navLabel: text('nav_label'),

        // Optional icon for nav
        icon: text('icon'),

        // Metadata (JSON blob for extensibility)
        metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),

        // Multi-tenant support
        appId: text('app_id'),

        // Timestamps
        createdAt: integer('created_at')
            .$defaultFn(() => Date.now())
            .notNull(),
        updatedAt: integer('updated_at')
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now())
            .notNull(),
    },
    (table) => [
        index('pages_slug_idx').on(table.slug),
        index('pages_status_idx').on(table.status),
        index('pages_nav_idx').on(table.showInNav, table.navOrder),
        index('pages_app_idx').on(table.appId),
    ],
);

export type PageRow = typeof pagesTable.$inferSelect;
export type NewPageRow = typeof pagesTable.$inferInsert;
