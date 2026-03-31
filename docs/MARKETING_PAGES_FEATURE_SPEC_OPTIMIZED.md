# Marketing Pages System — Optimized Feature Spec

> **Purpose**: Drag-and-drop marketing page builder with database-driven block rendering. For detailed docs, see
> [MARKETING_PAGES_FEATURE_SPEC.md](MARKETING_PAGES_FEATURE_SPEC.md).

---

## Quick Start

| What                    | Location                                      |
| ----------------------- | --------------------------------------------- |
| **Database Schema**     | [Section 3](#3-database-schema)               |
| **OttaORM Models**      | [Section 4](#4-models)                        |
| **API Endpoints**       | [Section 5](#5-api-routes)                    |
| **Admin UI Build**      | [Section 7](#7-admin-ui)                      |
| **UI/UX Requirements**  | [Section 9](#9-uiux-requirements)             |
| **Implementation Plan** | [Section 10](#10-implementation)              |
| **Security & Auth**     | [Section 11](#11-security--authentication)    |
| **Cache Strategy**      | [Section 12](#12-cache-invalidation-strategy) |
| **Testing**             | [Section 13](#13-testing-strategy)            |
| **Debugging**           | [Section 14](#14-debugging-checklist)         |

---

## 1. System Overview

### Architecture Diagram

```
Admin UI (TanStack) → Worker API (Cloudflare) → D1 SQLite
                         ↓
                   Next.js Homepage
                   (Dynamic [slug] route)
```

### Key Concepts

- **Blocks**: Reusable content sections (hero, features, CTA, testimonials)
- **Variants**: Visual presentations of blocks (centered vs split, grid vs carousel)
- **Slot Pattern**: Single data structure, multiple renderers
- **Preview Mode**: Draft pages visible via `?preview=true`

---

## 2. Database Schema (4 Tables)

### pages

```sql
CREATE TABLE pages (
    id TEXT PRIMARY KEY,
    appId TEXT NOT NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'published' | 'archived'
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    UNIQUE(appId, slug)
);
```

### page_sections

```sql
CREATE TABLE page_sections (
    id TEXT PRIMARY KEY,
    pageId TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    slot TEXT NOT NULL, -- 'hero', 'features', 'cta', etc.
    variant TEXT NOT NULL,
    title TEXT,
    subtitle TEXT,
    body TEXT,
    enabled INTEGER DEFAULT 1,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);
```

### page_features & page_actions

```sql
CREATE TABLE page_features (
    id TEXT PRIMARY KEY,
    sectionId TEXT NOT NULL REFERENCES page_sections(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    link TEXT,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL
);

CREATE TABLE page_actions (
    id TEXT PRIMARY KEY,
    sectionId TEXT NOT NULL REFERENCES page_sections(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    href TEXT NOT NULL,
    variant TEXT DEFAULT 'default',
    icon TEXT,
    external INTEGER DEFAULT 0,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL
);
```

---

## 3. OttaORM Models

### Page Model

```typescript
export class Page extends BaseModel {
    static entity = 'pages';
    static table = pagesTable;
    static primaryKey = 'id';

    // Methods
    async sections() {
        return PageSection.where({ pageId: this.get('id') });
    }

    publish() {
        this.set('status', 'published');
        return this.save();
    }

    draft() {
        this.set('status', 'draft');
        return this.save();
    }
}
```

### PageSection Model

```typescript
export class PageSection extends BaseModel {
    static entity = 'page_sections';
    static table = pageSectionsTable;

    async features() {
        return PageFeature.where({ sectionId: this.get('id') }).orderBy('sortOrder');
    }

    async actions() {
        return PageAction.where({ sectionId: this.get('id') }).orderBy('sortOrder');
    }

    static async getForPage(pageId: string) {
        return this.where({ pageId }).orderBy('sortOrder');
    }
}
```

### PageFeature & PageAction Models

```typescript
export class PageFeature extends BaseModel {
    static entity = 'page_features';
    static table = pageFeaturesTable;

    static async getForSection(sectionId: string) {
        return this.where({ sectionId }).orderBy('sortOrder');
    }
}

export class PageAction extends BaseModel {
    static entity = 'page_actions';
    static table = pageActionsTable;

    static async getForSection(sectionId: string) {
        return this.where({ sectionId }).orderBy('sortOrder');
    }
}
```

---

## 4. API Routes

### Public Routes

| Method | Endpoint           | Purpose                                    |
| ------ | ------------------ | ------------------------------------------ |
| GET    | `/api/pages/:slug` | Fetch page + sections + features + actions |
| GET    | `/api/pages/nav`   | Nav-enabled pages only                     |

### Admin CRUD (Auto-generated by OttaORM)

| Method   | Endpoint                     | Purpose       |
| -------- | ---------------------------- | ------------- |
| GET      | `/api/ottaorm/pages`         | List pages    |
| POST     | `/api/ottaorm/pages`         | Create page   |
| PUT      | `/api/ottaorm/pages/:id`     | Update page   |
| DELETE   | `/api/ottaorm/pages/:id`     | Delete page   |
| GET/POST | `/api/ottaorm/page_sections` | Sections CRUD |
| GET/POST | `/api/ottaorm/page_features` | Features CRUD |
| GET/POST | `/api/ottaorm/page_actions`  | Actions CRUD  |

---

## 5. Contract Package

### TypeScript Types

```typescript
// @ottabase/marketing-pages-contract

export type PageStatus = 'draft' | 'published' | 'archived';
export type BlockSlot = 'hero' | 'features' | 'cta' | 'testimonials' | 'navbar' | 'footer';
export type ActionVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link';

export interface PageRow {
    id: string;
    appId: string;
    slug: string;
    title: string;
    status: PageStatus;
    createdAt: number;
    updatedAt: number;
}

export interface PageSectionRow {
    id: string;
    pageId: string;
    slot: BlockSlot;
    variant: string;
    title?: string;
    subtitle?: string;
    body?: string;
    enabled: boolean;
    sortOrder: number;
}

export interface PageFeatureRow {
    id: string;
    sectionId: string;
    title: string;
    description?: string;
    icon?: string;
    link?: string;
    sortOrder: number;
}

export interface PageActionRow {
    id: string;
    sectionId: string;
    label: string;
    href: string;
    variant: ActionVariant;
    icon?: string;
    external: boolean;
    sortOrder: number;
}
```

### Zod Schemas (Runtime Validation)

```typescript
export const pageSchema = z.object({
    title: z.string().min(1).max(100),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    status: z.enum(['draft', 'published', 'archived']),
});

export const pageSectionSchema = z.object({
    slot: z.string(),
    variant: z.string(),
    title: z.string().max(200).nullable(),
    enabled: z.boolean(),
    sortOrder: z.number(),
});

export const pageActionSchema = z.object({
    label: z.string().min(1).max(50),
    href: z.string().url().or(z.string().startsWith('/')),
    variant: z.enum(['primary', 'secondary', 'outline', 'ghost', 'link']),
});
```

---

## 6. Admin UI Architecture

### Page 1: Pages List

```
┌─────────────────────────────────────┐
│  [+ New Page]  [Search...]    ⋮⋮⋮   │
├─────────────────────────────────────┤
│ Title        | Status    | Updated  │
│ Home         | Published | 2h ago   │
│ Pricing      | Draft     | 1d ago   │
│ About        | Published | 1w ago   │
└─────────────────────────────────────┘
```

### Page 2: Page Builder (Main)

```
┌──────────────────────────────────────────────────────┐
│ [← Pages]  Page Title  [Preview] [⚙️ Settings] [Save] │
├────────────────────┬─────────────────────────────────┤
│ Block Palette (30%)│ Canvas (70%)                     │
├────────────────────┼─────────────────────────────────┤
│ ⬜ Hero            │ ┌─────────────────────────────┐ │
│ ⬜ Features        │ │ [Hero] ≡                    │ │
│ ⬜ CTA             │ │ "Welcome to..."             │ │
│ ⬜ Testimonials    │ └─────────────────────────────┘ │
│ ⬜ Navbar          │ ┌─────────────────────────────┐ │
│ ⬜ Footer          │ │ [Features] ≡                │ │
│                    │ │ • Feature 1, 2, 3          │ │
│                    │ └─────────────────────────────┘ │
│                    │  [+ Add Block]                  │
└────────────────────┴─────────────────────────────────┘
```

### Block Editor (Sheet Panel)

```
┌──────────────────────────────────────┐
│ ✕ Edit Block                         │
├──────────────────────────────────────┤
│ Title                                │
│ [Welcome to...........................] │
│                                      │
│ Subtitle                             │
│ [Subheading text...................]  │
│                                      │
│ Variant         [Centered ▼]         │
│                                      │
│ Background Image [Upload]            │
│                                      │
│ Actions         [+ Add Button]       │
│ • Get Started                        │
│ • Learn More                         │
│                                      │
│              [Cancel] [Save]         │
└──────────────────────────────────────┘
```

### Key Components

- **BlockPalette**: Scrollable list of available blocks
- **Canvas**: Drag-and-drop sortable grid
- **BlockCard**: Individual block in canvas with inline preview
- **BlockEditor**: Form sheet for editing block data
- **FeatureManager**: Inline CRUD for features within a block
- **ActionManager**: Inline CRUD for buttons/actions within a block

---

## 7. Next.js Frontend

### Dynamic Route

```typescript
// app/[slug]/page.tsx
export async function generateStaticParams() {
    const pages = await fetch(`${API_URL}/api/pages/nav`).then(r => r.json());
    return pages.map(p => ({ slug: p.slug }));
}

export default async function Page({ params }: { params: { slug: string } }) {
    const preview = searchParams.preview === 'true';
    const page = await fetch(`${API_URL}/api/pages/${params.slug}?preview=${preview}`).then(r => r.json());

    return (
        <>
            {page.status === 'draft' && <DraftBanner />}
            {page.sections.map(section => (
                <SlotRenderer key={section.id} slot={section.slot} data={section} variant={section.variant} />
            ))}
        </>
    );
}
```

### SlotRenderer (Discriminated Union)

```typescript
export function SlotRenderer({ slot, data, variant }: SlotRendererProps) {
    const componentMap: Record<BlockSlot, React.ComponentType<any>> = {
        hero: variant === 'centered' ? HeroCentered : variant === 'split' ? HeroSplit : HeroMinimal,
        features: variant === 'grid' ? FeaturesGrid : variant === 'list' ? FeaturesList : FeaturesCards,
        cta: CTAButton,
        testimonials: TestimonialCarousel,
        navbar: Navbar,
        footer: Footer,
    };

    const Component = componentMap[slot];
    return Component ? <Component data={data} /> : <div>Unknown slot: {slot}</div>;
}
```

---

## 8. Block Registry System

### Goal

Apps register custom blocks at runtime without code deployment or DB migrations.

### API (Simplified)

```typescript
// In Next.js app startup
import { BlockRegistry } from '@ottabase/block-registry';

const registry = BlockRegistry.getInstance();

registry.register({
    id: 'hero',
    label: 'Hero Section',
    category: 'layout',
    fields: {
        title: { type: 'text', required: true },
        subtitle: { type: 'text' },
        backgroundImage: { type: 'image' },
        actions: { type: 'list' },
    },
    variants: [
        { id: 'centered', label: 'Centered' },
        { id: 'split', label: 'Split' },
    ],
});
```

### Discovery Endpoint

```
GET /api/blocks → Admin UI discovers all available blocks
```

---

## 9. UX Flows

### Create Page

1. Click **[+ New Page]**
2. Enter title and slug
3. Redirected to **Page Builder**
4. Empty canvas with block palette

### Add & Edit Blocks

1. Drag block from palette to canvas
2. Double-click block title to edit inline
3. Click block to open **Block Editor** sheet
4. Edit fields, features, actions
5. Auto-saves with debounce

### Reorder Blocks

1. Drag block by grab handle
2. Visual feedback with opacity change
3. On drop, `sortOrder` values updated

### Publish

1. Click **[Settings]** → **Publish**
2. Confirm slug & SEO fields
3. Page now live at `/{slug}`

---

## 9. UI/UX Requirements

### 9.1 Accessibility (A11y)

**Keyboard Navigation**: | Key | Action | |-----|--------| | `Escape` | Close block editor / deselect block | | `Delete`
| Delete selected block (confirm) | | `Ctrl+S` | Save all changes | | `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / Redo | |
`↑ / ↓` | Navigate between blocks | | `Enter` | Open editor for selected block | | `Tab` | Focus next field |

**ARIA Requirements**:

```tsx
// Blocks must be focusable with semantic roles
<div
    role="listitem"
    tabIndex={0}
    aria-selected={isSelected}
    aria-label={`${block.slot} block: ${block.title || 'Untitled'}`}
/>

// Drag handle with aria-label
<button aria-label="Drag to reorder" aria-roledescription="sortable">
    <GripVertical />
</button>

// Live regions for announcements
<div aria-live="polite" aria-atomic="true" className="sr-only">
    Moved block to position {index + 1}
</div>
```

---

### 9.2 Validation Rules

```typescript
// Page-level validation
- title: required, 1-100 chars
- slug: required, lowercase+numbers+hyphens, must be unique per app
- status: 'draft' | 'published' | 'archived'

// Block-level validation
- Block title: optional, max 200 chars
- Block subtitle: optional, max 500 chars
- Block body: optional, max 10,000 chars

// Features validation (within blocks)
- title: required, 1-100 chars
- description: optional, max 500 chars
- icon: optional (text name or Lucide icon ID)
- link: optional (valid URL or internal route)

// Actions validation (buttons within blocks)
- label: required, 1-50 chars
- href: required, valid URL or starts with /
- variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link'
- icon: optional (Lucide icon name)
- external: toggle (open in new tab)
```

**Error Messages**:

```tsx
// Field-level inline errors
<input value={title} />;
{
    errors.title && <span className="text-red-500 text-sm">{errors.title}</span>;
}

// Slug availability check (real-time)
<input value={slug} onBlur={() => checkSlugAvailable(slug)} />;
{
    slugError && <span className="text-red-500">{slugError}</span>;
}
```

---

### 9.3 Error Handling

| Error            | HTTP | Message                               | Action           |
| ---------------- | ---- | ------------------------------------- | ---------------- |
| Page not found   | 404  | "Page not found"                      | Show 404 page    |
| Slug exists      | 409  | "A page with this URL already exists" | Focus slug field |
| Validation error | 400  | Field-specific message                | Highlight field  |
| DB error         | 500  | "Something went wrong. Try again."    | Retry button     |
| Rate limited     | 429  | "Too many requests. Wait a moment."   | Auto-retry       |
| Unauthorized     | 403  | "You don't have permission"           | Refresh auth     |

**UI Pattern**:

```tsx
// Toast notifications for all errors
if (error) {
    toast.error(error.message, { duration: 5000 });
}

// Inline validation errors on field blur
<input
    onBlur={() => {
        const result = schema.safeParse(formData);
        if (!result.success) {
            setErrors(result.error.flatten().fieldErrors);
        }
    }}
/>;
```

---

### 9.4 Loading & Empty States

**Skeleton Loading**:

```tsx
// Pages list loading
<div className="space-y-3">
    {[1, 2, 3].map(i => (
        <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
    ))}
</div>

// Block editor loading
<Sheet open={isLoading}>
    <div className="space-y-4 p-4">
        <div className="h-10 bg-gray-200 rounded animate-pulse" />
        <div className="h-20 bg-gray-200 rounded animate-pulse" />
    </div>
</Sheet>
```

**Empty States**:

```tsx
// Empty pages list
<div className="text-center py-12">
    <FileText size={48} className="mx-auto opacity-30 mb-4" />
    <p className="text-gray-600 mb-4">No pages yet. Start by creating one.</p>
    <button onClick={createPage}>+ New Page</button>
</div>

// Empty canvas
<div className="flex flex-col items-center justify-center h-96 bg-gray-50 rounded border-2 border-dashed">
    <p className="text-gray-600 mb-4">No blocks yet. Add one from the palette →</p>
    <button onClick={() => selectBlock('hero')}>Add Hero Section</button>
</div>
```

---

### 9.5 Visual Feedback & Interactions

**Drag & Drop Feedback**:

```tsx
// Active state during drag
{
    isActive && <div className="opacity-50 bg-blue-100 rounded" />;
}

// Hover feedback
<button className="hover:bg-gray-100 active:scale-95 transition" />;

// Drop zone indication
{
    isOver && <div className="bg-blue-50 border-2 border-blue-400" />;
}

// Animated feedback
<MotionDiv initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
    Block added
</MotionDiv>;
```

**Confirmation Dialogs**:

```tsx
// Delete confirmation
<AlertDialog>
    <AlertDialogTitle>Delete block?</AlertDialogTitle>
    <AlertDialogDescription>
        This action cannot be undone. The block and all its features/actions will be deleted permanently.
    </AlertDialogDescription>
    <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
    <AlertDialogCancel>Cancel</AlertDialogCancel>
</AlertDialog>

// Publish confirmation
<Dialog>
    <DialogTitle>Publish page?</DialogTitle>
    <p>This will make the page live at <code>/{slug}</code></p>
    <button onClick={publishPage}>Publish</button>
</Dialog>
```

---

### 9.6 Responsive Design

**Viewport Preview** (in builder):

```
┌─────────────────────────────┐
│ [📱 Mobile]  [Tablet]  [🖥️ Desktop] │
├─────────────────────────────┤
│  ┌─────────┐                │
│  │ 375px   │  (Phone)      │
│  │ Preview │                │
│  └─────────┘                │
└─────────────────────────────┘
```

**Responsive Canvas Preview**:

- **Mobile**: 375px × auto (full height)
- **Tablet**: 768px × auto
- **Desktop**: 1200px × auto

**Block Palette Behavior**:

- Desktop: Fixed left sidebar (250px) + canvas (70%)
- Tablet: Collapsible sidebar + canvas
- Mobile: Drawer mode (swipe from left)

---

### 9.7 Toast & Notification Patterns

```tsx
// Success
toast.success('Page published!', { icon: '✓' });

// Error
toast.error('Failed to save block', { duration: 5000 });

// Loading
toast.loading('Publishing page...', { id: 'publish' });
// Later: toast.update('publish', { type: 'success', description: 'Published!' });

// Info
toast.info('Pages are cached for 60 seconds', { duration: 3000 });
```

---

### 9.8 Form States

```tsx
// Disabled state during submission
<button disabled={isSaving} className="opacity-50 cursor-not-allowed">
    {isSaving ? 'Saving...' : 'Save'}
</button>

// Required field indicator
<label>
    Title
    <span className="text-red-500 ml-1" aria-label="required">*</span>
    <input required aria-required="true" />
</label>

// Focused field highlight
<input
    className="focus:ring-2 focus:ring-blue-500 focus:border-transparent"
/>
```

---

## 10. Implementation Roadmap

### Phase 1: Database & Models (2-3 hours)

- [ ] Create 4 tables in `apps/*/ottabase/db/schema.ts`
- [ ] Create model classes with relationships
- [ ] Register in `worker/lib/db-utils.ts`
- [ ] Run migration: `curl -X POST http://localhost:3004/api/ottaorm/init`

### Phase 2: Contract Package (1 hour)

- [ ] Create `@ottabase/marketing-pages-contract`
- [ ] Export TypeScript types + Zod schemas

### Phase 3: Worker API (Basic CRUD) (2 hours)

- [ ] Models auto-generate CRUD via OttaORM
- [ ] Add public endpoint `/api/pages/:slug`
- [ ] Add preview mode support

### Phase 4: Admin UI - Pages List (2 hours)

- [ ] Create pages list with create/delete/duplicate
- [ ] Add search and filtering

### Phase 5: Admin UI - Builder (6-8 hours)

- [ ] Block palette component
- [ ] Canvas with @dnd-kit
- [ ] Block card component
- [ ] Block editor sheet
- [ ] Features & actions managers
- [ ] Page settings dialog

### Phase 6: Next.js Frontend (2-3 hours)

- [ ] Dynamic route `app/[slug]/page.tsx`
- [ ] SlotRenderer with variant dispatch
- [ ] Render all block variants
- [ ] Preview banner for drafts

### Phase 7: Polish (2 hours)

- [ ] Loading states, empty states, error handling
- [ ] Tests for models, API, components

**Total: ~18-20 hours for MVP**

---

## 10.6 Quick UX Wins (Priority)

| Feature                 | Effort  | Impact | Do First? |
| ----------------------- | ------- | ------ | --------- |
| Block icons             | 30 min  | High   | ✅ **P0** |
| Duplicate page          | 15 min  | High   | ✅ **P0** |
| Empty state UI          | 30 min  | High   | **P1**    |
| Field validation errors | 30 min  | High   | **P1**    |
| Publish preview         | 30 min  | Medium | **P1**    |
| Inline title edit       | 1 hour  | Medium | **P2**    |
| Undo/Redo               | 2 hours | High   | **P2**    |
| Keyboard shortcuts      | 1 hour  | Medium | **P3**    |

**Recommendation**: Ship 45 min of P0 features immediately, then P1 features in iteration 2.

---

## 11. Security & Authentication

**Admin Routes Require Auth**:

```typescript
// All mutation endpoints protected
router.use('/api/ottaorm/*', authMiddleware);
router.post('/api/pages/seed', authMiddleware);

// Public routes (no auth)
router.get('/api/pages/:slug', ...);  // Public data
router.get('/api/pages/nav', ...);    // Nav data
```

**Input Sanitization**:

```typescript
// Sanitize rich text fields (body, subtitle)
import DOMPurify from 'dompurify';

function sanitizeHtml(input: string) {
    return DOMPurify.sanitize(input, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
}
```

**Preview Mode Security**:

```typescript
// Development: Simple flag bypass
GET /api/pages/my-page?preview=true

// Production: Use signed token
const token = signJWT({ pageId, exp: Date.now() + 3600000 }, SECRET);
GET /api/pages/:slug?preview=true&token={token}
```

**RBAC (Role-Based Access)**:

```typescript
const PAGE_PERMISSIONS = {
    'pages.create': ['admin', 'marketing'],
    'pages.update': ['admin', 'marketing', 'editor'],
    'pages.delete': ['admin'],
    'pages.publish': ['admin', 'marketing'],
};

if (!hasPermission(user, 'pages.publish')) {
    return errorResponse('Insufficient permissions', 403);
}
```

---

## 12. Cache Invalidation Strategy

**Invalidation Triggers**:

| Event            | Invalidate                      | Method                      |
| ---------------- | ------------------------------- | --------------------------- |
| Create page      | `['pages']` list                | `invalidateQueries`         |
| Update page      | `['pages', pageId]` + list      | `setQueryData`              |
| Delete page      | `['pages', pageId]` + list      | `invalidateQueries`         |
| Create section   | `['page_sections', { pageId }]` | `setQueryData`              |
| Reorder sections | `['page_sections', { pageId }]` | `setQueryData` (optimistic) |
| Publish page     | Public page cache               | `revalidatePath` (Next.js)  |

**Optimistic Updates** (instant UI feedback without spinners):

```typescript
const updateSection = useMutation({
    mutationFn: (data) => api.updateSection(data),
    onMutate: async (newData) => {
        // Cancel outgoing fetches
        await queryClient.cancelQueries(['page_sections', { pageId }]);

        // Save previous state
        const previous = queryClient.getQueryData(['page_sections', { pageId }]);

        // Update UI immediately
        queryClient.setQueryData(['page_sections', { pageId }], (old) =>
            old.map((s) => (s.id === newData.id ? newData : s)),
        );

        return { previous };
    },
    onError: (err, newData, context) => {
        // Rollback on error
        queryClient.setQueryData(['page_sections', { pageId }], context.previous);
        toast.error('Failed to save');
    },
});
```

---

## 13. Testing Strategy

**Unit Tests** (Models):

```typescript
describe('Page Model', () => {
    it('validates slug format', async () => {
        await expect(Page.create({ title: 'Test', slug: 'Invalid Slug!' })).rejects.toThrow(/lowercase/);
    });

    it('cascades delete to sections', async () => {
        const page = await Page.create({ title: 'Test' });
        await PageSection.create({ pageId: page.id, slot: 'hero' });
        await page.delete();

        const sections = await PageSection.where({ pageId: page.id });
        expect(sections).toHaveLength(0);
    });
});
```

**Integration Tests** (API):

```typescript
describe('Pages API', () => {
    it('returns 404 for draft page (non-preview)', async () => {
        await Page.create({ title: 'Draft', slug: 'draft', status: 'draft' });
        const res = await fetch('/api/pages/draft');
        expect(res.status).toBe(404);
    });

    it('returns 200 for published page', async () => {
        await Page.create({ title: 'Live', slug: 'live', status: 'published' });
        const res = await fetch('/api/pages/live');
        expect(res.status).toBe(200);
    });
});
```

**E2E Tests** (Playwright):

```typescript
test('create and publish page flow', async ({ page }) => {
    await page.goto('/admin/pages');
    await page.click('[data-test=new-page-btn]');

    await page.fill('[data-test=page-title]', 'My Page');
    await page.fill('[data-test=page-slug]', 'my-page');
    await page.click('[data-test=save-btn]');

    // Add block
    await page.click('[data-test=add-hero-btn]');
    await page.click('[data-test=settings-btn]');

    // Publish
    await page.click('[data-test=publish-btn]');
    await page.click('[data-test=confirm-publish]');

    // Verify live
    const response = await page.goto('/my-page');
    expect(response?.status()).toBe(200);
});
```

---

## 14. Debugging Checklist

| Issue                         | Debug                                     | Solution                                       |
| ----------------------------- | ----------------------------------------- | ---------------------------------------------- |
| "Page not found" after create | Check status                              | Page is `draft`; preview or publish it         |
| Blocks not saving             | Browser console, network tab              | Look for mutation errors; add error logging    |
| Variant not rendering         | Browser console                           | Verify variant in `VARIANT_COMPONENTS` map     |
| Features/actions missing      | `curl /api/pages/slug\|jq '.sections[0]'` | Check sectionId matches DB                     |
| DnD not working               | React DevTools                            | Verify `<DndContext>` wraps sortable area      |
| Build fails                   | `pnpm lint && pnpm type-check`            | Fix TypeScript errors first                    |
| Slow builder                  | React Profiler                            | Check for re-render thrashing; use memoization |

---

## 15. Key Technical Decisions

| Decision                         | Rationale                                            |
| -------------------------------- | ---------------------------------------------------- |
| **4 normalized tables**          | Clean separation, cascade deletes, efficient queries |
| **Slot + Variant pattern**       | Write data once, render via any visual variant       |
| **Shared contract package**      | Single source of truth, type safety end-to-end       |
| **@dnd-kit for DnD**             | Modern, accessible, React 18+ compatible             |
| **Preview mode via query param** | Simple, stateless                                    |
| **OttaORM for CRUD**             | Consistent with codebase, auto-hooks                 |
| **Dynamic block registry**       | Extensible without code deployment                   |

---

## 16. File Paths

```
Admin UI (TanStack):
├── src/pages/admin/pages/
│   ├── AdminPagesListPage.tsx
│   ├── AdminPageBuilderPage.tsx
│   └── components/
│       ├── BlockPalette.tsx
│       ├── BlockCanvas.tsx
│       ├── BlockCard.tsx
│       ├── BlockEditor.tsx
│       ├── FeatureManager.tsx
│       └── ActionManager.tsx
├── hooks/pageHooks.ts (CRUD hooks)

Next.js App:
├── app/[slug]/page.tsx
├── app/[slug]/marketing-page-content.tsx
├── components/SlotRenderer.tsx
├── components/variants/
│   ├── hero/ (HeroCentered, HeroSplit, etc.)
│   ├── features/ (FeaturesGrid, etc.)
│   └── ... (other block variants)
├── lib/api.ts

Models & DB (OttaBase):
├── ottabase/db/schema.ts
├── ottabase/models/
│   ├── Page.ts
│   ├── PageSection.ts
│   ├── PageFeature.ts
│   └── PageAction.ts

Package:
└── @ottabase/marketing-pages-contract/
    └── src/
        ├── types.ts
        ├── schemas.ts
        └── index.ts
```

---

## 17. Error Handling

| Error               | Status | Response                           |
| ------------------- | ------ | ---------------------------------- |
| Page not found      | 404    | `{ error: "Page not found" }`      |
| Slug already exists | 409    | `{ error: "Slug in use" }`         |
| Invalid slot type   | 400    | `{ error: "Invalid slot: xyz" }`   |
| Validation failed   | 422    | `{ error: "...", details: {...} }` |
| Unauthorized        | 403    | `{ error: "Access denied" }`       |

**Use `errorResponse()` from `@ottabase/utils/http-errors`**

---

## 18. Performance Targets

| Metric                  | Target  |
| ----------------------- | ------- |
| Page render (cached)    | < 100ms |
| Page render (cold)      | < 300ms |
| Builder drag operations | < 50ms  |
| Create page → publish   | < 5 min |
| Admin load page data    | < 50ms  |

**Caching**: ISR 60s for public pages, TanStack Query 30-60s for admin

---

## 19. Quick Reference: Block Types (MVP)

```
Layout:  Hero, Features, CTA, Testimonials, Gallery
Nav:     Navbar, Footer
Custom:  Form, Video, Code, Text, Image, Spacer
```

Each block has **2-3 variants** (e.g., Hero: centered/split/minimal).

---

## 20. RLS (Row-Level Security)

All pages scoped to `appId` via OttaORM. No manual permission checks needed.

```typescript
// @ottabase/ottaorm automatically enforces
Export allowCrossAppAccess(false); // Default
```

---

## 21. Testing Checklist

- [ ] Models: CRUD, relationships, validation
- [ ] API: Status codes, error messages, authorization
- [ ] Admin UI: Add, edit, delete, reorder blocks
- [ ] Frontend: All block variants render correctly
- [ ] E2E: Create page → publish → access public URL

---

## 22. Deployment Notes

- **D1 migrations**: Auto-run on `/api/ottaorm/init` (idempotent)
- **ISR invalidation**: Trigger on page publish via `revalidatePath()`
- **No env vars needed**: Uses Cloudflare bindings directly
- **Multi-tenant**: RLS handles isolation automatically

---

## References

- [Full Specification](MARKETING_PAGES_FEATURE_SPEC.md) (4000+ lines, all details)
- OttaORM: `@ottabase/ottaorm`
- UI Components: `@ottabase/ui-shadcn`
- DnD Kit: `@dnd-kit/core`
