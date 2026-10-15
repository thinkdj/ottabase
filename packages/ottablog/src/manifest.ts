import { definePackage, type OttaPackage, type PackageExtras } from '@ottabase/kernel';
import { RLSPolicies, type Migration, type ModelRLSConfig } from '@ottabase/ottaorm';
import { ottablogOrgModeMigrations, ottablogOrgModeSuppressedIndexes } from './migrations';
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

export interface OttablogPackageOptions<Env> extends PackageExtras<Env> {
    /**
     * `platform`: one blog per app, slugs unique app-wide. `org`: every organization has its own
     * blog, slugs unique per organization, tenant-scoped policies on the shared tables.
     *
     * STRUCTURAL: it decides which migrations run and which policies guard the tables, so it is
     * a value in `ottabase.config.ts`, never an env var. Default `platform`.
     */
    mode?: 'platform' | 'org';
}

/** Tables that every organization writes to in org mode, and so need a tenant-scoped policy there. */
const ORG_MODE_SHARED_TABLES = [
    'categories',
    'post_tags',
    'series',
    'ottablog_themes',
    'ottablog_plugins',
    'ottablog_settings',
    'post_translations',
];

export function ottablogOrgModePolicies(): ModelRLSConfig[] {
    return ORG_MODE_SHARED_TABLES.map((model) => ({
        model,
        policy: RLSPolicies.TenantScoped(false),
        contextFields: ['organizationId', 'appId'],
        auditEnabled: true,
    }));
}

/** The blog package as the app registers it. The host adds the routes (its handlers own sessions and SEO). */
export function createOttablogPackage<Env = unknown>(options: OttablogPackageOptions<Env> = {}): OttaPackage<Env> {
    const { mode = 'platform', ...extras } = options;
    const org = mode === 'org';
    return definePackage<Env>({
        key: OTTABLOG_PACKAGE_KEY,
        name: 'Blog',
        version: '1.0.0',
        description: 'Posts, categories, tags, series, versions, translations, themes and plugins.',
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
        migrations: org ? (ottablogOrgModeMigrations as Migration[]) : [],
        suppressIndexes: org ? ottablogOrgModeSuppressedIndexes : [],
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
        policies: org ? ottablogOrgModePolicies() : [],
        ...extras,
    });
}
