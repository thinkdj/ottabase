# @ottabase/ottablog

A comprehensive blog and content management system for Ottabase apps. Built on the fat model pattern with OttaORM.

## Features

- **Fat Models** - All blog logic in one place with query helpers
- **Multiple Content Types** - Support for posts, news, docs, announcements, and custom types
- **Rich Content** - EditorJS integration via OttaEditor for flexible content
- **SEO Ready** - Built-in SEO metadata, hero images, canonical URLs
- **Hierarchical Categories** - Support for category trees with multi-type filtering
- **Flexible Tags** - Reusable tags system with type-based organization
- **Versioning** - Full version history tracking with retention policies
- **Series Support** - Group related posts into ordered series
- **Multi-App Ready** - Built-in appId support for multi-tenant databases
- **Analytics Ready** - Reading time, word count, view tracking
- **Type-Safe** - Full TypeScript support with Drizzle ORM

## Installation

```bash
pnpm add @ottabase/ottablog @ottabase/ottaorm @ottabase/db drizzle-orm
```

## Quick Start

### 1. Use Models in Your App

```typescript
import { Post, PostCategory, PostTag, PostSeries } from '@ottabase/ottablog';
import { setDriver } from '@ottabase/ottaorm';
import { createD1Driver } from '@ottabase/db/drizzle-d1';

// Set up database connection
setDriver(createD1Driver(env.OBCF_D1));

// Create a post
const post = await Post.create({
    title: 'My First Post',
    slug: 'my-first-post',
    content: { blocks: [] }, // EditorJS format
    status: 'published',
    authorId: 'user-123',
});

// Query posts
const published = await Post.published({ limit: 10 });
const featured = await Post.featured({ contentType: 'blog' });
const byCategory = await Post.byCategory('category-123');

// Create and manage blog tags
const tag = await PostTag.create({
    name: 'JavaScript',
    slug: 'javascript',
    color: '#f7df1e',
    type: 'post',
});

// Get tags for a post
const tags = await post.tags();
```

### 2. Add to Your Schema

```typescript
// ottabase/db/schema.ts
export {
    postsTable,
    categoriesTable,
    postTagsTable,
    postTagLinksTable,
    postVersionsTable,
    seriesTable,
} from '@ottabase/ottablog';
```

### 3. Initialize Database

```bash
# Call your auto-init endpoint to create all tables
curl -X POST http://localhost:3000/api/ottaorm/init
```

## Models

### Post

Comprehensive blog post model with rich content support.

```typescript
const post = await Post.create({
    title: 'Blog Post Title',
    slug: 'blog-post-title',
    excerpt: 'Short summary...',
    content: {
        /* EditorJS JSON */
    },
    contentType: 'blog', // blog, changelog, docs, news, announcement
    status: 'published', // draft, published, archived, scheduled
    categoryId: 'cat-123',
    seriesId: 'series-123',
    heroImage: {
        url: 'https://...',
        alt: 'Image alt text',
        caption: 'Image caption',
    },
    seoMeta: {
        title: 'SEO Title',
        description: 'Meta description',
        keywords: ['keyword1', 'keyword2'],
        canonicalUrl: 'https://...',
    },
    authorId: 'user-123',
    publishedAt: new Date(),
    isFeatured: true,
    allowComments: true,
});

// Query methods
await Post.findBySlug('my-post');
await Post.published({ limit: 10 });
await Post.featured({ contentType: 'blog' });
await Post.byCategory('category-123');
await Post.bySeries('series-123');

// Instance methods
await post.publish();
await post.unpublish();
await post.archive();
await post.toggleFeatured();
await post.incrementViews();
post.updateReadingStats(); // Calc reading time from content
post.generateSlug(); // Auto-generate from title
post.generateExcerpt(); // Auto-generate from content
```

**Fields:**

- `id` - Unique identifier
- `title` - Post title
- `slug` - URL-friendly identifier (unique per appId)
- `excerpt` - Short summary
- `content` - EditorJS JSON content
- `contentType` - Type of content (blog, changelog, docs, news, announcement)
- `status` - Publication status (draft, published, archived, scheduled)
- `categoryId` - Category reference
- `seriesId` - Series reference
- `seriesOrder` - Position in series
- `heroImage` - Featured image JSON
- `seoMeta` - SEO metadata JSON
- `privateNotes` - Author-only notes (EditorJS)
- `footnotes` - Public footnotes (EditorJS)
- `authorId`, `authorName`, `authorEmail`, `authorAvatar` - Author info
- `readingTimeMinutes`, `wordCount` - Auto-calculated stats
- `isFeatured` - Pin to top
- `allowComments` - Enable comments
- `viewCount` - View counter
- `publishAt`, `publishedAt`, `postedAt` - Dates
- `appId` - Multi-app identifier
- `maxVersionsToKeep` - Version retention setting

### PostCategory

Hierarchical category system with type support.

```typescript
const category = await PostCategory.create({
    name: 'Technology',
    slug: 'technology',
    description: 'Tech articles and guides',
    parentId: null, // null for root categories
    type: 'post', // post, news, docs, etc.
    sortOrder: 1,
});

// Query methods
await PostCategory.roots({ appId: 'app-123' });
await PostCategory.children('parent-cat-123');
await PostCategory.findBySlug('technology', { appId: 'app-123' });

// Instance methods
category.generateSlug();
```

**Fields:**

- `id` - Unique identifier
- `name` - Category name
- `slug` - URL-friendly identifier
- `description` - Category description
- `parentId` - Parent category for hierarchy
- `sortOrder` - Display order
- `type` - Content type (post, news, docs, etc.) - **NEW: Enables reuse for multiple content types**
- `appId` - Multi-app identifier

### PostTag

Flexible tagging system with type support.

```typescript
const tag = await PostTag.create({
    name: 'React',
    slug: 'react',
    color: '#61dafb',
    type: 'post', // post, news, docs, etc.
});

// Query methods
await PostTag.findBySlug('react', { appId: 'app-123' });
await PostTag.forApp('app-123');

// Instance methods
tag.generateSlug();
const style = tag.getStyle(); // { backgroundColor, color } for contrast
```

**Fields:**

- `id` - Unique identifier
- `name` - Tag name
- `slug` - URL-friendly identifier
- `color` - Hex color code
- `type` - Content type (post, news, docs, etc.) - **NEW: Enables reuse for multiple content types**
- `appId` - Multi-app identifier

### PostVersion

Version history tracking for posts.

```typescript
// Auto-created when posts change
const version = await PostVersion.createFromPost(post, {
    changedBy: 'user-123',
    changeNote: 'Fixed typo in intro',
});

// Query methods
await PostVersion.forPost('post-123');
await PostVersion.latestForPost('post-123');
await PostVersion.getVersion('post-123', 1);
await PostVersion.getNextVersionNumber('post-123');
```

**Fields:**

- `id` - Unique identifier
- `postId` - Post reference
- `versionNumber` - Version number
- `title`, `content`, `excerpt`, `privateNotes`, `footnotes` - Versioned fields
- `wordCount` - Word count at version
- `changedBy` - User who made change
- `changeNote` - Change description

### PostSeries

Group related posts into ordered collections.

```typescript
const series = await PostSeries.create({
    title: 'Learning React',
    slug: 'learning-react',
    description: 'A 5-part series on React basics',
    coverImage: { url: '...', alt: '...' },
    isComplete: false,
    sortOrder: 1,
});

// Query methods
await PostSeries.list({ appId: 'app-123' });
await PostSeries.complete({ appId: 'app-123' });
await PostSeries.findBySlug('learning-react', { appId: 'app-123' });
```

**Fields:**

- `id` - Unique identifier
- `title` - Series title
- `slug` - URL-friendly identifier
- `description` - Series description
- `coverImage` - Series cover image
- `isComplete` - Mark as complete
- `sortOrder` - Display order
- `appId` - Multi-app identifier

## Content Types

The `type` column on categories and tags enables reuse across multiple content types:

```typescript
// Post-specific categories
const postCats = await PostCategory.where({
    type: 'post',
    appId: 'app-123',
});

// News categories (same table, different type)
const newsCats = await PostCategory.where({
    type: 'news',
    appId: 'app-123',
});

// Documentation categories
const docsCats = await PostCategory.where({
    type: 'docs',
    appId: 'app-123',
});

// Custom types
const customCats = await PostCategory.where({
    type: 'myCustomType',
    appId: 'app-123',
});
```

**Available Types:**

- `post` - Standard blog posts (default)
- `news` - News articles
- `docs` - Documentation
- `changelog` - Change logs
- `announcement` - Announcements
- Custom types supported

## Relationships

```typescript
// Post to Author
const author = await post.author(['id', 'name', 'email']);

// Post to Tags (many-to-many)
const tags = await post.tags({
    select: ['id', 'name', 'slug'],
    orderBy: 'name',
});
```

## Multi-App Support

All models support the `appId` field for multi-tenant scenarios:

```typescript
// Query posts for specific app
const appPosts = await Post.where({ appId: 'app-123' });

// Categories by type and app
const appCategories = await PostCategory.where({
    type: 'post',
    appId: 'app-123',
});

// Filter tags by app and type
const appTags = await PostTag.where({
    type: 'blog',
    appId: 'app-123',
});
```

## Registration

Register models for dynamic CRUD:

```typescript
import { registerModels } from '@ottabase/ottaorm';
import { Post, PostCategory, PostTag, PostTagLink, PostVersion, PostSeries } from '@ottabase/ottablog';

registerModels([Post, PostCategory, PostTag, PostTagLink, PostVersion, PostSeries]);
```

## EditorJS Integration

Content is stored in EditorJS format for flexibility:

```typescript
const post = await Post.create({
    content: {
        time: Date.now(),
        blocks: [
            {
                type: 'paragraph',
                data: { text: 'First paragraph' },
            },
            {
                type: 'image',
                data: { url: '...' },
            },
        ],
        version: '2.28.0',
    },
});
```

## SEO Metadata

Built-in SEO support:

```typescript
const post = await Post.create({
    seoMeta: {
        title: 'Custom SEO Title',
        description: 'Meta description for search engines',
        keywords: ['keyword1', 'keyword2'],
        canonicalUrl: 'https://example.com/canonical',
        ogImage: 'https://...',
        ogType: 'article',
        twitterCard: 'summary_large_image',
        noIndex: false,
        noFollow: false,
    },
});
```

## Table Names

- `posts` - Blog posts with full content management
- `categories` - Category hierarchy with type support
- `post_tags` - Blog-specific tags with color and type support
- `post_versions` - Version history tracking
- `series` - Content series grouping
- `post_tag_links` - Many-to-many junction table between posts and post_tags

## Benefits

- **Type-Safe** - Full TypeScript support with IDE autocomplete
- **Self-Contained** - All blog logic in models
- **Reusable Infrastructure** - Categories and tags support multiple content types
- **Automated** - Auto-generated migrations from models
- **Multi-Tenant Ready** - appId support out of the box
- **SEO Optimized** - Built-in metadata support
- **Analytics Ready** - Reading time and view tracking
- **Version Control** - Full post history tracking
- **Content Organization** - Categories, tags, and series support

## License

MIT
