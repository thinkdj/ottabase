# @ottabase/ottablog

Blog CMS with fat models for Ottabase apps.

## Features

- Multiple content types (blog, changelog, docs, news)
- EditorJS content storage
- SEO metadata
- Categories with hierarchy
- Tags (many-to-many)
- Multi-app database sharing via `appId`
- Reading time calculation

## Quick Start

### 1. Register Models

```typescript
// cloudflare-worker.ts
import { BlogPost, BlogCategory, BlogTag, BlogSeries } from "@ottabase/ottablog";
import { registerModels } from "@ottabase/ottaorm";

registerModels([BlogPost, BlogCategory, BlogTag, BlogSeries]);
```

### 2. Export Tables in Schema

```typescript
// ottabase/db/schema.ts
export {
  postsTable,
  categoriesTable,
  tagsTable,
  seriesTable,
  postTagsTable,
} from "@ottabase/ottablog";
```

### 3. Run Migrations

```bash
curl -X POST http://localhost:3004/api/ottaorm/init
```

## Models

### BlogPost

```typescript
import { BlogPost } from "@ottabase/ottablog";

// Create post
const post = await BlogPost.create({
  title: "Hello World",
  slug: "hello-world",
  content: editorJsData,
  status: "published",
  authorId: userId,
});

// Query
const posts = await BlogPost.where({ status: "published" });
const post = await BlogPost.findBySlug("hello-world");

// With relationships
const category = await post.category();
const tags = await post.tags();
const author = await post.author();
```

### BlogCategory

```typescript
import { BlogCategory } from "@ottabase/ottablog";

const category = await BlogCategory.create({
  name: "Technology",
  slug: "technology",
  parentId: null,  // For hierarchy
});

const posts = await category.posts();
```

### BlogTag

```typescript
import { BlogTag } from "@ottabase/ottablog";

const tag = await BlogTag.create({
  name: "JavaScript",
  slug: "javascript",
});

const posts = await tag.posts();
```

### BlogSeries

```typescript
import { BlogSeries } from "@ottabase/ottablog";

const series = await BlogSeries.create({
  title: "React Tutorial",
  slug: "react-tutorial",
  description: "Learn React from scratch",
});

const posts = await series.posts();
```

## Content Types

```typescript
import { CONTENT_TYPES } from "@ottabase/ottablog";

CONTENT_TYPES.BLOG        // "blog"
CONTENT_TYPES.CHANGELOG   // "changelog"
CONTENT_TYPES.DOCS        // "docs"
CONTENT_TYPES.NEWS        // "news"
CONTENT_TYPES.ANNOUNCEMENT // "announcement"
```

## Post Statuses

```typescript
import { POST_STATUSES } from "@ottabase/ottablog";

POST_STATUSES.DRAFT     // "draft"
POST_STATUSES.PUBLISHED // "published"
POST_STATUSES.ARCHIVED  // "archived"
```

## Helpers

```typescript
import { generateSlug, calculateReadingTime, extractExcerpt } from "@ottabase/ottablog";

const slug = generateSlug("Hello World!");  // "hello-world"
const time = calculateReadingTime(content); // { minutes: 5, words: 1000 }
const excerpt = extractExcerpt(content, 160);
```

## React Components

```tsx
import { BlogRenderer, BlogExcerptCard } from "@ottabase/ottablog";

// Full post render
<BlogRenderer post={post} />

// Excerpt card for listing
<BlogExcerptCard
  post={post}
  onClick={() => navigate(`/blog/${post.slug}`)}
/>
```

## Exports

```typescript
// Models (fat models with tables)
import {
  BlogPost, postsTable,
  BlogCategory, categoriesTable,
  BlogTag, tagsTable,
  BlogSeries, seriesTable,
  BlogPostTag, postTagsTable,
  BlogPostVersion, postVersionsTable,
} from "@ottabase/ottablog";

// Helpers
import { generateSlug, calculateReadingTime, extractExcerpt } from "@ottabase/ottablog";
import { CONTENT_TYPES, POST_STATUSES } from "@ottabase/ottablog";

// Components
import { BlogRenderer, BlogExcerptCard } from "@ottabase/ottablog";
```
