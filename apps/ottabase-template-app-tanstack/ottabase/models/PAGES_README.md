# Marketing Pages System

A drag-and-drop page builder for creating marketing pages, landing pages, about pages, and more.

## Overview

The Marketing Pages system provides:

1. **Block-based Pages**: Build pages with reusable blocks (hero, features, CTA, pricing, FAQ, etc.)
2. **Content Pages**: Rich text pages that link to ottablog Post content
3. **Drag-and-Drop Editor**: Visual page builder with block palette and reordering
4. **Multi-page Support**: Create unlimited marketing pages beyond the homepage

## Schema

### Core Entities

| Table           | Purpose                                             |
| --------------- | --------------------------------------------------- |
| `pages`         | Page metadata, slug, type, status, SEO settings     |
| `page_sections` | Blocks within a page (hero, features, footer, etc.) |
| `page_features` | Feature items within sections                       |
| `page_actions`  | CTA buttons within sections                         |

### Page Types

- **`block`**: Section-based page (landing pages, marketing pages)
- **`content`**: Links to an ottablog Post for rich text content

### Page Status

- **`draft`**: Not visible to public
- **`published`**: Visible and accessible
- **`archived`**: Hidden but preserved

## API Routes

### Public Routes

| Route              | Method | Description                |
| ------------------ | ------ | -------------------------- |
| `/api/pages`       | GET    | List all published pages   |
| `/api/pages/nav`   | GET    | Get nav-enabled pages      |
| `/api/pages/:slug` | GET    | Get full page data by slug |
| `/api/pages/seed`  | POST   | Seed default homepage      |

### Legacy Routes (kept for compatibility)

| Route                | Description                     |
| -------------------- | ------------------------------- |
| `/api/homepage/data` | Original homepage data endpoint |
| `/api/homepage/seed` | Original homepage seed endpoint |

## Admin UI

Access via **Admin → Marketing Pages**:

### Pages List (`/admin/pages`)

- View all marketing pages
- Create new pages
- Duplicate existing pages
- Delete pages (homepage protected)

### Page Builder (`/admin/pages/:pageId`)

Drag-and-drop page builder with:

- **Block Palette** (left sidebar): Available block types organized by category
- **Canvas** (center): Your page layout with sortable blocks
- **Block Editor** (right panel): Opens when clicking a block to edit content
- **Page Settings** (dialog): Page info, theme, navigation, and SEO settings

### Available Blocks

| Block Type   | Description                       | Supports Features | Supports Actions |
| ------------ | --------------------------------- | ----------------- | ---------------- |
| Navigation   | Site navigation with logo & links | ❌                | ✅               |
| Hero Section | Bold headline with CTA buttons    | ❌                | ✅               |
| Features     | Showcase features in grid layout  | ✅                | ❌               |
| CTA          | Call to action with buttons       | ❌                | ✅               |
| About        | Rich content with optional images | ✅                | ✅               |
| Testimonials | Customer reviews                  | ✅                | ❌               |
| Gallery      | Image showcase                    | ✅                | ❌               |
| Team         | Team member profiles              | ✅                | ❌               |
| Pricing      | Pricing tables                    | ✅                | ✅               |
| FAQ          | Frequently asked questions        | ✅                | ❌               |
| Video        | Embedded video with text          | ❌                | ✅               |
| Code Block   | Code snippet with highlighting    | ❌                | ❌               |
| Custom       | Flexible custom content           | ✅                | ✅               |
| Footer       | Page footer with links            | ❌                | ✅               |

### Block Variants

Each block type supports multiple layout variants (e.g., hero: centered, split, fullscreen).

## Usage

### Creating a Page Programmatically

```typescript
import { Page } from '@/ottabase/models/Page';

const newPage = await Page.create({
    slug: 'pricing',
    title: 'Pricing',
    type: 'block',
    status: 'draft',
    themePreset: 'neo',
});
```

### Using Admin Hooks

```typescript
import { pageHooks, pageSectionHooks } from '@/hooks/pageHooks';

// List pages
const { data: pages } = pageHooks.useList({});

// Get single page
const { data: page } = pageHooks.useDetail(pageId);

// Create page
const createPage = useCreatePage();
await createPage.mutateAsync({ slug: 'about', title: 'About Us', type: 'block' });
```

### Fetching Page Data (Next.js)

```typescript
import { fetchPageByPageSlug, fetchNavPages } from '@/lib/api';

// Get page by slug
const pageData = await fetchPageByPageSlug('pricing');

// Get nav pages
const navPages = await fetchNavPages();
```

## Contract Types

Import from `@ottabase/homepage-contract`:

```typescript
import {
    // Zod schemas
    PageDataSchema,
    PageSectionSchema,
    NavPageSchema,

    // TypeScript types
    type PageDataPayload,
    type PageSectionPayload,
    type NavPagePayload,
} from '@ottabase/homepage-contract';
```

## Migration from Legacy Homepage

The new pages system is additive. Legacy homepage routes continue to work:

1. Keep using `/api/homepage/data` for existing integrations
2. Migrate to `/api/pages/homepage` when ready
3. Use `/admin/pages` for the new flexible builder

The homepage is simply a page with `slug: 'homepage'`.
