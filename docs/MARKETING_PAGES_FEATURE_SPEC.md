# Marketing Pages System — Complete Feature Specification

> **Purpose**: End-to-end technical and UX specification for building a drag-and-drop marketing page builder with
> database-driven block rendering.

---

## Table of Contents

| Section  | Title                                                                             | What It Covers                          |
| -------- | --------------------------------------------------------------------------------- | --------------------------------------- |
| 1        | [Executive Summary](#1-executive-summary)                                         | Overview, key capabilities              |
| 2        | [Architecture Overview](#2-architecture-overview)                                 | System diagram, data flow               |
| 3        | [Database Schema](#3-database-schema)                                             | 4 tables, columns, indexes              |
| 4        | [OttaORM Models](#4-ottaorm-models)                                               | Model classes, static methods           |
| 5        | [API Routes](#5-api-routes)                                                       | Public & admin endpoints                |
| 6        | [Contract Package](#6-contract-package)                                           | Zod schemas, TypeScript types           |
| 7        | [Admin UI — Page Builder](#7-admin-ui--page-builder)                              | Builder layout, components              |
| 8        | [Next.js Frontend Rendering](#8-nextjs-frontend-rendering)                        | Dynamic routes, SlotRenderer            |
| **8.5**  | **[Block Registry System](#85-block-registry-system)**                            | **Dynamic block registration**          |
| **8.6**  | **[Component Discovery API](#86-component-discovery-api)**                        | **Apps expose custom blocks via API**   |
| **8.7**  | **[Split-Pane Preview Architecture](#87-split-pane-preview-architecture)**        | **Real-time preview for builders**      |
| **8.8**  | **[Extensibility & Custom Blocks](#88-extensibility--custom-blocks)**             | **How apps register custom components** |
| 9        | [UX Flows](#9-ux-flows)                                                           | User journeys (create, edit, publish)   |
| 10       | [Implementation Checklist](#10-implementation-checklist)                          | Phase-by-phase task list                |
| **10.5** | **[UX/DX Enhancements](#105-uxdx-enhancements)**                                  | **Inline editing, undo/redo, hotkeys**  |
| **10.6** | **[Quick UX Wins](#106-quick-ux-wins-highest-impact-low-effort)**                 | **2-3 hour improvements**               |
| 11       | [File Paths Summary](#11-file-paths-summary)                                      | Every file location                     |
| 12       | [Key Technical Decisions](#12-key-technical-decisions)                            | Decision rationale table                |
| 13       | [Future Enhancements](#13-future-enhancements)                                    | Roadmap ideas                           |
| **14**   | **[Problem Statement & Why This Exists](#14-problem-statement--why-this-exists)** | **Motivation, success criteria**        |
| **15**   | **[Design Principles](#15-design-principles)**                                    | **Core architectural philosophy**       |
| **16**   | **[State Management Strategy](#16-state-management-strategy)**                    | **Data flow, mutation strategies**      |
| **17**   | **[Error Handling Matrix](#17-error-handling-matrix)**                            | **All error codes, validation rules**   |
| **18**   | **[Performance Considerations](#18-performance-considerations)**                  | **Caching, lazy loading, targets**      |
| **19**   | **[Security Considerations](#19-security-considerations)**                        | **Auth, RBAC, sanitization**            |
| **20**   | **[Testing Strategy](#20-testing-strategy)**                                      | **Unit, integration, E2E tests**        |
| **21**   | **[Debugging Guide](#21-debugging-guide)**                                        | **Common issues, logging, SQL**         |
| **22**   | **[Adding New Block Types](#22-adding-new-block-types)**                          | **Step-by-step migration guide**        |
| **23**   | **[Keyboard Shortcuts & Accessibility](#23-keyboard-shortcuts--accessibility)**   | **A11y requirements**                   |
| **24**   | **[Cache Invalidation Strategy](#24-cache-invalidation-strategy)**                | **When/how to invalidate**              |
| **25**   | **[Rollback & Recovery Procedures](#25-rollback--recovery-procedures)**           | **Undo, restore, backup**               |
| **26**   | **[Multi-Tenant Considerations](#26-multi-tenant-considerations)**                | **App isolation, templates**            |
| **27**   | **[Analytics Integration](#27-analytics-integration)**                            | **Tracking page views, clicks**         |
| **28**   | **[API Reference](#28-api-reference-openapi-summary)**                            | **All endpoints, examples**             |
| **29**   | **[Glossary](#29-glossary)**                                                      | **Term definitions**                    |

---

## 1. Executive Summary

Build a flexible, database-driven marketing page system that allows non-technical users to create and manage landing
pages via a drag-and-drop interface. Pages are composed of reusable **blocks** (hero, features, CTA, etc.) that support
multiple **variants** (centered, split, grid, etc.).

### Key Capabilities

- **Admin UI**: Drag-and-drop page builder with block palette, sortable canvas, and inline editing
- **Block System**: 15+ block types with multiple visual variants each
- **Preview Mode**: Live preview of draft pages before publishing
- **Multi-tenant**: Each page scoped to an `appId` for SaaS deployments
- **SEO Ready**: Per-page metadata (title, description, OG image)
- **Type-Safe**: Shared contract package with Zod validation + TypeScript types

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ADMIN UI (TanStack)                            │
│  ┌─────────────────┐  ┌─────────────────────────┐  ┌────────────────────┐   │
│  │  Block Library  │  │       Canvas            │  │   Block Editor     │   │
│  │  (15+ blocks)   │  │  (sortable, DnD)        │  │  (sheet panel)     │   │
│  └─────────────────┘  └─────────────────────────┘  └────────────────────┘   │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ OttaORM CRUD Hooks
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          WORKER API (Cloudflare)                            │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  /api/ottaorm/{pages,page_sections,page_features,page_actions}      │    │
│  │  /api/pages/:slug — Public page data (sections + features + actions)│    │
│  │  /api/pages/nav — Nav-enabled pages                                 │    │
│  │  /api/pages/seed — Idempotent homepage seed                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ D1 SQLite
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE (4 tables)                            │
│  pages → page_sections → page_features                                      │
│                        → page_actions                                       │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
          ┌──────────────────────────┴──────────────────────────┐
          │                                                     │
          ▼                                                     ▼
┌─────────────────────────┐                       ┌──────────────────────────┐
│  Contract Package       │                       │  Next.js Homepage        │
│  @ottabase/homepage-    │                       │  apps/nextjs-homepage/   │
│  contract               │                       │                          │
│  - Zod schemas          │  ────imports────▶     │  /api fetch              │
│  - TypeScript types     │                       │  SlotRenderer            │
│  - No drift guarantee   │                       │  Variant Components      │
└─────────────────────────┘                       └──────────────────────────┘
```

---

## 3. Database Schema

### 3.1 `pages` Table

Main page entity with metadata, SEO, theming, and nav configuration.

```typescript
// File: ottabase/models/Page.schema.ts
export const pagesTable = sqliteTable('pages', {
    // Identity
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    slug: text('slug').notNull().unique(), // URL path: "homepage", "pricing", "about"
    title: text('title').notNull(),

    // Type & Status
    type: text('type').$type<'block' | 'content'>().notNull().default('block'),
    status: text('status').$type<'draft' | 'published' | 'archived'>().notNull().default('draft'),

    // For content-type pages (links to ottablog Post)
    postId: text('post_id'), // FK to posts table

    // Theme & Styling
    themePreset: text('theme_preset'), // "default", "dark", "minimal"
    fallbackThemePresetId: text('fallback_theme_preset_id'), // Fallback theme if primary not found
    customCss: text('custom_css'),
    variantBySlotJson: text('variant_by_slot_json', { mode: 'json' }).$type<Record<string, string>>(),
    // Example: { "hero": "split", "features": "cards", "footer": "minimal" }

    // SEO
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    seoKeywords: text('seo_keywords'),

    // Navigation
    showInNav: integer('show_in_nav', { mode: 'boolean' }).notNull().default(false),
    navOrder: integer('nav_order').notNull().default(100), // Lower = earlier
    navLabel: text('nav_label'), // Defaults to title if null
    icon: text('icon'), // Lucide icon name

    // Extensibility
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
    appId: text('app_id'), // Multi-tenant

    // Timestamps
    createdAt: integer('created_at').$defaultFn(() => Date.now()).notNull(),
    updatedAt: integer('updated_at').$defaultFn(() => Date.now()).$onUpdateFn(() => Date.now()).notNull(),
});

// Indexes
index('pages_slug_idx').on(table.slug),
index('pages_status_idx').on(table.status),
index('pages_nav_idx').on(table.showInNav, table.navOrder),
index('pages_app_idx').on(table.appId),
```

### 3.2 `page_sections` Table

Building blocks within pages. Each section = one block in the builder.

```typescript
// File: ottabase/models/PageSection.schema.ts
export type SlotType =
    | 'navbar'
    | 'hero'
    | 'features'
    | 'cta'
    | 'footer'
    | 'about'
    | 'pricing'
    | 'testimonials'
    | 'gallery'
    | 'team'
    | 'faq'
    | 'video'
    | 'code'
    | 'contact'
    | 'custom';

export const pageSectionsTable = sqliteTable('page_sections', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),

    // Parent page (CASCADE delete)
    pageId: text('page_id')
        .notNull()
        .references(() => pagesTable.id, { onDelete: 'cascade' }),

    // Block type determines rendering component
    slot: text('slot').$type<SlotType>().notNull(),

    // Content
    title: text('title'),
    subtitle: text('subtitle'),
    body: text('body'), // Markdown or HTML

    // Visual
    icon: text('icon'), // Lucide icon name
    imageUrl: text('image_url'),
    videoUrl: text('video_url'),
    githubUrl: text('github_url'), // For nav/footer
    logoUrl: text('logo_url'),

    // Variant selection (e.g., "centered", "split", "grid")
    variant: text('variant'),

    // Styling
    cssClasses: text('css_classes'),
    backgroundColor: text('background_color'),

    // Control
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),

    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});
```

### 3.3 `page_features` Table

Feature items within sections (for features grid, pricing cards, FAQ items, team members, etc.).

```typescript
// File: ottabase/models/PageFeature.schema.ts
export const pageFeaturesTable = sqliteTable('page_features', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),

    // Parent section (CASCADE delete)
    sectionId: text('section_id')
        .notNull()
        .references(() => pageSectionsTable.id, { onDelete: 'cascade' }),

    // Content
    title: text('title').notNull(),
    description: text('description'),

    // Visual
    icon: text('icon'),
    imageUrl: text('image_url'),

    // Link (optional)
    href: text('href'),
    external: integer('external', { mode: 'boolean' }).default(false),

    sortOrder: integer('sort_order').notNull().default(0),

    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});
```

### 3.4 `page_actions` Table

CTA buttons within sections (hero buttons, CTA section buttons, etc.).

```typescript
// File: ottabase/models/PageAction.schema.ts
export type ActionVariant = 'default' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';

export const pageActionsTable = sqliteTable('page_actions', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),

    // Parent section (CASCADE delete)
    sectionId: text('section_id')
        .notNull()
        .references(() => pageSectionsTable.id, { onDelete: 'cascade' }),

    // Button content
    label: text('label').notNull(),
    href: text('href').notNull(),

    // Styling
    variant: text('variant').$type<ActionVariant>().default('default'),
    icon: text('icon'),

    external: integer('external', { mode: 'boolean' }).default(false),
    sortOrder: integer('sort_order').notNull().default(0),

    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});
```

### 3.5 Entity Relationship

```
pages (1) ─────────< page_sections (many)
                         │
                         ├────< page_features (many)
                         │
                         └────< page_actions (many)

Cascade deletes: Deleting a page deletes all its sections.
                 Deleting a section deletes all its features & actions.
```

---

## 4. OttaORM Models

### 4.1 Page Model

```typescript
// File: ottabase/models/Page.ts
import { BaseModel } from '@ottabase/ottaorm';
import { pagesTable } from './Page.schema';

export class Page extends BaseModel {
    static entity = 'pages';
    static table = pagesTable;
    static primaryKey = 'id';

    static casts = {
        showInNav: 'boolean',
        createdAt: 'integer',
        updatedAt: 'integer',
    };

    // ── Static Methods ──

    static async getHomepage(): Promise<Page | null> {
        const results = await this.where({ slug: 'homepage', status: 'published' });
        return results[0] || null;
    }

    static async getNavPages(): Promise<Page[]> {
        return this.where({ showInNav: true, status: 'published' }).orderBy('navOrder', 'asc');
    }

    static async getBySlug(slug: string): Promise<Page | null> {
        const results = await this.where({ slug });
        return results[0] || null;
    }

    // ── Computed Properties ──

    get isHomepage(): boolean {
        return this.get('slug') === 'homepage';
    }

    get displayNavLabel(): string {
        return this.get('navLabel') || this.get('title') || '';
    }
}
```

### 4.2 PageSection Model

```typescript
// File: ottabase/models/PageSection.ts
import { BaseModel } from '@ottabase/ottaorm';
import { pageSectionsTable } from './PageSection.schema';

export class PageSection extends BaseModel {
    static entity = 'page_sections';
    static table = pageSectionsTable;
    static primaryKey = 'id';

    static casts = {
        enabled: 'boolean',
        sortOrder: 'integer',
        createdAt: 'integer',
        updatedAt: 'integer',
    };

    static async getForPage(pageId: string): Promise<PageSection[]> {
        return this.where({ pageId }).orderBy('sortOrder', 'asc');
    }

    static async getEnabledForPage(pageId: string): Promise<PageSection[]> {
        return this.where({ pageId, enabled: true }).orderBy('sortOrder', 'asc');
    }
}
```

### 4.3 PageAction & PageFeature Models

```typescript
// File: ottabase/models/PageAction.ts
export class PageAction extends BaseModel {
    static entity = 'page_actions';
    static table = pageActionsTable;
    static primaryKey = 'id';

    static async getForSection(sectionId: string): Promise<PageAction[]> {
        return this.where({ sectionId }).orderBy('sortOrder', 'asc');
    }
}

// File: ottabase/models/PageFeature.ts
export class PageFeature extends BaseModel {
    static entity = 'page_features';
    static table = pageFeaturesTable;
    static primaryKey = 'id';

    static async getForSection(sectionId: string): Promise<PageFeature[]> {
        return this.where({ sectionId }).orderBy('sortOrder', 'asc');
    }
}
```

### 4.4 Model Registration

```typescript
// File: worker/lib/db-utils.ts
import { Page, PageSection, PageAction, PageFeature } from '../../ottabase/models';

registerModels([
    // ... other models
    Page,
    PageSection,
    PageAction,
    PageFeature,
]);
```

---

## 5. API Routes

### 5.1 Public API — `/api/pages/:slug`

Returns complete page data for frontend rendering.

```typescript
// File: worker/routes/pages.ts

interface PageDataPayload {
    page: {
        id: string;
        slug: string;
        title: string;
        type: 'block' | 'content';
        status: 'draft' | 'published' | 'archived';
        showInNav: boolean;
        navOrder: number;
        navLabel: string | null;
        icon: string | null;
    };
    sections: Array<{
        id: string;
        slot: string;
        title: string | null;
        subtitle: string | null;
        body: string | null;
        variant: string | null;
        githubUrl: string | null;
        icon: string | null;
        imageUrl: string | null;
        enabled: boolean;
        cssClasses: string | null;
        metadata: Record<string, unknown> | null;
        sortOrder: number;
        features: Array<{
            id: string;
            title: string;
            description: string;
            icon: string | null;
            imageUrl: string | null;
            href: string | null;
        }>;
        actions: Array<{
            id: string;
            label: string;
            href: string;
            variant: string | null;
            icon: string | null;
            external: boolean;
        }>;
    }>;
    display: {
        variantBySlot: Record<string, string> | null;
        themePreset: string | null;
        fallbackThemePresetId: string | null;
        customCss: string | null;
        seoTitle: string | null;
        seoDescription: string | null;
        seoImage: string | null;
    };
    content: { title: string; body: string; excerpt: string | null } | null;
}

// Route handler
export async function handlePageBySlug(context: PagesRouteContext, slug: string): Promise<Response> {
    const preview = url.searchParams.get('preview') === 'true';

    // Find page (published only, unless preview mode)
    const pageWhere: Record<string, unknown> = { slug };
    if (!preview) pageWhere.status = 'published';

    const pages = await Page.where(pageWhere);
    if (pages.length === 0) {
        return errorResponse(`Page not found: ${slug}`, 404);
    }

    const page = pages[0];
    const pageId = page.get('id');

    // Fetch sections with features and actions
    const sections = await PageSection.getForPage(pageId);
    const sectionPayloads = await Promise.all(
        sections.map(async (section) => {
            const sectionId = section.get('id');
            const [features, actions] = await Promise.all([
                PageFeature.getForSection(sectionId),
                PageAction.getForSection(sectionId),
            ]);
            return {
                id: sectionId,
                slot: section.get('slot'),
                // ... all other fields
                features: features.map((f) => ({
                    /* ... */
                })),
                actions: actions.map((a) => ({
                    /* ... */
                })),
            };
        }),
    );

    return jsonResponse({
        page: {
            /* ... */
        },
        sections: sectionPayloads,
        display: {
            /* ... */
        },
        content: null,
    });
}
```

### 5.2 Nav API — `/api/pages/nav`

Returns pages marked for navigation.

```typescript
export async function handleNavPages(context: PagesRouteContext): Promise<Response> {
    const pages = await Page.getNavPages();
    return jsonResponse({
        pages: pages.map((p) => ({
            slug: p.get('slug'),
            title: p.get('title'),
            navLabel: p.get('navLabel'),
            navOrder: p.get('navOrder'),
            icon: p.get('icon'),
        })),
    });
}
```

### 5.3 Seed API — `POST /api/pages/seed`

Idempotent seeding of default homepage.

```typescript
export async function handleSeedHomepage(context: PagesRouteContext): Promise<Response> {
    // Check if homepage exists
    const existing = await Page.getBySlug('homepage');
    if (existing) {
        return jsonResponse({ message: 'Homepage already exists', skipped: true });
    }

    // Create homepage with default blocks
    const page = await Page.create({
        slug: 'homepage',
        title: 'Welcome to Ottabase',
        type: 'block',
        status: 'published',
        showInNav: true,
        navOrder: 0,
    });

    // Create default sections: navbar, hero, features, cta, about, footer
    const sections = [
        { slot: 'navbar', title: 'Ottabase', variant: 'default', sortOrder: 0 },
        {
            slot: 'hero',
            title: 'Build faster with Ottabase',
            subtitle: 'Modern platform...',
            variant: 'centered',
            sortOrder: 1,
        },
        { slot: 'features', title: 'Features', variant: 'grid', sortOrder: 2 },
        { slot: 'cta', title: 'Ready to get started?', variant: 'default', sortOrder: 3 },
        { slot: 'about', title: 'About Ottabase', variant: 'default', sortOrder: 4 },
        { slot: 'footer', title: 'Ottabase', variant: 'default', sortOrder: 5 },
    ];

    for (const sectionData of sections) {
        const section = await PageSection.create({ pageId: page.get('id'), ...sectionData });

        // Add default features for 'features' section
        if (sectionData.slot === 'features') {
            await PageFeature.create({
                sectionId: section.get('id'),
                title: 'Cloudflare Workers',
                description: 'Edge deployment',
                icon: 'Zap',
            });
            // ... more features
        }

        // Add default actions for 'hero' and 'cta' sections
        if (sectionData.slot === 'hero' || sectionData.slot === 'cta') {
            await PageAction.create({
                sectionId: section.get('id'),
                label: 'Get Started',
                href: '/docs',
                variant: 'default',
            });
        }
    }

    return jsonResponse({ message: 'Homepage seeded', pageId: page.get('id') });
}
```

### 5.4 Route Registration

```typescript
// File: worker/routes/router.ts
router.get('/api/pages/nav', (ctx) => handleNavPages(ctx));
router.get<{ slug: string }>('/api/pages/:slug', (ctx) => handlePageBySlug(ctx, ctx.params.slug));
router.post('/api/pages/seed', (ctx) => handleSeedHomepage(ctx));
```

---

## 6. Contract Package

### 6.1 Package Structure

```
packages/homepage-contract/
├── src/
│   ├── schemas.ts    # Zod schemas for runtime validation
│   ├── types.ts      # TypeScript types inferred from Zod
│   └── index.ts      # Re-exports
├── package.json
└── tsconfig.json
```

### 6.2 Zod Schemas

```typescript
// File: packages/homepage-contract/src/schemas.ts
import { z } from 'zod';

export const PageActionPayloadSchema = z.object({
    id: z.string(),
    label: z.string(),
    href: z.string(),
    variant: z.string().nullable(),
    icon: z.string().nullable(),
    external: z.boolean(),
});

export const PageFeaturePayloadSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    icon: z.string().nullable(),
    imageUrl: z.string().nullable(),
    href: z.string().nullable(),
});

export const PageSectionPayloadSchema = z.object({
    id: z.string(),
    slot: z.string(),
    title: z.string().nullable(),
    subtitle: z.string().nullable(),
    body: z.string().nullable(),
    variant: z.string().nullable(),
    githubUrl: z.string().nullable(),
    icon: z.string().nullable(),
    imageUrl: z.string().nullable(),
    enabled: z.boolean(),
    cssClasses: z.string().nullable(),
    metadata: z.record(z.unknown()).nullable(),
    sortOrder: z.number(),
    features: z.array(PageFeaturePayloadSchema),
    actions: z.array(PageActionPayloadSchema),
});

export const PageDisplayPayloadSchema = z.object({
    variantBySlot: z.record(z.string()).nullable(),
    themePreset: z.string().nullable(),
    fallbackThemePresetId: z.string().nullable(),
    customCss: z.string().nullable(),
    seoTitle: z.string().nullable(),
    seoDescription: z.string().nullable(),
    seoImage: z.string().nullable(),
});

export const PageDataPayloadSchema = z.object({
    page: z.object({
        id: z.string(),
        slug: z.string(),
        title: z.string(),
        type: z.enum(['block', 'content']),
        status: z.enum(['draft', 'published', 'archived']),
        showInNav: z.boolean(),
        navOrder: z.number(),
        navLabel: z.string().nullable(),
        icon: z.string().nullable(),
    }),
    sections: z.array(PageSectionPayloadSchema),
    display: PageDisplayPayloadSchema,
    content: z
        .object({
            title: z.string(),
            body: z.string(),
            excerpt: z.string().nullable(),
        })
        .nullable(),
});
```

### 6.3 Type Inference

```typescript
// File: packages/homepage-contract/src/types.ts
import type { z } from 'zod';
import type {
    PageActionPayloadSchema,
    PageDataPayloadSchema,
    PageDisplayPayloadSchema,
    PageFeaturePayloadSchema,
    PageSectionPayloadSchema,
} from './schemas';

export type PageActionPayload = z.infer<typeof PageActionPayloadSchema>;
export type PageFeaturePayload = z.infer<typeof PageFeaturePayloadSchema>;
export type PageSectionPayload = z.infer<typeof PageSectionPayloadSchema>;
export type PageDisplayPayload = z.infer<typeof PageDisplayPayloadSchema>;
export type PageDataPayload = z.infer<typeof PageDataPayloadSchema>;
```

---

## 7. Admin UI — Page Builder

### 7.1 Page Structure

```
src/pages/admin/pages/
├── index.ts                    # Route exports
├── AdminPagesListPage.tsx      # Pages list with CRUD
├── MarketingPageBuilder.tsx    # Drag-and-drop builder
├── AdminPageBuilderPage.tsx    # Route component (loads builder)
└── pages-constants.ts          # Block definitions, variants
```

### 7.2 Pages List View

**File**: `AdminPagesListPage.tsx`

**UX Requirements**:

- Minimal design (GitHub/Notion style)
- Search/filter by title or slug
- Status badges: Draft (amber), Published (green), Archived (gray)
- Actions: Edit, Preview, Duplicate, Delete
- Quick-create button with default "New Page"

**Components**:

```tsx
function AdminPagesListPage() {
    const { data: pages } = pageHooks.useList();
    const createMutation = pageHooks.useCreate();
    const deleteMutation = pageHooks.useDelete();

    return (
        <div className="max-w-4xl mx-auto p-6">
            <header className="flex justify-between mb-6">
                <h1>Marketing Pages</h1>
                <Button onClick={() => createMutation.mutate({ title: 'New Page', slug: `page-${Date.now()}` })}>
                    <Plus /> New Page
                </Button>
            </header>

            <Input placeholder="Search pages..." />

            <div className="space-y-2">
                {pages?.map((page) => (
                    <PageListItem key={page.id} page={page} />
                ))}
            </div>
        </div>
    );
}
```

### 7.3 Marketing Page Builder

**File**: `MarketingPageBuilder.tsx` (actual implementation in
`apps/ottabase-template-app-tanstack/src/pages/admin/pages/`)

**Layout**: Tab-based editor with three main sections:

1. **Settings Tab** — Page metadata, SEO, theme, navigation
2. **Sections Tab** — Drag-and-drop block canvas with palette
3. **Publishing Tab** — Status, preview, publish actions

**Sections Tab Layout** (the main builder view):

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Header: Back | Page Title (editable) | Status | Settings | Preview     │
├─────────────┬────────────────────────────────────────┬───────────────────┤
│             │                                        │                   │
│   Block     │              Canvas                    │  Block Editor     │
│   Library   │         (sortable blocks)              │  (sheet panel)    │
│             │                                        │                   │
│  ─────────  │  ┌──────────────────────────────────┐  │  Opens when       │
│  Navigation │  │  [Navbar Block]              ☰   │  │  block selected   │
│  ─────────  │  └──────────────────────────────────┘  │                   │
│  Navbar     │  ┌──────────────────────────────────┐  │  Contains:        │
│             │  │  [Hero Block]                 ☰   │  │  - Title/subtitle │
│  ─────────  │  └──────────────────────────────────┘  │  - Variant picker │
│  Hero       │  ┌──────────────────────────────────┐  │  - Features list  │
│  ─────────  │  │  [Features Block]             ☰   │  │  - Actions list  │
│  Content    │  └──────────────────────────────────┘  │  - Advanced       │
│  ─────────  │                                        │                   │
│  Features   │                                        │                   │
│  CTA        │                                        │                   │
│  About      │                                        │                   │
│  ...        │                                        │                   │
└─────────────┴────────────────────────────────────────┴───────────────────┘
```

**Key Components**:

```tsx
// Block Library - Left sidebar with draggable block types (also referred to as "palette")
function BlockLibrary({ onAddBlock, existingBlocks }) {
    return (
        <ScrollArea className="w-64 border-r p-4">
            <h3>Add Block</h3>
            {BLOCK_TYPES.map(block => (
                <PaletteItem
                    key={block.id}
                    config={block}
                    onAdd={onAddBlock}
                    disabled={block.singleton && existingBlocks.includes(block.id)}
                />
            ))}
        </ScrollArea>
    );
}

// Canvas - Center area with sortable blocks (draggable from library or reorder existing)
function Canvas({ blocks, selectedBlockId, onSelectBlock, onReorder }) {
    return (
        <DndContext onDragEnd={handleDragEnd}>
            <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                <div className="flex-1 p-6 space-y-4">
                    {blocks.map(block => (
                        <SortableBlockCard
                            key={block.id}
                            block={block}
                            isSelected={block.id === selectedBlockId}
                            onSelect={() => onSelectBlock(block.id)}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
}

// Block Editor - Right panel (sheet) for editing selected block
function BlockEditor({ block, onUpdate, onClose }) {
    return (
        <Sheet open={!!block} onOpenChange={() => onClose()}>
            <SheetContent className="w-[400px]">
                <SheetHeader>
                    <SheetTitle>Edit {block.slot}</SheetTitle>
                </SheetHeader>

                <div className="space-y-4 py-4">
                    <Input label="Title" value={block.title} onChange={...} />
                    <Textarea label="Subtitle" value={block.subtitle} onChange={...} />
                    <Select label="Variant" options={getBlockVariants(block.slot)} value={block.variant} />

                    {block.supportsFeatures && (
                        <FeaturesEditor features={block.features} onChange={...} />
                    )}

                    {block.supportsActions && (
                        <ActionsEditor actions={block.actions} onChange={...} />
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
```

### 7.4 Block Types Configuration

**File**: `pages-constants.ts`

```typescript
export interface SlotConfig {
    id: string; // Internal slot name
    label: string; // Display name
    icon: LucideIcon; // Palette icon
    description: string; // Tooltip
    supportsFeatures: boolean;
    supportsActions: boolean;
    singleton?: boolean; // Only one per page (navbar, footer)
    defaultVariant: string;
}

export const BLOCK_TYPES: SlotConfig[] = [
    // Navigation
    {
        id: 'navbar',
        label: 'Navigation Bar',
        icon: Navigation,
        supportsFeatures: false,
        supportsActions: true,
        singleton: true,
        defaultVariant: 'default',
    },

    // Hero
    {
        id: 'hero',
        label: 'Hero Section',
        icon: Sparkles,
        supportsFeatures: false,
        supportsActions: true,
        defaultVariant: 'centered',
    },

    // Content
    {
        id: 'features',
        label: 'Features Grid',
        icon: Grid3X3,
        supportsFeatures: true,
        supportsActions: false,
        defaultVariant: 'grid',
    },
    {
        id: 'cta',
        label: 'Call to Action',
        icon: Megaphone,
        supportsFeatures: false,
        supportsActions: true,
        defaultVariant: 'default',
    },
    {
        id: 'about',
        label: 'About / Content',
        icon: FileText,
        supportsFeatures: true,
        supportsActions: true,
        defaultVariant: 'default',
    },
    {
        id: 'testimonials',
        label: 'Testimonials',
        icon: Quote,
        supportsFeatures: true,
        supportsActions: false,
        defaultVariant: 'carousel',
    },
    {
        id: 'gallery',
        label: 'Image Gallery',
        icon: ImageIcon,
        supportsFeatures: true,
        supportsActions: false,
        defaultVariant: 'grid',
    },
    {
        id: 'team',
        label: 'Team Members',
        icon: Users,
        supportsFeatures: true,
        supportsActions: false,
        defaultVariant: 'grid',
    },
    {
        id: 'pricing',
        label: 'Pricing Table',
        icon: LayoutList,
        supportsFeatures: true,
        supportsActions: true,
        defaultVariant: 'cards',
    },
    {
        id: 'faq',
        label: 'FAQ Section',
        icon: Contact,
        supportsFeatures: true,
        supportsActions: false,
        defaultVariant: 'accordion',
    },
    {
        id: 'video',
        label: 'Video Section',
        icon: Video,
        supportsFeatures: false,
        supportsActions: true,
        defaultVariant: 'default',
    },
    {
        id: 'code',
        label: 'Code Block',
        icon: Code2,
        supportsFeatures: false,
        supportsActions: false,
        defaultVariant: 'default',
    },
    {
        id: 'contact',
        label: 'Contact Form',
        icon: Contact,
        supportsFeatures: false,
        supportsActions: true,
        defaultVariant: 'default',
    },
    {
        id: 'custom',
        label: 'Custom HTML',
        icon: Code2,
        supportsFeatures: false,
        supportsActions: false,
        defaultVariant: 'default',
    },

    // Footer
    {
        id: 'footer',
        label: 'Footer',
        icon: Rows3,
        supportsFeatures: false,
        supportsActions: true,
        singleton: true,
        defaultVariant: 'default',
    },
];

export const BLOCK_VARIANTS: Record<string, { id: string; label: string }[]> = {
    hero: [
        { id: 'centered', label: 'Centered' },
        { id: 'split', label: 'Split (Image Right)' },
        { id: 'minimal', label: 'Minimal' },
    ],
    features: [
        { id: 'grid', label: 'Grid (3 columns)' },
        { id: 'cards', label: 'Cards' },
        { id: 'list', label: 'List' },
    ],
    cta: [
        { id: 'default', label: 'Default' },
        { id: 'banner', label: 'Banner' },
        { id: 'minimal', label: 'Minimal' },
    ],
    navbar: [
        { id: 'default', label: 'Default' },
        { id: 'centered', label: 'Centered' },
        { id: 'minimal', label: 'Minimal' },
    ],
    footer: [
        { id: 'default', label: 'Default' },
        { id: 'minimal', label: 'Minimal' },
        { id: 'columns', label: 'Multi-Column' },
    ],
    about: [
        { id: 'default', label: 'Default' },
        { id: 'minimal', label: 'Minimal' },
        { id: 'detailed', label: 'Detailed' },
    ],
};

export const ACTION_VARIANTS = [
    { id: 'default', label: 'Primary' },
    { id: 'secondary', label: 'Secondary' },
    { id: 'outline', label: 'Outline' },
    { id: 'ghost', label: 'Ghost' },
    { id: 'link', label: 'Link' },
];

export const PAGE_STATUS_OPTIONS = [
    { id: 'draft', label: 'Draft', color: 'amber' },
    { id: 'published', label: 'Published', color: 'emerald' },
    { id: 'archived', label: 'Archived', color: 'zinc' },
];
```

### 7.5 CRUD Hooks & Model Registration

**File**: `src/hooks/pageHooks.ts`

```typescript
import { createModelHooks } from '@ottabase/ottaorm/client';
import type { PageRow, NewPageRow } from '../../ottabase/models/Page.schema';

// OttaORM auto-generated hooks for CRUD operations
export const pageHooks = createModelHooks<PageRow, NewPageRow>({ entityName: 'pages' });
export const pageSectionHooks = createModelHooks({ entityName: 'page_sections' });
export const pageFeatureHooks = createModelHooks({ entityName: 'page_features' });
export const pageActionHooks = createModelHooks({ entityName: 'page_actions' });

// Provides: useList, useDetail, useCreate, useUpdate, useDelete, useInfiniteList
export type { PageRow, PageSectionRow, PageFeatureRow, PageActionRow };
```

**Usage in Builder**:

```typescript
function AdminPageBuilderPage() {
    const { data: page } = pageHooks.useDetail(pageId);
    const { data: sections } = pageSectionHooks.useList({ filters: { pageId } });
    const updatePage = pageHooks.useUpdate();
    const updateSection = pageSectionHooks.useUpdate();
    const createFeature = pageFeatureHooks.useCreate();
    const deleteFeature = pageFeatureHooks.useDelete();

    // Update page title
    const handleTitleChange = (newTitle: string) => {
        updatePage.mutate({ id: pageId, title: newTitle });
    };

    // Add feature to section
    const handleAddFeature = (sectionId: string, featureData: NewPageFeatureRow) => {
        createFeature.mutate({ ...featureData, sectionId });
    };
}
```

**Model Registry**:

Models are registered in `worker/lib/db-utils.ts` for automatic CRUD API endpoints:

```typescript
// worker/lib/db-utils.ts
const pageModels = [Page, PageSection, PageFeature, PageAction];
registerModels([...coreModels, ...pageModels]);
```

This enables:

- `GET /api/ottaorm/pages` — List pages
- `POST /api/ottaorm/pages` — Create page
- `PATCH /api/ottaorm/pages/:id` — Update page
- `DELETE /api/ottaorm/pages/:id` — Delete page
- Same for `page_sections`, `page_features`, `page_actions`

### 7.6 Router Registration (TanStack App)

**File**: `src/router.tsx`

Admin pages are registered as nested routes in the TanStack Router:

```typescript
// src/router.tsx
import { AdminPagesListPage } from './pages/admin/pages/AdminPagesListPage';
import { AdminPageBuilderPage } from './pages/admin/pages/AdminPageBuilderPage';

const adminRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'admin',
    component: AdminLayout,
});

const adminPagesRoute = createRoute({
    getParentRoute: () => adminRoute,
    path: 'pages',
    component: AdminPagesListPage,
});

const adminPageBuilderRoute = createRoute({
    getParentRoute: () => adminPagesRoute,
    path: '$pageId',
    component: AdminPageBuilderPage,
});

// Creates routes:
// /admin/pages → Pages list view
// /admin/pages/:pageId → Page builder
```

**Navigation**:

```typescript
// Link to pages list
<Link to={adminPagesRoute.to()}>Pages</Link>

// Link to specific page builder
<Link to={adminPageBuilderRoute.to({ pageId: 'page-123' })}>
    Edit Page
</Link>
```

### 7.7 Page Settings Dialog

```tsx
function PageSettingsDialog({ page, open, onOpenChange, onSave }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Page Settings</DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="general">
                    <TabsList>
                        <TabsTrigger value="general">General</TabsTrigger>
                        <TabsTrigger value="seo">SEO</TabsTrigger>
                        <TabsTrigger value="nav">Navigation</TabsTrigger>
                        <TabsTrigger value="theme">Theme</TabsTrigger>
                    </TabsList>

                    <TabsContent value="general">
                        <Input label="Title" value={page.title} />
                        <Input label="Slug" value={page.slug} />
                        <Select label="Status" options={PAGE_STATUS_OPTIONS} value={page.status} />
                    </TabsContent>

                    <TabsContent value="seo">
                        <Input label="SEO Title" value={page.seoTitle} />
                        <Textarea label="SEO Description" value={page.seoDescription} />
                        <Input label="SEO Keywords" value={page.seoKeywords} />
                    </TabsContent>

                    <TabsContent value="nav">
                        <Switch label="Show in Navigation" checked={page.showInNav} />
                        <Input label="Nav Order" type="number" value={page.navOrder} />
                        <Input label="Nav Label" value={page.navLabel} />
                        <Input label="Icon" value={page.icon} />
                    </TabsContent>

                    <TabsContent value="theme">
                        <Select label="Theme Preset" options={THEME_PRESETS} value={page.themePreset} />
                        <Select label="Fallback Theme" options={THEME_PRESETS} value={page.fallbackThemePresetId} />
                        <Textarea label="Custom CSS" value={page.customCss} />
                    </TabsContent>
                </Tabs>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={onSave}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
```

---

## 8. Next.js Frontend Rendering

### 8.1 Dynamic Route

**File**: `app/[slug]/page.tsx`

```tsx
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchPageByPageSlug } from '../../lib/api';
import { MarketingPageContent } from './marketing-page-content';

interface PageProps {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ preview?: string }>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const { preview } = await searchParams;
    const isPreview = preview === 'true';

    if (slug === 'homepage') return { title: 'Home' };

    const pageData = await fetchPageByPageSlug(slug, isPreview);
    if (!pageData) return { title: 'Not Found' };

    return {
        title: pageData.display.seoTitle || pageData.page.title,
        description: pageData.display.seoDescription || undefined,
        openGraph: pageData.display.seoImage ? { images: [{ url: pageData.display.seoImage }] } : undefined,
    };
}

export default async function MarketingPage({ params, searchParams }: PageProps) {
    const { slug } = await params;
    const { preview } = await searchParams;
    const isPreview = preview === 'true';

    // Homepage handled by (site)/page.tsx
    if (slug === 'homepage') notFound();

    const pageData = await fetchPageByPageSlug(slug, isPreview);
    if (!pageData) notFound();

    // Only show published pages unless in preview mode
    if (!isPreview && pageData.page.status !== 'published') notFound();

    return <MarketingPageContent pageData={pageData} isPreview={isPreview} />;
}
```

### 8.2 Marketing Page Content Component

**File**: `app/[slug]/marketing-page-content.tsx`

```tsx
'use client';

import type { PageDataPayload, PageSectionPayload } from '@ottabase/homepage-contract';
import { SlotRenderer } from '../../components/SlotRenderer';
import type { HeroData, HeroAction } from '../../components/variants/hero';
import type { FeaturesData } from '../../components/variants/features';
import type { CTAData, CTAAction } from '../../components/variants/cta';
import type { AboutData } from '../../components/variants/about';
import type { NavbarData } from '../../components/variants/navbar';
import type { FooterData } from '../../components/variants/footer';

interface MarketingPageContentProps {
    pageData: PageDataPayload;
    isPreview?: boolean;
}

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost';

function toButtonVariant(v: string | null | undefined): ButtonVariant {
    const valid: ButtonVariant[] = ['default', 'secondary', 'outline', 'ghost'];
    return valid.includes(v as ButtonVariant) ? (v as ButtonVariant) : 'default';
}

function transformSection(section: PageSectionPayload): { slot: string; data: unknown } | null {
    const { slot, title, subtitle, body, githubUrl, features, actions } = section;

    switch (slot) {
        case 'hero':
            return {
                slot: 'hero',
                data: {
                    title: title || 'Welcome',
                    subtitle: subtitle || body || undefined,
                    actions: actions.map(
                        (a): HeroAction => ({
                            label: a.label,
                            href: a.href,
                            variant: toButtonVariant(a.variant),
                        }),
                    ),
                } satisfies HeroData,
            };

        case 'features':
            return {
                slot: 'features',
                data: {
                    title: title || 'Features',
                    features: features.map((f) => ({
                        title: f.title,
                        description: f.description || '',
                        icon: f.icon || undefined,
                    })),
                } satisfies FeaturesData,
            };

        case 'cta':
            return {
                slot: 'cta',
                data: {
                    title: title || 'Get Started',
                    description: subtitle || body || undefined,
                    actions: actions.map(
                        (a): CTAAction => ({
                            label: a.label,
                            href: a.href,
                            variant: toButtonVariant(a.variant),
                        }),
                    ),
                } satisfies CTAData,
            };

        case 'about':
            return {
                slot: 'about',
                data: {
                    title: title || 'About',
                    description: subtitle || body || undefined,
                    githubUrl: githubUrl || undefined,
                } satisfies AboutData,
            };

        case 'navbar':
            return {
                slot: 'navbar',
                data: { title: title || 'Ottabase', githubUrl: githubUrl || undefined } satisfies NavbarData,
            };

        case 'footer':
            return {
                slot: 'footer',
                data: { siteName: title || 'Ottabase', tagline: subtitle || body || undefined } satisfies FooterData,
            };

        default:
            // Fallback: render as CTA
            return {
                slot: 'cta',
                data: {
                    title: title || slot.charAt(0).toUpperCase() + slot.slice(1),
                    description: subtitle || body || undefined,
                    actions: actions.map(
                        (a): CTAAction => ({
                            label: a.label,
                            href: a.href,
                            variant: toButtonVariant(a.variant),
                        }),
                    ),
                } satisfies CTAData,
            };
    }
}

export function MarketingPageContent({ pageData, isPreview = false }: MarketingPageContentProps) {
    const { sections, page } = pageData;

    const enabledSections = sections.filter((s) => s.enabled !== false).sort((a, b) => a.sortOrder - b.sortOrder);

    const navbarSection = enabledSections.find((s) => s.slot === 'navbar');
    const footerSection = enabledSections.find((s) => s.slot === 'footer');
    const contentSections = enabledSections.filter((s) => s.slot !== 'navbar' && s.slot !== 'footer');

    return (
        <div className="min-h-screen flex flex-col">
            {/* Preview Banner */}
            {isPreview && (
                <div className="bg-amber-500 text-black px-4 py-2 text-center text-sm font-medium">
                    Preview Mode — This page is {page.status}. Only you can see this preview.
                </div>
            )}

            {/* Navbar */}
            {navbarSection && <SlotRenderer slot="navbar" data={transformSection(navbarSection)?.data as NavbarData} />}

            {/* Content Sections */}
            <main className="flex-1">
                {contentSections.map((section) => {
                    const transformed = transformSection(section);
                    if (!transformed) return null;

                    return <SlotRenderer key={section.id} slot={transformed.slot} data={transformed.data} />;
                })}
            </main>

            {/* Footer */}
            {footerSection && <SlotRenderer slot="footer" data={transformSection(footerSection)?.data as FooterData} />}
        </div>
    );
}
```

### 8.3 Slot Renderer

**File**: `components/SlotRenderer.tsx`

```tsx
import dynamic from 'next/dynamic';
import type { HeroData } from './variants/hero';
import type { FeaturesData } from './variants/features';
import type { CTAData } from './variants/cta';
import type { NavbarData } from './variants/navbar';
import type { FooterData } from './variants/footer';
import type { AboutData } from './variants/about';

// Discriminated union for type safety
type SlotRendererProps =
    | { slot: 'hero'; data: HeroData; variant?: string }
    | { slot: 'features'; data: FeaturesData; variant?: string }
    | { slot: 'cta'; data: CTAData; variant?: string }
    | { slot: 'navbar'; data: NavbarData; variant?: string }
    | { slot: 'footer'; data: FooterData; variant?: string }
    | { slot: 'about'; data: AboutData; variant?: string };

// Lazy-load variant components
const VARIANT_COMPONENTS = {
    hero: {
        centered: dynamic(() => import('./variants/hero/HeroCentered')),
        split: dynamic(() => import('./variants/hero/HeroSplit')),
        minimal: dynamic(() => import('./variants/hero/HeroMinimal')),
    },
    features: {
        grid: dynamic(() => import('./variants/features/FeaturesGrid')),
        cards: dynamic(() => import('./variants/features/FeaturesCards')),
        list: dynamic(() => import('./variants/features/FeaturesList')),
    },
    cta: {
        default: dynamic(() => import('./variants/cta/CTADefault')),
        banner: dynamic(() => import('./variants/cta/CTABanner')),
        minimal: dynamic(() => import('./variants/cta/CTAMinimal')),
    },
    navbar: {
        default: dynamic(() => import('./variants/navbar/NavbarDefault')),
        centered: dynamic(() => import('./variants/navbar/NavbarCentered')),
        minimal: dynamic(() => import('./variants/navbar/NavbarMinimal')),
    },
    footer: {
        default: dynamic(() => import('./variants/footer/FooterDefault')),
        minimal: dynamic(() => import('./variants/footer/FooterMinimal')),
        columns: dynamic(() => import('./variants/footer/FooterColumns')),
    },
    about: {
        default: dynamic(() => import('./variants/about/AboutDefault')),
        minimal: dynamic(() => import('./variants/about/AboutMinimal')),
        detailed: dynamic(() => import('./variants/about/AboutDetailed')),
    },
};

const DEFAULT_VARIANTS: Record<string, string> = {
    hero: 'centered',
    features: 'grid',
    cta: 'default',
    navbar: 'default',
    footer: 'default',
    about: 'default',
};

export function SlotRenderer(props: SlotRendererProps) {
    const { slot, data, variant } = props;

    const variants = VARIANT_COMPONENTS[slot];
    const variantId = variant || DEFAULT_VARIANTS[slot] || 'default';
    const Component = variants?.[variantId] || variants?.['default'];

    if (!Component) {
        console.warn(`No component found for slot="${slot}" variant="${variantId}"`);
        return null;
    }

    return <Component data={data} />;
}
```

### 8.4 Variant Component Example

**File**: `components/variants/hero/HeroCentered.tsx`

```tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { HeroData, HeroAction } from './types';

export default function HeroCentered({ data }: { data: HeroData }) {
    return (
        <section className="relative py-20 md:py-32">
            <div className="container mx-auto px-4 text-center">
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">{data.title}</h1>

                {data.subtitle && (
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">{data.subtitle}</p>
                )}

                {data.actions && data.actions.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-4">
                        {data.actions.map((action, i) => (
                            <Button key={i} variant={action.variant || 'default'} asChild>
                                <Link href={action.href}>{action.label}</Link>
                            </Button>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
```

### 8.5 API Client

**File**: `lib/api.ts`

```typescript
import type { PageDataPayload, NavPagePayload } from '@ottabase/homepage-contract';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004';

export async function fetchPageByPageSlug(slug: string, preview = false): Promise<PageDataPayload | null> {
    if (!API_URL) return null;

    try {
        const url = new URL(`${API_URL}/api/pages/${encodeURIComponent(slug)}`);
        if (preview) url.searchParams.set('preview', 'true');

        const res = await fetch(url.toString(), {
            next: { revalidate: preview ? 0 : 60 }, // No cache in preview mode
        });

        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

export async function fetchNavPages(): Promise<NavPagePayload[]> {
    if (!API_URL) return [];

    try {
        const res = await fetch(`${API_URL}/api/pages/nav`, {
            next: { revalidate: 60 },
        });

        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data.pages) ? data.pages : [];
    } catch {
        return [];
    }
}
```

---

## 8.5 Block Registry System

### Why This Matters

**Goal**: SaaS founders can register custom components without code deployment or DB migrations.

**Current Limitation**: Slot types are hardcoded enums. Adding a custom block requires:

1. DB migration
2. Code change + redeploy
3. Admin UI manual refresh

**Solution**: Dynamic registry system that apps populate at startup.

### Architecture

#### 1. Block Definition Interface

```typescript
// @ottabase/block-registry (new package)
export interface FieldDefinition {
    type: 'text' | 'textarea' | 'image' | 'select' | 'number' | 'list' | 'object-array';
    label: string;
    placeholder?: string;
    required?: boolean;
    maxLength?: number;
    options?: (string | { label: string; value: string })[];
    schema?: FieldDefinition; // For lists/objects
    responsive?: {
        desktop?: Partial<FieldDefinition>;
        mobile?: Partial<FieldDefinition>;
    };
}

export interface VariantDefinition {
    id: string;
    label: string;
    description?: string;
}

export interface BlockDefinition {
    id: string; // 'hero', 'org:testimonial-wall'
    label: string; // Display name
    icon?: string; // Lucide icon name
    description?: string; // Tooltip
    category: 'layout' | 'content' | 'cta' | 'custom' | 'social' | 'form';

    // Schema
    fields: Record<string, FieldDefinition>;
    variants: VariantDefinition[];
    defaultVariant: string;

    // Rendering hints
    supportsFeatures: boolean;
    supportsActions: boolean;

    // Constraints
    singleton?: boolean; // Only one per page (navbar, footer)
    minWidth?: number; // CSS pixels
    maxWidth?: number;

    // Metadata
    previewUrl?: string; // e.g., '/preview/hero?variant=centered'
    componentName?: string; // For frontend
    sourceApp?: string; // Which app registered this
}
```

#### 2. Registration API

```typescript
// In each Next.js app (at startup, e.g., in app layout or middleware)
import { BlockRegistry } from '@ottabase/block-registry';

const registry = BlockRegistry.getInstance();

// Register built-in blocks
registry.register({
    id: 'hero',
    label: 'Hero Section',
    category: 'layout',
    fields: {
        title: { type: 'text', required: true, maxLength: 100 },
        subtitle: { type: 'text', maxLength: 200 },
        backgroundImage: { type: 'image' },
        actions: { type: 'list', schema: { type: 'action' } },
    },
    variants: [
        { id: 'centered', label: 'Centered' },
        { id: 'split', label: 'Split Layout' },
        { id: 'minimal', label: 'Minimal' },
    ],
    defaultVariant: 'centered',
    supportsFeatures: false,
    supportsActions: true,
});

// Register custom app blocks
registry.register({
    id: 'acme:testimonial-carousel',
    label: 'Testimonial Carousel (ACME)',
    category: 'custom',
    icon: 'MessageSquare',
    fields: {
        testimonials: {
            type: 'object-array',
            schema: {
                name: { type: 'text', required: true },
                role: { type: 'text' },
                quote: { type: 'textarea', required: true },
                image: { type: 'image' },
                rating: { type: 'select', options: ['1', '2', '3', '4', '5'] },
            },
        },
        columns: { type: 'select', options: ['2', '3', '4'], defaultValue: '3' },
        autoPlay: { type: 'select', options: ['true', 'false'] },
    },
    variants: [
        { id: 'grid', label: 'Grid' },
        { id: 'carousel', label: 'Carousel' },
    ],
    defaultVariant: 'carousel',
    supportsFeatures: false,
    supportsActions: false,
});
```

#### 3. Schema Validation from Registry

```typescript
// At runtime, generate Zod schemas from registry
import { buildBlockSchema } from '@ottabase/block-registry';

export function generatePageSectionSchema(registry: BlockRegistry) {
    const blockSchemas = {};

    for (const block of registry.getAll()) {
        blockSchemas[block.id] = buildBlockSchema(block.fields);
    }

    return z
        .object({
            id: z.string(),
            slot: z.string(), // Any registered block ID
            title: z.string().optional(),
            data: z.record(z.unknown()), // Dynamic fields validated by slot
            variant: z.string(),
            enabled: z.boolean(),
            sortOrder: z.number(),
        })
        .refine((data) => {
            const block = registry.get(data.slot);
            if (!block) return false;

            // Validate data against block schema
            const schema = blockSchemas[block.id];
            return schema.safeParse(data.data).success;
        });
}
```

**Benefit**: Adding a custom block requires NO database changes, NO code deployment (if already running), just API call.

---

## 8.6 Component Discovery API

### Why This Matters

**Problem**: Admin UI has no way to discover custom blocks registered by Next.js apps.

**Goal**: Admin UI auto-discovers and displays all available blocks (built-in + custom).

### Architecture

#### 1. App Exposes Block Registry Endpoint

```typescript
// apps/my-homepage/app/api/blocks/route.ts
import { BlockRegistry } from '@ottabase/block-registry';

export async function GET(request: Request) {
    const registry = BlockRegistry.getInstance();

    return Response.json({
        blocks: registry.getAll().map((block) => ({
            id: block.id,
            label: block.label,
            icon: block.icon,
            description: block.description,
            category: block.category,
            variants: block.variants,
            defaultVariant: block.defaultVariant,
            supportsFeatures: block.supportsFeatures,
            supportsActions: block.supportsActions,
            singleton: block.singleton,
            previewUrl: block.previewUrl, // e.g., '/preview/hero?variant=centered'
            componentName: block.componentName,
            sourceApp: block.sourceApp,
        })),
        timestamp: Date.now(),
    });
}
```

#### 2. Admin UI Fetches & Caches

```typescript
// src/lib/blockRegistry.ts (admin UI)
import { BlockRegistry } from '@ottabase/block-registry';

export async function fetchRegisteredBlocks(homePageUrl: string) {
    const registry = BlockRegistry.getInstance();

    try {
        const response = await fetch(`${homePageUrl}/api/blocks`);
        const data = await response.json();

        // Register all blocks
        for (const block of data.blocks) {
            registry.register(block);
        }

        return registry;
    } catch (error) {
        console.error('Failed to fetch blocks:', error);
        return registry; // Return cached registry
    }
}

// Usage in admin builder initialization
export async function initializeBuilder(pageId: string, homePageUrl: string) {
    const registry = await fetchRegisteredBlocks(homePageUrl);
    const page = await fetchPage(pageId);

    return { registry, page };
}
```

#### 3. Admin UI Block Palette Updates Dynamically

```tsx
// src/components/BlockPalette.tsx
import { useBuilder } from '@/hooks/useBuilder';

export function BlockPalette() {
    const { registry } = useBuilder();

    const blocks = registry.getAll();
    const grouped = groupBy(blocks, 'category');

    return (
        <div className="space-y-4">
            {Object.entries(grouped).map(([category, categoryBlocks]) => (
                <div key={category}>
                    <h4 className="text-sm font-semibold capitalize">{category}</h4>
                    <div className="space-y-2">
                        {categoryBlocks.map((block) => (
                            <div key={block.id} className="group relative">
                                {/* Show variants inline */}
                                {block.variants.length > 1 && (
                                    <div className="opacity-0 group-hover:opacity-100 absolute top-0 right-0 flex gap-1 p-2 bg-gray-100 rounded">
                                        {block.variants.map((v) => (
                                            <button
                                                key={v.id}
                                                onClick={() => addBlock(block.id, v.id)}
                                                className="text-xs px-2 py-1 bg-white rounded hover:bg-blue-100"
                                            >
                                                {v.label}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <button
                                    onClick={() => addBlock(block.id, block.defaultVariant)}
                                    className="w-full text-left px-3 py-2 rounded hover:bg-blue-50 transition"
                                >
                                    {block.icon && <Icon name={block.icon} className="inline mr-2" />}
                                    <span className="text-sm">{block.label}</span>
                                    {block.singleton && <Badge>Only one</Badge>}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
```

**Benefit**: Add a new block to your Next.js app → it automatically appears in the admin builder palette within seconds.

---

## 8.7 Split-Pane Preview Architecture

### Why This Matters

**Problem**: Current builder requires clicking "Preview" to see changes in a new tab. Users can't see what they're
building in real-time.

**Goal**: Live, side-by-side preview that updates instantly as user edits.

### Architecture

#### 1. Split Layout Component

```tsx
// src/pages/admin/pages/AdminPageBuilderPage.tsx
export function AdminPageBuilderPage() {
    return (
        <div className="flex h-screen gap-4 p-4 bg-gray-50">
            {/* Left: Builder (70%) */}
            <div className="flex-[0.7] flex flex-col space-y-4 overflow-auto">
                <BuilderHeader />

                <Tabs defaultValue="sections">
                    <TabsList>
                        <TabsTrigger value="sections">Sections</TabsTrigger>
                        <TabsTrigger value="settings">Settings</TabsTrigger>
                        <TabsTrigger value="seo">SEO</TabsTrigger>
                    </TabsList>

                    <TabsContent value="sections">
                        <BlockCanvas />
                    </TabsContent>
                </Tabs>
            </div>

            {/* Right: Live Preview (30%) */}
            <div className="flex-[0.3] bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
                <LivePreviewHeader />
                <LivePreviewPane />
            </div>
        </div>
    );
}
```

#### 2. Live Preview Component

```tsx
// src/components/LivePreviewPane.tsx
import { useBuilder } from '@/hooks/useBuilder';
import { SlotRenderer } from '@/components/SlotRenderer';

export function LivePreviewPane() {
    const { page, sections, display, previewMode } = useBuilder();
    const [viewport, setViewport] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

    const viewportWidths = {
        mobile: 375,
        tablet: 768,
        desktop: 1200,
    };

    return (
        <div className="flex flex-col h-full bg-gray-100">
            {/* Viewport Selector */}
            <div className="flex gap-2 p-3 border-b bg-white">
                {(['mobile', 'tablet', 'desktop'] as const).map((mode) => (
                    <button
                        key={mode}
                        onClick={() => setViewport(mode)}
                        className={`px-3 py-1 text-sm rounded ${
                            viewport === mode ? 'bg-blue-500 text-white' : 'bg-gray-200'
                        }`}
                    >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)} ({viewportWidths[mode]}px)
                    </button>
                ))}
            </div>

            {/* Preview Canvas */}
            <div className="flex-1 overflow-auto bg-gray-100 flex items-start justify-center p-4">
                <div
                    className="bg-white shadow-lg"
                    style={{
                        width: `${viewportWidths[viewport]}px`,
                        minHeight: '100%',
                    }}
                >
                    {/* Draft Banner */}
                    {page.status === 'draft' && (
                        <div className="bg-amber-100 text-amber-900 px-4 py-2 text-sm font-medium">
                            Draft Preview — Changes are not live
                        </div>
                    )}

                    {/* Rendered Blocks */}
                    <div className="preview-container">
                        {sections
                            .filter((s) => s.enabled)
                            .sort((a, b) => a.sortOrder - b.sortOrder)
                            .map((section) => (
                                <SlotRenderer
                                    key={section.id}
                                    slot={section.slot}
                                    data={transformSectionData(section)}
                                    variant={section.variant}
                                    isPreview={true}
                                />
                            ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
```

#### 3. Real-Time Sync via TanStack Query

```typescript
// src/hooks/useBuilder.ts
export function useBuilder() {
    const pageId = useParams().pageId;

    // Fetch page data
    const { data: page } = pageHooks.useDetail(pageId);

    // Fetch sections
    const { data: sections } = pageSectionHooks.useList(
        { filters: { pageId } },
        {
            refetchOnWindowFocus: true,
            refetchInterval: 1000, // Update preview every 1 second
        },
    );

    // When mutations occur, preview updates automatically
    const updateSection = pageSectionHooks.useUpdate();

    const handleSectionChange = (sectionId: string, updates: Partial<PageSectionRow>) => {
        updateSection.mutate(
            { id: sectionId, ...updates },
            {
                onSuccess: () => {
                    // TanStack Query auto-updates cache
                    // Preview re-renders from new data
                },
            },
        );
    };

    return {
        page,
        sections: sections || [],
        updateSection: handleSectionChange,
        // ...
    };
}
```

**Benefit**: Users see exactly what they're building in real-time. Page building feels instant and satisfying.

---

## 8.8 Extensibility & Custom Blocks

### How It All Works Together

#### Step 1: App Registers Blocks (at startup)

```typescript
// apps/my-saas/lib/blocks.ts
import { BlockRegistry } from '@ottabase/block-registry';

export function registerCustomBlocks() {
    const registry = BlockRegistry.getInstance();

    registry.register({
        id: 'myorg:pricing-calculator',
        label: 'Pricing Calculator',
        category: 'custom',
        fields: {
            title: { type: 'text', required: true },
            plans: { type: 'object-array', schema: { ... } },
            currency: { type: 'select', options: ['USD', 'EUR', 'GBP'] },
        },
        variants: [
            { id: 'cards', label: 'Card Layout' },
            { id: 'slider', label: 'Slider' },
        ],
        defaultVariant: 'cards',
        previewUrl: '/preview/pricing?variant=cards',
        componentName: 'PricingCalculator',
    });
}

// In app layout or middleware
registerCustomBlocks();
```

#### Step 2: Admin Discovers Blocks

```typescript
// Admin loads: GET /api/blocks
// Response includes: hero, features, pricing-calculator, your-custom-blocks
// Admin UI palette auto-updates with all blocks
```

#### Step 3: User Adds Block & Sees Preview

```
User clicks "Pricing Calculator" variant "Slider"
↓
Block added to page with default data
↓
Live preview pane renders <PricingCalculator variant="slider" />
↓
User sees it immediately on the right side
```

#### Step 4: User Edits Block Data

```
User clicks block → Editor sheet opens
User fills form based on block's field definitions
↓
Each field change → mutation → cache updated
↓
Live preview re-renders with new data
```

**Result**: Fully dynamic, extensible page builder with zero custom deployment needed for new blocks.

### 9.1 Creating a New Page

1. User navigates to **Admin → Marketing Pages**
2. Clicks **"+ New Page"** button
3. System creates page with:
    - `title`: "New Page"
    - `slug`: `page-{timestamp}`
    - `status`: "draft"
    - `type`: "block"
4. Redirects to **Page Builder**
5. Page builder loads empty canvas

### 9.2 Adding Blocks

1. In Page Builder, user sees **Block Palette** on left
2. Clicks a block type (e.g., "Hero Section")
3. System:
    - Creates `PageSection` record with `slot: 'hero'`, `enabled: true`
    - Adds to canvas at bottom
    - Sets default variant (e.g., "centered")
4. Block appears in canvas with grab handle
5. User can click block to edit in **Block Editor** sheet

### 9.3 Reordering Blocks

1. User drags block by grab handle
2. DnD library (@dnd-kit) handles visual feedback
3. On drop, system:
    - Calculates new `sortOrder` values
    - Batch updates all affected sections
4. Canvas re-renders with new order

### 9.4 Editing a Block

1. User clicks a block in canvas
2. **Block Editor** sheet slides in from right
3. Editor shows:
    - Title, subtitle, body fields
    - Variant selector (dropdown)
    - Features list (if `supportsFeatures`)
    - Actions list (if `supportsActions`)
    - Advanced: CSS classes, background color
4. Changes are debounced and auto-saved

### 9.5 Managing Features (within a block)

1. In Block Editor for "Features Grid" block
2. User sees existing features with drag handles
3. Clicks **"+ Add Feature"**
4. Inline editor appears:
    - Title (required)
    - Description
    - Icon (picker or text)
    - Link URL (optional)
5. User fills and saves
6. Feature appears in list, can be reordered

### 9.6 Managing Actions (CTA buttons)

1. In Block Editor for "Hero" or "CTA" block
2. User sees existing buttons
3. Clicks **"+ Add Button"**
4. Inline editor:
    - Label (required)
    - URL (required)
    - Variant (Primary, Secondary, Outline, Ghost, Link)
    - Icon (optional)
    - Open in new tab (toggle)
5. User fills and saves

### 9.7 Publishing a Page

1. User clicks **"Settings"** button in header
2. Opens **Page Settings Dialog**
3. Navigates to **General** tab
4. Changes Status from "Draft" → "Published"
5. Clicks **Save**
6. Page is now live at `/{slug}`

### 9.8 Previewing a Page

1. User clicks **"Preview"** button in header
2. Opens new tab to `http://{HOMEPAGE_URL}/{slug}?preview=true`
3. Draft page renders with **amber preview banner**
4. User verifies design before publishing

### 9.9 Deleting a Page

1. In Pages List, user clicks **⋮** menu on page row
2. Clicks **"Delete"**
3. Confirmation dialog appears
4. User confirms
5. System:
    - Deletes page (cascade deletes sections, features, actions)
    - Removes from list

---

## 10. Implementation Checklist

### Phase 1: Database & Models

- [ ] Create `Page.schema.ts` with all fields
- [ ] Create `PageSection.schema.ts` with FK to pages
- [ ] Create `PageFeature.schema.ts` with FK to sections
- [ ] Create `PageAction.schema.ts` with FK to sections
- [ ] Export all tables in `ottabase/db/schema.ts`
- [ ] Add tables to `config.migrations.ts` PACKAGE_REGISTRY
- [ ] Create `Page.ts` model with static methods
- [ ] Create `PageSection.ts` model
- [ ] Create `PageFeature.ts` model
- [ ] Create `PageAction.ts` model
- [ ] Register models in `worker/lib/db-utils.ts`
- [ ] Run migrations: `curl -X POST /api/ottaorm/init`

### Phase 2: API Routes

- [ ] Create `worker/routes/pages.ts`
- [ ] Implement `GET /api/pages/:slug` with features/actions
- [ ] Implement `GET /api/pages/nav`
- [ ] Implement `POST /api/pages/seed`
- [ ] Add preview mode (`?preview=true`)
- [ ] Register routes in `router.ts`
- [ ] Test with curl/Postman

### Phase 3: Contract Package

- [ ] Create `packages/homepage-contract/`
- [ ] Define Zod schemas in `schemas.ts`
- [ ] Export TypeScript types in `types.ts`
- [ ] Add to workspace and build

### Phase 4: Admin UI - Pages List

- [ ] Create `src/pages/admin/pages/AdminPagesListPage.tsx`
- [ ] Create CRUD hooks in `hooks/pageHooks.ts`
- [ ] Add route in TanStack Router
- [ ] Implement create/delete/duplicate
- [ ] Add search and filtering

### Phase 5: Admin UI - Page Builder

- [ ] Create `pages-constants.ts` with block definitions
- [ ] Create `MarketingPageBuilder.tsx`
- [ ] Implement Block Palette component
- [ ] Implement Canvas with @dnd-kit
- [ ] Implement Block Editor sheet
- [ ] Implement Features editor
- [ ] Implement Actions editor
- [ ] Implement Page Settings dialog
- [ ] Wire up all mutations

### Phase 6: Next.js Frontend

- [ ] Create `app/[slug]/page.tsx` dynamic route
- [ ] Create `app/[slug]/marketing-page-content.tsx`
- [ ] Update `lib/api.ts` with preview support
- [ ] Create/update slot components in `components/variants/`
- [ ] Implement SlotRenderer with variant dispatch
- [ ] Add preview banner for draft pages
- [ ] Test all slots and variants

### Phase 7: Polish & Testing

- [ ] Add loading states
- [ ] Add error handling
- [ ] Add optimistic updates
- [ ] Write tests for models
- [ ] Write tests for API routes
- [ ] Write component tests

---

## 10.5 UX/DX Enhancements

These are not MVP but significantly improve the builder experience:

### A. Inline Editing (Block Title in Canvas)

**Problem**: Users must click a block, wait for sheet to open, find the title field, edit it.

**Solution**: Double-click block title in canvas to edit inline.

```tsx
// src/components/BlockCanvas/BlockCard.tsx
export function BlockCard({ section }: { section: PageSectionRow }) {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [title, setTitle] = useState(section.title);
    const updateSection = pageSectionHooks.useUpdate();

    const handleTitleBlur = async () => {
        if (title !== section.title) {
            updateSection.mutate({ id: section.id, title });
        }
        setIsEditingTitle(false);
    };

    return (
        <Card className="cursor-grab active:cursor-grabbing">
            {isEditingTitle ? (
                <input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={handleTitleBlur}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleTitleBlur();
                        if (e.key === 'Escape') {
                            setTitle(section.title);
                            setIsEditingTitle(false);
                        }
                    }}
                    className="text-sm font-semibold border-b focus:outline-none"
                />
            ) : (
                <h3
                    onDoubleClick={() => setIsEditingTitle(true)}
                    className="text-sm font-semibold cursor-pointer hover:text-blue-600"
                >
                    {title || 'Untitled Block'}
                </h3>
            )}
        </Card>
    );
}
```

**Benefit**: Faster editing flow, especially for bulk updates.

---

### B. Keyboard Shortcuts

**Common flows that need shortcuts**:

| Shortcut   | Action                | Context      |
| ---------- | --------------------- | ------------ |
| `Ctrl/⌘ Z` | Undo last change      | Builder      |
| `Ctrl/⌘ Y` | Redo                  | Builder      |
| `Ctrl/⌘ D` | Duplicate selected    | Canvas       |
| `Delete`   | Delete selected block | Canvas       |
| `Ctrl/⌘ S` | Save page             | Builder      |
| `Escape`   | Close editor sheet    | Editor       |
| `Tab`      | Focus next field      | Block editor |

**Implementation**:

```typescript
// src/lib/useKeyboardShortcuts.ts
export function useKeyboardShortcuts() {
    const { selectedBlockId, deleteBlock, duplicateBlock } = useBuilder();
    const updatePage = pageHooks.useUpdate();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                undo();
            }
            if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                redo();
            }
            if (e.key === 'd' && (e.ctrlKey || e.metaKey) && selectedBlockId) {
                e.preventDefault();
                duplicateBlock(selectedBlockId);
            }
            if (e.key === 'Delete' && selectedBlockId) {
                deleteBlock(selectedBlockId);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedBlockId]);
}
```

---

### C. Undo/Redo (Action History)

**Architecture**: Track mutations in builder state, allow forward/backward navigation.

```typescript
// src/lib/useActionHistory.ts
interface Action {
    type: 'add' | 'update' | 'delete' | 'reorder';
    targetId: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    timestamp: number;
}

export function useActionHistory() {
    const [history, setHistory] = useState<Action[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);

    const record = (action: Omit<Action, 'timestamp'>) => {
        const newHistory = history.slice(0, currentIndex + 1);
        newHistory.push({ ...action, timestamp: Date.now() });
        setHistory(newHistory);
        setCurrentIndex(newHistory.length - 1);
    };

    const undo = () => {
        if (currentIndex > 0) {
            const action = history[currentIndex - 1];
            replayAction(action, 'undo');
            setCurrentIndex(currentIndex - 1);
        }
    };

    const redo = () => {
        if (currentIndex < history.length - 1) {
            const action = history[currentIndex + 1];
            replayAction(action, 'redo');
            setCurrentIndex(currentIndex + 1);
        }
    };

    return { record, undo, redo, canUndo: currentIndex > 0, canRedo: currentIndex < history.length - 1 };
}
```

---

### D. Copy/Paste Blocks

**Allows users to reuse common patterns**.

```typescript
// src/lib/useBlockClipboard.ts
export function useBlockClipboard() {
    const [clipboard, setClipboard] = useState<PageSectionRow | null>(null);

    const copyBlock = (section: PageSectionRow) => {
        setClipboard(section);
        toast.success('Block copied');
    };

    const pasteBlock = async (pageId: string, afterSectionId?: string) => {
        if (!clipboard) return;

        const newSection = { ...clipboard, id: generateId(), pageId };
        if (afterSectionId) {
            // Insert after specified block
            newSection.sortOrder = clipboard.sortOrder + 1;
        }

        const createSection = pageSectionHooks.useCreate();
        createSection.mutate(newSection);
        toast.success('Block pasted');
    };

    return { copyBlock, pasteBlock, hasClipboard: !!clipboard };
}
```

---

### E. Column Resizing (Split-Pane)

**Allow users to adjust builder/preview ratio**:

```tsx
// src/components/ResizablePanes.tsx
import { Rnd } from 'react-rnd';

export function ResizableBuilderLayout() {
    return (
        <Rnd
            default={{ x: 0, y: 0, width: '70%', height: '100%' }}
            resizeHandleComponent={{ right: <div className="w-1 bg-border hover:bg-blue-500" /> }}
            enableResizing={{ right: true }}
        >
            <BuilderPane />
        </Rnd>
    );
}
```

---

## 10.6 Quick UX Wins (Highest Impact, Low Effort)

These are 1-3 hour improvements that dramatically improve the builder feel:

### 1. **Block Icons in Palette + Canvas** (30 min)

Add Lucide icons to block palette and canvas cards to make the builder visually scannable.

```tsx
// src/components/BlockPalette.tsx
const BLOCK_ICONS = {
    hero: 'Zap',
    features: 'Grid3x3',
    cta: 'Button',
    navbar: 'Menu',
    footer: 'LayoutFooter',
    testimonials: 'MessageSquare',
};

{
    blocks.map((block) => (
        <div key={block.id} className="flex items-center gap-2 p-2 hover:bg-gray-100">
            <Icon name={BLOCK_ICONS[block.id]} size={18} />
            <span className="text-sm">{block.label}</span>
        </div>
    ));
}
```

**Impact**: Builders visually identify blocks 3x faster.

---

### 2. **Empty State Messaging** (30 min)

Show helpful hints when page has no blocks:

```tsx
// src/components/BlockCanvas.tsx
if (sections.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-96 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-center">
                <p className="text-gray-600 text-sm mb-4">No blocks yet. Start by adding one from the palette →</p>
                <button onClick={() => selectBlock('hero')} className="px-4 py-2 bg-blue-500 text-white rounded">
                    Add Hero Section
                </button>
            </div>
        </div>
    );
}
```

**Impact**: First-time users understand what to do next immediately.

---

### 3. **Validation Errors in Block Editor** (30 min)

Show red outlines and error messages for required fields:

```tsx
// src/components/BlockEditor.tsx
export function BlockEditor({ block, definition }: Props) {
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleSave = () => {
        const schema = buildBlockSchema(definition.fields);
        const result = schema.safeParse(formData);

        if (!result.success) {
            const errorMap: Record<string, string> = {};
            result.error.errors.forEach((err) => {
                errorMap[err.path.join('.')] = err.message;
            });
            setErrors(errorMap);
            return;
        }

        updateBlock(block.id, formData);
    };

    return (
        <form>
            {Object.entries(definition.fields).map(([fieldKey, fieldDef]) => (
                <div key={fieldKey} className={errors[fieldKey] ? 'border-red-500' : ''}>
                    <input value={formData[fieldKey]} />
                    {errors[fieldKey] && <span className="text-red-500 text-xs">{errors[fieldKey]}</span>}
                </div>
            ))}
        </form>
    );
}
```

**Impact**: Users never waste time fixing data validation errors after publishing.

---

### 4. **Publish Preview (Quick Visual Check)** (30 min)

Show a mini preview of how the page looks before publish:

```tsx
// src/components/PublishDialog.tsx
export function PublishDialog({ page }: Props) {
    return (
        <Dialog>
            <div className="flex gap-4">
                {/* Left: Settings */}
                <div className="flex-1">
                    <h3 className="text-sm font-semibold mb-4">Confirm & Publish</h3>
                    <div className="space-y-3">
                        <div>
                            <label>URL Slug</label>
                            <input value={page.slug} readOnly className="w-full px-2 py-1 border rounded bg-gray-100" />
                        </div>
                        <div>
                            <label>SEO Title</label>
                            <input value={page.seoTitle} />
                        </div>
                    </div>
                </div>

                {/* Right: Live Preview (375px mobile viewport) */}
                <div className="w-96 bg-gray-100 rounded overflow-hidden">
                    <LivePreviewPane pageId={page.id} viewport="mobile" />
                </div>
            </div>
        </Dialog>
    );
}
```

**Impact**: Users see exactly what they're publishing before going live.

---

### 5. **Duplicate Page** (15 min)

Add "Duplicate" option to pages list context menu:

```tsx
// src/pages/admin/pages/AdminPagesListPage.tsx
const handleDuplicate = async (pageId: string) => {
    const originalPage = await fetchPage(pageId);
    const newPage = {
        ...originalPage,
        id: generateId(),
        title: `${originalPage.title} (Copy)`,
        slug: `${originalPage.slug}-copy-${Date.now()}`,
        status: 'draft' as const,
    };

    createPage.mutate(newPage);

    // Also duplicate all sections
    const sections = await fetchSections(pageId);
    sections.forEach((section) => {
        createSection.mutate({
            ...section,
            id: generateId(),
            pageId: newPage.id,
        });
    });

    toast.success('Page duplicated');
};
```

**Impact**: Template pages reduce time for new landing pages from 5 min to 30 sec.

---

### 6. **Bulk Section Import (JSON)** (1 hour)

Let power users paste JSON to bulk-import sections:

```tsx
// src/components/BlockImportDialog.tsx
const handleImportJSON = (json: string) => {
    try {
        const sections = JSON.parse(json);
        sections.forEach((section) => {
            createSection.mutate(section);
        });
        toast.success(`Imported ${sections.length} sections`);
    } catch (e) {
        toast.error('Invalid JSON');
    }
};
```

**Example JSON**:

```json
[
    {
        "slot": "hero",
        "variant": "centered",
        "title": "Welcome to our platform",
        "subtitle": "Build landing pages in minutes",
        "actions": [{ "label": "Get Started", "href": "/signup", "variant": "primary" }]
    },
    {
        "slot": "features",
        "variant": "grid",
        "title": "Why choose us?",
        "features": [
            { "title": "Fast", "description": "Deployed in seconds" },
            { "title": "Secure", "description": "Enterprise-grade" }
        ]
    }
]
```

**Impact**: Designers or developers can pre-populate pages programmatically, then hand off to content team for
refinement.

---

## Summary: UX/DX Priority Matrix

| Feature                 | Effort  | Impact | Priority |
| ----------------------- | ------- | ------ | -------- |
| Block icons             | 30 min  | High   | **P0**   |
| Empty state messaging   | 30 min  | High   | **P1**   |
| Field validation errors | 30 min  | High   | **P1**   |
| Publish preview         | 30 min  | Medium | **P1**   |
| Duplicate page          | 15 min  | High   | **P0**   |
| Bulk JSON import        | 1 hour  | Medium | **P2**   |
| Inline title editing    | 1 hour  | Medium | **P2**   |
| Undo/Redo               | 2 hours | High   | **P2**   |
| Keyboard shortcuts      | 1 hour  | Medium | **P3**   |
| Copy/Paste blocks       | 1 hour  | Medium | **P3**   |
| Column resizing         | 30 min  | Low    | **P3**   |

**Recommendation**: Ship P0 features (block icons ~15 min, duplicate ~15 min = 30 min ROI) immediately after MVP. Add P1
features in second iteration.

---

## 11. File Paths Summary

```
Database & Models (TanStack App):
├── ottabase/models/Page.schema.ts
├── ottabase/models/PageSection.schema.ts
├── ottabase/models/PageFeature.schema.ts
├── ottabase/models/PageAction.schema.ts
├── ottabase/models/Page.ts
├── ottabase/models/PageSection.ts
├── ottabase/models/PageFeature.ts
├── ottabase/models/PageAction.ts
├── ottabase/models/pagePolicy.ts (RLS policies)
├── ottabase/db/schema.ts (exports all tables)
├── ottabase/db/schemas-helper.ts (schema collection)
├── ottabase/config.migrations.ts (registration)
└── worker/lib/db-utils.ts (model & policy registration)

API Routes (TanStack App):
├── worker/routes/pages.ts (main implementation)
├── worker/routes/router.ts (route registration)
└── src/router.tsx (admin UI route registration)

RLS Policies (TanStack App):
├── ottabase/models/pagePolicy.ts (Page, PageSection, PageFeature, PageAction policies)
└── Registered in worker/lib/db-utils.ts via registerPolicy()

Contract Package:
└── packages/homepage-contract/src/
    ├── schemas.ts (Zod schemas for validation)
    ├── types.ts (TypeScript inferred types)
    └── index.ts (re-exports)

Admin UI (TanStack App):
├── src/pages/admin/pages/
│   ├── index.ts (route exports)
│   ├── AdminPagesListPage.tsx (pages list view)
│   ├── AdminPageBuilderPage.tsx (builder container with tabs)
│   ├── MarketingPageBuilder.tsx (main drag-and-drop builder)
│   └── pages-constants.ts (block types, variants, constants)
├── src/hooks/pageHooks.ts (CRUD hooks via createModelHooks)
└── src/router.tsx (TanStack Router config with /admin/pages routes)

Next.js Frontend (Next.js Homepage App):
├── app/[slug]/page.tsx (dynamic route for marketing pages)
├── app/[slug]/marketing-page-content.tsx (client component rendering logic)
├── components/SlotRenderer.tsx (discriminated union slot renderer)
├── components/variants/
│   ├── hero/ (HeroCentered, HeroSplit, HeroMinimal)
│   ├── features/ (FeaturesGrid, FeaturesCards, FeaturesList)
│   ├── cta/ (CTADefault, CTABanner, CTAMinimal)
│   ├── navbar/ (NavbarDefault, NavbarCentered, NavbarMinimal)
│   ├── footer/ (FooterDefault, FooterMinimal, FooterColumns)
│   └── about/ (AboutDefault, AboutMinimal, AboutDetailed)
└── lib/api.ts (API client with fetch functions)
```

---

## 12. Key Technical Decisions

| Decision                                 | Rationale                                                      |
| ---------------------------------------- | -------------------------------------------------------------- |
| **4 tables (normalized)**                | Clean separation, cascade deletes, efficient queries           |
| **Slot + Variant pattern**               | Write data once, render via any visual variant                 |
| **Contract package**                     | Single source of truth, no type drift between API and frontend |
| **Zod schemas**                          | Runtime validation + TypeScript inference                      |
| **@dnd-kit for DnD**                     | Modern, accessible, React 18+ compatible                       |
| **Preview mode via query param**         | Simple, no auth required for dev (can add token later)         |
| **Discriminated union for SlotRenderer** | Compile-time enforcement of slot ↔ data type match             |
| **Dynamic imports for variants**         | Code splitting, better performance                             |
| **OttaORM for CRUD**                     | Consistent with rest of codebase, auto-hooks                   |
| **Cascade deletes in DB**                | Data integrity, no orphan records                              |

---

## 13. Future Enhancements

- **Undo/Redo** — Track action history in builder
- **Block templates** — Pre-filled content for common patterns
- **A/B testing** — Multiple versions of pages
- **Analytics** — Track page views and conversions
- **Scheduled publishing** — Publish at specific time
- **Version history** — Restore previous versions
- **Multi-language** — i18n for page content
- **Theme builder** — Visual theme customization
- **Form blocks** — Contact forms with submission handling
- **Integration blocks** — Calendly, Stripe, etc.

---

## 13.5 Row-Level Security (RLS) — Data Access Control

> **Important**: This system includes RLS policies to enforce data isolation. These are automatically enforced by the
> OttaORM layer.

### RLS Policy Files

All pages system RLS policies are defined in `ottabase/models/pagePolicy.ts`:

```typescript
// File: ottabase/models/pagePolicy.ts
export const pagePolicy = {
    entity: 'pages',
    tenant: {
        field: 'appId',
        description: 'Pages scoped to app',
    },
};

export const pageSectionPolicy = {
    entity: 'page_sections',
    description: 'Sections inherit page scope via pageId FK',
};

export const pageFeaturePolicy = {
    entity: 'page_features',
    description: 'Features inherit section scope via sectionId FK',
};

export const pageActionPolicy = {
    entity: 'page_actions',
    description: 'Actions inherit section scope via sectionId FK',
};
```

### Policy Registration

Policies are registered in `worker/lib/db-utils.ts` during app initialization:

```typescript
// worker/lib/db-utils.ts
function initDbConnection(env: CloudflareEnv) {
    registerConnection('default', createD1Driver(env.OBCF_D1));

    // Register policies before models
    registerPolicy(pagePolicy);
    registerPolicy(pageSectionPolicy);
    registerPolicy(pageFeaturePolicy);
    registerPolicy(pageActionPolicy);

    // Register models (policies automatically enforced)
    registerModels([Page, PageSection, PageFeature, PageAction, ...otherModels]);

    // Initialize RLS rules for current context
    initRLS();
}
```

### Policy Behavior

When a query is executed via OttaORM:

1. **Tenant Rule** → If `appId` filter set, restrict results to matching appId
2. **Cascade** → Sections, Features, Actions inherit parent scope automatically
3. **No Bypassing** → Raw SQL queries must manually apply RLS (recommended: use OttaORM instead)

**Example Query** (automatically scoped):

```typescript
// Assuming context has appId = "app-123"
const pages = await Page.where({ status: 'published' });
// Behind the scenes: SELECT * FROM pages WHERE status = 'published' AND appId = 'app-123'
```

### Multi-Tenant Isolation

For SaaS deployments where multiple organizations share the system:

```typescript
// In handler context, set appId filter
const pages = await Page.where({
    status: 'published',
    appId: currentOrgId, // Must specify orgId
});

// Cannot query across orgs (policy prevents it)
const allPages = await Page.where({ status: 'published' }); // Error if appId required
```

---

## 14. Problem Statement & Why This Exists

### The Problem

Before this system, marketing pages in Ottabase had two options:

1. **Hardcoded in Next.js** — Fast but requires developer deployment for every text change
2. **Blog posts (ottablog)** — Dynamic but limited to article format, no rich layouts

Neither option allowed non-technical users to create landing pages with modern layouts (hero sections, feature grids,
CTAs, testimonials).

### The Solution

A **block-based page builder** that:

- Stores page structure in D1 (no code deploys for content changes)
- Supports multiple visual variants per block (centered hero vs split hero)
- Provides drag-and-drop UX for non-technical users
- Maintains type safety from database to frontend via shared contract

### Success Criteria

| Metric                          | Target                                      |
| ------------------------------- | ------------------------------------------- |
| Time to create new landing page | < 5 minutes (no code)                       |
| Time to update content          | < 30 seconds (edit → save → live)           |
| Page render time (frontend)     | < 100ms (cached), < 300ms (cold)            |
| Builder responsiveness          | < 50ms for drag operations                  |
| Zero deployments for content    | Marketing team never needs DevOps for pages |

---

## 15. Design Principles

### 1. **Blocks Are Data, Not Code**

Blocks store structured data (title, features, actions). Visual rendering is decoupled via variants. _Same data,
different designs._

```
Block Data: { slot: "hero", title: "Welcome", actions: [...] }
     ↓
Variant Selection: "centered" | "split" | "minimal"
     ↓
Component: <HeroCentered data={...} /> | <HeroSplit data={...} />
```

### 2. **Composition Over Configuration**

Instead of one mega-block with 50 options, we have focused blocks:

- `hero` → title, subtitle, actions
- `features` → title, feature list
- `cta` → title, description, actions

Combine blocks to build complex pages.

### 3. **Progressive Enhancement**

Default content always works. Advanced options (custom CSS, metadata) are optional.

### 4. **Type Safety End-to-End**

```
Drizzle Schema → OttaORM Model → API Response → Zod Validation → TypeScript Type → React Component
```

No `any` types. All transformations are explicit.

### 5. **Minimal Admin, Maximum Render**

Admin builder does complex work (DnD, inline editing). Public frontend is simple (fetch JSON → render components).

---

## 16. State Management Strategy

### Admin Builder State

```typescript
// Local state (React useState/useReducer)
interface BuilderState {
    page: PageRow; // Current page metadata
    blocks: PageSectionRow[]; // Ordered sections
    selectedBlockId: string | null; // Currently selected for editing
    isDirty: boolean; // Unsaved changes indicator
    isReordering: boolean; // DnD in progress
}

// Server state (TanStack Query)
// - pageHooks.useDetail(pageId) → page metadata
// - pageSectionHooks.useList({ pageId }) → blocks
// - pageFeatureHooks.useList({ sectionId }) → features for selected block
// - pageActionHooks.useList({ sectionId }) → actions for selected block
```

### Data Flow

```
User Action (add block)
     ↓
Optimistic Update (local state + cache)
     ↓
Mutation (pageSectionHooks.useCreate)
     ↓
Server Response (success/error)
     ↓
Cache Invalidation (queryClient.invalidateQueries(['page_sections']))
     ↓
UI Re-render (new block appears)
```

### Mutation Strategies

| Operation         | Strategy          | Rollback on Error               |
| ----------------- | ----------------- | ------------------------------- |
| Add block         | Optimistic        | Remove from cache               |
| Delete block      | Optimistic        | Restore to cache                |
| Reorder blocks    | Optimistic        | Restore original order          |
| Edit block fields | Debounced (300ms) | Revert to server value          |
| Add feature       | Optimistic        | Remove from cache               |
| Publish page      | Await             | Show error toast, stay on draft |

---

## 17. Error Handling Matrix

### API Errors

| Error Code           | HTTP Status | Cause                       | User Message                          | Recovery Action               |
| -------------------- | ----------- | --------------------------- | ------------------------------------- | ----------------------------- |
| `PAGE_NOT_FOUND`     | 404         | Slug doesn't exist          | "Page not found"                      | Show 404 page                 |
| `PAGE_NOT_PUBLISHED` | 404         | Page is draft (non-preview) | "Page not found"                      | Show 404 page                 |
| `VALIDATION_ERROR`   | 400         | Invalid payload             | Field-specific message                | Highlight field, show message |
| `SLUG_EXISTS`        | 409         | Duplicate slug              | "A page with this URL already exists" | Focus slug field              |
| `DB_ERROR`           | 500         | D1 query failed             | "Something went wrong. Try again."    | Log error, show retry button  |
| `RATE_LIMITED`       | 429         | Too many requests           | "Too many requests. Wait a moment."   | Disable button, auto-retry    |

### Client Errors

| Scenario                   | Detection                     | Handling                                |
| -------------------------- | ----------------------------- | --------------------------------------- |
| Network offline            | `navigator.onLine === false`  | Queue mutations, sync when online       |
| Mutation timeout           | 10s without response          | Show retry option                       |
| Optimistic update conflict | Server returns different data | Show conflict toast, use server version |
| Stale data                 | `staleTime` exceeded          | Background refetch                      |
| Component render error     | Error boundary catches        | Show fallback UI, log to error service  |

### Validation Rules

```typescript
// Page validation
const pageSchema = z.object({
    title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
    slug: z
        .string()
        .min(1, 'URL slug is required')
        .max(50, 'Slug too long')
        .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
    status: z.enum(['draft', 'published', 'archived']),
});

// Section validation
const sectionSchema = z.object({
    title: z.string().max(200).nullable(),
    subtitle: z.string().max(500).nullable(),
    body: z.string().max(10000).nullable(),
});

// Action validation
const actionSchema = z.object({
    label: z.string().min(1, 'Button label required').max(50),
    href: z.string().url('Must be a valid URL').or(z.string().startsWith('/')),
});

// Feature validation
const featureSchema = z.object({
    title: z.string().min(1, 'Feature title required').max(100),
    description: z.string().max(500).nullable(),
});
```

---

## 18. Performance Considerations

### Caching Strategy

| Resource            | Cache Location | TTL     | Invalidation Trigger     |
| ------------------- | -------------- | ------- | ------------------------ |
| Page list (admin)   | TanStack Query | 30s     | Create/delete page       |
| Page detail (admin) | TanStack Query | 60s     | Update page              |
| Sections (admin)    | TanStack Query | 60s     | Any section mutation     |
| Public page data    | Next.js ISR    | 60s     | Revalidate on publish    |
| Nav pages           | Next.js ISR    | 60s     | Revalidate on nav change |
| Variant components  | Dynamic import | Forever | Code deployment          |

### Lazy Loading

```typescript
// Variant components are dynamically imported
const VARIANT_COMPONENTS = {
    hero: {
        centered: dynamic(() => import('./variants/hero/HeroCentered')),
        split: dynamic(() => import('./variants/hero/HeroSplit')),
        // Only loaded when used
    },
};

// Benefits:
// - Initial bundle excludes unused variants
// - Each variant ~5-15KB (post-compression)
// - Total savings: ~50-100KB on initial load
```

### Database Optimization

```sql
-- Indexes for common queries
CREATE INDEX pages_slug_idx ON pages(slug);
CREATE INDEX pages_status_idx ON pages(status);
CREATE INDEX pages_nav_idx ON pages(show_in_nav, nav_order);
CREATE INDEX pages_app_idx ON pages(app_id);

CREATE INDEX page_sections_page_idx ON page_sections(page_id, sort_order);
CREATE INDEX page_features_section_idx ON page_features(section_id, sort_order);
CREATE INDEX page_actions_section_idx ON page_actions(section_id, sort_order);

-- Query pattern for /api/pages/:slug
-- Single query with JOINs (vs multiple roundtrips)
SELECT
    p.*,
    ps.*,
    pf.*,
    pa.*
FROM pages p
LEFT JOIN page_sections ps ON ps.page_id = p.id
LEFT JOIN page_features pf ON pf.section_id = ps.id
LEFT JOIN page_actions pa ON pa.section_id = ps.id
WHERE p.slug = ? AND p.status = 'published'
ORDER BY ps.sort_order, pf.sort_order, pa.sort_order;
```

### Bundle Size Targets

| Component                | Max Size (gzipped) | Current |
| ------------------------ | ------------------ | ------- |
| Admin Page Builder       | 150KB              | ~120KB  |
| Single variant component | 15KB               | ~8-12KB |
| homepage-contract pkg    | 5KB                | ~3KB    |
| SlotRenderer             | 10KB               | ~6KB    |

---

## 19. Security Considerations

### Authentication & Authorization

```typescript
// Admin routes require authentication
// File: worker/routes/router.ts
router.use('/api/ottaorm/*', authMiddleware);  // OttaORM CRUD
router.post('/api/pages/seed', authMiddleware); // Seed requires auth

// Public routes (no auth)
router.get('/api/pages/:slug', ...);  // Public page data
router.get('/api/pages/nav', ...);    // Public nav data
```

### Input Sanitization

```typescript
// All user input is sanitized before storage
function sanitizeHtml(input: string): string {
    // Remove script tags, event handlers
    return DOMPurify.sanitize(input, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
}

// Applied to: body, subtitle (markdown/HTML content)
// NOT applied to: title, label (plain text only)
```

### Preview Mode Security

```typescript
// Preview mode considerations:
// - ?preview=true bypasses status check
// - Currently no auth required (for dev convenience)
// - Production should add signed token:

// Secure preview URL generation (admin)
const previewToken = signJWT({ pageId, exp: Date.now() + 3600000 }, SECRET);
const previewUrl = `/${slug}?preview=true&token=${previewToken}`;

// Secure preview verification (frontend)
const isValidPreview = preview === 'true' && verifyJWT(token, SECRET);
```

### RBAC Integration

```typescript
// Page operations require specific permissions
const PAGE_PERMISSIONS = {
    'pages.create': ['admin', 'marketing'],
    'pages.update': ['admin', 'marketing', 'editor'],
    'pages.delete': ['admin'],
    'pages.publish': ['admin', 'marketing'],
    'pages.preview': ['admin', 'marketing', 'editor'],
};

// Check in route handler
if (!hasPermission(user, 'pages.publish')) {
    return errorResponse('Insufficient permissions', 403);
}
```

---

## 20. Testing Strategy

### Unit Tests

```typescript
// File: __tests__/models/Page.test.ts
describe('Page Model', () => {
    it('generates unique slug from title', async () => {
        const page = await Page.create({ title: 'My Landing Page' });
        expect(page.get('slug')).toMatch(/^my-landing-page(-\d+)?$/);
    });

    it('validates slug format', async () => {
        await expect(Page.create({ title: 'Test', slug: 'Invalid Slug!' })).rejects.toThrow(/slug must be lowercase/);
    });

    it('cascades delete to sections', async () => {
        const page = await Page.create({ title: 'Test' });
        await PageSection.create({ pageId: page.get('id'), slot: 'hero' });

        await page.delete();

        const sections = await PageSection.where({ pageId: page.get('id') });
        expect(sections).toHaveLength(0);
    });
});
```

### Integration Tests (API)

```typescript
// File: __tests__/api/pages.test.ts
describe('GET /api/pages/:slug', () => {
    beforeEach(async () => {
        await seedHomepage();
    });

    it('returns published page with sections', async () => {
        const res = await fetch('/api/pages/homepage');
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.page.slug).toBe('homepage');
        expect(data.sections).toBeInstanceOf(Array);
        expect(data.sections.length).toBeGreaterThan(0);
    });

    it('returns 404 for draft page without preview flag', async () => {
        await Page.create({ title: 'Draft', slug: 'draft-page', status: 'draft' });

        const res = await fetch('/api/pages/draft-page');
        expect(res.status).toBe(404);
    });

    it('returns draft page with preview=true', async () => {
        await Page.create({ title: 'Draft', slug: 'draft-page', status: 'draft' });

        const res = await fetch('/api/pages/draft-page?preview=true');
        expect(res.status).toBe(200);
    });
});
```

### Component Tests

```typescript
// File: __tests__/components/SlotRenderer.test.tsx
describe('SlotRenderer', () => {
    it('renders correct hero variant', () => {
        render(<SlotRenderer slot="hero" variant="centered" data={mockHeroData} />);
        expect(screen.getByRole('heading')).toHaveTextContent(mockHeroData.title);
    });

    it('falls back to default variant', () => {
        render(<SlotRenderer slot="hero" data={mockHeroData} />);
        // Should render centered (default) without error
        expect(screen.getByRole('heading')).toBeInTheDocument();
    });

    it('handles missing variant gracefully', () => {
        const consoleSpy = vi.spyOn(console, 'warn');
        render(<SlotRenderer slot="hero" variant="nonexistent" data={mockHeroData} />);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No component found'));
    });
});
```

### E2E Tests (Playwright)

```typescript
// File: e2e/page-builder.spec.ts
test.describe('Marketing Page Builder', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/admin/pages');
        await page.click('button:has-text("New Page")');
    });

    test('creates page and adds hero block', async ({ page }) => {
        // Add hero block from palette
        await page.click('[data-block-type="hero"]');

        // Verify block appears in canvas
        await expect(page.locator('[data-block-slot="hero"]')).toBeVisible();

        // Click block to edit
        await page.click('[data-block-slot="hero"]');

        // Fill title
        await page.fill('input[name="title"]', 'Welcome to My Site');

        // Save and verify
        await page.click('button:has-text("Save")');
        await expect(page.locator('.toast')).toHaveText(/saved/i);
    });

    test('reorders blocks via drag and drop', async ({ page }) => {
        // Add two blocks
        await page.click('[data-block-type="hero"]');
        await page.click('[data-block-type="features"]');

        // Get initial order
        const blocks = page.locator('[data-block-slot]');
        await expect(blocks.nth(0)).toHaveAttribute('data-block-slot', 'hero');
        await expect(blocks.nth(1)).toHaveAttribute('data-block-slot', 'features');

        // Drag features above hero
        await page
            .locator('[data-block-slot="features"] [data-drag-handle]')
            .dragTo(page.locator('[data-block-slot="hero"]'));

        // Verify new order
        await expect(blocks.nth(0)).toHaveAttribute('data-block-slot', 'features');
        await expect(blocks.nth(1)).toHaveAttribute('data-block-slot', 'hero');
    });

    test('previews draft page', async ({ page, context }) => {
        await page.click('[data-block-type="hero"]');

        // Click preview
        const [previewPage] = await Promise.all([context.waitForEvent('page'), page.click('a:has-text("Preview")')]);

        // Verify preview banner
        await expect(previewPage.locator('.bg-amber-500')).toContainText('Preview Mode');
    });
});
```

---

## 21. Debugging Guide

### Common Issues

#### 1. "Page not found" after creating page

**Cause**: Page status is `draft` by default.

**Solution**: Either:

- Publish the page (Settings → Status → Published)
- Use preview mode (`?preview=true`)

#### 2. Blocks not saving

**Cause**: Mutation error not shown (silent failure).

**Debug**:

```typescript
// Add to useMutation onError
onError: (error) => {
    console.error('Block save failed:', error);
    toast.error(error.message);
};
```

#### 3. Variant component not rendering

**Cause**: Dynamic import failed or variant doesn't exist.

**Debug**:

```typescript
// Check console for:
// "No component found for slot=X variant=Y"

// Verify variant exists in VARIANT_COMPONENTS
console.log(Object.keys(VARIANT_COMPONENTS.hero)); // ['centered', 'split', 'minimal']
```

#### 4. Features/Actions not appearing

**Cause**: Section ID mismatch or missing data.

**Debug**:

```bash
# Check API response
curl http://localhost:3004/api/pages/my-page | jq '.sections[].features'
```

#### 5. DnD not working

**Cause**: Missing @dnd-kit context or wrong strategy.

**Debug**:

```typescript
// Verify DndContext wraps the sortable area
<DndContext sensors={sensors} collisionDetection={closestCenter}>
    <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
        {/* blocks */}
    </SortableContext>
</DndContext>
```

### Logging Points

```typescript
// API handler
console.log('[pages] Fetching page:', { slug, preview, appId });
console.log('[pages] Found sections:', sections.length);

// Builder mutations
console.log('[builder] Adding block:', { slot, pageId });
console.log('[builder] Reordering:', { oldIndex, newIndex });

// Frontend rendering
console.log('[SlotRenderer] Rendering:', { slot, variant, hasData: !!data });
```

### Database Queries

```sql
-- Find all pages with section counts
SELECT p.*, COUNT(ps.id) as section_count
FROM pages p
LEFT JOIN page_sections ps ON ps.page_id = p.id
GROUP BY p.id;

-- Find orphan sections (no parent page)
SELECT ps.* FROM page_sections ps
LEFT JOIN pages p ON p.id = ps.page_id
WHERE p.id IS NULL;

-- Check page data integrity
SELECT
    p.slug,
    (SELECT COUNT(*) FROM page_sections WHERE page_id = p.id) as sections,
    (SELECT COUNT(*) FROM page_sections ps
     JOIN page_features pf ON pf.section_id = ps.id
     WHERE ps.page_id = p.id) as features,
    (SELECT COUNT(*) FROM page_sections ps
     JOIN page_actions pa ON pa.section_id = ps.id
     WHERE ps.page_id = p.id) as actions
FROM pages p;
```

---

## 22. Adding New Block Types

### Step-by-Step Guide

When adding a new block type (e.g., "Testimonials"):

#### 1. Add to SlotType enum

```typescript
// File: ottabase/models/PageSection.schema.ts
export type SlotType =
    // ... existing types
    'testimonials'; // ← Add new type
```

#### 2. Add to BLOCK_TYPES config

```typescript
// File: src/pages/admin/pages/pages-constants.ts
export const BLOCK_TYPES: SlotConfig[] = [
    // ... existing blocks
    {
        id: 'testimonials',
        label: 'Testimonials',
        icon: Quote,
        description: 'Customer testimonials in carousel or grid',
        supportsFeatures: true,  // Each testimonial is a "feature"
        supportsActions: false,
        singleton: false,
        defaultVariant: 'carousel',
    },
];

export const BLOCK_VARIANTS: Record<string, ...> = {
    // ... existing variants
    testimonials: [
        { id: 'carousel', label: 'Carousel' },
        { id: 'grid', label: 'Grid' },
        { id: 'single', label: 'Single Quote' },
    ],
};
```

#### 3. Create variant components

```typescript
// File: components/variants/testimonials/types.ts
export interface TestimonialItem {
    title: string;      // Person's name
    description: string; // Quote text
    imageUrl?: string;  // Avatar
    href?: string;      // Company/role link
}

export interface TestimonialsData {
    title: string;
    features: TestimonialItem[];  // Reuse "features" structure
}

// File: components/variants/testimonials/TestimonialsCarousel.tsx
export default function TestimonialsCarousel({ data }: { data: TestimonialsData }) {
    return (
        <section className="py-20">
            <h2 className="text-3xl font-bold text-center mb-12">{data.title}</h2>
            <div className="relative overflow-hidden">
                {/* Carousel implementation */}
            </div>
        </section>
    );
}
```

#### 4. Register in SlotRenderer

```typescript
// File: components/SlotRenderer.tsx
import type { TestimonialsData } from './variants/testimonials/types';

type SlotRendererProps =
    // ... existing props
    { slot: 'testimonials'; data: TestimonialsData; variant?: string };

const VARIANT_COMPONENTS = {
    // ... existing
    testimonials: {
        carousel: dynamic(() => import('./variants/testimonials/TestimonialsCarousel')),
        grid: dynamic(() => import('./variants/testimonials/TestimonialsGrid')),
        single: dynamic(() => import('./variants/testimonials/TestimonialsSingle')),
    },
};

const DEFAULT_VARIANTS = {
    // ... existing
    testimonials: 'carousel',
};
```

#### 5. Add transformation in marketing-page-content.tsx

```typescript
// File: app/[slug]/marketing-page-content.tsx
function transformSection(section: PageSectionPayload) {
    switch (slot) {
        // ... existing cases

        case 'testimonials':
            return {
                slot: 'testimonials',
                data: {
                    title: title || 'What Our Customers Say',
                    features: features.map((f) => ({
                        title: f.title, // Person's name
                        description: f.description || '',
                        imageUrl: f.imageUrl || undefined,
                        href: f.href || undefined,
                    })),
                } satisfies TestimonialsData,
            };
    }
}
```

#### 6. Update contract package

```typescript
// File: packages/homepage-contract/src/types.ts
export interface TestimonialItem {
    title: string;
    description: string;
    imageUrl: string | null;
    href: string | null;
}

export interface TestimonialsData {
    title: string;
    features: TestimonialItem[];
}
```

---

## 23. Keyboard Shortcuts & Accessibility

### Admin Builder Keyboard Shortcuts

| Shortcut       | Action                               |
| -------------- | ------------------------------------ |
| `Escape`       | Close block editor / deselect block  |
| `Delete`       | Delete selected block (with confirm) |
| `Ctrl+S`       | Force save all changes               |
| `Ctrl+Z`       | Undo (if implemented)                |
| `Ctrl+Shift+Z` | Redo (if implemented)                |
| `↑ / ↓`        | Navigate between blocks              |
| `Enter`        | Open editor for selected block       |

### Accessibility Requirements

```tsx
// Block in canvas must be focusable
<div
    role="listitem"
    tabIndex={0}
    aria-selected={isSelected}
    aria-label={`${block.slot} block: ${block.title || 'Untitled'}`}
    onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect();
        if (e.key === 'Delete') onDelete();
    }}
>

// Drag handle must have aria-label
<button
    aria-label="Drag to reorder"
    aria-roledescription="sortable"
    {...listeners}  // @dnd-kit listeners
>
    <GripVertical />
</button>

// Block palette items
<button
    role="menuitem"
    aria-label={`Add ${block.label} block`}
    disabled={block.singleton && existingBlocks.includes(block.id)}
>
```

### Screen Reader Announcements

```typescript
// Use live regions for DnD feedback
const [announcement, setAnnouncement] = useState('');

function onDragStart({ active }) {
    setAnnouncement(`Picked up ${active.data.current.slot} block`);
}

function onDragEnd({ active, over }) {
    if (over) {
        setAnnouncement(`Moved ${active.data.current.slot} block to position ${newIndex + 1}`);
    } else {
        setAnnouncement('Drag cancelled');
    }
}

// Render live region
<div aria-live="polite" aria-atomic="true" className="sr-only">
    {announcement}
</div>
```

---

## 24. Cache Invalidation Strategy

### When to Invalidate

| Event            | Invalidate                            | Method                      |
| ---------------- | ------------------------------------- | --------------------------- |
| Create page      | `['pages']` list                      | `invalidateQueries`         |
| Update page      | `['pages', pageId]`, `['pages']` list | `invalidateQueries`         |
| Delete page      | `['pages', pageId]`, `['pages']` list | `invalidateQueries`         |
| Create section   | `['page_sections', { pageId }]`       | `invalidateQueries`         |
| Update section   | `['page_sections', { pageId }]`       | `setQueryData` (optimistic) |
| Delete section   | `['page_sections', { pageId }]`       | `invalidateQueries`         |
| Reorder sections | `['page_sections', { pageId }]`       | `setQueryData` (optimistic) |
| Publish page     | Public page cache (Next.js)           | `revalidatePath`            |

### Implementation

```typescript
// Admin mutations (TanStack Query)
const createSection = useMutation({
    mutationFn: (data) => pageSectionHooks.create(data),
    onMutate: async (newSection) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries({ queryKey: ['page_sections', { pageId }] });

        // Snapshot previous value
        const previous = queryClient.getQueryData(['page_sections', { pageId }]);

        // Optimistically add new section
        queryClient.setQueryData(['page_sections', { pageId }], (old) => [
            ...old,
            { ...newSection, id: `temp-${Date.now()}` },
        ]);

        return { previous };
    },
    onError: (err, newSection, context) => {
        // Rollback on error
        queryClient.setQueryData(['page_sections', { pageId }], context.previous);
    },
    onSettled: () => {
        // Refetch to ensure consistency
        queryClient.invalidateQueries({ queryKey: ['page_sections', { pageId }] });
    },
});

// Public page cache (Next.js)
// File: worker/routes/pages.ts
export async function handleUpdatePage(context, pageId) {
    // ... update logic

    const page = await Page.find(pageId);
    if (page.get('status') === 'published') {
        // Trigger ISR revalidation
        await fetch(`${HOMEPAGE_URL}/api/revalidate?path=/${page.get('slug')}`, {
            method: 'POST',
            headers: { 'x-revalidate-secret': env.REVALIDATE_SECRET },
        });
    }
}
```

---

## 25. Rollback & Recovery Procedures

### Accidental Page Deletion

Pages are soft-deleted (status: 'archived') by default. Hard delete requires confirmation.

```typescript
// Soft delete (recoverable)
async function archivePage(pageId: string) {
    await Page.update(pageId, { status: 'archived' });
}

// Hard delete (with confirmation in UI)
async function permanentlyDeletePage(pageId: string) {
    await Page.delete(pageId); // Cascades to sections/features/actions
}

// Recovery
async function recoverPage(pageId: string) {
    await Page.update(pageId, { status: 'draft' });
}
```

### Restoring Previous Version

```typescript
// Version history (if implemented)
interface PageVersion {
    id: string;
    pageId: string;
    data: PageDataPayload; // Full snapshot
    createdAt: number;
    createdBy: string;
}

// Create version before major changes
async function createVersion(pageId: string) {
    const pageData = await fetchFullPageData(pageId);
    await PageVersion.create({
        pageId,
        data: pageData,
        createdBy: getCurrentUserId(),
    });
}

// Restore from version
async function restoreVersion(versionId: string) {
    const version = await PageVersion.find(versionId);
    const { sections, ...pageData } = version.get('data');

    // Delete current sections
    await PageSection.where({ pageId: version.get('pageId') }).delete();

    // Restore page metadata
    await Page.update(version.get('pageId'), pageData);

    // Restore sections with features/actions
    for (const section of sections) {
        const newSection = await PageSection.create({
            pageId: version.get('pageId'),
            ...section,
        });

        for (const feature of section.features) {
            await PageFeature.create({ sectionId: newSection.get('id'), ...feature });
        }

        for (const action of section.actions) {
            await PageAction.create({ sectionId: newSection.get('id'), ...action });
        }
    }
}
```

### Database Backup/Restore

```bash
# Backup D1 database (Cloudflare CLI)
wrangler d1 export OBCF_D1 --output=backup-$(date +%Y%m%d).sql

# Restore
wrangler d1 execute OBCF_D1 --file=backup-20260331.sql
```

---

## 26. Multi-Tenant Considerations

### App Isolation

Every page belongs to an `appId`. Queries must scope by appId:

```typescript
// Model method with RLS context
static async getForApp(appId: string): Promise<Page[]> {
    return this.where({ appId, status: 'published' });
}

// API handler extracts appId from context
const appId = context.appId; // From RLS context
const pages = await Page.where({ ...where, appId });
```

### Slug Uniqueness

Slugs are unique **per appId**, not globally:

```sql
-- Unique constraint in schema
CREATE UNIQUE INDEX pages_app_slug_idx ON pages(app_id, slug);
```

### Template Sharing

Pages can be marked as templates and copied across apps:

```typescript
interface PageTemplate {
    id: string;
    name: string;
    thumbnail: string;
    pageData: Omit<PageDataPayload, 'page.id' | 'page.appId'>;
}

async function createFromTemplate(templateId: string, appId: string, slug: string) {
    const template = await PageTemplate.find(templateId);
    const { sections, display } = template.get('pageData');

    const page = await Page.create({
        appId,
        slug,
        title: template.get('name'),
        ...display,
    });

    // Copy sections with features/actions
    for (const section of sections) {
        // ... create section and children
    }

    return page;
}
```

---

## 27. Analytics Integration

### Page View Tracking

```typescript
// Frontend - Fire on page render
useEffect(() => {
    trackPageView({
        pageId: pageData.page.id,
        slug: pageData.page.slug,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
    });
}, [pageData.page.id]);

// API endpoint
POST /api/analytics/pageview
{
    "pageId": "...",
    "slug": "pricing",
    "referrer": "https://google.com",
    "sessionId": "..."
}
```

### Block Performance

Track which blocks get the most engagement:

```typescript
// Track CTA clicks
function trackBlockClick(sectionId: string, actionId: string) {
    fetch('/api/analytics/click', {
        method: 'POST',
        body: JSON.stringify({ sectionId, actionId }),
    });
}

// Dashboard shows:
// - Click-through rate per CTA
// - Time on page
// - Scroll depth (which blocks are seen)
```

---

## 28. API Reference (OpenAPI Summary)

### Endpoints

| Method | Path                           | Auth? | Description                         |
| ------ | ------------------------------ | ----- | ----------------------------------- |
| GET    | `/api/pages/:slug`             | No    | Get page by slug (public + preview) |
| GET    | `/api/pages/nav`               | No    | Get nav-enabled pages               |
| POST   | `/api/pages/seed`              | Yes   | Seed default homepage               |
| GET    | `/api/ottaorm/pages`           | Yes   | List pages (admin)                  |
| POST   | `/api/ottaorm/pages`           | Yes   | Create page                         |
| PUT    | `/api/ottaorm/pages/:id`       | Yes   | Update page                         |
| DELETE | `/api/ottaorm/pages/:id`       | Yes   | Delete page                         |
| ...    | `/api/ottaorm/page_sections/*` | Yes   | Section CRUD                        |
| ...    | `/api/ottaorm/page_features/*` | Yes   | Feature CRUD                        |
| ...    | `/api/ottaorm/page_actions/*`  | Yes   | Action CRUD                         |

### Request/Response Examples

```bash
# Get public page
GET /api/pages/pricing
→ 200 { page: {...}, sections: [...], display: {...}, content: null }

# Get with preview
GET /api/pages/pricing?preview=true
→ 200 { page: { status: 'draft', ... }, ... }

# Create page (admin)
POST /api/ottaorm/pages
Content-Type: application/json
Authorization: Bearer <token>
{ "title": "New Landing Page", "slug": "new-landing" }
→ 201 { "id": "uuid...", ... }

# Update section
PUT /api/ottaorm/page_sections/section-uuid
Content-Type: application/json
Authorization: Bearer <token>
{ "title": "Updated Hero Title", "variant": "split" }
→ 200 { "id": "section-uuid", "title": "Updated Hero Title", ... }
```

---

## 29. Glossary

| Term             | Definition                                                            |
| ---------------- | --------------------------------------------------------------------- |
| **Block**        | A section of a page (hero, features, CTA). Stored as `page_sections`. |
| **Slot**         | The type of a block (`hero`, `features`, `cta`, etc.).                |
| **Variant**      | Visual style of a block (`centered`, `split`, `grid`).                |
| **Feature**      | An item within a block (a feature card, testimonial, FAQ item).       |
| **Action**       | A CTA button within a block (label, href, variant).                   |
| **Canvas**       | The drag-and-drop area showing page blocks.                           |
| **Palette**      | The sidebar showing available block types to add.                     |
| **Contract**     | Shared TypeScript types + Zod schemas between API and frontend.       |
| **Preview Mode** | Viewing a draft page via `?preview=true`.                             |
| **ISR**          | (Incremental Static Regeneration) Next.js caching strategy.           |
| **OttaORM**      | Ottabase's fat-model ORM built on Drizzle.                            |

---

_Document Version: 2.0_  
_Last Updated: March 2026_  
_Maintainer: @thinkdj_
