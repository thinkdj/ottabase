# @ottabase/ottablog — agent notes

Blog/CMS engine: fat-model posts, tags, categories, series, versioning, themes, plugins, and a React BlogRenderer. Full docs: ./README.md

## Use when

-   Any blog/changelog/docs/news content feature: post CRUD, categories/tags/series, versioning, RSS/sitemap data, rendering posts with themes/plugins.
-   NOT for universal non-blog tags — use `Tag` from `@ottabase/ottaorm`.
-   NOT for generic page rendering — use `@ottabase/ottarenderer` directly.

## Imports

```ts
import {
    Post, PostCategory, PostTag, PostTagLink, PostCategoryLink, PostSeries, PostVersion,
    postsTable, categoriesTable, postTagsTable, postTagLinksTable,
    postCategoryLinksTable, postVersionsTable, seriesTable,
    ottablogThemesTable, ottablogPluginsTable,
    generateSlug, calculateReadingTime, extractExcerpt, CONTENT_TYPES, POST_STATUSES,
    registerTheme, setActiveTheme, initOttablog,
} from '@ottabase/ottablog';
import { normalizeSlugInput, resolveUniqueSlug, BlogRendererErrorBoundary } from '@ottabase/ottablog';
import { BlogRenderer, BlogExcerptCard } from '@ottabase/ottablog/renderer';
```

## Canonical usage

```ts
// Fat-model post lifecycle (RLS context must be set: organizationId/userId/appId)
const post = await Post.createWithSlug('Hello World', { contentType: 'blog' });
await post.publish(); // sets status, publishedAt, postedAt
const found = await Post.findBySlug('hello-world', { appId });
const recent = await Post.published({ appId, limit: 10 }); // ordered by publishedAt
await found?.trackView(); // opt-in view counter — never called automatically
```

```tsx
// Rendering (client): initOttablog registers default + minimal themes
initOttablog({ defaultThemeId: 'default' });
<BlogRendererErrorBoundary>
    <BlogRenderer post={postData} showHeroImage showMetadata showSeries />
</BlogRendererErrorBoundary>;
```

## Wiring

1. Add all nine tables to `PACKAGE_REGISTRY.ottablog.tables` in `apps/*/ottabase/config.migrations.ts`.
2. App-specific model extensions (if any) go in `apps/*/ottabase/models/`.
3. Include the ottablog models in `registerModels([...])` in `worker/lib/db-utils.ts`.
4. Re-export the tables from `apps/*/ottabase/db/schema.ts` so drizzle sees them.

## Gotchas

-   `PostTag` is blog-specific (color, type); universal tags live in `@ottabase/ottaorm` `Tag`.
-   `post.categoryId` is legacy single-category; prefer the `PostCategoryLink` junction (many-to-many).
-   `trackView()` is opt-in; by-slug reads do not auto-increment views (D1 write cost).
-   Slugs are unique per `appId` (plus `type` for tags/categories); use `resolveUniqueSlug` on collision.
-   Junction tables (`postTagLinksTable`, `postCategoryLinksTable`) use a UUID `id` PK, not a composite key.
-   Sanitize user-supplied HTML/URLs via `@ottabase/utils/sanitize` before storing post content.
-   Edge runtime only — no Node-only APIs in model or renderer code.
