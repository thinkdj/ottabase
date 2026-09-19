/**
 * Schema exports for @ottabase/ottablog
 *
 * Re-exports schema tables and models from ottaorm-models.
 * Use this for database schema migrations and table definitions.
 */
export {
    PostSeries,
    seriesTable,
    PostCategory,
    categoriesTable,
    Post,
    postsTable,
    PostTag,
    postTagsTable,
    PostTagLink,
    postTagLinksTable,
    PostVersion,
    postVersionsTable,
    OttablogPlugin,
    ottablogPluginsTable,
    OttablogTheme,
    ottablogThemesTable,
    OttablogSettings,
    ottablogSettingsTable,
    PostTranslation,
    postTranslationsTable,
} from './ottaorm-models';
export type {
    Series,
    NewSeries,
    Category,
    NewCategory,
    NewPost,
    PostTagType,
    NewPostTagType,
    PostTagLinkType,
    NewPostTagLinkType,
    NewPostVersion,
    OttablogPluginType,
    NewOttablogPluginType,
    OttablogThemeType,
    NewOttablogThemeType,
    NewOttablogSettingsType,
    OttablogSettingsType,
    NewPostTranslationType,
    PostTranslationType,
} from './ottaorm-models';
