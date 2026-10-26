/**
 * Ottablog migrations.
 *
 * Every blog is scoped by organization: an organization's own blog, or the site blog
 * (organization_id NULL). The schemas declare per-blog unique slug indexes; this migration brings
 * an install made before blogs were scoped up to date, once:
 *
 *  - An install that served ONE app-wide blog stamped each post with its author's workspace, so
 *    that content becomes the site blog. An install that already served organization blogs (it
 *    recorded `ottablog_org_mode_slug_scope_v1`) keeps its scopes as they are.
 *  - Comments on posts take their post's blog.
 *  - The old app-wide unique slug indexes are dropped: they would stop two blogs sharing a slug.
 *
 * A fresh install has nothing to convert. Not idempotent DDL (it moves data), so it declares no
 * `affectedTables`: it must never re-run after a table rebuild.
 */

/** Both migration runners (`runMigrations` and `autoInit`) hand `up()` the DbDriver. */
interface MigrationDb {
    executeRaw: (sql: string, params?: unknown[]) => Promise<unknown>;
}

/** Recorded by installs that already served organization blogs before blogs were always scoped. */
const ORG_BLOGS_MIGRATION = 'ottablog_org_mode_slug_scope_v1';

/** Tables whose rows belong to one blog. */
const BLOG_SCOPED_TABLES = [
    'posts',
    'post_versions',
    'post_translations',
    'categories',
    'post_tags',
    'series',
    'ottablog_themes',
    'ottablog_plugins',
    'ottablog_settings',
];

const APP_WIDE_SLUG_INDEXES = [
    'posts_app_id_slug_unique_idx',
    'categories_app_id_type_slug_unique_idx',
    'post_tags_app_id_type_slug_unique_idx',
    'series_app_id_slug_unique_idx',
    'ottablog_themes_app_id_theme_id_unique_idx',
    'ottablog_plugins_app_id_plugin_id_unique_idx',
];

function hasRows(result: unknown): boolean {
    if (Array.isArray(result)) return result.length > 0;
    const rows = (result as { results?: unknown[] } | null)?.results;
    return Array.isArray(rows) && rows.length > 0;
}

async function servedOrganizationBlogs(db: MigrationDb): Promise<boolean> {
    try {
        return hasRows(
            await db.executeRaw('SELECT 1 FROM _ottabase_migrations WHERE name = ? LIMIT 1', [ORG_BLOGS_MIGRATION]),
        );
    } catch {
        return false;
    }
}

export const ottablogMigrations = [
    {
        name: 'ottablog_blog_scopes_v1',
        up: async (db: MigrationDb) => {
            if (!(await servedOrganizationBlogs(db))) {
                // OR IGNORE: a row that would collide with another blog's slug keeps its scope
                // rather than failing the whole upgrade.
                for (const table of BLOG_SCOPED_TABLES) {
                    await db.executeRaw(`UPDATE OR IGNORE ${table} SET organization_id = NULL`);
                }
            }
            try {
                await db.executeRaw(
                    `UPDATE comments SET organization_id =
                        (SELECT posts.organization_id FROM posts WHERE posts.id = comments.target_id)
                     WHERE target_type = 'post' AND target_id IN (SELECT id FROM posts)`,
                );
            } catch {
                // No comments package installed: nothing to re-scope.
            }
            for (const index of APP_WIDE_SLUG_INDEXES) {
                await db.executeRaw(`DROP INDEX IF EXISTS ${index}`);
            }
        },
    },
];
