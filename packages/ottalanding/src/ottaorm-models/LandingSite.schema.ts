/**
 * LandingSite table schema — site-level config (name, nav, footer, theme)
 */
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const landingSitesTable = sqliteTable(
    'ottalanding_sites',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        /** App/product name */
        name: text('name').notNull(),

        /** Short tagline */
        tagline: text('tagline'),

        /** Logo URLs */
        logoUrl: text('logo_url'),
        logoDarkUrl: text('logo_dark_url'),
        faviconUrl: text('favicon_url'),

        /** Navigation links (JSON array of { label, href }) */
        navLinks: text('nav_links', { mode: 'json' })
            .notNull()
            .$type<Array<{ label: string; href: string }>>()
            .default([]),

        /** Navbar CTA button (JSON { label, href }) */
        navCta: text('nav_cta', { mode: 'json' }).$type<{ label: string; href: string } | null>(),

        /** Footer sections (JSON array) */
        footerSections: text('footer_sections', { mode: 'json' })
            .notNull()
            .$type<Array<{ title: string; links: Array<{ label: string; href: string }> }>>()
            .default([]),

        /** Social links (JSON array) */
        socialLinks: text('social_links', { mode: 'json' })
            .notNull()
            .$type<Array<{ name: string; href: string; icon?: string }>>()
            .default([]),

        /** Legal / copyright (JSON) */
        legal: text('legal', { mode: 'json' }).$type<{
            copyright?: string;
            links?: Array<{ label: string; href: string }>;
        } | null>(),

        /** Active theme ID (references theme registry) */
        themeId: text('theme_id').notNull().default('atlas'),

        /** Multi-app scoping */
        appId: text('app_id'),

        /** Organization scoping */
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
        uniqueIndex('ottalanding_sites_app_id_unique_idx').on(table.appId),
        index('ottalanding_sites_org_id_idx').on(table.organizationId),
    ],
);

export type LandingSiteType = typeof landingSitesTable.$inferSelect;
export type NewLandingSiteType = typeof landingSitesTable.$inferInsert;
