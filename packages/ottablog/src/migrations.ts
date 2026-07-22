/**
 * Ottablog migrations.
 *
 * `ottablogOrgModeMigrations` applies ONLY when the app runs the blog in org
 * mode (features.ottablog.mode === 'org'): register it conditionally in the
 * app's package-migration registry. It swaps the app-scoped unique slug
 * indexes for org-aware pairs so each organization gets its own slug
 * namespace, while platform-owned rows (organization_id IS NULL) keep
 * app-scoped uniqueness via partial indexes.
 *
 * SQLite treats NULLs as distinct in unique indexes, so a single
 * (organization_id, app_id, slug) index would silently stop constraining
 * platform-owned rows — hence the IS NULL / IS NOT NULL pairs.
 *
 * Statements are idempotent (IF EXISTS / IF NOT EXISTS): safe on fresh
 * installs (running right after auto-init created tables and columns) and on
 * re-runs.
 */

interface MigrationDb {
    executeRaw?: (sql: string) => Promise<unknown>;
    execute?: (sql: string) => Promise<unknown>;
}

async function exec(db: MigrationDb, sql: string): Promise<void> {
    if (db.executeRaw) {
        await db.executeRaw(sql);
    } else if (db.execute) {
        await db.execute(sql);
    } else {
        throw new Error('ottablog migration: driver exposes neither executeRaw nor execute');
    }
}

const ORG_MODE_INDEX_STATEMENTS: string[] = [
    // posts: drop the strict app-wide unique slug index; org rows are constrained by the
    // existing posts_org_app_slug_unique_idx, platform rows by the partial below.
    `DROP INDEX IF EXISTS posts_app_id_slug_unique_idx`,
    `CREATE UNIQUE INDEX IF NOT EXISTS posts_app_slug_unique_no_org_idx
        ON posts(app_id, slug) WHERE organization_id IS NULL`,

    // categories
    `DROP INDEX IF EXISTS categories_app_id_type_slug_unique_idx`,
    `CREATE UNIQUE INDEX IF NOT EXISTS categories_org_app_type_slug_unique_idx
        ON categories(organization_id, app_id, type, slug) WHERE organization_id IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS categories_app_type_slug_unique_no_org_idx
        ON categories(app_id, type, slug) WHERE organization_id IS NULL`,

    // post_tags
    `DROP INDEX IF EXISTS post_tags_app_id_type_slug_unique_idx`,
    `CREATE UNIQUE INDEX IF NOT EXISTS post_tags_org_app_type_slug_unique_idx
        ON post_tags(organization_id, app_id, type, slug) WHERE organization_id IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS post_tags_app_type_slug_unique_no_org_idx
        ON post_tags(app_id, type, slug) WHERE organization_id IS NULL`,

    // series
    `DROP INDEX IF EXISTS series_app_id_slug_unique_idx`,
    `CREATE UNIQUE INDEX IF NOT EXISTS series_org_app_slug_unique_idx
        ON series(organization_id, app_id, slug) WHERE organization_id IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS series_app_slug_unique_no_org_idx
        ON series(app_id, slug) WHERE organization_id IS NULL`,

    // ottablog_themes: theme registry rows become per-(org, app)
    `DROP INDEX IF EXISTS ottablog_themes_app_id_theme_id_unique_idx`,
    `CREATE UNIQUE INDEX IF NOT EXISTS ottablog_themes_org_app_theme_unique_idx
        ON ottablog_themes(organization_id, app_id, theme_id) WHERE organization_id IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS ottablog_themes_app_theme_unique_no_org_idx
        ON ottablog_themes(app_id, theme_id) WHERE organization_id IS NULL`,

    // ottablog_plugins: plugin rows become per-(org, app)
    `DROP INDEX IF EXISTS ottablog_plugins_app_id_plugin_id_unique_idx`,
    `CREATE UNIQUE INDEX IF NOT EXISTS ottablog_plugins_org_app_plugin_unique_idx
        ON ottablog_plugins(organization_id, app_id, plugin_id) WHERE organization_id IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS ottablog_plugins_app_plugin_unique_no_org_idx
        ON ottablog_plugins(app_id, plugin_id) WHERE organization_id IS NULL`,
];

export const ottablogOrgModeMigrations = [
    {
        name: 'ottablog_org_mode_slug_scope_v1',
        up: async (db: MigrationDb) => {
            for (const sql of ORG_MODE_INDEX_STATEMENTS) {
                await exec(db, sql);
            }
        },
    },
];
