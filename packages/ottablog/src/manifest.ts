import { definePackage, type OttaPackage, type PackageExtras } from '@ottabase/kernel';
import type { Migration, ModelRLSConfig, SecurityContext } from '@ottabase/ottaorm';
import { ottablogMigrations } from './migrations';
import {
    categoriesTable,
    OttablogPlugin,
    ottablogPluginsTable,
    OttablogSettings,
    ottablogSettingsTable,
    OttablogTheme,
    ottablogThemesTable,
    Post,
    PostCategory,
    PostCategoryLink,
    postCategoryLinksTable,
    PostSeries,
    postsTable,
    PostTag,
    PostTagLink,
    postTagLinksTable,
    postTagsTable,
    PostTranslation,
    postTranslationsTable,
    PostVersion,
    postVersionsTable,
    seriesTable,
} from './ottaorm-models';

export const OTTABLOG_PACKAGE_KEY = 'ottablog';

export type OttablogPackageOptions<Env> = PackageExtras<Env>;

/** Tables whose rows belong to one blog (posts and post versions carry editorial policies in core). */
const BLOG_SCOPED_TABLES = [
    'categories',
    'post_tags',
    'series',
    'ottablog_themes',
    'ottablog_plugins',
    'ottablog_settings',
    'post_translations',
];

/**
 * A blog's rows, for whoever works in that blog: an organization's rows for a caller acting in
 * that organization (membership is enforced by the engine), the site blog's rows (organizationId
 * NULL) for a platform admin acting in platform scope. Anyone else, anonymous callers included,
 * reads nothing; public pages read through /api/blog instead.
 */
function blogScopeFilter(context: SecurityContext): Record<string, unknown> | null {
    if (!context.userId) return null;
    if (context.organizationId == null && context.platformAdmin !== true) return null;
    const filter: Record<string, unknown> = { organizationId: context.organizationId ?? null };
    if (context.appId) filter.appId = context.appId;
    return filter;
}

export function blogScopedPolicies(): ModelRLSConfig[] {
    return BLOG_SCOPED_TABLES.map((model) => ({
        model,
        policy: { level: 'custom', filter: blogScopeFilter },
        contextFields: ['organizationId', 'appId'],
        // A create lands in the caller's own blog: never the site blog unless a platform admin.
        createWithinReadScope: true,
        auditEnabled: true,
    }));
}

/** The blog package as the app registers it. The host adds the routes (its handlers own sessions and SEO). */
export function createOttablogPackage<Env = unknown>(options: OttablogPackageOptions<Env> = {}): OttaPackage<Env> {
    return definePackage<Env>({
        key: OTTABLOG_PACKAGE_KEY,
        name: 'Blog',
        version: '1.0.0',
        description:
            'Site and organization blogs: posts, categories, tags, series, versions, translations, themes and plugins.',
        tables: {
            seriesTable,
            categoriesTable,
            postsTable,
            postTagsTable,
            postTagLinksTable,
            postCategoryLinksTable,
            postVersionsTable,
            ottablogPluginsTable,
            ottablogThemesTable,
            ottablogSettingsTable,
            postTranslationsTable,
        },
        migrations: ottablogMigrations as Migration[],
        models: [
            Post,
            PostTag,
            PostTagLink,
            PostCategoryLink,
            PostCategory,
            PostSeries,
            PostVersion,
            OttablogPlugin,
            OttablogTheme,
            OttablogSettings,
            PostTranslation,
        ],
        policies: blogScopedPolicies(),
        ...options,
    });
}
