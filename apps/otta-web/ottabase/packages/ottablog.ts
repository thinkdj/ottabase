// The blog package: the package owns its tables, models, migrations and policies
// (`createOttablogPackage`); this app adds the routes, whose handlers own sessions and SEO.
// The route table itself is canonical in @ottabase/ottablog/router.
import { createOttablogPackage } from '@ottabase/ottablog';
import { buildBlogRouter } from '@ottabase/ottablog/router';
import { ctxOf } from '../../worker/lib/api-context';
import {
    handleBlogAuthorById,
    handleBlogBlurbCreate,
    handleBlogBlurbUpdate,
    handleBlogCategoryBySlug,
    handleBlogDemoSeed,
    handleBlogExport,
    handleBlogImport,
    handleBlogPhotoJournalCreate,
    handleBlogPhotoJournalUpdate,
    handleBlogPostBySlug,
    handleBlogPostsList,
    handleBlogPostTranslationCreate,
    handleBlogPostTranslationDelete,
    handleBlogPostTranslations,
    handleBlogPostTranslationUpdate,
    handleBlogPostUnlock,
    handleBlogPreviewTokenMint,
    handleBlogPublishScheduled,
    handleBlogRelatedPosts,
    handleBlogRssFeed,
    handleBlogSeriesBySlug,
    handleBlogSitemap,
    handleBlogStudioActivateTheme,
    handleBlogStudioLanguages,
    handleBlogStudioPluginConfig,
    handleBlogStudioPluginEnable,
    handleBlogStudioState,
    handleBlogStudioThemeTokens,
    handleBlogTagBySlug,
} from '../../worker/routes/blog';
import ottabaseConfig from '../ottabase.config';

export const ottablogPackage = createOttablogPackage<CloudflareEnv>({
    // Structural, so read from the config FILE: the mode decides migrations and policies.
    mode: ottabaseConfig.features.ottablog.mode,
    routes: {
        basePath: '/api/blog',
        build: () =>
            buildBlogRouter<CloudflareEnv>(
                {
                    handleBlogStudioState,
                    handleBlogStudioActivateTheme,
                    handleBlogStudioPluginEnable,
                    handleBlogStudioPluginConfig,
                    handleBlogPostsList,
                    handleBlogBlurbCreate,
                    handleBlogBlurbUpdate,
                    handleBlogPhotoJournalCreate,
                    handleBlogPhotoJournalUpdate,
                    handleBlogPostBySlug,
                    handleBlogPostUnlock,
                    handleBlogTagBySlug,
                    handleBlogCategoryBySlug,
                    handleBlogSeriesBySlug,
                    handleBlogAuthorById,
                    handleBlogExport,
                    handleBlogImport,
                    handleBlogRelatedPosts,
                    handleBlogRssFeed,
                    handleBlogSitemap,
                    handleBlogPublishScheduled,
                    handleBlogDemoSeed,
                    handleBlogPreviewTokenMint,
                    handleBlogStudioThemeTokens,
                    handleBlogStudioLanguages,
                    handleBlogPostTranslations,
                    handleBlogPostTranslationCreate,
                    handleBlogPostTranslationUpdate,
                    handleBlogPostTranslationDelete,
                },
                { makeContext: ctxOf },
            ),
    },
});
